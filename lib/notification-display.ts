/**
 * Client-safe display metadata for notification categories. Deliberately
 * separate from `lib/notifications.ts` (server-only: imports Prisma,
 * `logger`, Redis) — a "use client" component can't import that file at
 * all, even just for a label map, without pulling Node-only code into the
 * browser bundle.
 */
export type NotificationCategoryValue = "ALERT" | "APPROVAL" | "BOOKING" | "ASSIGNMENT" | "INFO";

export const CATEGORY_LABELS: Record<NotificationCategoryValue, string> = {
  ALERT: "Alerts",
  APPROVAL: "Approvals",
  BOOKING: "Bookings",
  ASSIGNMENT: "Assignments",
  INFO: "Info",
};

export const CATEGORY_DOT_CLASS: Record<NotificationCategoryValue, string> = {
  ALERT: "bg-destructive",
  APPROVAL: "bg-[var(--chart-2)]",
  BOOKING: "bg-[var(--chart-1)]",
  ASSIGNMENT: "bg-[var(--chart-4)]",
  INFO: "bg-muted-foreground",
};

export type NotificationView = {
  id: string;
  type: string;
  category: NotificationCategoryValue;
  title: string;
  body: string | null;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
};
