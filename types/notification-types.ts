import { z } from "zod";

export const NotificationListQuerySchema = z.object({
  cursor: z.string().datetime({ offset: true }).optional(),
  filter: z.enum(["alerts", "approvals", "bookings"]).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type NotificationListQuery = z.infer<typeof NotificationListQuerySchema>;

/**
 * Resume point for the SSE stream: the id of the last notification the client received.
 * Browsers send it automatically as the `Last-Event-ID` header when an EventSource reconnects;
 * the first connection of a page passes it as `?since=` (newest id it already loaded).
 * Notification ids are UUIDv7, so they sort by creation time.
 */
export const NotificationStreamResumeSchema = z.string().uuid();
