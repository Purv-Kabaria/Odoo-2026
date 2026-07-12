import { z } from 'zod';

export const EntityListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(200).default(''),
});

export const BulkDeleteSchema = z.object({
  ids: z
    .array(z.string().uuid('Invalid resource identifier'))
    .max(500)
    .optional(),
});

/** Bulk "edit selected" — set one field to one value across many rows. */
export const BulkUpdateSchema = z.object({
  ids: z.array(z.string().uuid('Invalid resource identifier')).min(1).max(500),
  field: z.string().min(1).max(60),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
});

export type EntityListQuery = z.infer<typeof EntityListQuerySchema>;

export const OrganizationSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(140),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers, and hyphens'),
  createdAt: z.union([z.string(), z.date()]).optional(),
  updatedAt: z.union([z.string(), z.date()]).optional(),
});

export const OrganizationWriteSchema = OrganizationSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type OrganizationType = z.infer<typeof OrganizationSchema>;
export type OrganizationWriteInput = z.infer<typeof OrganizationWriteSchema>;

export const DepartmentSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(140),
  headId: z.string().uuid().nullable().optional(),
  parentDepartmentId: z.string().uuid().nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).default('ACTIVE'),
  createdAt: z.union([z.string(), z.date()]).optional(),
  updatedAt: z.union([z.string(), z.date()]).optional(),
});

export const DepartmentWriteSchema = DepartmentSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type DepartmentType = z.infer<typeof DepartmentSchema>;
export type DepartmentWriteInput = z.infer<typeof DepartmentWriteSchema>;
