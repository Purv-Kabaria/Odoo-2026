import { recordActivityEvent } from "@/lib/activity-events";
import { Api } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const IdSchema = z.object({ id: z.string().cuid() });

function canDecide(role: string): boolean {
  return role === "ADMIN" || role === "ASSET_MANAGER" || role === "DEPARTMENT_HEAD";
}

export async function POST(_req: Request, props: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();
    if (!canDecide(user.role)) return Api.forbidden();

    const params = await props.params;
    const idResult = IdSchema.safeParse(params);
    if (!idResult.success) return Api.badRequest("Invalid transfer id");

    const transfer = await prisma.transferRequest.findFirst({
      where: { id: idResult.data.id, asset: { orgId: user.orgId } },
    });
    if (!transfer) return Api.notFound("Transfer request not found");
    if (transfer.status !== "REQUESTED") return Api.badRequest("This transfer has already been decided");

    const result = await prisma.transferRequest.updateMany({
      where: { id: transfer.id, status: "REQUESTED" },
      data: { status: "REJECTED", approvedById: user.id, decidedAt: new Date() },
    });
    if (result.count !== 1) return Api.badRequest("This transfer has already been decided");

    void recordActivityEvent({
      orgId: user.orgId,
      action: "transfer.rejected",
      actorId: user.id,
      entityType: "transfer",
      entityId: transfer.id,
      metadata: { assetId: transfer.assetId },
    });
    logger.info("transfers.reject", { requestId, id: transfer.id });

    return Api.ok({ id: transfer.id, status: "REJECTED" });
  } catch (error) {
    logger.error("transfers.reject.failed", error, { requestId });
    return Api.internalError("Failed to reject transfer");
  }
}
