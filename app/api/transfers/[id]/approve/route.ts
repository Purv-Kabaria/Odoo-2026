import { recordActivityEvent } from "@/lib/activity-events";
import { Api } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getIdempotentResponse, idempotencyKeyFor, setIdempotentResponse } from "@/lib/idempotency";
import { logger } from "@/lib/logger";
import { dispatchNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { deleteCacheByPrefix } from "@/lib/redis-cache";
import { z } from "zod";
import type { User } from "@prisma/client";

const IdSchema = z.object({ id: z.string().uuid() });

async function canApproveTransfer(
  user: Pick<User, "id" | "role" | "orgId">,
  fromEmployeeId: string | null,
): Promise<boolean> {
  if (user.role === "ADMIN" || user.role === "ASSET_MANAGER") return true;
  if (user.role !== "DEPARTMENT_HEAD" || !fromEmployeeId) return false;

  const holder = await prisma.user.findUnique({ where: { id: fromEmployeeId }, select: { departmentId: true } });
  if (!holder?.departmentId) return false;

  const headedDept = await prisma.department.findFirst({
    where: { id: holder.departmentId, headId: user.id },
  });
  return Boolean(headedDept);
}

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();

    const params = await props.params;
    const idResult = IdSchema.safeParse(params);
    if (!idResult.success) return Api.badRequest("Invalid transfer id");

    const idempotencyKey = idempotencyKeyFor(req, user.id, `transfer-approve:${idResult.data.id}`);
    const cached = await getIdempotentResponse(idempotencyKey);
    if (cached) return Api.ok(cached, { idempotent: true });

    const transfer = await prisma.transferRequest.findFirst({
      where: { id: idResult.data.id, asset: { orgId: user.orgId } },
    });
    if (!transfer) return Api.notFound("Transfer request not found");
    if (transfer.status !== "REQUESTED") return Api.badRequest("This transfer has already been decided");

    if (!(await canApproveTransfer(user, transfer.fromEmployeeId))) {
      return Api.forbidden("You can only approve transfers within your own department");
    }

    const result = await prisma.$transaction(async (tx) => {
      const guarded = await tx.transferRequest.updateMany({
        where: { id: transfer.id, status: "REQUESTED" },
        data: { status: "COMPLETED", approvedById: user.id, decidedAt: new Date() },
      });
      if (guarded.count !== 1) return null;

      await tx.allocation.updateMany({
        where: { assetId: transfer.assetId, status: "ACTIVE" },
        data: { status: "RETURNED", returnedAt: new Date() },
      });
      await tx.allocation.create({
        data: {
          assetId: transfer.assetId,
          toEmployeeId: transfer.toEmployeeId,
          allocatedById: user.id,
        },
      });
      await tx.asset.update({ where: { id: transfer.assetId }, data: { status: "ALLOCATED" } });

      return tx.transferRequest.findUnique({ where: { id: transfer.id } });
    });

    if (!result) return Api.badRequest("This transfer has already been decided");

    void deleteCacheByPrefix(`assets:list:${user.orgId}:`);
    void deleteCacheByPrefix(`allocations:list:${user.orgId}:`);
    void deleteCacheByPrefix(`transfers:list:${user.orgId}:`);
    void recordActivityEvent({
      orgId: user.orgId,
      action: "transfer.approved",
      actorId: user.id,
      entityType: "transfer",
      entityId: transfer.id,
      metadata: { assetId: transfer.assetId },
    });
    void (async () => {
      const asset = await prisma.asset.findUnique({ where: { id: transfer.assetId }, select: { assetTag: true } });
      void dispatchNotification({
        recipientIds: [transfer.toEmployeeId],
        type: "TRANSFER_APPROVED",
        title: `Transfer approved: ${asset?.assetTag ?? "asset"} is now yours`,
        relatedEntityType: "transfer",
        relatedEntityId: transfer.id,
      });
    })();
    void setIdempotentResponse(idempotencyKey, result);
    logger.info("transfers.approve", { requestId, id: transfer.id });

    return Api.ok(result);
  } catch (error) {
    logger.error("transfers.approve.failed", error, { requestId });
    return Api.internalError("Failed to approve transfer");
  }
}
