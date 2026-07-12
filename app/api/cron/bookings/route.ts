import { Api } from "@/lib/api";
import { runBookingCheckInSweep } from "@/lib/cron/booking-checkin-reminder";
import { runBookingLifecycleSweep } from "@/lib/cron/booking-lifecycle";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Scheduled trigger for the booking check-in state machine. Runs the
 * lifecycle sweep first so UPCOMING rows have already flipped to ONGOING
 * before the check-in sweep evaluates them in the same tick.
 *
 * Wire this up with Vercel Cron (see vercel.json) or an external scheduler
 * like Upstash QStash pointed at this URL with a matching Authorization
 * header — either way, CRON_SECRET must be set for this to run at all.
 */
export async function GET(req: Request) {
  const requestId = crypto.randomUUID();
  const startedAt = performance.now();

  if (!env.CRON_SECRET) {
    return Api.serviceUnavailable("Cron trigger not configured");
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return Api.unauthorized();
  }

  try {
    const lifecycle = await runBookingLifecycleSweep();
    const checkIn = await runBookingCheckInSweep();

    const durationMs = performance.now() - startedAt;
    logger.info("cron.bookings.run", { requestId, durationMs, ...lifecycle, ...checkIn });

    return Api.ok({ ok: true });
  } catch (error) {
    logger.error("cron.bookings.failed", error, { requestId });
    return Api.internalError("Booking cron sweep failed");
  }
}
