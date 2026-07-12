import type { NotificationType, Prisma } from "@prisma/client";

import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { publishToUser } from "@/lib/redis-pubsub";
import type { NotificationCategoryValue } from "@/lib/notification-display";

/** Computed at read time, never persisted — the `Notification` table has no
 * `category` column, so this stays a pure derived lookup instead of a write
 * path that could drift out of sync with the DB. Covers every notification
 * type named in the product spec, including ones no module can trigger yet
 * (Allocation/Booking/Maintenance aren't built), so those modules can plug
 * in later without a migration. */
export const NOTIFICATION_TYPE_META: Record<NotificationType, { category: NotificationCategoryValue }> = {
  ASSET_ASSIGNED: { category: "ASSIGNMENT" },
  MAINTENANCE_APPROVED: { category: "APPROVAL" },
  MAINTENANCE_REJECTED: { category: "APPROVAL" },
  BOOKING_CONFIRMED: { category: "BOOKING" },
  BOOKING_CANCELLED: { category: "BOOKING" },
  BOOKING_REMINDER: { category: "BOOKING" },
  TRANSFER_APPROVED: { category: "APPROVAL" },
  TRANSFER_REJECTED: { category: "APPROVAL" },
  OVERDUE_RETURN: { category: "ALERT" },
  AUDIT_DISCREPANCY: { category: "ALERT" },
};

const CATEGORY_TO_TYPES: Record<NotificationCategoryValue, NotificationType[]> = (() => {
  const map = { ALERT: [], APPROVAL: [], BOOKING: [], ASSIGNMENT: [], INFO: [] } as Record<
    NotificationCategoryValue,
    NotificationType[]
  >;
  for (const [type, meta] of Object.entries(NOTIFICATION_TYPE_META) as [NotificationType, { category: NotificationCategoryValue }][]) {
    map[meta.category].push(type);
  }
  return map;
})();

export type NotificationView = {
  id: string;
  type: NotificationType;
  category: NotificationCategoryValue;
  title: string;
  body: string | null;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
};

const notificationSelect = {
  id: true,
  type: true,
  title: true,
  body: true,
  relatedEntityType: true,
  relatedEntityId: true,
  isRead: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect;

function toView(
  row: Prisma.NotificationGetPayload<{ select: typeof notificationSelect }>,
): NotificationView {
  return {
    id: row.id,
    type: row.type,
    category: NOTIFICATION_TYPE_META[row.type].category,
    title: row.title,
    body: row.body,
    entityType: row.relatedEntityType,
    entityId: row.relatedEntityId,
    // The table only tracks isRead as a boolean (no read-timestamp column) —
    // synthesize a stand-in timestamp so the API contract (readAt: string |
    // null) stays stable for existing clients, which only ever check
    // truthiness, never the actual value.
    readAt: row.isRead ? row.createdAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

type CreateNotificationsInput = {
  recipientIds: string[];
  type: NotificationType;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
};

/** Best-effort, like `recordActivityEvent` — a notification failure must
 * never break the mutation that triggered it. Persists first (durable,
 * survives a down Redis or a client that wasn't connected), then pushes
 * live to anyone currently subscribed. */
export async function createNotifications(input: CreateNotificationsInput): Promise<void> {
  const uniqueRecipients = Array.from(new Set(input.recipientIds));
  if (uniqueRecipients.length === 0) return;

  try {
    const created = await prisma.notification.createManyAndReturn({
      data: uniqueRecipients.map((userId) => ({
        userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        relatedEntityType: input.entityType ?? null,
        relatedEntityId: input.entityId ?? null,
      })),
      select: { userId: true, ...notificationSelect },
    });

    await Promise.all(created.map((row) => publishToUser(row.userId, toView(row))));
  } catch (error) {
    logger.warn("notifications.create_failed", {
      type: input.type,
      recipientCount: uniqueRecipients.length,
      errorMessage: error instanceof Error ? error.message : "Unknown notification error",
    });
  }
}

export async function listNotifications({
  userId,
  category,
  page,
  limit,
}: {
  userId: string;
  category?: NotificationCategoryValue;
  page: number;
  limit: number;
}): Promise<{ rows: NotificationView[]; total: number }> {
  const where: Prisma.NotificationWhereInput = {
    userId,
    ...(category ? { type: { in: CATEGORY_TO_TYPES[category] } } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      select: notificationSelect,
    }),
    prisma.notification.count({ where }),
  ]);

  return { rows: rows.map(toView), total };
}

/** Ownership-guarded and idempotent — re-marking an already-read
 * notification is a no-op, still returns true; only returns false when the
 * id doesn't belong to this user (or doesn't exist). */
export async function markNotificationRead(id: string, userId: string): Promise<boolean> {
  const existing = await prisma.notification.findFirst({ where: { id, userId }, select: { id: true } });
  if (!existing) return false;

  await prisma.notification.updateMany({
    where: { id, userId },
    data: { isRead: true },
  });
  return true;
}

export async function markAllNotificationsRead(userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
  return result.count;
}

export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, isRead: false } });
}
