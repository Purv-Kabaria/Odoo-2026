import { z } from 'zod';

export const AuditCycleListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const AuditCycleCreateSchema = z
  .object({
    name: z.string().trim().min(2).max(140),
    scopeType: z.enum(['DEPARTMENT', 'LOCATION']),
    departmentId: z.uuid().optional(),
    location: z.string().trim().min(1).max(140).optional(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    auditorIds: z.array(z.uuid()).min(1).max(20),
  })
  .refine(
    (data) =>
      data.scopeType === 'DEPARTMENT'
        ? Boolean(data.departmentId)
        : Boolean(data.location),
    {
      message:
        'departmentId is required when scopeType is DEPARTMENT, location is required when scopeType is LOCATION',
      path: ['scopeType'],
    },
  )
  .refine((data) => data.endDate >= data.startDate, {
    message: 'endDate must be on or after startDate',
    path: ['endDate'],
  });

export const AuditItemMarkSchema = z.object({
  status: z.enum(['VERIFIED', 'MISSING', 'DAMAGED']),
  note: z.string().trim().max(500).optional(),
});

export type AuditCycleCreateInput = z.infer<typeof AuditCycleCreateSchema>;
export type AuditItemMarkInput = z.infer<typeof AuditItemMarkSchema>;
