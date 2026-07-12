import { recordActivityEvent } from "@/lib/activity-events";
import { Api } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { deleteCacheByPrefix } from "@/lib/redis-cache";
import { MaintenanceResolveSchema } from "@/types/maintenance-types";
import { z } from "zod";

const IdSchema = z.object({ id: z.string().uuid() });

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();

    const params = await props.params;
    const idResult = IdSchema.safeParse(params);
    if (!idResult.success) return Api.badRequest("Invalid maintenance request id");

    const body = await req.json().catch(() => ({}));
    const validation = MaintenanceResolveSchema.safeParse(body);
    if (!validation.success) return Api.badRequest("Invalid resolution data", validation.error.format());

    const request_ = await prisma.maintenanceRequest.findFirst({
      where: { id: idResult.data.id, asset: { orgId: user.orgId } },
    });
    if (!request_) return Api.notFound("Maintenance request not found");
    if (request_.technicianId !== user.id && user.role !== "ADMIN" && user.role !== "ASSET_MANAGER") {
      return Api.forbidden("Only the assigned technician can resolve this request");
    }
    if (request_.status !== "IN_PROGRESS") {
      return Api.badRequest("This request is not currently in progress");
    }

    // Resolving always returns the asset to Available, per the documented
    // API contract (docs/API_DESIGN.md) — a deliberate literal reading of
    // the mockup's stated rule, not a computed "restore prior state."
    const updated = await prisma.$transaction(async (tx) => {
      const guarded = await tx.maintenanceRequest.updateMany({
        where: { id: request_.id, status: "IN_PROGRESS" },
        data: { status: "RESOLVED", resolvedAt: new Date(), resolutionNotes: validation.data.resolutionNotes ?? null },
      });
      if (guarded.count !== 1) return null;
      await tx.asset.update({ where: { id: request_.assetId }, data: { status: "AVAILABLE" } });
      return tx.maintenanceRequest.findUnique({ where: { id: request_.id } });
    });
    if (!updated) return Api.badRequest("This request is not currently in progress");

    void deleteCacheByPrefix(`assets:list:${user.orgId}:`);
    void recordActivityEvent({
      orgId: user.orgId,
      action: "maintenance.resolved",
      actorId: user.id,
      entityType: "maintenance",
      entityId: request_.id,
      metadata: {},
    });
    logger.info("maintenance.resolve", { requestId, id: request_.id });

    return Api.ok(updated);
  } catch (error) {
    logger.error("maintenance.resolve.failed", error, { requestId });
    return Api.internalError("Failed to resolve request");
  }
}
