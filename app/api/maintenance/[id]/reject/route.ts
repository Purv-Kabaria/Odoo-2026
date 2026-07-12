import { recordActivityEvent } from "@/lib/activity-events";
import { Api } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { dispatchNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const IdSchema = z.object({ id: z.string().uuid() });

function canDecide(role: string): boolean {
  return role === "ADMIN" || role === "ASSET_MANAGER";
}

export async function POST(_req: Request, props: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();
    if (!canDecide(user.role)) return Api.forbidden("Only Asset Managers and Admins can reject maintenance requests");

    const params = await props.params;
    const idResult = IdSchema.safeParse(params);
    if (!idResult.success) return Api.badRequest("Invalid maintenance request id");

    const request_ = await prisma.maintenanceRequest.findFirst({
      where: { id: idResult.data.id, asset: { orgId: user.orgId } },
    });
    if (!request_) return Api.notFound("Maintenance request not found");
    if (request_.status !== "PENDING") return Api.badRequest("This request has already been decided");

    const result = await prisma.maintenanceRequest.updateMany({
      where: { id: request_.id, status: "PENDING" },
      data: { status: "REJECTED", approvedById: user.id, approvedAt: new Date() },
    });
    if (result.count !== 1) return Api.badRequest("This request has already been decided");

    void recordActivityEvent({
      orgId: user.orgId,
      action: "maintenance.rejected",
      actorId: user.id,
      entityType: "maintenance",
      entityId: request_.id,
      metadata: {},
    });
    void (async () => {
      const asset = await prisma.asset.findUnique({ where: { id: request_.assetId }, select: { assetTag: true } });
      void dispatchNotification({
        recipientIds: [request_.raisedById],
        type: "MAINTENANCE_REJECTED",
        title: `Maintenance request for ${asset?.assetTag ?? "your asset"} rejected`,
        relatedEntityType: "maintenance",
        relatedEntityId: request_.id,
      });
    })();
    logger.info("maintenance.reject", { requestId, id: request_.id });

    return Api.ok({ id: request_.id, status: "REJECTED" });
  } catch (error) {
    logger.error("maintenance.reject.failed", error, { requestId });
    return Api.internalError("Failed to reject request");
  }
}
