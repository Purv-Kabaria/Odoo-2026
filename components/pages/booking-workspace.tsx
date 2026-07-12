"use client";

import * as React from "react";
import { differenceInSeconds } from "date-fns";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookingCheckInStatusPanel } from "@/components/pages/booking-checkin-status-panel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { readApiResponse } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type Asset = { id: string; assetTag: string; name: string; isBookable: boolean };
type CheckInStatus = "CHECKED_IN" | "PENDING" | "MISSED";
type Booking = {
  id: string;
  title: string | null;
  startTime: string;
  endTime: string;
  status: string;
  checkedIn?: boolean;
  checkInDeadline?: string | null;
  checkInGraceExtended?: boolean;
  checkInStatus?: CheckInStatus;
  bookedBy?: { name: string };
  asset?: { assetTag: string; name: string };
};

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const DAY_START_HOUR = 8;
const DAY_END_HOUR = 18;

function toLocalDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function minutesFromDayStart(date: Date, dayStart: Date): number {
  return (date.getTime() - dayStart.getTime()) / 60000;
}

export function BookingWorkspace({ isManager = false }: { isManager?: boolean }) {
  const [assets, setAssets] = React.useState<Asset[]>([]);
  const [assetId, setAssetId] = React.useState("");
  const [dateStr, setDateStr] = React.useState(() => toLocalDateInput(new Date()));
  const [dayBookings, setDayBookings] = React.useState<Booking[]>([]);
  const [myBookings, setMyBookings] = React.useState<Booking[]>([]);
  const [startTime, setStartTime] = React.useState("09:00");
  const [endTime, setEndTime] = React.useState("10:00");
  const [conflict, setConflict] = React.useState<{ from: Date; to: Date } | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [checkingInId, setCheckingInId] = React.useState<string | null>(null);
  const [now, setNow] = React.useState(() => new Date());

  React.useEffect(() => {
    fetch("/api/assets?isBookable=true&limit=100")
      .then((res) => readApiResponse<{ data: Asset[] }>(res, "Failed to load resources"))
      .then((json) => {
        const bookable = json.data.filter((a) => a.isBookable);
        setAssets(bookable);
        if (bookable.length > 0) setAssetId((current) => current || bookable[0].id);
      })
      .catch(() => undefined);
  }, []);

  const loadMyBookings = React.useCallback(async () => {
    try {
      const res = await fetch("/api/bookings");
      const json = await readApiResponse<{ data: Booking[] }>(res, "Failed to load your bookings");
      setMyBookings(json.data);
    } catch {
      // non-fatal for the page
    }
  }, []);

  const dayWindow = React.useMemo(() => {
    const from = new Date(`${dateStr}T00:00:00`);
    const to = new Date(`${dateStr}T23:59:59`);
    return { from, to };
  }, [dateStr]);

  const loadDayBookings = React.useCallback(async () => {
    if (!assetId) return;
    try {
      const params = new URLSearchParams({ from: dayWindow.from.toISOString(), to: dayWindow.to.toISOString() });
      const res = await fetch(`/api/assets/${assetId}/bookings?${params.toString()}`);
      const json = await readApiResponse<{ data: Booking[] }>(res, "Failed to load bookings");
      setDayBookings(json.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load bookings");
    }
  }, [assetId, dayWindow]);

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void loadDayBookings();
      void loadMyBookings();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loadDayBookings, loadMyBookings]);

  const hasPendingCheckIn = myBookings.some(
    (b) => (b.checkInStatus ?? "PENDING") === "PENDING" && b.status !== "CANCELLED" && b.status !== "COMPLETED",
  );

  // Live countdown ticker for check-in deadlines, independent of the
  // server-refresh poll below.
  React.useEffect(() => {
    if (!hasPendingCheckIn) return;
    const interval = window.setInterval(() => setNow(new Date()), 10_000);
    return () => window.clearInterval(interval);
  }, [hasPendingCheckIn]);

  // No realtime channel for bookings — poll so server-side auto-cancel/grace
  // extension (from the check-in cron sweep) shows up without a manual refresh.
  React.useEffect(() => {
    if (!hasPendingCheckIn) return;
    const interval = window.setInterval(() => void loadMyBookings(), 20_000);
    return () => window.clearInterval(interval);
  }, [hasPendingCheckIn, loadMyBookings]);

  const requestedRange = React.useMemo(() => {
    if (!startTime || !endTime) return null;
    const start = new Date(`${dateStr}T${startTime}:00`);
    const end = new Date(`${dateStr}T${endTime}:00`);
    return { start, end };
  }, [dateStr, startTime, endTime]);

  const localConflict = React.useMemo(() => {
    if (!requestedRange) return false;
    return dayBookings.some((b) => {
      const bStart = new Date(b.startTime);
      const bEnd = new Date(b.endTime);
      return requestedRange.start < bEnd && requestedRange.end > bStart;
    });
  }, [requestedRange, dayBookings]);

  const handleBook = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!requestedRange) return;
    setIsSubmitting(true);
    setConflict(null);

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId,
          startTime: requestedRange.start.toISOString(),
          endTime: requestedRange.end.toISOString(),
        }),
      });

      if (response.status === 409) {
        setConflict({ from: requestedRange.start, to: requestedRange.end });
        toast.error("Slot is unavailable — it conflicts with an existing booking.");
        return;
      }

      await readApiResponse(response, "Failed to create booking");
      toast.success("Booking confirmed");
      void loadDayBookings();
      void loadMyBookings();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create booking");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckIn = async (id: string) => {
    setCheckingInId(id);
    try {
      const response = await fetch(`/api/bookings/${id}/check-in`, { method: "POST" });
      await readApiResponse(response, "Failed to check in");
      toast.success("Checked in");
      void loadMyBookings();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to check in");
      void loadMyBookings();
    } finally {
      setCheckingInId(null);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      const response = await fetch(`/api/bookings/${id}/cancel`, { method: "POST" });
      await readApiResponse(response, "Failed to cancel booking");
      toast.success("Booking cancelled");
      void loadDayBookings();
      void loadMyBookings();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to cancel booking");
    }
  };

  const totalMinutes = (DAY_END_HOUR - DAY_START_HOUR) * 60;
  const dayStart = new Date(`${dateStr}T${String(DAY_START_HOUR).padStart(2, "0")}:00:00`);

  return (
    <main className="mx-auto w-full max-w-6xl px-3 py-6 sm:px-4 md:px-6 lg:px-8">
      <div className="mb-5 space-y-1">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Assets</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Resource Booking</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">Book shared resources by time slot with no overlaps.</p>
      </div>

      <div className="mb-4 flex flex-col gap-2 border border-border bg-card p-3 shadow-sm sm:flex-row sm:items-center">
        <Select value={assetId} onValueChange={setAssetId}>
          <SelectTrigger className="w-full cursor-pointer sm:w-64"><SelectValue placeholder="Select a resource" /></SelectTrigger>
          <SelectContent>
            {assets.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)} className="w-full sm:w-44" />
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-[1fr_320px]">
        <section className="border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">Day timeline</h2>
          <div className="relative border border-border" style={{ height: `${(DAY_END_HOUR - DAY_START_HOUR) * 48}px` }}>
            {Array.from({ length: DAY_END_HOUR - DAY_START_HOUR + 1 }).map((_, i) => (
              <div
                key={i}
                className="absolute left-0 right-0 border-t border-border text-xs text-muted-foreground"
                style={{ top: `${i * 48}px` }}
              >
                <span className="-mt-2 inline-block bg-card px-1">{String(DAY_START_HOUR + i).padStart(2, "0")}:00</span>
              </div>
            ))}
            {dayBookings.map((b) => {
              const top = (minutesFromDayStart(new Date(b.startTime), dayStart) / totalMinutes) * ((DAY_END_HOUR - DAY_START_HOUR) * 48);
              const height = ((new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) / 60000 / totalMinutes) * ((DAY_END_HOUR - DAY_START_HOUR) * 48);
              return (
                <div
                  key={b.id}
                  className="absolute left-16 right-2 overflow-hidden truncate rounded-md bg-primary/80 px-2 py-1 text-xs text-primary-foreground shadow-sm"
                  style={{ top: `${Math.max(0, top)}px`, height: `${Math.max(20, height)}px` }}
                >
                  {b.title ?? "Booked"} — {b.bookedBy?.name}
                </div>
              );
            })}
            {conflict && (
              <div
                className="absolute left-16 right-2 rounded-md border-2 border-dashed border-destructive bg-destructive/10 px-2 py-1 text-xs text-destructive"
                style={{
                  top: `${Math.max(0, (minutesFromDayStart(conflict.from, dayStart) / totalMinutes) * ((DAY_END_HOUR - DAY_START_HOUR) * 48))}px`,
                  height: `${Math.max(20, ((conflict.to.getTime() - conflict.from.getTime()) / 60000 / totalMinutes) * ((DAY_END_HOUR - DAY_START_HOUR) * 48))}px`,
                }}
              >
                Requested {startTime} to {endTime} — conflict — slot is unavailable
              </div>
            )}
          </div>
        </section>

        <section className="border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">Book this resource</h2>
          <form onSubmit={(e) => void handleBook(e)} className="grid gap-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-2">
                <Label htmlFor="booking-start">Start</Label>
                <Input id="booking-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="booking-end">End</Label>
                <Input id="booking-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
              </div>
            </div>
            {localConflict && (
              <p className="text-xs text-destructive">This slot overlaps an existing booking.</p>
            )}
            <Button type="submit" disabled={isSubmitting || !assetId || localConflict} className="cursor-pointer">
              {isSubmitting ? "Booking..." : "Book slot"}
            </Button>
          </form>

          <div className="mt-5">
            <h3 className="mb-2 text-sm font-semibold">My upcoming bookings</h3>
            {myBookings.length === 0 ? (
              <p className="text-xs text-muted-foreground">No upcoming bookings.</p>
            ) : (
              <ul className="space-y-2">
                {myBookings.map((b) => {
                  const checkInStatus = b.checkInStatus ?? "PENDING";
                  const canCheckIn =
                    checkInStatus === "PENDING" &&
                    b.status !== "CANCELLED" &&
                    b.status !== "COMPLETED" &&
                    now >= new Date(b.startTime);
                  const secondsToDeadline = b.checkInDeadline
                    ? differenceInSeconds(new Date(b.checkInDeadline), now)
                    : null;
                  const inGrace = Boolean(b.checkInGraceExtended) && checkInStatus === "PENDING";

                  return (
                    <li key={b.id} className="flex flex-col gap-2 border border-border p-2 text-xs sm:flex-row sm:items-center sm:justify-between">
                      <span className="min-w-0 truncate">
                        {b.asset?.assetTag} — {new Date(b.startTime).toLocaleString()}
                      </span>
                      <div className="flex shrink-0 items-center gap-2">
                        {checkInStatus === "CHECKED_IN" && <Badge variant="secondary">Checked in</Badge>}
                        {checkInStatus === "MISSED" && <Badge variant="destructive">Missed check-in</Badge>}
                        {canCheckIn && secondsToDeadline !== null && (
                          <span className={cn("text-muted-foreground", inGrace && "font-medium text-destructive")}>
                            {inGrace ? "Grace: " : "Check in: "}
                            {formatCountdown(secondsToDeadline)}
                          </span>
                        )}
                        {canCheckIn && (
                          <Button
                            size="sm"
                            variant={inGrace ? "destructive" : "default"}
                            className="cursor-pointer"
                            disabled={checkingInId === b.id}
                            onClick={() => void handleCheckIn(b.id)}
                          >
                            {checkingInId === b.id ? "Checking in..." : "Check In"}
                          </Button>
                        )}
                        {checkInStatus !== "MISSED" && b.status !== "CANCELLED" && b.status !== "COMPLETED" && (
                          <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => void handleCancel(b.id)}>
                            Cancel
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </div>

      {isManager && <BookingCheckInStatusPanel />}
    </main>
  );
}
