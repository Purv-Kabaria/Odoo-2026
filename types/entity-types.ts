import { z } from 'zod';

export const EntityListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(200).default(''),
});

export const BulkDeleteSchema = z.object({
  ids: z
    .array(z.uuid('Invalid resource identifier'))
    .max(500)
    .optional(),
});

/** Bulk "edit selected" — set one field to one value across many rows. */
export const BulkUpdateSchema = z.object({
  ids: z.array(z.uuid('Invalid resource identifier')).min(1).max(500),
  field: z.string().min(1).max(60),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
});

export type EntityListQuery = z.infer<typeof EntityListQuerySchema>;

export const ProductSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2).max(140),
  sku: z.string().trim().min(2).max(80),
  category: z.string().trim().min(2).max(80),
  status: z.enum(['ACTIVE', 'DRAFT', 'ARCHIVED']).default('DRAFT'),
  priceCents: z.number().int().min(0),
  stock: z.number().int().min(0),
  createdAt: z.union([z.string(), z.date()]).optional(),
  updatedAt: z.union([z.string(), z.date()]).optional(),
});

export const ProductWriteSchema = ProductSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const OrganizationSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2).max(140),
  slug: z.string().trim().min(2).max(100),
  industry: z.string().trim().min(2).max(80),
  region: z.string().trim().min(2).max(80),
  plan: z.enum(['STARTER', 'GROWTH', 'ENTERPRISE']).default('STARTER'),
  seats: z.number().int().min(1),
  createdAt: z.union([z.string(), z.date()]).optional(),
  updatedAt: z.union([z.string(), z.date()]).optional(),
});

export const OrganizationWriteSchema = OrganizationSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ProductType = z.infer<typeof ProductSchema>;
export type ProductWriteInput = z.infer<typeof ProductWriteSchema>;
export type OrganizationType = z.infer<typeof OrganizationSchema>;
export type OrganizationWriteInput = z.infer<typeof OrganizationWriteSchema>;

export const AssetSchema = z.object({
  id: z.uuid().optional(),
  assetTag: z.string().trim().min(3).max(20),
  name: z.string().trim().min(2).max(140),
  category: z.string().trim().min(2).max(80),
  serialNumber: z.string().trim().max(100).optional().nullable(),
  status: z
    .enum([
      'AVAILABLE',
      'ALLOCATED',
      'RESERVED',
      'UNDER_MAINTENANCE',
      'LOST',
      'RETIRED',
      'DISPOSED',
    ])
    .default('AVAILABLE'),
  condition: z.enum(['NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED']).default('GOOD'),
  location: z.string().trim().max(140).optional().nullable(),
  departmentId: z.uuid().optional().nullable(),
  acquisitionDate: z.union([z.string(), z.date()]).optional().nullable(),
  acquisitionCostCents: z.number().int().min(0).optional().nullable(),
  isBookable: z.boolean().default(false),
  createdAt: z.union([z.string(), z.date()]).optional(),
  updatedAt: z.union([z.string(), z.date()]).optional(),
});

export const AssetWriteSchema = AssetSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const DepartmentSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2).max(140),
  parentId: z.uuid().optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  createdAt: z.union([z.string(), z.date()]).optional(),
  updatedAt: z.union([z.string(), z.date()]).optional(),
});

export const DepartmentWriteSchema = DepartmentSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type AssetType = z.infer<typeof AssetSchema>;
export type AssetWriteInput = z.infer<typeof AssetWriteSchema>;
export type DepartmentType = z.infer<typeof DepartmentSchema>;
export type DepartmentWriteInput = z.infer<typeof DepartmentWriteSchema>;
