import { recordActivityEvent } from "@/lib/activity-events";
import { Api } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { deleteCacheByPrefix, getJsonCache, setJsonCache } from "@/lib/redis-cache";
import { KitCreateSchema, KitListQuerySchema } from "@/types/kit-types";

// Prisma over the Node driver, never Edge — same reasoning as every other
// route here that touches the database.
export const runtime = "nodejs";

const CACHE_PREFIX = "kits:list:";

function canAllocate(role: string): boolean {
  return role === "ADMIN" || role === "ASSET_MANAGER";
}

export async function GET(req: Request) {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();

    const searchParams = new URL(req.url).searchParams;
    const validation = KitListQuerySchema.safeParse({
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });
    if (!validation.success) return Api.badRequest("Invalid query", validation.error.format());
    const { page, limit } = validation.data;
    const skip = (page - 1) * limit;

    const cacheKey = `${CACHE_PREFIX}${user.orgId}:${JSON.stringify({ page, limit })}`;
    const cached = await getJsonCache<{ rows: unknown[]; total: number }>(cacheKey);
    if (cached) {
      return Api.ok(cached.rows, {
        total: cached.total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(cached.total / limit)),
      });
    }

    const [rows, total] = await Promise.all([
      prisma.assetKit.findMany({
        where: { orgId: user.orgId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          description: true,
          createdAt: true,
          createdBy: { select: { id: true, name: true } },
          _count: { select: { items: true } },
        },
      }),
      prisma.assetKit.count({ where: { orgId: user.orgId } }),
    ]);

    void setJsonCache(cacheKey, { rows, total });

    return Api.ok(rows, { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) });
  } catch (error) {
    logger.error("kits.list.failed", error, { requestId });
    return Api.internalError("Failed to load kits");
  }
}

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();
    if (!canAllocate(user.role)) return Api.forbidden("Only Asset Managers and Admins can create kits");

    const body = await req.json().catch(() => null);
    const validation = KitCreateSchema.safeParse(body);
    if (!validation.success) return Api.badRequest("Invalid kit data", validation.error.format());
    const { name, description, assetIds } = validation.data;

    // Single batched lookup, not a per-id query, to confirm every asset
    // exists, belongs to this org, and isn't a shared bookable resource
    // (kits are for direct allocation — same rule the single-asset
    // allocate endpoint enforces).
    const assets = await prisma.asset.findMany({
      where: { id: { in: assetIds }, orgId: user.orgId },
      select: { id: true, assetTag: true, name: true, isBookable: true },
    });
    if (assets.length !== assetIds.length) {
      const found = new Set(assets.map((a) => a.id));
      const missing = assetIds.filter((id) => !found.has(id));
      return Api.badRequest("Some assets were not found in your organization", { missingAssetIds: missing });
    }
    const bookable = assets.filter((a) => a.isBookable);
    if (bookable.length > 0) {
      return Api.badRequest(
        "Kits can only contain directly-allocatable assets — shared bookable resources use Resource Booking instead",
        { bookableAssets: bookable.map((a) => ({ id: a.id, assetTag: a.assetTag, name: a.name })) },
      );
    }

    const kit = await prisma.assetKit.create({
      data: {
        orgId: user.orgId,
        name,
        description: description ?? null,
        createdById: user.id,
        items: { create: assetIds.map((assetId) => ({ assetId })) },
      },
      include: { _count: { select: { items: true } } },
    });

    void deleteCacheByPrefix(`${CACHE_PREFIX}${user.orgId}:`);
    void recordActivityEvent({
      orgId: user.orgId,
      action: "kit.created",
      actorId: user.id,
      entityType: "asset_kit",
      entityId: kit.id,
      metadata: { name: kit.name, itemCount: assetIds.length },
    });
    logger.info("kits.create", { requestId, id: kit.id, itemCount: assetIds.length });

    return Api.created(kit);
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return Api.conflict("A kit with this name already exists", { code: "KIT_NAME_TAKEN" });
    }
    logger.error("kits.create.failed", error, { requestId });
    return Api.internalError("Failed to create kit");
  }
}
