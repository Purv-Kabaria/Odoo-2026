import { z } from "zod";

export const NotificationListQuerySchema = z.object({
  cursor: z.string().datetime({ offset: true }).optional(),
  filter: z.enum(["alerts", "approvals", "bookings"]).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type NotificationListQuery = z.infer<typeof NotificationListQuerySchema>;
