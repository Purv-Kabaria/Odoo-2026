import { z } from "zod";

// Kits are physically curated bundles ("New Hire Kit") — cap at a size that
// keeps the bulk-allocate transaction (§ app/api/kits/[id]/allocate) fast
// and bounded on a serverless invocation, and reject a single-asset "kit"
// since that's just an ordinary allocation.
const KIT_MIN_ITEMS = 2;
const KIT_MAX_ITEMS = 50;

function uniqueIds(ids: string[]): boolean {
  return new Set(ids).size === ids.length;
}

export const KitCreateSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).optional().nullable(),
  assetIds: z
    .array(z.string().uuid())
    .min(KIT_MIN_ITEMS, `A kit needs at least ${KIT_MIN_ITEMS} assets`)
    .max(KIT_MAX_ITEMS, `A kit can hold at most ${KIT_MAX_ITEMS} assets`)
    .refine(uniqueIds, "Duplicate asset in kit"),
});

export const KitListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const AllocateKitSchema = z
  .object({
    toEmployeeId: z.string().uuid().optional(),
    toDepartmentId: z.string().uuid().optional(),
    expectedReturnDate: z.coerce.date().optional().nullable(),
  })
  .refine((data) => Boolean(data.toEmployeeId) !== Boolean(data.toDepartmentId), {
    message: "Choose exactly one of employee or department",
  });

export type KitCreateInput = z.infer<typeof KitCreateSchema>;
export type AllocateKitInput = z.infer<typeof AllocateKitSchema>;
