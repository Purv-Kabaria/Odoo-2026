import { recordActivityEvent } from "@/lib/activity-events";
import { Api } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { AuditItemMarkSchema } from "@/types/audit-types";
import { z } from "zod";

const IdSchema = z.object({ id: z.string().uuid() });

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();

    const params = await props.params;
    const idResult = IdSchema.safeParse(params);
    if (!idResult.success) return Api.badRequest("Invalid audit item id");

    const body = await req.json().catch(() => null);
    const validation = AuditItemMarkSchema.safeParse(body);
    if (!validation.success) return Api.badRequest("Invalid verification data", validation.error.format());

    const item = await prisma.auditItem.findFirst({
      where: { id: idResult.data.id, cycle: { orgId: user.orgId } },
      include: { cycle: { include: { auditors: true } }, asset: { select: { assetTag: true } } },
    });
    if (!item) return Api.notFound("Audit item not found");

    const isAssignedAuditor = item.cycle.auditors.some((a) => a.auditorId === user.id);
    if (user.role !== "ADMIN" && !isAssignedAuditor) {
      return Api.forbidden("You are not assigned to audit this cycle");
    }
    if (item.cycle.status === "CLOSED") {
      return Api.badRequest("This audit cycle is closed — verification is locked");
    }

    // Guarded against a concurrent cycle-close: re-checks the cycle isn't
    // CLOSED at write time (not just at the read above), since closing a
    // cycle snapshots a DiscrepancyReport that a late-landing write here
    // would silently fall out of sync with.
    const guarded = await prisma.auditItem.updateMany({
      where: { id: item.id, cycle: { status: { not: "CLOSED" } } },
      data: {
        verification: validation.data.verification,
        notes: validation.data.notes ?? null,
        auditedById: user.id,
        auditedAt: new Date(),
      },
    });
    if (guarded.count !== 1) {
      return Api.badRequest("This audit cycle was closed before verification could be recorded — please retry");
    }
    const updated = await prisma.auditItem.findUniqueOrThrow({ where: { id: item.id } });

    void recordActivityEvent({
      orgId: user.orgId,
      action: "audit.item_marked",
      actorId: user.id,
      entityType: "audit_item",
      entityId: item.id,
      metadata: { assetTag: item.asset.assetTag, verification: validation.data.verification },
    });
    logger.info("audit_items.mark", { requestId, id: item.id, verification: validation.data.verification });

    return Api.ok(updated);
  } catch (error) {
    logger.error("audit_items.mark.failed", error, { requestId });
    return Api.internalError("Failed to record verification");
  }
}
