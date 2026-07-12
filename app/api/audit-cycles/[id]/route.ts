import { Api } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const IdSchema = z.object({ id: z.string().uuid() });

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();

    const params = await props.params;
    const idResult = IdSchema.safeParse(params);
    if (!idResult.success) return Api.badRequest("Invalid audit cycle id");

    const cycle = await prisma.auditCycle.findFirst({
      where: { id: idResult.data.id, orgId: user.orgId },
      include: {
        createdBy: { select: { id: true, name: true } },
        closedBy: { select: { id: true, name: true } },
        scopeDept: { select: { id: true, name: true } },
        auditors: { include: { auditor: { select: { id: true, name: true } } } },
        items: {
          orderBy: { createdAt: "asc" },
          include: {
            asset: { select: { id: true, assetTag: true, name: true, location: true } },
            auditedBy: { select: { id: true, name: true } },
          },
        },
        discrepancyReport: true,
      },
    });
    if (!cycle) return Api.notFound("Audit cycle not found");

    const isAssignedAuditor = cycle.auditors.some((a) => a.auditorId === user.id);
    if (user.role !== "ADMIN" && !isAssignedAuditor) {
      return Api.forbidden("You are not assigned to this audit cycle");
    }

    return Api.ok(cycle);
  } catch (error) {
    logger.error("audit_cycles.get.failed", error, { requestId });
    return Api.internalError("Failed to load audit cycle");
  }
}
