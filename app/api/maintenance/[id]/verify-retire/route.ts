import { recordActivityEvent } from "@/lib/activity-events";
import { Api } from "@/lib/api";
import { canManuallyTransitionAssetStatus } from "@/lib/assets";
import { getCurrentUser } from "@/lib/auth";
import { assetSearchConfig } from "@/lib/entities/assets";
import { logger } from "@/lib/logger";
import { upsertInSearch } from "@/lib/meilisearch";
import { prisma } from "@/lib/prisma";
import { deleteCacheByPrefix } from "@/lib/redis-cache";
import { z } from "zod";

const IdSchema = z.object({ id: z.string().uuid() });

function canManage(role: string): boolean {
  return role === "ADMIN" || role === "ASSET_MANAGER";
}

/**
 * Manager confirmation step after an (optionally AI-flagged) maintenance
 * resolution — globally retires the asset. Reuses the same whitelisted
 * manual-transition rule as `PATCH /api/assets/[id]`
 * (`canManuallyTransitionAssetStatus`) rather than re-deriving it, but keeps
 * its own route so the activity-log entry is distinguishable from a plain
 * asset edit and carries maintenance-request context.
 */
export async function POST(_req: Request, props: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();
    if (!canManage(user.role)) return Api.forbidden("Only Asset Managers and Admins can retire an asset");

    const params = await props.params;
    const idResult = IdSchema.safeParse(params);
    if (!idResult.success) return Api.badRequest("Invalid maintenance request id");

    const request_ = await prisma.maintenanceRequest.findFirst({
      where: { id: idResult.data.id, asset: { orgId: user.orgId } },
      include: { asset: true },
    });
    if (!request_) return Api.notFound("Maintenance request not found");

    // Retirement is only valid as the final step of report -> approve ->
    // assign -> progress -> resolve -> verify-retire — without this check
    // any maintenance request (even PENDING or REJECTED) could be used as
    // the pretext to retire an asset that was never actually resolved.
    if (request_.status !== "RESOLVED") {
      return Api.badRequest(
        "This maintenance request must be Resolved before the asset can be retired",
      );
    }

    if (!canManuallyTransitionAssetStatus(request_.asset.status)) {
      return Api.badRequest(
        `Cannot retire this asset while it is ${request_.asset.status.toLowerCase().replace("_", " ")} — it must be Available, Retired, or Disposed first.`,
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const guarded = await tx.asset.updateMany({
        where: { id: request_.assetId, status: request_.asset.status },
        data: { status: "RETIRED" },
      });
      if (guarded.count !== 1) return null;
      return tx.asset.findUnique({ where: { id: request_.assetId } });
    });
    if (!updated) return Api.conflict("This asset's status changed before retirement could be confirmed — please retry");

    void upsertInSearch(assetSearchConfig, [updated]);
    void deleteCacheByPrefix(`assets:list:${user.orgId}:`);
    void recordActivityEvent({
      orgId: user.orgId,
      action: "maintenance.verified_retirement",
      actorId: user.id,
      entityType: "maintenance",
      entityId: request_.id,
      metadata: {
        assetId: request_.assetId,
        assetTag: request_.asset.assetTag,
        aiFlagged: request_.aiRecommendRetirement ?? false,
      },
    });
    logger.info("maintenance.verify_retire", { requestId, id: request_.id, assetId: request_.assetId });

    return Api.ok({ maintenanceRequestId: request_.id, asset: updated });
  } catch (error) {
    logger.error("maintenance.verify_retire.failed", error, { requestId });
    return Api.internalError("Failed to retire asset");
  }
}
