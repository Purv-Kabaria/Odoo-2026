import { recordActivityEvent } from "@/lib/activity-events";
import { Api } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { assetSearchConfig } from "@/lib/entities/assets";
import { logger } from "@/lib/logger";
import { searchIds, upsertInSearch } from "@/lib/meilisearch";
import { prisma } from "@/lib/prisma";
import { deleteCacheByPrefix, getJsonCache, setJsonCache } from "@/lib/redis-cache";
import { AssetCreateSchema, AssetListQuerySchema } from "@/types/asset-types";
import type { Prisma } from "@prisma/client";

const CACHE_PREFIX = "assets:list:";

function canManageAssets(role: string): boolean {
  return role === "ADMIN" || role === "ASSET_MANAGER";
}

export async function GET(req: Request) {
  const startedAt = performance.now();
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();

    const searchParams = new URL(req.url).searchParams;
    const validation = AssetListQuerySchema.safeParse({
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      q: searchParams.get("q") ?? undefined,
      category: searchParams.get("category") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      departmentId: searchParams.get("departmentId") ?? undefined,
      location: searchParams.get("location") ?? undefined,
    });
    if (!validation.success) {
      return Api.badRequest("Invalid query", validation.error.format());
    }
    const { page, limit, q, category, status, departmentId, location } = validation.data;
    const skip = (page - 1) * limit;

    const cacheKey = `${CACHE_PREFIX}${user.orgId}:${JSON.stringify({ page, limit, q, category, status, departmentId, location })}`;
    const cached = await getJsonCache<{ rows: unknown[]; total: number }>(cacheKey);
    if (cached) {
      return Api.ok(cached.rows, {
        total: cached.total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(cached.total / limit)),
      });
    }

    const meiliIds = q ? await searchIds(assetSearchConfig, q, Math.min(1000, Math.max(limit * page, 50))) : null;

    const where: Prisma.AssetWhereInput = { orgId: user.orgId };
    if (meiliIds !== null) {
      where.id = { in: meiliIds };
    } else if (q) {
      where.OR = [
        { assetTag: { equals: q.toUpperCase() } },
        { serialNumber: { equals: q } },
        { name: { contains: q, mode: "insensitive" } },
      ];
    }
    if (category) where.categoryId = category;
    if (status) where.status = status;
    if (location) where.location = { contains: location, mode: "insensitive" };
    if (departmentId) {
      where.allocations = {
        some: {
          status: "ACTIVE",
          OR: [{ toDepartmentId: departmentId }, { toEmployee: { departmentId } }],
        },
      };
    }

    const [rows, total] = await Promise.all([
      prisma.asset.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          assetTag: true,
          name: true,
          status: true,
          location: true,
          isBookable: true,
          condition: true,
          category: { select: { id: true, name: true } },
        },
      }),
      prisma.asset.count({ where }),
    ]);

    void setJsonCache(cacheKey, { rows, total });

    logger.info("assets.list", {
      requestId,
      durationMs: Math.round(performance.now() - startedAt),
      count: rows.length,
      total,
    });

    return Api.ok(rows, { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) });
  } catch (error) {
    logger.error("assets.list.failed", error, { requestId });
    return Api.internalError("Failed to load assets");
  }
}

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();
    if (!canManageAssets(user.role)) {
      return Api.forbidden("Only Asset Managers and Admins can register assets");
    }

    const body = await req.json().catch(() => null);
    const validation = AssetCreateSchema.safeParse(body);
    if (!validation.success) {
      return Api.badRequest("Invalid asset data", validation.error.format());
    }
    const data = validation.data;

    const category = await prisma.assetCategory.findFirst({
      where: { id: data.categoryId, orgId: user.orgId },
    });
    if (!category) return Api.badRequest("Category not found");

    const fieldSchema = Array.isArray(category.fieldSchema)
      ? (category.fieldSchema as { key: string; label: string; type: string; required?: boolean }[])
      : [];
    const declaredKeys = new Set(fieldSchema.map((f) => f.key));
    const customFields = data.customFields ?? {};
    for (const key of Object.keys(customFields)) {
      if (!declaredKeys.has(key)) {
        return Api.badRequest(`"${key}" is not a declared field for this category`);
      }
    }
    for (const field of fieldSchema) {
      if (field.required && (customFields[field.key] === undefined || customFields[field.key] === null)) {
        return Api.badRequest(`"${field.label}" is required for this category`);
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.update({
        where: { id: user.orgId },
        data: { assetSeq: { increment: 1 } },
        select: { assetSeq: true },
      });
      const assetTag = `AF-${String(org.assetSeq).padStart(4, "0")}`;

      return tx.asset.create({
        data: {
          orgId: user.orgId,
          assetTag,
          name: data.name,
          categoryId: data.categoryId,
          serialNumber: data.serialNumber ?? null,
          acquisitionDate: data.acquisitionDate ?? null,
          acquisitionCost: data.acquisitionCost ?? null,
          condition: data.condition,
          location: data.location ?? null,
          photoUrl: data.photoUrl ?? null,
          isBookable: data.isBookable,
          customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
        },
      });
    });

    void upsertInSearch(assetSearchConfig, [created]);
    void deleteCacheByPrefix(`${CACHE_PREFIX}${user.orgId}:`);
    void recordActivityEvent({
      orgId: user.orgId,
      action: "asset.registered",
      actorId: user.id,
      entityType: "asset",
      entityId: created.id,
      metadata: { assetTag: created.assetTag, name: created.name },
    });
    logger.info("assets.create", { requestId, id: created.id, assetTag: created.assetTag });

    return Api.created(created);
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return Api.conflict("An asset with this serial number already exists");
    }
    logger.error("assets.create.failed", error, { requestId });
    return Api.internalError("Failed to register asset");
  }
}
