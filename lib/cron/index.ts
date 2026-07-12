import { schedule } from "node-cron";

import { runBookingCheckInSweep } from "./booking-checkin-reminder";
import { logger } from "@/lib/logger";

/**
 * Registered once per server process from instrumentation.ts. Uses
 * node-cron v4's built-in `noOverlap: true` as its reentrancy guard — a slow
 * run skips the next tick of that same job rather than piling up concurrent
 * executions; it's not a distributed lock. If this app ever runs as more
 * than one container, every instance registers and fires independently —
 * acceptable at the current single-`app`-service docker-compose shape.
 */
export function registerCronJobs(): void {
  schedule(
    "*/5 * * * *",
    async () => {
      try {
        await runBookingCheckInSweep();
      } catch (error) {
        logger.error("cron.booking_checkin.failed", error);
      }
    },
    { name: "booking-checkin", noOverlap: true },
  );

  logger.info("cron.registered", { jobs: "booking-checkin" });
}
