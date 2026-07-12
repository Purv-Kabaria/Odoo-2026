import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

/**
 * Advances Booking.status purely off startTime/endTime. Nothing else in the
 * app currently moves a booking off UPCOMING, so the check-in sweep (which
 * only acts on UPCOMING/ONGOING rows) depends on this running first in every
 * cron tick.
 */
export async function runBookingLifecycleSweep(): Promise<{ startedCount: number; completedCount: number }> {
  const now = new Date();

  const started = await prisma.booking.updateMany({
    where: { status: "UPCOMING", startTime: { lte: now }, endTime: { gt: now } },
    data: { status: "ONGOING" },
  });

  const completed = await prisma.booking.updateMany({
    where: { status: { in: ["UPCOMING", "ONGOING"] }, endTime: { lte: now } },
    data: { status: "COMPLETED" },
  });

  logger.info("cron.booking_lifecycle", { startedCount: started.count, completedCount: completed.count });
  return { startedCount: started.count, completedCount: completed.count };
}
