import type { NotificationCategory, NotificationType, Prisma } from "@prisma/client";

import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { publishToUser } from "@/lib/redis-pubsub";

/** Resolved onto the row at creation time so the category-filtered feed is
 * a plain indexed equality query, not a per-request case statement. Covers
 * every notification type named in the product spec — most are dormant
 * until their owning module (Allocation, Booking, Maintenance) ships. */
export const NOTIFICATION_TYPE_META: Record<NotificationType, { category: NotificationCategory }> = {
  ASSET_ASSIGNED: { category: "ASSIGNMENT" },
  MAINTENANCE_APPROVED: { category: "APPROVAL" },
  MAINTENANCE_REJECTED: { category: "APPROVAL" },
  BOOKING_CONFIRMED: { category: "BOOKING" },
  BOOKING_CANCELLED: { category: "BOOKING" },
  BOOKING_REMINDER: { category: "BOOKING" },
  TRANSFER_APPROVED: { category: "APPROVAL" },
  OVERDUE_RETURN: { category: "ALERT" },
  AUDIT_DISCREPANCY_FLAGGED: { category: "ALERT" },
  AUDIT_CYCLE_ASSIGNED: { category: "ASSIGNMENT" },
  AUDIT_CYCLE_CLOSED: { category: "INFO" },
};

export type NotificationView = {
  id: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  body: string | null;
  entityType: string | null;
  entityId: string | null;
  metadata: Prisma.JsonValue | null;
  readAt: string | null;
  createdAt: string;
};

const notificationSelect = {
  id: true,
  type: true,
  category: true,
  title: true,
  body: true,
  entityType: true,
  entityId: true,
  metadata: true,
  readAt: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect;

function toView(
  row: Prisma.NotificationGetPayload<{ select: typeof notificationSelect }>,
): NotificationView {
  return {
    ...row,
    readAt: row.readAt ? row.readAt.toISOString() : null,
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
  metadata?: Prisma.InputJsonValue;
};

/** Best-effort, like `recordActivityEvent` — a notification failure must
 * never break the mutation that triggered it. Persists first (durable,
 * survives a down Redis or a client that wasn't connected), then pushes
 * live to anyone currently subscribed. */
export async function createNotifications(input: CreateNotificationsInput): Promise<void> {
  const uniqueRecipients = Array.from(new Set(input.recipientIds));
  if (uniqueRecipients.length === 0) return;

  const { category } = NOTIFICATION_TYPE_META[input.type];

  try {
    const created = await prisma.notification.createManyAndReturn({
      data: uniqueRecipients.map((userId) => ({
        userId,
        type: input.type,
        category,
        title: input.title,
        body: input.body ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        metadata: input.metadata,
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
  category?: NotificationCategory;
  page: number;
  limit: number;
}): Promise<{ rows: NotificationView[]; total: number }> {
  const where: Prisma.NotificationWhereInput = {
    userId,
    ...(category ? { category } : {}),
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
 * notification just re-sets `readAt`, still returns true; only returns
 * false when the id doesn't belong to this user (or doesn't exist). */
export async function markNotificationRead(id: string, userId: string): Promise<boolean> {
  const result = await prisma.notification.updateMany({
    where: { id, userId },
    data: { readAt: new Date() },
  });
  return result.count === 1;
}

export async function markAllNotificationsRead(userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}

export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}
