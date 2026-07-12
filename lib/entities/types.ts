import type { Role } from '@prisma/client';
import type { z } from 'zod';

/**
 * Column type drives three things generically: which Prisma where-clause
 * shape a filter/search on it builds (`lib/entities/query.ts`), which input
 * control renders for it in a create/edit form (`components/forms/entity-form.tsx`),
 * and how its value is formatted for display in a table cell.
 */
export type EntityColumnType =
  | 'text'
  | 'email'
  | 'number'
  | 'boolean'
  | 'date'
  | 'select';

export type SelectOption = {
  label: string;
  value: string;
};

export type EntityColumn = {
  /** Prisma field name — must match the model exactly. */
  key: string;
  label: string;
  type: EntityColumnType;
  /** Options for type: "select" — required when type is "select". */
  options?: SelectOption[];
  sortable?: boolean;
  filterable?: boolean;
  /** Included in the "all fields" text search and the Postgres ILIKE fallback. */
  searchable?: boolean;
  /** Whether the column is shown in the table by default (still toggleable). */
  visibleByDefault?: boolean;
  /** Whether the column appears in create/edit forms. Defaults to true. */
  editable?: boolean;
  /** Custom display formatting for the table cell (e.g. cents -> "$12.34"). */
  format?: (value: unknown) => string;
};

export type EntityAction = 'read' | 'create' | 'update' | 'delete';

export type EntityPermissions = Record<EntityAction, Role[]>;

/**
 * Extra guard for fields within an entity that need a stricter role than
 * the entity's general `update` permission — e.g. any signed-in Asset
 * Manager can update a user's name, but only an Admin can change their role.
 * the entity's general `update` permission — e.g. any signed-in Asset Manager
 * can update a user's name, but only an Admin can change their role.
 */
export type RestrictedFields = {
  fields: string[];
  allowedRoles: Role[];
};

export type EntityConfig = {
  /** URL-safe key: used in API route dispatch, localStorage keys, nav hrefs. */
  key: string;
  label: string;
  singularLabel: string;
  prismaModel: 'user' | 'organization' | 'department' | 'asset' | 'assetCategory';
  columns: EntityColumn[];
  /** Validates both create and update payloads (id/createdAt/updatedAt omitted). */
  schema: z.ZodTypeAny;
  permissions: EntityPermissions;
  restrictedFields?: RestrictedFields;
  defaultSort: { field: string; order: 'asc' | 'desc' };
  /** Omit entirely for Postgres-only search (no Meilisearch index for this entity). */
  search?: { indexEnv: string };
};

/**
 * The structural subset `lib/meilisearch.ts` actually needs. Lets a
 * bespoke, non-generic-CRUD domain (e.g. Asset) reuse Meilisearch indexing
 * without joining the generic `entityRegistry`/`EntityConfig` machinery —
 * any `EntityConfig` already satisfies this.
 */
export type SearchableEntity = Pick<EntityConfig, 'key' | 'search' | 'columns'>;

export function canPerform(
  config: EntityConfig,
  action: EntityAction,
  role: Role,
): boolean {
  return config.permissions[action].includes(role);
}

export function editableColumns(config: EntityConfig): EntityColumn[] {
  return config.columns.filter((column) => column.editable !== false);
}

export function filterableColumns(config: SearchableEntity): EntityColumn[] {
  return config.columns.filter((column) => column.filterable);
}

export function sortableColumns(config: SearchableEntity): EntityColumn[] {
  return config.columns.filter((column) => column.sortable);
}

export function searchableColumns(config: SearchableEntity): EntityColumn[] {
  return config.columns.filter((column) => column.searchable);
}
