import { z } from "zod";

import { Api } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { markNotificationRead } from "@/lib/notifications";

const ParamsSchema = z.object({ id: z.string().uuid("Invalid notification identifier") });

export async function POST(
  _req: Request,
  props: { params: Promise<{ id: string }> },
) {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();

    const params = await props.params;
    const validation = ParamsSchema.safeParse(params);
    if (!validation.success) {
      return Api.badRequest("Invalid notification identifier", validation.error.format());
    }

    const updated = await markNotificationRead(validation.data.id, user.id);
    if (!updated) return Api.notFound("Notification not found");

    logger.info("notifications.mark_read", { requestId, userId: user.id, id: validation.data.id });
    return Api.ok({ id: validation.data.id, isRead: true });
  } catch (error) {
    logger.error("notifications.mark_read.failed", error, { requestId });
    return Api.internalError("Failed to update notification");
  }
}
