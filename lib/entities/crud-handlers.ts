import { z } from 'zod';

import { recordActivityEvent } from '@/lib/activity-events';
import { Api } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import {
  deleteFromSearch,
  searchIds as searchInMeili,
  upsertInSearch,
} from '@/lib/meilisearch';
import {
  deleteCacheByPrefix,
  getJsonCache,
  setJsonCache,
} from '@/lib/redis-cache';
import { BulkDeleteSchema, BulkUpdateSchema } from '@/types/entity-types';
import type { Role } from '@prisma/client';

import { getDelegate } from './prisma-delegate';
import type { FilterRuleInput, SortRuleInput } from './query';
import { buildOrderBy, buildWhere, parseListQuery } from './query';
import { canPerform } from './types';
import type { EntityColumn, EntityConfig } from './types';

const EntityIdSchema = z.object({ id: z.string().cuid('Invalid identifier') });

type EntityListCacheValue = {
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  searchProvider: 'none' | 'postgres' | 'meilisearch';
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isUniqueConstraintError(error: unknown): boolean {
  return isPlainObject(error) && 'code' in error && error.code === 'P2002';
}

/** Fields the caller tried to set explicitly, restricted role check runs against the raw body (pre-Zod-default) so an omitted field never trips it. */
function attemptedRestrictedFields(
  config: EntityConfig,
  rawBody: unknown,
): string[] {
  if (!config.restrictedFields || !isPlainObject(rawBody)) return [];
  return config.restrictedFields.fields.filter((field) => field in rawBody);
}

function isRestrictedFieldAllowed(config: EntityConfig, role: string): boolean {
  if (!config.restrictedFields) return true;
  return (config.restrictedFields.allowedRoles as string[]).includes(role);
}

function entityCachePrefix(config: EntityConfig): string {
  return `entity-list:${config.key}:`;
}

export function invalidateEntityListCache(config: EntityConfig): Promise<void> {
  return deleteCacheByPrefix(entityCachePrefix(config));
}

function entityCacheKey(
  config: EntityConfig,
  role: Role,
  input: {
    page: number;
    limit: number;
    search: string;
    filters: FilterRuleInput[];
    sorts: SortRuleInput[];
  },
): string {
  const payload = JSON.stringify({
    role,
    page: input.page,
    limit: input.limit,
    search: input.search,
    filters: input.filters,
    sorts: input.sorts,
  });

  return `${entityCachePrefix(config)}${Buffer.from(payload).toString('base64url')}`;
}

function normalizeBulkValue(
  column: EntityColumn,
  value: string | number | boolean | null,
): { success: true; value: string | number | boolean | null } | { success: false; error: string } {
  if (value === null) {
    return { success: false, error: `"${column.label}" requires a value` };
  }

  if (column.type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return { success: false, error: `"${column.label}" must be a valid number` };
    }
    return { success: true, value };
  }

  if (column.type === 'boolean') {
    if (typeof value !== 'boolean') {
      return { success: false, error: `"${column.label}" must be true or false` };
    }
    return { success: true, value };
  }

  if (column.type === 'select' && column.options) {
    const allowed = column.options.map((option) => option.value);
    if (typeof value !== 'string' || !allowed.includes(value)) {
      return { success: false, error: `Invalid value for "${column.label}"` };
    }
    return { success: true, value };
  }

  if (typeof value !== 'string') {
    return { success: false, error: `"${column.label}" must be text` };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return { success: false, error: `"${column.label}" requires a value` };
  }

  return { success: true, value: trimmed };
}

/**
 * `GET`/`POST`/`PATCH` (bulk update)/`DELETE` (bulk) for an entity's
 * collection route (`app/api/<entity>/route.ts`). Every handler follows
 * the same shape: authenticate -> authorize -> validate -> mutate ->
 * sync search -> log -> respond. See AGENTS.md §3 for the pattern this
 * generalizes.
 */
export function createCollectionHandlers(config: EntityConfig) {
  async function GET(req: Request) {
    const startedAt = performance.now();
    const requestId = crypto.randomUUID();

    try {
      const user = await getCurrentUser();
      if (!user) return Api.unauthorized();
      if (!canPerform(config, 'read', user.role)) return Api.forbidden();

      const searchParams = new URL(req.url).searchParams;
      const parsed = parseListQuery(config, searchParams);
      if ('error' in parsed) return Api.badRequest(parsed.error);

      const { page, limit, search, filters, sorts } = parsed;
      const skip = (page - 1) * limit;
      const cacheKey = entityCacheKey(config, user.role, {
        page,
        limit,
        search,
        filters,
        sorts,
      });
      const cached = await getJsonCache<EntityListCacheValue>(cacheKey);

      if (cached) {
        logger.info(`${config.key}.list.cache_hit`, {
          requestId,
          durationMs: Math.round(performance.now() - startedAt),
          count: cached.rows.length,
          total: cached.total,
          searchProvider: cached.searchProvider,
        });

        return Api.ok(cached.rows, {
          total: cached.total,
          page: cached.page,
          limit: cached.limit,
          totalPages: cached.totalPages,
          searchProvider: cached.searchProvider,
          cache: 'redis',
        });
      }

      const meiliIds = search
        ? await searchInMeili(
          config,
          search,
          Math.min(1000, Math.max(limit * page, 50)),
        )
        : null;

      const where = buildWhere(config, {
        search,
        filters,
        searchIds: meiliIds ?? undefined,
      });
      const orderBy = buildOrderBy(config, sorts);
      const delegate = getDelegate(config);

      const [rows, total] = await Promise.all([
        delegate.findMany({ where, orderBy, skip, take: limit }),
        delegate.count({ where }),
      ]);

      const searchProvider = !search
        ? 'none'
        : meiliIds === null
          ? 'postgres'
          : 'meilisearch';

      logger.info(`${config.key}.list`, {
        requestId,
        durationMs: Math.round(performance.now() - startedAt),
        count: rows.length,
        total,
        searchProvider,
      });

      const totalPages = Math.max(1, Math.ceil(total / limit));
      const payload: EntityListCacheValue = {
        rows,
        total,
        page,
        limit,
        totalPages,
        searchProvider,
      };

      void setJsonCache(cacheKey, payload);

      return Api.ok(rows, {
        total,
        page,
        limit,
        totalPages,
        searchProvider,
        cache: 'miss',
      });
    } catch (error) {
      logger.error(`${config.key}.list.failed`, error, { requestId });
      return Api.internalError(`Failed to fetch ${config.label.toLowerCase()}`);
    }
  }

  async function POST(req: Request) {
    const requestId = crypto.randomUUID();

    try {
      const user = await getCurrentUser();
      if (!user) return Api.unauthorized();
      if (!canPerform(config, 'create', user.role)) {
        return Api.forbidden(
          `You don't have permission to create ${config.label.toLowerCase()}`,
        );
      }

      const body = await req.json().catch(() => null);

      const attempted = attemptedRestrictedFields(config, body);
      if (
        attempted.length > 0 &&
        !isRestrictedFieldAllowed(config, user.role)
      ) {
        return Api.forbidden(
          `You don't have permission to set: ${attempted.join(', ')}`,
        );
      }

      const validation = config.schema.safeParse(body);
      if (!validation.success) {
        return Api.badRequest(
          `Invalid ${config.singularLabel.toLowerCase()} data`,
          validation.error.format(),
        );
      }

      const delegate = getDelegate(config);
      const created = await delegate.create({
        data: validation.data as Record<string, unknown>,
      });

      void upsertInSearch(config, [created]);
      void invalidateEntityListCache(config);
      void recordActivityEvent({
        action: 'CREATED',
        actorId: user.id,
        entityType: config.key,
        entityId: created.id as string,
        summary: `${config.singularLabel} created`,
        requestId,
        metadata: { entityLabel: config.singularLabel },
      });
      logger.info(`${config.key}.create`, {
        requestId,
        id: created.id as string,
      });

      return Api.created(created);
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        return Api.conflict(
          `A ${config.singularLabel.toLowerCase()} with this value already exists`,
        );
      }
      logger.error(`${config.key}.create.failed`, error, { requestId });
      return Api.internalError(
        `Failed to create ${config.singularLabel.toLowerCase()}`,
      );
    }
  }

  /** Bulk "edit selected": set one field to one value across many rows. */
  async function PATCH(req: Request) {
    const requestId = crypto.randomUUID();

    try {
      const user = await getCurrentUser();
      if (!user) return Api.unauthorized();
      if (!canPerform(config, 'update', user.role)) {
        return Api.forbidden(
          `You don't have permission to update ${config.label.toLowerCase()}`,
        );
      }

      const body = await req.json().catch(() => null);
      const validation = BulkUpdateSchema.safeParse(body);
      if (!validation.success) {
        return Api.badRequest(
          'Invalid bulk update payload',
          validation.error.format(),
        );
      }

      const { ids, field, value } = validation.data;
      const column = config.columns.find((c) => c.key === field);
      if (!column || column.editable === false) {
        return Api.badRequest(`"${field}" is not an editable column`);
      }
      if (
        config.restrictedFields?.fields.includes(field) &&
        !isRestrictedFieldAllowed(config, user.role)
      ) {
        return Api.forbidden(`You don't have permission to change "${field}"`);
      }
      const normalized = normalizeBulkValue(column, value);
      if (!normalized.success) return Api.badRequest(normalized.error);

      const delegate = getDelegate(config);
      const result = await delegate.updateMany({
        where: { id: { in: ids } },
        data: { [field]: normalized.value },
      });
      const updatedRows = await delegate.findMany({
        where: { id: { in: ids } },
      });

      void upsertInSearch(config, updatedRows);
      void invalidateEntityListCache(config);
      void recordActivityEvent({
        action: 'BULK_UPDATED',
        actorId: user.id,
        entityType: config.key,
        summary: `${result.count} ${config.label.toLowerCase()} updated`,
        requestId,
        metadata: {
          field,
          requestedCount: ids.length,
          updatedCount: result.count,
        },
      });
      logger.warn(`${config.key}.bulk_update`, {
        requestId,
        field,
        count: result.count,
      });

      return Api.ok({ updated: result.count });
    } catch (error) {
      logger.error(`${config.key}.bulk_update.failed`, error, { requestId });
      return Api.internalError(
        `Failed to update ${config.label.toLowerCase()}`,
      );
    }
  }

  async function DELETE(req: Request) {
    const requestId = crypto.randomUUID();

    try {
      const user = await getCurrentUser();
      if (!user) return Api.unauthorized();
      if (!canPerform(config, 'delete', user.role)) {
        return Api.forbidden(
          `You don't have permission to delete ${config.label.toLowerCase()}`,
        );
      }

      const body = await req.json().catch(() => ({}));
      const validation = BulkDeleteSchema.safeParse(body);
      if (!validation.success) {
        return Api.badRequest(
          'Invalid delete payload',
          validation.error.format(),
        );
      }

      const ids = validation.data.ids;
      const delegate = getDelegate(config);
      const result = await delegate.deleteMany(
        ids && ids.length > 0 ? { where: { id: { in: ids } } } : {},
      );

      void deleteFromSearch(config, ids);
      void invalidateEntityListCache(config);
      void recordActivityEvent({
        action: 'BULK_DELETED',
        actorId: user.id,
        entityType: config.key,
        summary: `${result.count} ${config.label.toLowerCase()} deleted`,
        requestId,
        metadata: {
          scope: ids && ids.length > 0 ? 'selected' : 'all',
          requestedCount: ids?.length ?? null,
          deletedCount: result.count,
        },
      });
      logger.warn(`${config.key}.bulk_delete`, {
        requestId,
        count: result.count,
        scope: ids && ids.length > 0 ? 'selected' : 'all',
      });

      return Api.ok({ deleted: result.count });
    } catch (error) {
      logger.error(`${config.key}.bulk_delete.failed`, error, { requestId });
      return Api.internalError(
        `Failed to delete ${config.label.toLowerCase()}`,
      );
    }
  }

  return { GET, POST, PATCH, DELETE };
}

/** `PUT`/`DELETE` for a single resource (`app/api/<entity>/[id]/route.ts`). */
export function createItemHandlers(config: EntityConfig) {
  async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
    const requestId = crypto.randomUUID();

    try {
      const user = await getCurrentUser();
      if (!user) return Api.unauthorized();
      if (!canPerform(config, 'update', user.role)) {
        return Api.forbidden(
          `You don't have permission to update ${config.label.toLowerCase()}`,
        );
      }

      const params = await props.params;
      const idResult = EntityIdSchema.safeParse(params);
      if (!idResult.success)
        return Api.badRequest('Invalid identifier', idResult.error.format());

      const body = await req.json().catch(() => null);

      const attempted = attemptedRestrictedFields(config, body);
      if (
        attempted.length > 0 &&
        !isRestrictedFieldAllowed(config, user.role)
      ) {
        return Api.forbidden(
          `You don't have permission to change: ${attempted.join(', ')}`,
        );
      }

      const validation = config.schema.safeParse(body);
      if (!validation.success) {
        return Api.badRequest(
          `Invalid ${config.singularLabel.toLowerCase()} data`,
          validation.error.format(),
        );
      }

      const delegate = getDelegate(config);
      const existing = await delegate.findUnique({
        where: { id: idResult.data.id },
      });
      if (!existing) return Api.notFound(`${config.singularLabel} not found`);

      const updated = await delegate.update({
        where: { id: idResult.data.id },
        data: validation.data as Record<string, unknown>,
      });

      void upsertInSearch(config, [updated]);
      void invalidateEntityListCache(config);
      void recordActivityEvent({
        action: 'UPDATED',
        actorId: user.id,
        entityType: config.key,
        entityId: idResult.data.id,
        summary: `${config.singularLabel} updated`,
        requestId,
        metadata: { entityLabel: config.singularLabel },
      });
      logger.info(`${config.key}.update`, { requestId, id: idResult.data.id });

      return Api.ok(updated);
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        return Api.conflict(
          `A ${config.singularLabel.toLowerCase()} with this value already exists`,
        );
      }
      logger.error(`${config.key}.update.failed`, error, { requestId });
      return Api.internalError(
        `Failed to update ${config.singularLabel.toLowerCase()}`,
      );
    }
  }

  async function DELETE(
    _req: Request,
    props: { params: Promise<{ id: string }> },
  ) {
    const requestId = crypto.randomUUID();

    try {
      const user = await getCurrentUser();
      if (!user) return Api.unauthorized();
      if (!canPerform(config, 'delete', user.role)) {
        return Api.forbidden(
          `You don't have permission to delete ${config.label.toLowerCase()}`,
        );
      }

      const params = await props.params;
      const idResult = EntityIdSchema.safeParse(params);
      if (!idResult.success)
        return Api.badRequest('Invalid identifier', idResult.error.format());

      const delegate = getDelegate(config);
      const existing = await delegate.findUnique({
        where: { id: idResult.data.id },
      });
      if (!existing) return Api.noContent(); // idempotent: deleting an already-gone resource is a no-op success

      await delegate.delete({ where: { id: idResult.data.id } });

      void deleteFromSearch(config, [idResult.data.id]);
      void invalidateEntityListCache(config);
      void recordActivityEvent({
        action: 'DELETED',
        actorId: user.id,
        entityType: config.key,
        entityId: idResult.data.id,
        summary: `${config.singularLabel} deleted`,
        requestId,
        metadata: { entityLabel: config.singularLabel },
      });
      logger.info(`${config.key}.delete`, { requestId, id: idResult.data.id });

      return Api.noContent();
    } catch (error) {
      logger.error(`${config.key}.delete.failed`, error, { requestId });
      return Api.internalError(
        `Failed to delete ${config.singularLabel.toLowerCase()}`,
      );
    }
  }

  return { PUT, DELETE };
}
