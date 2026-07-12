import { recordActivityEvent } from "@/lib/activity-events";
import { Api } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { dispatchNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { deleteCacheByPrefix } from "@/lib/redis-cache";
import { AllocateAssetSchema, AllocationListQuerySchema } from "@/types/allocation-types";
import type { Prisma } from "@prisma/client";

function canAllocate(role: string): boolean {
  return role === "ADMIN" || role === "ASSET_MANAGER";
}

export async function GET(req: Request) {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();

    const searchParams = new URL(req.url).searchParams;
    const validation = AllocationListQuerySchema.safeParse({
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      scope: searchParams.get("scope") ?? undefined,
      overdue: searchParams.get("overdue") ?? undefined,
    });
    if (!validation.success) return Api.badRequest("Invalid query", validation.error.format());
    const { page, limit, scope, overdue } = validation.data;
    const skip = (page - 1) * limit;

    const where: Prisma.AllocationWhereInput = { asset: { orgId: user.orgId } };
    if (overdue) {
      where.returnedAt = null;
      where.expectedReturnDate = { lt: new Date() };
    }

    const requestedScope = scope === "all" && !canAllocate(user.role) && user.role !== "DEPARTMENT_HEAD" ? "mine" : scope;

    if (requestedScope === "mine") {
      where.toEmployeeId = user.id;
    } else if (requestedScope === "department") {
      if (!user.departmentId) return Api.ok([], { total: 0, page, limit, totalPages: 1 });
      where.OR = [{ toDepartmentId: user.departmentId }, { toEmployee: { departmentId: user.departmentId } }];
    }
    // requestedScope === "all": no additional filter — Asset Manager/Admin see every allocation in the org.

    const [rows, total] = await Promise.all([
      prisma.allocation.findMany({
        where,
        orderBy: { allocatedAt: "desc" },
        skip,
        take: limit,
        include: {
          asset: { select: { id: true, assetTag: true, name: true, status: true } },
          toEmployee: { select: { id: true, name: true } },
          toDepartment: { select: { id: true, name: true } },
        },
      }),
      prisma.allocation.count({ where }),
    ]);

    return Api.ok(rows, { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) });
  } catch (error) {
    logger.error("allocations.list.failed", error, { requestId });
    return Api.internalError("Failed to load allocations");
  }
}

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();
    if (!canAllocate(user.role)) return Api.forbidden("Only Asset Managers and Admins can allocate assets");

    const body = await req.json().catch(() => null);
    const validation = AllocateAssetSchema.safeParse(body);
    if (!validation.success) return Api.badRequest("Invalid allocation data", validation.error.format());
    const { assetId, toEmployeeId, toDepartmentId, expectedReturnDate } = validation.data;

    const asset = await prisma.asset.findFirst({ where: { id: assetId, orgId: user.orgId } });
    if (!asset) return Api.notFound("Asset not found");
    if (asset.isBookable) {
      return Api.badRequest("This asset is a shared bookable resource — use Resource Booking instead");
    }

    const existingActive = await prisma.allocation.findFirst({
      where: { assetId, status: "ACTIVE" },
      include: {
        toEmployee: { select: { name: true } },
        toDepartment: { select: { name: true } },
      },
    });
    if (existingActive) {
      const holder = existingActive.toEmployee?.name ?? existingActive.toDepartment?.name ?? "another holder";
      const dept = existingActive.toDepartment?.name ?? "";
      return Api.conflict(
        `Already Allocated to ${holder}${dept ? ` (${dept})` : ""} — Direct re-allocation is blocked, submit a transfer request below.`,
        { code: "ASSET_ALREADY_ALLOCATED" },
      );
    }

    const allocation = await prisma.$transaction(async (tx) => {
      const created = await tx.allocation.create({
        data: {
          assetId,
          toEmployeeId,
          toDepartmentId,
          allocatedById: user.id,
          expectedReturnDate: expectedReturnDate ?? null,
        },
      });
      await tx.asset.update({ where: { id: assetId }, data: { status: "ALLOCATED" } });
      return created;
    });

    void deleteCacheByPrefix(`assets:list:${user.orgId}:`);
    void recordActivityEvent({
      orgId: user.orgId,
      action: "asset.allocated",
      actorId: user.id,
      entityType: "allocation",
      entityId: allocation.id,
      metadata: { assetTag: asset.assetTag, toEmployeeId, toDepartmentId },
    });
    void (async () => {
      const recipientId = toEmployeeId
        ? toEmployeeId
        : toDepartmentId
          ? (await prisma.department.findUnique({ where: { id: toDepartmentId }, select: { headId: true } }))
              ?.headId
          : null;
      if (!recipientId) return;
      void dispatchNotification({
        recipientIds: [recipientId],
        type: "ASSET_ASSIGNED",
        title: `${asset.assetTag} — ${asset.name} has been assigned to you`,
        relatedEntityType: "allocation",
        relatedEntityId: allocation.id,
      });
    })();
    logger.info("allocations.create", { requestId, id: allocation.id, assetId });

    return Api.created(allocation);
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return Api.conflict(
        "Already Allocated — Direct re-allocation is blocked, submit a transfer request below.",
        { code: "ASSET_ALREADY_ALLOCATED" },
      );
    }
    logger.error("allocations.create.failed", error, { requestId });
    return Api.internalError("Failed to allocate asset");
  }
}
