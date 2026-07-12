import { recordActivityEvent } from "@/lib/activity-events";
import { Api } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { dispatchNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { deleteCacheByPrefix } from "@/lib/redis-cache";
import { MaintenanceAssignSchema } from "@/types/maintenance-types";
import { z } from "zod";

const IdSchema = z.object({ id: z.string().uuid() });

function canAssign(role: string): boolean {
  return role === "ADMIN" || role === "ASSET_MANAGER";
}

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();
    if (!canAssign(user.role)) return Api.forbidden("Only Asset Managers and Admins can assign a technician");

    const params = await props.params;
    const idResult = IdSchema.safeParse(params);
    if (!idResult.success) return Api.badRequest("Invalid maintenance request id");

    const body = await req.json().catch(() => null);
    const validation = MaintenanceAssignSchema.safeParse(body);
    if (!validation.success) return Api.badRequest("Invalid assignment", validation.error.format());

    const request_ = await prisma.maintenanceRequest.findFirst({
      where: { id: idResult.data.id, asset: { orgId: user.orgId } },
    });
    if (!request_) return Api.notFound("Maintenance request not found");
    if (request_.status !== "APPROVED") return Api.badRequest("Only an approved request can have a technician assigned");

    const technician = await prisma.user.findFirst({ where: { id: validation.data.technicianId, orgId: user.orgId } });
    if (!technician) return Api.badRequest("Technician not found");

    const result = await prisma.maintenanceRequest.updateMany({
      where: { id: request_.id, status: "APPROVED" },
      data: { status: "TECHNICIAN_ASSIGNED", technicianId: technician.id },
    });
    if (result.count !== 1) return Api.badRequest("This request is no longer awaiting technician assignment");

    void deleteCacheByPrefix(`maintenance:list:${user.orgId}:`);
    void recordActivityEvent({
      orgId: user.orgId,
      action: "maintenance.technician_assigned",
      actorId: user.id,
      entityType: "maintenance",
      entityId: request_.id,
      metadata: { technicianId: technician.id },
    });
    void (async () => {
      const asset = await prisma.asset.findUnique({ where: { id: request_.assetId }, select: { assetTag: true } });
      void dispatchNotification({
        recipientIds: [technician.id],
        type: "MAINTENANCE_TECHNICIAN_ASSIGNED",
        title: `You've been assigned to repair ${asset?.assetTag ?? "an asset"}`,
        relatedEntityType: "maintenance",
        relatedEntityId: request_.id,
      });
    })();
    logger.info("maintenance.assign", { requestId, id: request_.id });

    return Api.ok({ id: request_.id, status: "TECHNICIAN_ASSIGNED", technicianId: technician.id });
  } catch (error) {
    logger.error("maintenance.assign.failed", error, { requestId });
    return Api.internalError("Failed to assign technician");
  }
}
