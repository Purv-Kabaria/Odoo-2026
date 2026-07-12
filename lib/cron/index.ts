import { schedule } from "node-cron";

import { logger } from "@/lib/logger";

import { runBookingCheckinReminderSweep } from "./booking-checkin-reminder";
import { runBookingReminderSweep } from "./booking-reminder";
import { runOverdueReturnSweep } from "./overdue-return-sweep";

/**
 * Registered once per server process from `instrumentation.ts`. Each job
 * uses node-cron v4's built-in `noOverlap: true` as its reentrancy guard —
 * a slow run of a job skips the next tick of *that same job* rather than
 * piling up concurrent executions; it's not a distributed lock. If this
 * app ever runs as more than one container, every instance registers and
 * fires every job independently — acceptable at the current single-`app`-
 * service docker-compose shape, not solved here since it isn't needed yet.
 */
export function registerCronJobs(): void {
  schedule(
    "*/5 * * * *",
    async () => {
      try {
        await runBookingReminderSweep();
      } catch (error) {
        logger.error("cron.booking_reminder.failed", error);
      }
    },
    { name: "booking-reminder", noOverlap: true },
  );

  schedule(
    "*/5 * * * *",
    async () => {
      try {
        await runBookingCheckinReminderSweep();
      } catch (error) {
        logger.error("cron.booking_checkin_reminder.failed", error);
      }
    },
    { name: "booking-checkin-reminder", noOverlap: true },
  );

  schedule(
    "0 6 * * *",
    async () => {
      try {
        await runOverdueReturnSweep();
      } catch (error) {
        logger.error("cron.overdue_return_sweep.failed", error);
      }
    },
    { name: "overdue-return-sweep", noOverlap: true },
  );

  logger.info("cron.registered", {
    jobs: "booking-reminder, booking-checkin-reminder, overdue-return-sweep",
  });
}
