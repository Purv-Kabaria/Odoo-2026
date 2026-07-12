import { logger } from "@/lib/logger";
import { dispatchNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

/**
 * Every 5 minutes: notify a booking's owner that their slot ends soon.
 * Window is startTime/endTime + 4..6 minutes rather than an exact 5 —
 * absorbs cron scheduling jitter without risking a double-fire, since the
 * guarded `reminderSentAt` update below only lets one tick win per booking
 * regardless of how many ticks land inside the window.
 */
export async function runBookingReminderSweep(): Promise<void> {
  const now = new Date();
  const windowStart = new Date(now.getTime() + 4 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 6 * 60 * 1000);

  const candidates = await prisma.booking.findMany({
    where: {
      status: "ONGOING",
      endTime: { gte: windowStart, lte: windowEnd },
      reminderSentAt: null,
    },
    include: { asset: { select: { assetTag: true, name: true } } },
  });

  for (const booking of candidates) {
    // Guarded update: only the tick that flips reminderSentAt from null
    // actually proceeds to dispatch, so two overlapping runs (or a retry)
    // can't both notify the same booking.
    const claimed = await prisma.booking.updateMany({
      where: { id: booking.id, reminderSentAt: null },
      data: { reminderSentAt: now },
    });
    if (claimed.count !== 1) continue;

    void dispatchNotification({
      recipientIds: [booking.bookedById],
      type: "BOOKING_REMINDER",
      title: `${booking.asset.assetTag} — booking ends in 5 minutes`,
      relatedEntityType: "booking",
      relatedEntityId: booking.id,
    });
  }

  logger.info("cron.booking_reminder", { candidateCount: candidates.length });
}
