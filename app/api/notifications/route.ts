import { Api } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { listNotifications } from "@/lib/notifications";
import { NotificationListQuerySchema } from "@/types/notification-types";

export async function GET(req: Request) {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();

    const searchParams = new URL(req.url).searchParams;
    const validation = NotificationListQuerySchema.safeParse({
      cursor: searchParams.get("cursor") ?? undefined,
      filter: searchParams.get("filter") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });
    if (!validation.success) {
      return Api.badRequest("Invalid notification query", validation.error.format());
    }

    const { cursor, filter, limit } = validation.data;
    const { rows, nextCursor } = await listNotifications({
      userId: user.id,
      cursor: cursor ? new Date(cursor) : undefined,
      filter,
      limit,
    });

    logger.info("notifications.list", { requestId, userId: user.id, count: rows.length });

    return Api.ok(rows, { nextCursor, realtime: "sse" });
  } catch (error) {
    logger.error("notifications.list.failed", error, { requestId });
    return Api.internalError("Failed to load notifications");
  }
}
