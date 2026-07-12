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

    const updated = await prisma.auditItem.update({
      where: { id: item.id },
      data: {
        verification: validation.data.verification,
        notes: validation.data.notes ?? null,
        auditedById: user.id,
        auditedAt: new Date(),
      },
    });

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
