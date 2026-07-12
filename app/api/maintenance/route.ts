import { recordActivityEvent } from "@/lib/activity-events";
import { Api } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { deleteCacheByPrefix, getJsonCache, setJsonCache } from "@/lib/redis-cache";
import { MaintenanceListQuerySchema, MaintenanceRequestCreateSchema } from "@/types/maintenance-types";
import type { Prisma } from "@prisma/client";

const CACHE_PREFIX = "maintenance:list:";

function canManage(role: string): boolean {
  return role === "ADMIN" || role === "ASSET_MANAGER";
}

export async function GET(req: Request) {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();

    const searchParams = new URL(req.url).searchParams;
    const validation = MaintenanceListQuerySchema.safeParse({
      status: searchParams.get("status") ?? undefined,
    });
    if (!validation.success) return Api.badRequest("Invalid query", validation.error.format());
    const { status: statusParam } = validation.data;

    const where: Prisma.MaintenanceRequestWhereInput = { asset: { orgId: user.orgId } };
    if (statusParam) {
      where.status = statusParam;
    } else if (canManage(user.role)) {
      where.status = { not: "REJECTED" };
    }
    if (!canManage(user.role)) {
      // Full kanban view is Asset Manager/Admin; everyone else sees only
      // what they raised or are the assigned technician for — this must
      // apply regardless of whether a status filter is present, or a
      // non-manager could see every org-wide request via ?status=X.
      where.OR = [{ raisedById: user.id }, { technicianId: user.id }];
    }

    // Cache key includes userId since non-manager results are scoped to
    // "raised by or assigned to me", which differs per caller.
    const cacheKey = `${CACHE_PREFIX}${user.orgId}:${JSON.stringify({ userId: user.id, role: user.role, status: statusParam })}`;
    const cached = await getJsonCache<unknown[]>(cacheKey);
    if (cached) return Api.ok(cached);

    const rows = await prisma.maintenanceRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        asset: { select: { id: true, assetTag: true, name: true, status: true, acquisitionCost: true } },
        raisedBy: { select: { id: true, name: true } },
        technician: { select: { id: true, name: true } },
      },
    });

    void setJsonCache(cacheKey, rows);

    return Api.ok(rows);
  } catch (error) {
    logger.error("maintenance.list.failed", error, { requestId });
    return Api.internalError("Failed to load maintenance requests");
  }
}

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();

    const body = await req.json().catch(() => null);
    const validation = MaintenanceRequestCreateSchema.safeParse(body);
    if (!validation.success) return Api.badRequest("Invalid maintenance request", validation.error.format());
    const { assetId, description, priority, photoUrl } = validation.data;

    const asset = await prisma.asset.findFirst({ where: { id: assetId, orgId: user.orgId } });
    if (!asset) return Api.notFound("Asset not found");

    const request_ = await prisma.maintenanceRequest.create({
      data: { assetId, raisedById: user.id, description, priority, photoUrl: photoUrl ?? null },
    });

    void deleteCacheByPrefix(`${CACHE_PREFIX}${user.orgId}:`);
    void recordActivityEvent({
      orgId: user.orgId,
      action: "maintenance.raised",
      actorId: user.id,
      entityType: "maintenance",
      entityId: request_.id,
      metadata: { assetTag: asset.assetTag, priority },
    });
    logger.info("maintenance.create", { requestId, id: request_.id, assetId });

    return Api.created(request_);
  } catch (error) {
    logger.error("maintenance.create.failed", error, { requestId });
    return Api.internalError("Failed to raise maintenance request");
  }
}
