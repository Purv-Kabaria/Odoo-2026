import type { NotificationType } from "@prisma/client";

import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

type DispatchNotificationInput = {
  recipientIds: string[];
  type: NotificationType;
  title: string;
  body?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
};

/**
 * Fire-and-forget, same guarantee as recordActivityEvent — a notification
 * failure must never break the mutation (or sweep) that triggered it.
 */
export async function dispatchNotification(input: DispatchNotificationInput): Promise<void> {
  const uniqueRecipients = Array.from(new Set(input.recipientIds));
  if (uniqueRecipients.length === 0) return;

  try {
    await prisma.notification.createMany({
      data: uniqueRecipients.map((userId) => ({
        userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        relatedEntityType: input.relatedEntityType ?? null,
        relatedEntityId: input.relatedEntityId ?? null,
      })),
    });
  } catch (error) {
    logger.warn("notifications.dispatch_failed", {
      type: input.type,
      recipientCount: uniqueRecipients.length,
      errorMessage: error instanceof Error ? error.message : "Unknown notification error",
    });
  }
}
