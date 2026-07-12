import { logger } from "@/lib/logger";
import { dispatchNotification, hasUnreadNotificationForEntity } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

/**
 * Daily: flag allocations past their expected return date. No "last
 * notified" timestamp column — dedup by checking for an existing *unread*
 * OVERDUE_RETURN notification for this allocation+recipient first. Once
 * the recipient reads/dismisses it, tomorrow's sweep notifies again, which
 * is the correct behavior for something that's still overdue (unlike the
 * one-shot booking reminders, this is a standing condition, not a single
 * moment in time).
 */
export async function runOverdueReturnSweep(): Promise<void> {
  const now = new Date();

  const overdue = await prisma.allocation.findMany({
    where: { returnedAt: null, expectedReturnDate: { lt: now } },
    include: {
      asset: { select: { assetTag: true, orgId: true } },
      toEmployee: { select: { id: true } },
      toDepartment: { select: { headId: true } },
    },
  });

  let dispatched = 0;
  for (const allocation of overdue) {
    const holderId = allocation.toEmployee?.id ?? allocation.toDepartment?.headId ?? null;

    const managers = await prisma.user.findMany({
      where: { orgId: allocation.asset.orgId, role: { in: ["ADMIN", "ASSET_MANAGER"] }, status: "ACTIVE" },
      select: { id: true },
    });

    const recipientIds = Array.from(new Set([holderId, ...managers.map((m) => m.id)].filter((id): id is string => Boolean(id))));

    const freshRecipients: string[] = [];
    for (const recipientId of recipientIds) {
      const alreadyNotified = await hasUnreadNotificationForEntity(recipientId, "OVERDUE_RETURN", allocation.id);
      if (!alreadyNotified) freshRecipients.push(recipientId);
    }
    if (freshRecipients.length === 0) continue;

    void dispatchNotification({
      recipientIds: freshRecipients,
      type: "OVERDUE_RETURN",
      title: `${allocation.asset.assetTag} is overdue for return`,
      relatedEntityType: "allocation",
      relatedEntityId: allocation.id,
    });
    dispatched += freshRecipients.length;
  }

  logger.info("cron.overdue_return_sweep", { overdueCount: overdue.length, dispatched });
}
