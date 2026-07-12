import { recordActivityEvent } from "@/lib/activity-events";
import { Api } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const IdSchema = z.object({ id: z.string().cuid() });

function canDecide(role: string): boolean {
  return role === "ADMIN" || role === "ASSET_MANAGER";
}

export async function POST(_req: Request, props: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();
    if (!canDecide(user.role)) return Api.forbidden("Only Asset Managers and Admins can approve maintenance requests");

    const params = await props.params;
    const idResult = IdSchema.safeParse(params);
    if (!idResult.success) return Api.badRequest("Invalid maintenance request id");

    const request_ = await prisma.maintenanceRequest.findFirst({
      where: { id: idResult.data.id, asset: { orgId: user.orgId } },
    });
    if (!request_) return Api.notFound("Maintenance request not found");
    if (request_.status !== "PENDING") return Api.badRequest("This request has already been decided");

    const updated = await prisma.$transaction(async (tx) => {
      const guarded = await tx.maintenanceRequest.updateMany({
        where: { id: request_.id, status: "PENDING" },
        data: { status: "APPROVED", approvedById: user.id, approvedAt: new Date() },
      });
      if (guarded.count !== 1) return null;
      await tx.asset.update({ where: { id: request_.assetId }, data: { status: "UNDER_MAINTENANCE" } });
      return tx.maintenanceRequest.findUnique({ where: { id: request_.id } });
    });
    if (!updated) return Api.badRequest("This request has already been decided");

    void recordActivityEvent({
      orgId: user.orgId,
      action: "maintenance.approved",
      actorId: user.id,
      entityType: "maintenance",
      entityId: request_.id,
      metadata: {},
    });
    logger.info("maintenance.approve", { requestId, id: request_.id });

    return Api.ok(updated);
  } catch (error) {
    logger.error("maintenance.approve.failed", error, { requestId });
    return Api.internalError("Failed to approve request");
  }
}
