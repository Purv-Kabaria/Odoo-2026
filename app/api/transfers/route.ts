import { recordActivityEvent } from "@/lib/activity-events";
import { Api } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { deleteCacheByPrefix, getJsonCache, setJsonCache } from "@/lib/redis-cache";
import { TransferRequestCreateSchema } from "@/types/allocation-types";
import type { Prisma } from "@prisma/client";

const CACHE_PREFIX = "transfers:list:";

function canApprove(role: string): boolean {
  return role === "ADMIN" || role === "ASSET_MANAGER" || role === "DEPARTMENT_HEAD";
}

export async function GET(req: Request) {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();
    if (!canApprove(user.role)) return Api.forbidden();

    const searchParams = new URL(req.url).searchParams;
    const statusParam = searchParams.get("status");

    const where: Prisma.TransferRequestWhereInput = { asset: { orgId: user.orgId } };
    if (statusParam) where.status = statusParam as Prisma.TransferRequestWhereInput["status"];

    if (user.role === "DEPARTMENT_HEAD") {
      const headed = await prisma.department.findMany({ where: { headId: user.id }, select: { id: true } });
      const headedIds = headed.map((d) => d.id);
      where.asset = {
        orgId: user.orgId,
        allocations: {
          some: {
            status: "ACTIVE",
            OR: [{ toDepartmentId: { in: headedIds } }, { toEmployee: { departmentId: { in: headedIds } } }],
          },
        },
      };
    }

    // Cache key includes userId since a Department Head's results are
    // scoped to the department(s) they head, which differs per caller.
    const cacheKey = `${CACHE_PREFIX}${user.orgId}:${JSON.stringify({ userId: user.id, role: user.role, status: statusParam })}`;
    const cached = await getJsonCache<unknown[]>(cacheKey);
    if (cached) return Api.ok(cached);

    const rows = await prisma.transferRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        asset: { select: { id: true, assetTag: true, name: true } },
        fromEmployee: { select: { id: true, name: true } },
        toEmployee: { select: { id: true, name: true } },
        requestedBy: { select: { id: true, name: true } },
      },
    });

    void setJsonCache(cacheKey, rows);

    return Api.ok(rows);
  } catch (error) {
    logger.error("transfers.list.failed", error, { requestId });
    return Api.internalError("Failed to load transfer requests");
  }
}

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();

    const body = await req.json().catch(() => null);
    const validation = TransferRequestCreateSchema.safeParse(body);
    if (!validation.success) return Api.badRequest("Invalid transfer request", validation.error.format());
    const { assetId, toEmployeeId, reason } = validation.data;

    const asset = await prisma.asset.findFirst({ where: { id: assetId, orgId: user.orgId } });
    if (!asset) return Api.notFound("Asset not found");

    // The transfer target must belong to the caller's own org — otherwise
    // an asset could be transferred to a foreign-org employee.
    const targetEmployee = await prisma.user.findFirst({ where: { id: toEmployeeId, orgId: user.orgId } });
    if (!targetEmployee) return Api.badRequest("Target employee not found in your organization");

    const activeAllocation = await prisma.allocation.findFirst({ where: { assetId, status: "ACTIVE" } });
    if (!activeAllocation) return Api.badRequest("This asset is not currently allocated to anyone");

    const transfer = await prisma.transferRequest.create({
      data: {
        assetId,
        fromEmployeeId: activeAllocation.toEmployeeId,
        toEmployeeId,
        requestedById: user.id,
        reason,
      },
    });

    void deleteCacheByPrefix(`${CACHE_PREFIX}${user.orgId}:`);
    void recordActivityEvent({
      orgId: user.orgId,
      action: "transfer.requested",
      actorId: user.id,
      entityType: "transfer",
      entityId: transfer.id,
      metadata: { assetTag: asset.assetTag },
    });
    logger.info("transfers.create", { requestId, id: transfer.id, assetId });

    return Api.created(transfer);
  } catch (error) {
    logger.error("transfers.create.failed", error, { requestId });
    return Api.internalError("Failed to submit transfer request");
  }
}
