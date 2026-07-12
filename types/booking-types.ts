import { z } from "zod";

export const BookingCreateSchema = z
  .object({
    assetId: z.string().uuid(),
    title: z.string().trim().max(140).optional().nullable(),
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
    onBehalfOfDeptId: z.string().uuid().optional().nullable(),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: "End time must be after start time",
    path: ["endTime"],
  });

export const BookingRescheduleSchema = z
  .object({
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: "End time must be after start time",
    path: ["endTime"],
  });

export const BookingWindowQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});

export type BookingCreateInput = z.infer<typeof BookingCreateSchema>;
