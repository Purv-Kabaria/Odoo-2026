import { z } from "zod";

export const AllocateAssetSchema = z
  .object({
    assetId: z.string().cuid(),
    toEmployeeId: z.string().cuid().optional(),
    toDepartmentId: z.string().cuid().optional(),
    expectedReturnDate: z.coerce.date().optional().nullable(),
  })
  .refine((data) => Boolean(data.toEmployeeId) !== Boolean(data.toDepartmentId), {
    message: "Choose exactly one of employee or department",
  });

export const ReturnAllocationSchema = z.object({
  returnCondition: z.enum(["NEW", "GOOD", "FAIR", "POOR", "DAMAGED"]),
  checkInNotes: z.string().trim().max(1000).optional().nullable(),
});

export const AllocationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  scope: z.enum(["mine", "department", "all"]).default("mine"),
  overdue: z.coerce.boolean().optional(),
});

export const TransferRequestCreateSchema = z.object({
  assetId: z.string().cuid(),
  toEmployeeId: z.string().cuid(),
  reason: z.string().trim().min(2).max(500),
});

export type AllocateAssetInput = z.infer<typeof AllocateAssetSchema>;
export type TransferRequestCreateInput = z.infer<typeof TransferRequestCreateSchema>;
