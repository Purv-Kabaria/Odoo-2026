import { prisma } from '@/lib/prisma';

import type { EntityConfig } from './types';

/**
 * Structural subset of a Prisma model delegate that every generic CRUD
 * operation needs. Intentionally loose (`any` args/results) — this is the
 * single boundary where the generic engine trades static type safety for
 * genericity across arbitrary models. Real type safety is enforced at the
 * edges instead: Zod validates every payload, and each entity's config +
 * the UI consuming its rows are typed against the real schema.
 */
export type GenericDelegate = {
  findMany: (
    args: Record<string, unknown>,
  ) => Promise<Record<string, unknown>[]>;
  findUnique: (
    args: Record<string, unknown>,
  ) => Promise<Record<string, unknown> | null>;
  count: (args: Record<string, unknown>) => Promise<number>;
  create: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
  update: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
  updateMany: (args: Record<string, unknown>) => Promise<{ count: number }>;
  delete: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
  deleteMany: (args: Record<string, unknown>) => Promise<{ count: number }>;
};

export function getDelegate(config: EntityConfig): GenericDelegate {
  return prisma[config.prismaModel] as unknown as GenericDelegate;
}
