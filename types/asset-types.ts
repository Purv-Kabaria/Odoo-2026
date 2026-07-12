import { z } from "zod";

export const AssetListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(200).default(""),
  category: z.string().trim().max(60).optional(),
  status: z
    .enum(["AVAILABLE", "ALLOCATED", "RESERVED", "UNDER_MAINTENANCE", "LOST", "RETIRED", "DISPOSED"])
    .optional(),
  departmentId: z.string().cuid().optional(),
  location: z.string().trim().max(120).optional(),
});

export const CustomFieldValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const AssetCreateSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(140),
  categoryId: z.string().cuid("Select a category"),
  serialNumber: z.string().trim().max(120).optional().nullable(),
  acquisitionDate: z.coerce.date().optional().nullable(),
  acquisitionCost: z.coerce.number().min(0).max(99_999_999.99).optional().nullable(),
  condition: z.enum(["NEW", "GOOD", "FAIR", "POOR", "DAMAGED"]).default("GOOD"),
  location: z.string().trim().max(160).optional().nullable(),
  photoUrl: z.string().url().max(2048).optional().nullable(),
  isBookable: z.boolean().default(false),
  customFields: z.record(z.string(), CustomFieldValueSchema).optional(),
});

// Status can only move to a manual terminal state here — ALLOCATED,
// RESERVED, and UNDER_MAINTENANCE are side effects of their own
// action endpoints, never set directly (AGENTS.md §3 skeleton + the
// API contract's "not set freely" rule for PATCH /assets/:id).
export const AssetManualStatusSchema = z.enum(["RETIRED", "DISPOSED", "LOST"]);

export const AssetUpdateSchema = z.object({
  name: z.string().trim().min(2).max(140).optional(),
  serialNumber: z.string().trim().max(120).optional().nullable(),
  acquisitionDate: z.coerce.date().optional().nullable(),
  acquisitionCost: z.coerce.number().min(0).max(99_999_999.99).optional().nullable(),
  condition: z.enum(["NEW", "GOOD", "FAIR", "POOR", "DAMAGED"]).optional(),
  location: z.string().trim().max(160).optional().nullable(),
  photoUrl: z.string().url().max(2048).optional().nullable(),
  isBookable: z.boolean().optional(),
  customFields: z.record(z.string(), CustomFieldValueSchema).optional(),
  status: AssetManualStatusSchema.optional(),
});

export const AssetLookupQuerySchema = z
  .object({
    tag: z.string().trim().max(20).optional(),
    serial: z.string().trim().max(120).optional(),
    qr: z.string().trim().max(200).optional(),
  })
  .refine((data) => [data.tag, data.serial, data.qr].filter(Boolean).length === 1, {
    message: "Provide exactly one of tag, serial, or qr",
  });

export const CategoryCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
});

export type AssetCreateInput = z.infer<typeof AssetCreateSchema>;
export type AssetUpdateInput = z.infer<typeof AssetUpdateSchema>;
export type AssetListQuery = z.infer<typeof AssetListQuerySchema>;
