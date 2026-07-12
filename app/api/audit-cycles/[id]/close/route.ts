import { recordActivityEvent } from "@/lib/activity-events";
import { Api } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getIdempotentResponse, idempotencyKeyFor, setIdempotentResponse } from "@/lib/idempotency";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const IdSchema = z.object({ id: z.string().uuid() });

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();
    if (user.role !== "ADMIN") return Api.forbidden("Only Admins can close an audit cycle");

    const params = await props.params;
    const idResult = IdSchema.safeParse(params);
    if (!idResult.success) return Api.badRequest("Invalid audit cycle id");

    const cycle = await prisma.auditCycle.findFirst({
      where: { id: idResult.data.id, orgId: user.orgId },
      include: { items: { include: { asset: { select: { id: true, assetTag: true, name: true } } } } },
    });
    if (!cycle) return Api.notFound("Audit cycle not found");

    // Closing an already-closed cycle is a no-op success, not an error —
    // matches this repo's idempotent-mutation convention.
    if (cycle.status === "CLOSED") return Api.ok(cycle);

    const idempotencyKey = idempotencyKeyFor(req, user.id, `audit-close:${cycle.id}`);
    const cached = await getIdempotentResponse(idempotencyKey);
    if (cached) return Api.ok(cached, { idempotent: true });

    const missingItems = cycle.items.filter((i) => i.verification === "MISSING");
    const damagedItems = cycle.items.filter((i) => i.verification === "DAMAGED");
    const verifiedCount = cycle.items.filter((i) => i.verification === "VERIFIED").length;
    const stillPendingCount = cycle.items.filter((i) => i.verification === "PENDING").length;

    const result = await prisma.$transaction(async (tx) => {
      const guarded = await tx.auditCycle.updateMany({
        where: { id: cycle.id, status: { not: "CLOSED" } },
        data: { status: "CLOSED", closedById: user.id, closedAt: new Date() },
      });
      if (guarded.count !== 1) return null;

      if (missingItems.length > 0) {
        await tx.asset.updateMany({
          where: { id: { in: missingItems.map((i) => i.assetId) } },
          data: { status: "LOST" },
        });
      }

      // A confirmed-damaged item routes into the existing maintenance
      // workflow rather than sitting flagged with no next step — raising
      // never itself changes Asset.status (only an *approved* request
      // does), consistent with the Screen 7 maintenance rule.
      for (const item of damagedItems) {
        await tx.maintenanceRequest.create({
          data: {
            assetId: item.assetId,
            raisedById: user.id,
            description: `Flagged damaged during audit cycle "${cycle.name}"${item.notes ? `: ${item.notes}` : ""}`,
            priority: "MEDIUM",
          },
        });
      }

      const summary = {
        totalItems: cycle.items.length,
        verified: verifiedCount,
        missing: missingItems.length,
        damaged: damagedItems.length,
        stillPending: stillPendingCount,
        flaggedAssets: [...missingItems, ...damagedItems].map((i) => ({
          assetId: i.assetId,
          assetTag: i.asset.assetTag,
          assetName: i.asset.name,
          verification: i.verification,
        })),
      };

      const report = await tx.discrepancyReport.create({
        data: { cycleId: cycle.id, summary },
      });

      return { cycle: await tx.auditCycle.findUnique({ where: { id: cycle.id } }), report };
    });

    if (!result) return Api.ok(cycle);

    void recordActivityEvent({
      orgId: user.orgId,
      action: "audit.cycle_closed",
      actorId: user.id,
      entityType: "audit_cycle",
      entityId: cycle.id,
      metadata: { missing: missingItems.length, damaged: damagedItems.length, verified: verifiedCount },
    });
    void setIdempotentResponse(idempotencyKey, result);
    logger.info("audit_cycles.close", {
      requestId,
      id: cycle.id,
      missing: missingItems.length,
      damaged: damagedItems.length,
    });

    return Api.ok(result);
  } catch (error) {
    logger.error("audit_cycles.close.failed", error, { requestId });
    return Api.internalError("Failed to close audit cycle");
  }
}
