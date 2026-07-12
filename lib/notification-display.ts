import {
  Bell,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  type LucideIcon,
} from "lucide-react";

/**
 * Client-safe display metadata for notifications. Deliberately separate
 * from `lib/notifications.ts` (server-only: imports Prisma, `logger`,
 * Redis) — a "use client" component can't import that file at all, even
 * just for a label map, without pulling Node-only code into the browser
 * bundle.
 *
 * The `Notification` model has no `category` column — the feed filter
 * (`docs/API_DESIGN.md` §Notifications: all/alerts/approvals/bookings) is
 * derived from `type` server-side via `NOTIFICATION_FILTER_TYPES` in
 * `lib/notifications.ts`. This file keeps its own small type→tab/icon/color
 * map for rendering, kept in sync with that server-side grouping by hand.
 */
export type NotificationTypeValue =
  | "ASSET_ASSIGNED"
  | "TRANSFER_APPROVED"
  | "TRANSFER_REJECTED"
  | "MAINTENANCE_APPROVED"
  | "MAINTENANCE_REJECTED"
  | "MAINTENANCE_TECHNICIAN_ASSIGNED"
  | "MAINTENANCE_RESOLVED"
  | "BOOKING_CONFIRMED"
  | "BOOKING_CANCELLED"
  | "BOOKING_REMINDER"
  | "OVERDUE_RETURN"
  | "AUDIT_DISCREPANCY";

export type NotificationFilterValue = "alerts" | "approvals" | "bookings";

/** Mirrors `NOTIFICATION_FILTER_TYPES` in `lib/notifications.ts` — kept
 * here too since a client component can't import that server-only file. */
export const TYPE_TO_FILTER: Record<NotificationTypeValue, NotificationFilterValue | null> = {
  ASSET_ASSIGNED: null,
  TRANSFER_APPROVED: "approvals",
  TRANSFER_REJECTED: "approvals",
  MAINTENANCE_APPROVED: "approvals",
  MAINTENANCE_REJECTED: "approvals",
  MAINTENANCE_TECHNICIAN_ASSIGNED: "approvals",
  MAINTENANCE_RESOLVED: "approvals",
  BOOKING_CONFIRMED: "bookings",
  BOOKING_CANCELLED: "bookings",
  BOOKING_REMINDER: "bookings",
  OVERDUE_RETURN: "alerts",
  AUDIT_DISCREPANCY: "alerts",
};

export const FILTER_LABELS: Record<NotificationFilterValue, string> = {
  alerts: "Alerts",
  approvals: "Approvals",
  bookings: "Bookings",
};

export const FILTER_ICONS: Record<NotificationFilterValue, LucideIcon> = {
  alerts: Bell,
  approvals: CheckCircle2,
  bookings: CalendarClock,
};

/** Falls back to a neutral dot for ASSET_ASSIGNED (no filter tab). */
export function dotClassForType(type: NotificationTypeValue): string {
  const filter = TYPE_TO_FILTER[type];
  if (filter === "alerts") return "bg-destructive";
  if (filter === "approvals") return "bg-[var(--chart-2)]";
  if (filter === "bookings") return "bg-[var(--chart-1)]";
  return "bg-[var(--chart-4)]";
}

export function iconForType(type: NotificationTypeValue): LucideIcon {
  const filter = TYPE_TO_FILTER[type];
  return filter ? FILTER_ICONS[filter] : ClipboardCheck;
}

export type NotificationView = {
  id: string;
  type: NotificationTypeValue;
  title: string;
  body: string | null;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  isRead: boolean;
  createdAt: string;
};
