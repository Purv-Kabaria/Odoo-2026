import { z } from 'zod';

export const EntityListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(200).default(''),
});

export const BulkDeleteSchema = z.object({
  ids: z
    .array(z.string().cuid('Invalid resource identifier'))
    .max(500)
    .optional(),
});

/** Bulk "edit selected" — set one field to one value across many rows. */
export const BulkUpdateSchema = z.object({
  ids: z.array(z.string().cuid('Invalid resource identifier')).min(1).max(500),
  field: z.string().min(1).max(60),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
});

export type EntityListQuery = z.infer<typeof EntityListQuerySchema>;

export const ProductSchema = z.object({
  id: z.string().cuid().optional(),
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
  id: z.string().cuid().optional(),
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
