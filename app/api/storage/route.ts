import { z } from "zod";

import { recordActivityEvent } from "@/lib/activity-events";
import { Api } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { env } from "@/lib/env";
import {
  getIdempotentResponse,
  parseIdempotencyKey,
  setIdempotentResponse,
} from "@/lib/idempotency";
import { logger } from "@/lib/logger";
import { deleteObject, objectStorageConfigured, putObject } from "@/lib/object-storage";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const STORAGE_UPLOAD_LIMIT = 20;
const STORAGE_UPLOAD_WINDOW_MS = 60 * 1000;
const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/csv",
]);

const ListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(5000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

function canSeeAll(role: string): boolean {
  return role === "ADMIN" || role === "MODERATOR";
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 140) || "upload";
}

export async function GET(req: Request) {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();

    const searchParams = new URL(req.url).searchParams;
    const validation = ListQuerySchema.safeParse({
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });

    if (!validation.success) {
      return Api.badRequest("Invalid storage query", validation.error.format());
    }

    const { page, limit } = validation.data;
    const where = canSeeAll(user.role) ? {} : { uploadedById: user.id };
    const skip = (page - 1) * limit;

    const [objects, total] = await Promise.all([
      prisma.objectAsset.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          filename: true,
          contentType: true,
          sizeBytes: true,
          createdAt: true,
          uploadedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      prisma.objectAsset.count({ where }),
    ]);

    return Api.ok(objects, {
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) {
    logger.error("storage.list.failed", error, { requestId });
    return Api.internalError("Failed to load stored objects");
  }
}

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  let uploadedKey: string | null = null;

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();

    if (!objectStorageConfigured()) {
      return Api.serviceUnavailable("Object storage is not configured.");
    }

    const idempotency = parseIdempotencyKey(req, user.id, "storage-upload");
    if (!idempotency.success) return Api.badRequest(idempotency.message);
    const idempotencyKey = idempotency.key;
    const cached = await getIdempotentResponse<{
      id: string;
      filename: string;
      contentType: string;
      sizeBytes: number;
      createdAt: string;
    }>(idempotencyKey);
    if (cached) return Api.created(cached);

    const rateLimit = await checkRateLimit(
      `storage-upload:${getClientIp(req)}:${user.id}`,
      STORAGE_UPLOAD_LIMIT,
      STORAGE_UPLOAD_WINDOW_MS,
    );
    if (!rateLimit.success) {
      logger.warn("storage.upload.rate_limited", { requestId, userId: user.id });
      return Api.tooManyRequests(
        "Too many uploads. Try again shortly.",
        (rateLimit.resetAt - Date.now()) / 1000,
      );
    }

    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) {
      return Api.badRequest("A file is required");
    }

    if (file.size <= 0 || file.size > env.STORAGE_MAX_UPLOAD_BYTES) {
      return Api.badRequest(
        `File must be between 1 byte and ${env.STORAGE_MAX_UPLOAD_BYTES} bytes`,
      );
    }

    if (!ALLOWED_CONTENT_TYPES.has(file.type)) {
      return Api.badRequest("This file type is not allowed");
    }

    const filename = sanitizeFilename(file.name);
    const key = `${user.id}/${crypto.randomUUID()}-${filename}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = await putObject({
      key,
      body: buffer,
      contentType: file.type,
    });

    if (!stored) {
      return Api.serviceUnavailable("Object storage is temporarily unavailable.");
    }
    uploadedKey = key;

    const object = await prisma.objectAsset.create({
      data: {
        key,
        filename,
        contentType: file.type,
        sizeBytes: file.size,
        uploadedById: user.id,
      },
      select: {
        id: true,
        filename: true,
        contentType: true,
        sizeBytes: true,
        createdAt: true,
      },
    });

    logger.info("storage.upload", {
      requestId,
      userId: user.id,
      objectId: object.id,
      sizeBytes: object.sizeBytes,
    });

    void recordActivityEvent({
      action: "STORAGE_UPLOADED",
      actorId: user.id,
      entityType: "objectAsset",
      entityId: object.id,
      summary: `Uploaded ${filename}`,
      requestId,
      metadata: {
        contentType: file.type,
        sizeBytes: file.size,
      },
    });

    void setIdempotentResponse(idempotencyKey, object);
    return Api.created(object);
  } catch (error) {
    if (uploadedKey) void deleteObject(uploadedKey);
    logger.error("storage.upload.failed", error, { requestId });
    return Api.internalError("Failed to upload object");
  }
}
