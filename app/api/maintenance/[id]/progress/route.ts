import { recordActivityEvent } from "@/lib/activity-events";
import { Api } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { deleteCacheByPrefix } from "@/lib/redis-cache";
import { z } from "zod";

const IdSchema = z.object({ id: z.string().uuid() });

export async function POST(_req: Request, props: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();

    const params = await props.params;
    const idResult = IdSchema.safeParse(params);
    if (!idResult.success) return Api.badRequest("Invalid maintenance request id");

    const request_ = await prisma.maintenanceRequest.findFirst({
      where: { id: idResult.data.id, asset: { orgId: user.orgId } },
    });
    if (!request_) return Api.notFound("Maintenance request not found");
    if (request_.technicianId !== user.id && user.role !== "ADMIN" && user.role !== "ASSET_MANAGER") {
      return Api.forbidden("Only the assigned technician can start this work");
    }
    if (request_.status !== "TECHNICIAN_ASSIGNED") {
      return Api.badRequest("A technician must be assigned before work can start");
    }

    const result = await prisma.maintenanceRequest.updateMany({
      where: { id: request_.id, status: "TECHNICIAN_ASSIGNED" },
      data: { status: "IN_PROGRESS" },
    });
    if (result.count !== 1) return Api.badRequest("This request is no longer awaiting technician assignment");

    void deleteCacheByPrefix(`maintenance:list:${user.orgId}:`);
    void recordActivityEvent({
      orgId: user.orgId,
      action: "maintenance.in_progress",
      actorId: user.id,
      entityType: "maintenance",
      entityId: request_.id,
      metadata: {},
    });
    logger.info("maintenance.progress", { requestId, id: request_.id });

    return Api.ok({ id: request_.id, status: "IN_PROGRESS" });
  } catch (error) {
    logger.error("maintenance.progress.failed", error, { requestId });
    return Api.internalError("Failed to start work");
  }
}
