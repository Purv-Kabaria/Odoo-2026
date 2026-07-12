import { recordActivityEvent } from "@/lib/activity-events";
import { Api } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { AuditCycleCreateSchema, AuditCycleListQuerySchema } from "@/types/audit-types";
import type { Prisma } from "@prisma/client";

function canManageAudits(role: string): boolean {
  return role === "ADMIN";
}

export async function GET(req: Request) {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();

    const searchParams = new URL(req.url).searchParams;
    const validation = AuditCycleListQuerySchema.safeParse({
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      status: searchParams.get("status") ?? undefined,
    });
    if (!validation.success) return Api.badRequest("Invalid query", validation.error.format());
    const { page, limit, status } = validation.data;
    const skip = (page - 1) * limit;

    const where: Prisma.AuditCycleWhereInput = { orgId: user.orgId };
    if (status) where.status = status;
    // Non-admins only see cycles they're assigned to audit.
    if (user.role !== "ADMIN") {
      where.auditors = { some: { auditorId: user.id } };
    }

    const [rows, total] = await Promise.all([
      prisma.auditCycle.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          createdBy: { select: { id: true, name: true } },
          scopeDept: { select: { id: true, name: true } },
          auditors: { include: { auditor: { select: { id: true, name: true } } } },
          _count: { select: { items: true } },
        },
      }),
      prisma.auditCycle.count({ where }),
    ]);

    return Api.ok(rows, { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) });
  } catch (error) {
    logger.error("audit_cycles.list.failed", error, { requestId });
    return Api.internalError("Failed to load audit cycles");
  }
}

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();
    if (!canManageAudits(user.role)) return Api.forbidden("Only Admins can create audit cycles");

    const body = await req.json().catch(() => null);
    const validation = AuditCycleCreateSchema.safeParse(body);
    if (!validation.success) return Api.badRequest("Invalid audit cycle data", validation.error.format());
    const { name, scopeDeptId, scopeLocation, startDate, endDate, auditorIds } = validation.data;

    if (scopeDeptId) {
      const dept = await prisma.department.findFirst({ where: { id: scopeDeptId, orgId: user.orgId } });
      if (!dept) return Api.badRequest("Department not found");
    }
    const auditors = await prisma.user.findMany({ where: { id: { in: auditorIds }, orgId: user.orgId } });
    if (auditors.length !== auditorIds.length) return Api.badRequest("One or more auditors not found");

    const assetWhere: Prisma.AssetWhereInput = { orgId: user.orgId, status: { not: "DISPOSED" } };
    if (scopeDeptId) {
      assetWhere.allocations = {
        some: { status: "ACTIVE", OR: [{ toDepartmentId: scopeDeptId }, { toEmployee: { departmentId: scopeDeptId } }] },
      };
    } else if (scopeLocation) {
      assetWhere.location = { equals: scopeLocation, mode: "insensitive" };
    }
    const inScopeAssets = await prisma.asset.findMany({ where: assetWhere, select: { id: true } });
    if (inScopeAssets.length === 0) {
      return Api.badRequest("No assets match this audit scope");
    }

    const cycle = await prisma.$transaction(async (tx) => {
      const created = await tx.auditCycle.create({
        data: {
          orgId: user.orgId,
          name,
          scopeDeptId: scopeDeptId ?? null,
          scopeLocation: scopeLocation ?? null,
          startDate,
          endDate,
          createdById: user.id,
        },
      });
      await tx.auditAssignment.createMany({
        data: auditorIds.map((auditorId) => ({ cycleId: created.id, auditorId })),
      });
      await tx.auditItem.createMany({
        data: inScopeAssets.map((asset) => ({ cycleId: created.id, assetId: asset.id })),
      });
      await tx.auditCycle.update({ where: { id: created.id }, data: { status: "IN_PROGRESS" } });
      return created;
    });

    void recordActivityEvent({
      orgId: user.orgId,
      action: "audit.cycle_created",
      actorId: user.id,
      entityType: "audit_cycle",
      entityId: cycle.id,
      metadata: { name, assetCount: inScopeAssets.length, auditorCount: auditors.length },
    });
    logger.info("audit_cycles.create", { requestId, id: cycle.id, assetCount: inScopeAssets.length });

    return Api.created(cycle);
  } catch (error) {
    logger.error("audit_cycles.create.failed", error, { requestId });
    return Api.internalError("Failed to create audit cycle");
  }
}
