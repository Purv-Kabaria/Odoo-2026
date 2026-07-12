import { recordActivityEvent } from "@/lib/activity-events";
import { Api } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { evaluateRetirementRecommendation } from "@/lib/maintenance-retirement";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { z } from "zod";

const IdSchema = z.object({ id: z.string().uuid() });
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 1000;

function canManage(role: string): boolean {
  return role === "ADMIN" || role === "ASSET_MANAGER";
}

/**
 * Manual "re-analyze" trigger — the same evaluation also runs
 * fire-and-forget from `[id]/resolve/route.ts` right after a request is
 * resolved. Both call sites share `evaluateRetirementRecommendation` so the
 * prompt/parsing/persistence logic exists exactly once.
 */
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID();
  const startedAt = performance.now();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();
    if (!canManage(user.role)) {
      return Api.forbidden("Only Asset Managers and Admins can request an AI retirement recommendation");
    }

    const params = await props.params;
    const idResult = IdSchema.safeParse(params);
    if (!idResult.success) return Api.badRequest("Invalid maintenance request id");

    const request_ = await prisma.maintenanceRequest.findFirst({
      where: { id: idResult.data.id, asset: { orgId: user.orgId } },
    });
    if (!request_) return Api.notFound("Maintenance request not found");

    const rateLimit = await checkRateLimit(
      `maintenance-recommend:${getClientIp(req)}:${user.id}`,
      RATE_LIMIT,
      RATE_WINDOW_MS,
    );
    if (!rateLimit.success) {
      logger.warn("maintenance.recommend_retirement.rate_limited", { requestId, userId: user.id });
      return Api.tooManyRequests(
        "Too many AI recommendation requests. Try again shortly.",
        (rateLimit.resetAt - Date.now()) / 1000,
      );
    }

    const result = await evaluateRetirementRecommendation(request_.id);
    if (!result.success) {
      logger.warn("maintenance.recommend_retirement.failed", {
        requestId,
        id: request_.id,
        reason: result.reason,
      });
      return result.reason === "not_configured"
        ? Api.serviceUnavailable("The AI provider is not configured for this environment.")
        : Api.internalError("The AI provider could not produce a recommendation right now.");
    }

    void recordActivityEvent({
      orgId: user.orgId,
      action: "maintenance.retirement_recommended",
      actorId: user.id,
      entityType: "maintenance",
      entityId: request_.id,
      metadata: { recommend: result.data.recommend_retirement },
    });
    logger.info("maintenance.recommend_retirement", {
      requestId,
      id: request_.id,
      durationMs: Math.round(performance.now() - startedAt),
      recommend: result.data.recommend_retirement,
    });

    return Api.ok(result.data);
  } catch (error) {
    logger.error("maintenance.recommend_retirement.failed", error, { requestId });
    return Api.internalError("Failed to generate a retirement recommendation");
  }
}
