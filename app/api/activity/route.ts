import { Api } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { listActivityEvents } from "@/lib/activity-events";
import { logger } from "@/lib/logger";
import { ActivityListQuerySchema } from "@/types/activity-types";

function canReadAllActivity(role: string): boolean {
  return role === "ADMIN" || role === "ASSET_MANAGER";
}

export async function GET(req: Request) {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();

    const searchParams = new URL(req.url).searchParams;
    const validation = ActivityListQuerySchema.safeParse({
      limit: searchParams.get("limit") ?? undefined,
      since: searchParams.get("since") ?? undefined,
    });

    if (!validation.success) {
      return Api.badRequest("Invalid activity query", validation.error.format());
    }

    const events = await listActivityEvents({
      limit: validation.data.limit,
      since: validation.data.since ? new Date(validation.data.since) : undefined,
      orgId: user.orgId,
      actorId: user.id,
      includeAll: canReadAllActivity(user.role),
    });

    logger.info("activity.list", {
      requestId,
      userId: user.id,
      count: events.length,
    });

    return Api.ok(events, {
      total: events.length,
      realtime: "polling",
    });
  } catch (error) {
    logger.error("activity.list.failed", error, { requestId });
    return Api.internalError("Failed to load activity");
  }
}
