import { recordActivityEvent } from "@/lib/activity-events";
import { runBookingLifecycleSweep } from "@/lib/cron/booking-lifecycle";
import { logger } from "@/lib/logger";
import { dispatchNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

const GRACE_PERIOD_MS = 5 * 60 * 1000;

/**
 * Registered as a single node-cron job (see lib/cron/index.ts) — node-cron
 * schedules run on independent timers with no ordering guarantee between
 * jobs, so the lifecycle transition (UPCOMING/ONGOING/COMPLETED) runs first
 * *inside* this function rather than as a separate registered job, to
 * guarantee it always happens before the check-in phases below see the row.
 *
 * Two-phase check-in enforcement after that, each phase claiming rows one at
 * a time via a guarded updateMany (where id + the still-false guard field)
 * so two overlapping cron ticks can't both act on the same booking:
 *
 *  Phase 1 — first miss: push checkInDeadline out by 5 minutes (grace) and
 *  notify. checkInGraceExtended flips true, doubling as the de-dupe guard.
 *  Phase 2 — still missed after grace: auto-cancel. The booking frees its
 *  slot purely by leaving CANCELLED — the overlap check/GiST exclusion
 *  constraint already ignores cancelled rows, so no Asset-level change
 *  is needed for other users to book the same window.
 */
export async function runBookingCheckInSweep(): Promise<{ extendedCount: number; cancelledCount: number }> {
  await runBookingLifecycleSweep();

  const now = new Date();

  const graceCandidates = await prisma.booking.findMany({
    where: {
      status: { in: ["UPCOMING", "ONGOING"] },
      checkedIn: false,
      checkInGraceExtended: false,
      checkInDeadline: { lte: now },
    },
    include: { asset: { select: { assetTag: true, orgId: true } } },
  });

  let extendedCount = 0;
  for (const booking of graceCandidates) {
    // The where clause guarantees checkInDeadline <= now, so it can't be
    // null here — this guard only satisfies strict null checking.
    if (!booking.checkInDeadline) continue;

    const claimed = await prisma.booking.updateMany({
      where: { id: booking.id, checkInGraceExtended: false },
      data: {
        checkInGraceExtended: true,
        checkInDeadline: new Date(booking.checkInDeadline.getTime() + GRACE_PERIOD_MS),
      },
    });
    if (claimed.count !== 1) continue;
    extendedCount += 1;

    void dispatchNotification({
      recipientIds: [booking.bookedById],
      type: "BOOKING_REMINDER",
      title: `Check in now — your check-in window for ${booking.asset.assetTag} closes in 5 minutes`,
      relatedEntityType: "booking",
      relatedEntityId: booking.id,
    });
    void recordActivityEvent({
      orgId: booking.asset.orgId,
      action: "booking.checkin_grace_extended",
      entityType: "booking",
      entityId: booking.id,
      metadata: { assetTag: booking.asset.assetTag },
    });
  }

  const cancelCandidates = await prisma.booking.findMany({
    where: {
      status: { in: ["UPCOMING", "ONGOING"] },
      checkedIn: false,
      checkInGraceExtended: true,
      checkInDeadline: { lte: now },
    },
    include: { asset: { select: { assetTag: true, orgId: true } } },
  });

  let cancelledCount = 0;
  for (const booking of cancelCandidates) {
    const claimed = await prisma.booking.updateMany({
      where: { id: booking.id, status: { in: ["UPCOMING", "ONGOING"] } },
      data: { status: "CANCELLED" },
    });
    if (claimed.count !== 1) continue;
    cancelledCount += 1;

    void dispatchNotification({
      recipientIds: [booking.bookedById],
      type: "BOOKING_CANCELLED",
      title: `Booking auto-cancelled — no check-in for ${booking.asset.assetTag}`,
      relatedEntityType: "booking",
      relatedEntityId: booking.id,
    });
    void recordActivityEvent({
      orgId: booking.asset.orgId,
      action: "booking.auto_cancelled_missed_checkin",
      entityType: "booking",
      entityId: booking.id,
      metadata: { assetTag: booking.asset.assetTag },
    });
  }

  logger.info("cron.booking_checkin_sweep", {
    graceCandidateCount: graceCandidates.length,
    extendedCount,
    cancelCandidateCount: cancelCandidates.length,
    cancelledCount,
  });

  return { extendedCount, cancelledCount };
}
