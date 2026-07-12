import { recordActivityEvent } from "@/lib/activity-events";
import { Api } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { TransferRequestCreateSchema } from "@/types/allocation-types";
import type { Prisma } from "@prisma/client";

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
