import { recordActivityEvent } from "@/lib/activity-events";
import { Api } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getIdempotentResponse, idempotencyKeyFor, setIdempotentResponse } from "@/lib/idempotency";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { deleteCacheByPrefix } from "@/lib/redis-cache";
import { ReturnAllocationSchema } from "@/types/allocation-types";
import { z } from "zod";

const IdSchema = z.object({ id: z.string().uuid() });

function canReturn(role: string): boolean {
  return role === "ADMIN" || role === "ASSET_MANAGER";
}

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();
    if (!canReturn(user.role)) return Api.forbidden("Only Asset Managers and Admins can process returns");

    const params = await props.params;
    const idResult = IdSchema.safeParse(params);
    if (!idResult.success) return Api.badRequest("Invalid allocation id");

    const idempotencyKey = idempotencyKeyFor(req, user.id, `allocation-return:${idResult.data.id}`);
    const cached = await getIdempotentResponse(idempotencyKey);
    if (cached) return Api.ok(cached, { idempotent: true });

    const body = await req.json().catch(() => null);
    const validation = ReturnAllocationSchema.safeParse(body);
    if (!validation.success) return Api.badRequest("Invalid return data", validation.error.format());

    const allocation = await prisma.allocation.findFirst({
      where: { id: idResult.data.id, asset: { orgId: user.orgId } },
    });
    if (!allocation) return Api.notFound("Allocation not found");
    if (allocation.status !== "ACTIVE") return Api.badRequest("This allocation has already been returned");

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.allocation.updateMany({
        where: { id: allocation.id, status: "ACTIVE" },
        data: {
          status: "RETURNED",
          returnedAt: new Date(),
          returnCondition: validation.data.returnCondition,
          checkInNotes: validation.data.checkInNotes ?? null,
        },
      });
      if (result.count !== 1) return null;
      await tx.asset.update({ where: { id: allocation.assetId }, data: { status: "AVAILABLE" } });
      return tx.allocation.findUnique({ where: { id: allocation.id } });
    });

    if (!updated) return Api.badRequest("This allocation has already been returned");

    void deleteCacheByPrefix(`assets:list:${user.orgId}:`);
    void deleteCacheByPrefix(`allocations:list:${user.orgId}:`);
    void recordActivityEvent({
      orgId: user.orgId,
      action: "asset.returned",
      actorId: user.id,
      entityType: "allocation",
      entityId: allocation.id,
      metadata: { condition: validation.data.returnCondition },
    });
    void setIdempotentResponse(idempotencyKey, updated);
    logger.info("allocations.return", { requestId, id: allocation.id });

    return Api.ok(updated);
  } catch (error) {
    logger.error("allocations.return.failed", error, { requestId });
    return Api.internalError("Failed to process return");
  }
}
