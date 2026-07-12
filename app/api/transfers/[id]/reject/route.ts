import { recordActivityEvent } from "@/lib/activity-events";
import { Api } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { dispatchNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { deleteCacheByPrefix } from "@/lib/redis-cache";
import { z } from "zod";
import type { User } from "@prisma/client";

const IdSchema = z.object({ id: z.string().uuid() });

// Mirrors approve/route.ts's canApproveTransfer — a Department Head may only
// decide transfers whose current holder belongs to a department they head,
// not any transfer org-wide.
async function canDecideTransfer(
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

export async function POST(_req: Request, props: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();

    const params = await props.params;
    const idResult = IdSchema.safeParse(params);
    if (!idResult.success) return Api.badRequest("Invalid transfer id");

    const transfer = await prisma.transferRequest.findFirst({
      where: { id: idResult.data.id, asset: { orgId: user.orgId } },
    });
    if (!transfer) return Api.notFound("Transfer request not found");
    if (transfer.status !== "REQUESTED") return Api.badRequest("This transfer has already been decided");

    if (!(await canDecideTransfer(user, transfer.fromEmployeeId))) {
      return Api.forbidden("You can only reject transfers within your own department");
    }

    const result = await prisma.transferRequest.updateMany({
      where: { id: transfer.id, status: "REQUESTED" },
      data: { status: "REJECTED", approvedById: user.id, decidedAt: new Date() },
    });
    if (result.count !== 1) return Api.badRequest("This transfer has already been decided");

    void deleteCacheByPrefix(`transfers:list:${user.orgId}:`);
    void recordActivityEvent({
      orgId: user.orgId,
      action: "transfer.rejected",
      actorId: user.id,
      entityType: "transfer",
      entityId: transfer.id,
      metadata: { assetId: transfer.assetId },
    });
    void (async () => {
      const asset = await prisma.asset.findUnique({ where: { id: transfer.assetId }, select: { assetTag: true } });
      void dispatchNotification({
        recipientIds: [transfer.requestedById],
        type: "TRANSFER_REJECTED",
        title: `Transfer rejected: ${asset?.assetTag ?? "asset"}`,
        relatedEntityType: "transfer",
        relatedEntityId: transfer.id,
      });
    })();
    logger.info("transfers.reject", { requestId, id: transfer.id });

    return Api.ok({ id: transfer.id, status: "REJECTED" });
  } catch (error) {
    logger.error("transfers.reject.failed", error, { requestId });
    return Api.internalError("Failed to reject transfer");
  }
}
