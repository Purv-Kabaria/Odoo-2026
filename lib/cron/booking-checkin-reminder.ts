import { logger } from "@/lib/logger";
import { dispatchNotification, hasUnreadNotificationForEntity } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

/**
 * Every 5 minutes: nudge a booking's owner to check in if the session
 * started 10–15 minutes ago and no check-in has happened. Unlike the
 * ending-soon reminder, this has no dedicated "sent" timestamp column —
 * reusing `Booking.reminderSentAt` for both events would race with the
 * ending-soon sweep on a short booking, and adding a second boolean+
 * timestamp pair just for this is unnecessary bookkeeping when the
 * Notification table can already answer "did we already tell this person"
 * via `hasUnreadNotificationForEntity`.
 */
export async function runBookingCheckinReminderSweep(): Promise<void> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - 15 * 60 * 1000);
  const windowEnd = new Date(now.getTime() - 10 * 60 * 1000);

  const candidates = await prisma.booking.findMany({
    where: {
      status: "ONGOING",
      startTime: { gte: windowStart, lte: windowEnd },
      checkedIn: false,
    },
    include: { asset: { select: { assetTag: true, name: true } } },
  });

  let dispatched = 0;
  for (const booking of candidates) {
    const alreadyNotified = await hasUnreadNotificationForEntity(
      booking.bookedById,
      "BOOKING_REMINDER",
      booking.id,
    );
    if (alreadyNotified) continue;

    void dispatchNotification({
      recipientIds: [booking.bookedById],
      type: "BOOKING_REMINDER",
      title: `Don't forget to check in for ${booking.asset.assetTag}`,
      relatedEntityType: "booking",
      relatedEntityId: booking.id,
    });
    dispatched += 1;
  }

  logger.info("cron.booking_checkin_reminder", { candidateCount: candidates.length, dispatched });
}
