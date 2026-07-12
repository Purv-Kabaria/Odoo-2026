"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
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

function StatusBadge({ status }: { status: CheckInStatus }) {
  if (status === "CHECKED_IN") return <Badge variant="secondary">Checked In</Badge>;
  if (status === "MISSED") return <Badge variant="destructive">Missed</Badge>;
  return <Badge variant="outline">Pending</Badge>;
}

export function BookingCheckInStatusPanel() {
  const [bookings, setBookings] = React.useState<OrgBooking[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

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
        <h2 className="text-sm font-semibold">Today&apos;s check-in status</h2>
        <Badge variant="outline">Live</Badge>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : bookings.length === 0 ? (
        <p className="text-xs text-muted-foreground">No bookings scheduled for today.</p>
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
              {bookings.map((b) => (
                <tr key={b.id} className="border-b border-border last:border-0">
                  <td className="min-w-0 truncate py-1.5 pr-2">{b.asset.assetTag}</td>
                  <td className="min-w-0 truncate py-1.5 pr-2">{b.bookedBy.name}</td>
                  <td className="py-1.5 pr-2 whitespace-nowrap">{new Date(b.startTime).toLocaleTimeString()}</td>
                  <td className="py-1.5 pr-2">
                    <StatusBadge status={b.checkInStatus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
