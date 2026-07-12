import { z } from 'zod';

export const NotificationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  category: z.enum(['ALERT', 'APPROVAL', 'BOOKING', 'ASSIGNMENT', 'INFO']).optional(),
});

export type NotificationListQuery = z.infer<typeof NotificationListQuerySchema>;
