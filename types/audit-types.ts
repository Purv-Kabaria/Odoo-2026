import { z } from "zod";

export const AuditCycleListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["PLANNED", "IN_PROGRESS", "CLOSED"]).optional(),
});

export const AuditCycleCreateSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(140),
    scopeDeptId: z.string().uuid().optional().nullable(),
    scopeLocation: z.string().trim().min(1).max(160).optional().nullable(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    auditorIds: z.array(z.string().uuid()).min(1, "Assign at least one auditor").max(20),
  })
  .refine((data) => !(data.scopeDeptId && data.scopeLocation), {
    message: "Scope by department or location, not both",
    path: ["scopeLocation"],
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "End date must be on or after the start date",
    path: ["endDate"],
  });

export const AuditItemMarkSchema = z.object({
  verification: z.enum(["VERIFIED", "MISSING", "DAMAGED"]),
  notes: z.string().trim().max(500).optional().nullable(),
});

export type AuditCycleCreateInput = z.infer<typeof AuditCycleCreateSchema>;
export type AuditItemMarkInput = z.infer<typeof AuditItemMarkSchema>;
