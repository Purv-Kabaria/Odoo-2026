import { z } from "zod";

export const ActivityListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  since: z
    .string()
    .datetime({ offset: true })
    .optional(),
});

export type ActivityListQuery = z.infer<typeof ActivityListQuerySchema>;
