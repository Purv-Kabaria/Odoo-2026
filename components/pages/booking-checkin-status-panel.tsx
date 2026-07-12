"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { CalendarCheck, CheckCircle2, Clock, Radio, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { readApiResponse } from "@/lib/api-client";

type CheckInStatus = "CHECKED_IN" | "PENDING" | "MISSED";
type OrgBooking = {
  id: string;
  startTime: string;
  status: string;
  checkInStatus: CheckInStatus;
  bookedBy: { name: string };
  asset: { assetTag: string; name: string };
};

const POLL_INTERVAL_MS = 20_000;

function CheckInStatusBadge({ status }: { status: CheckInStatus }) {
  if (status === "CHECKED_IN") return <Badge variant="secondary"><CheckCircle2 data-icon="inline-start" />Checked In</Badge>;
  if (status === "MISSED") return <Badge variant="destructive"><XCircle data-icon="inline-start" />Missed</Badge>;
  return <Badge variant="outline"><Clock data-icon="inline-start" />Pending</Badge>;
}

export function BookingCheckInStatusPanel() {
  const [bookings, setBookings] = React.useState<OrgBooking[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  const load = React.useCallback(async () => {
    try {
      const res = await fetch("/api/bookings?scope=org");
      const json = await readApiResponse<{ data: OrgBooking[] }>(res, "Failed to load check-in status");
      setBookings(json.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load check-in status");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => void load());
    const interval = window.setInterval(() => void load(), POLL_INTERVAL_MS);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(interval);
    };
  }, [load]);

  return (
    <section className="border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <CalendarCheck className="size-4 text-primary" />
          Today&apos;s check-in status
        </h2>
        <Badge variant="outline">
          <Radio data-icon="inline-start" className="text-emerald-500" />
          Live
        </Badge>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : bookings.length === 0 ? (
        <div className="flex min-h-20 flex-col items-center justify-center gap-1.5 text-center">
          <CalendarCheck className="size-5 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">No bookings scheduled for today.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="py-1.5 pr-2 font-medium">Asset</th>
                <th className="py-1.5 pr-2 font-medium">Booked By</th>
                <th className="py-1.5 pr-2 font-medium">Start Time</th>
                <th className="py-1.5 pr-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b, index) => (
                <motion.tr
                  key={b.id}
                  initial={prefersReducedMotion ? undefined : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{
                    duration: prefersReducedMotion ? 0 : 0.15,
                    delay: prefersReducedMotion ? 0 : Math.min(index, 10) * 0.02,
                  }}
                  className="border-b border-border last:border-0"
                >
                  <td className="min-w-0 truncate py-1.5 pr-2">{b.asset.assetTag}</td>
                  <td className="min-w-0 truncate py-1.5 pr-2">{b.bookedBy.name}</td>
                  <td className="py-1.5 pr-2 whitespace-nowrap">{new Date(b.startTime).toLocaleTimeString()}</td>
                  <td className="py-1.5 pr-2">
                    <CheckInStatusBadge status={b.checkInStatus} />
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
