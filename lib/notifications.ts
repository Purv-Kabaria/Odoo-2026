import type { NotificationType, Prisma } from "@prisma/client";

import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { publishToUser } from "@/lib/redis-pubsub";

/** The doc's `filter` param (`docs/API_DESIGN.md` §Notifications) has no
 * dedicated tab for ASSET_ASSIGNED — it only shows up under "all". */
export const NOTIFICATION_FILTER_TYPES: Record<"alerts" | "approvals" | "bookings", NotificationType[]> = {
  alerts: ["OVERDUE_RETURN", "AUDIT_DISCREPANCY"],
  approvals: [
    "TRANSFER_APPROVED",
    "TRANSFER_REJECTED",
    "MAINTENANCE_APPROVED",
    "MAINTENANCE_REJECTED",
    "MAINTENANCE_TECHNICIAN_ASSIGNED",
    "MAINTENANCE_RESOLVED",
  ],
  bookings: ["BOOKING_CONFIRMED", "BOOKING_CANCELLED", "BOOKING_REMINDER"],
};

export type NotificationFilter = keyof typeof NOTIFICATION_FILTER_TYPES;

export type NotificationView = {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  isRead: boolean;
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
  return { ...row, createdAt: row.createdAt.toISOString() };
}

type DispatchNotificationInput = {
  recipientIds: string[];
  type: NotificationType;
  title: string;
  body?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
};

/** Fire-and-forget, same guarantee as `recordActivityEvent` — a
 * notification failure must never break the mutation that triggered it.
 * Persists first (durable, survives a down Redis or no one currently
 * connected), then best-effort pushes live to any open SSE stream. */
export async function dispatchNotification(input: DispatchNotificationInput): Promise<void> {
  const uniqueRecipients = Array.from(new Set(input.recipientIds));
  if (uniqueRecipients.length === 0) return;

  try {
    const created = await prisma.notification.createManyAndReturn({
      data: uniqueRecipients.map((userId) => ({
        userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        relatedEntityType: input.relatedEntityType ?? null,
        relatedEntityId: input.relatedEntityId ?? null,
      })),
      select: { userId: true, ...notificationSelect },
    });

    await Promise.all(created.map((row) => publishToUser(row.userId, toView(row))));
  } catch (error) {
    logger.warn("notifications.dispatch_failed", {
      type: input.type,
      recipientCount: uniqueRecipients.length,
      errorMessage: error instanceof Error ? error.message : "Unknown notification error",
    });
  }
}

/** Keyset pagination on `[userId, createdAt]`, matching
 * `docs/API_DESIGN.md`:21 — the notification feed is append-heavy and
 * expected past offset-pagination's comfort zone. */
export async function listNotifications({
  userId,
  cursor,
  filter,
  limit,
}: {
  userId: string;
  cursor?: Date;
  filter?: NotificationFilter;
  limit: number;
}): Promise<{ rows: NotificationView[]; nextCursor: string | null }> {
  const where: Prisma.NotificationWhereInput = {
    userId,
    ...(cursor ? { createdAt: { lt: cursor } } : {}),
    ...(filter ? { type: { in: NOTIFICATION_FILTER_TYPES[filter] } } : {}),
  };

  const rows = await prisma.notification.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    take: limit,
    select: notificationSelect,
  });

  const nextCursor = rows.length === limit ? rows[rows.length - 1].createdAt.toISOString() : null;

  return { rows: rows.map(toView), nextCursor };
}

/** Ownership-guarded and idempotent — re-marking an already-read
 * notification just no-ops-updates it, still returns true; only false
 * when the id doesn't belong to this user (or doesn't exist). */
export async function markNotificationRead(id: string, userId: string): Promise<boolean> {
  const result = await prisma.notification.updateMany({
    where: { id, userId },
    data: { isRead: true },
  });
  return result.count === 1;
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

/** Used by the overdue-return cron sweep to dedup instead of adding
 * another "last notified" timestamp column — see lib/cron/overdue-return-sweep.ts. */
export async function hasUnreadNotificationForEntity(
  userId: string,
  type: NotificationType,
  relatedEntityId: string,
): Promise<boolean> {
  const existing = await prisma.notification.findFirst({
    where: { userId, type, relatedEntityId, isRead: false },
    select: { id: true },
  });
  return existing !== null;
}
