import { NextResponse } from "next/server";
import { z } from "zod";

import { recordActivityEvent } from "@/lib/activity-events";
import { Api } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { deleteObject, getObject } from "@/lib/object-storage";
import { prisma } from "@/lib/prisma";

const ParamsSchema = z.object({
  id: z.uuid("Invalid object identifier"),
});

function canAccess(role: string, userId: string, uploadedById: string): boolean {
  return role === "ADMIN" || role === "MODERATOR" || userId === uploadedById;
}

export async function GET(
  _req: Request,
  props: { params: Promise<{ id: string }> },
) {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();

    const params = await props.params;
    const validation = ParamsSchema.safeParse(params);
    if (!validation.success) {
      return Api.badRequest("Invalid object identifier", validation.error.format());
    }

    const object = await prisma.objectAsset.findUnique({
      where: { id: validation.data.id },
    });
    if (!object) return Api.notFound("Object not found");
    if (!canAccess(user.role, user.id, object.uploadedById)) {
      return Api.forbidden("You do not have permission to download this object");
    }

    const stored = await getObject(object.key);
    if (!stored?.body) {
      return Api.serviceUnavailable("The object is not currently available for download.");
    }

    return new NextResponse(stored.body, {
      headers: {
        "Content-Type": stored.contentType,
        "Content-Disposition": `attachment; filename="${object.filename.replaceAll('"', '')}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    logger.error("storage.download.failed", error, { requestId });
    return Api.internalError("Failed to download object");
  }
}

export async function DELETE(
  _req: Request,
  props: { params: Promise<{ id: string }> },
) {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();

    const params = await props.params;
    const validation = ParamsSchema.safeParse(params);
    if (!validation.success) {
      return Api.badRequest("Invalid object identifier", validation.error.format());
    }

    const object = await prisma.objectAsset.findUnique({
      where: { id: validation.data.id },
    });
    if (!object) return Api.noContent();
    if (!canAccess(user.role, user.id, object.uploadedById)) {
      return Api.forbidden("You do not have permission to delete this object");
    }

    await prisma.objectAsset.delete({ where: { id: object.id } });
    void deleteObject(object.key);
    void recordActivityEvent({
      action: "STORAGE_DELETED",
      actorId: user.id,
      entityType: "objectAsset",
      entityId: object.id,
      summary: `Deleted ${object.filename}`,
      requestId,
      metadata: {
        contentType: object.contentType,
        sizeBytes: object.sizeBytes,
      },
    });

    logger.info("storage.delete", {
      requestId,
      userId: user.id,
      objectId: object.id,
    });

    return Api.noContent();
  } catch (error) {
    logger.error("storage.delete.failed", error, { requestId });
    return Api.internalError("Failed to delete object");
  }
}
