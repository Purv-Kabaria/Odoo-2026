import {
  filterableColumns,
  searchableColumns,
  sortableColumns,
} from '@/lib/entities/types';
import type { SearchableEntity } from '@/lib/entities/types';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { resilientFetch } from '@/lib/resilience';

type MeiliSearchHit = {
  id: string;
};

type MeiliSearchResponse = {
  hits?: MeiliSearchHit[];
  estimatedTotalHits?: number;
};

type MeiliTaskResponse = {
  taskUid?: number;
};

function getHost() {
  return env.MEILISEARCH_HOST?.replace(/\/$/, '');
}

function getHeaders() {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (env.MEILISEARCH_API_KEY) {
    headers.Authorization = `Bearer ${env.MEILISEARCH_API_KEY}`;
  }

  return headers;
}

/**
 * `config.search.indexEnv` names one of the MEILISEARCH_*_INDEX vars
 * `lib/env.ts` already validates with a default — read directly from
 * `process.env` here since the specific var name is only known at
 * runtime per-config, not statically, so it can't go through the typed
 * `env` object without losing genericity. Purely cosmetic (index naming),
 * never a required/security-sensitive value.
 */
function indexNameFor(config: SearchableEntity): string {
  if (!config.search) return config.key;
  return process.env[config.search.indexEnv] || config.key;
}

async function meiliFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T | null> {
  const host = getHost();
  if (!host) return null;

  const response = await resilientFetch(
    `${host}${path}`,
    {
      ...init,
      headers: {
        ...getHeaders(),
        ...init?.headers,
      },
      cache: 'no-store',
    },
    { name: 'meilisearch', timeoutMs: 3000, retries: 1 },
  );

  if (!response) {
    logger.warn('search.request_unavailable', { path });
    return null;
  }

  if (!response.ok) {
    logger.warn('search.request_failed', {
      path,
      status: response.status,
    });
    return null;
  }

  try {
    return (await response.json()) as T;
  } catch (error) {
    logger.warn('search.response_invalid', {
      path,
      errorMessage: error instanceof Error ? error.message : 'Invalid JSON',
    });
    return null;
  }
}

export async function configureSearchIndex(
  config: SearchableEntity,
): Promise<void> {
  if (!config.search) return;

  await meiliFetch<MeiliTaskResponse>(
    `/indexes/${indexNameFor(config)}/settings`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        searchableAttributes: searchableColumns(config).map(
          (column) => column.key,
        ),
        filterableAttributes: filterableColumns(config).map(
          (column) => column.key,
        ),
        sortableAttributes: sortableColumns(config).map((column) => column.key),
        typoTolerance: { enabled: true },
      }),
    },
  );
}

function toSearchableDocument(
  row: Record<string, unknown>,
): Record<string, unknown> {
  const doc: Record<string, unknown> = { ...row };
  for (const key of ['createdAt', 'updatedAt']) {
    if (doc[key] instanceof Date) {
      doc[key] = (doc[key] as Date).toISOString();
    }
  }
  return doc;
}

export async function upsertInSearch(
  config: SearchableEntity,
  rows: Record<string, unknown>[],
): Promise<void> {
  if (!config.search || rows.length === 0) return;

  await configureSearchIndex(config);
  const result = await meiliFetch<MeiliTaskResponse>(
    `/indexes/${indexNameFor(config)}/documents`,
    {
      method: 'POST',
      body: JSON.stringify(rows.map(toSearchableDocument)),
    },
  );
  if (!result) {
    logger.warn('search.upsert_skipped', {
      entity: config.key,
      count: rows.length,
    });
  }
}

export async function deleteFromSearch(
  config: SearchableEntity,
  ids?: string[],
): Promise<void> {
  if (!config.search) return;
  const index = indexNameFor(config);

  if (ids && ids.length > 0) {
    const result = await meiliFetch<MeiliTaskResponse>(
      `/indexes/${index}/documents/delete-batch`,
      {
        method: 'POST',
        body: JSON.stringify(ids),
      },
    );
    if (!result) {
      logger.warn('search.delete_skipped', { entity: config.key, count: ids.length });
    }
    return;
  }

  const result = await meiliFetch<MeiliTaskResponse>(`/indexes/${index}/documents`, {
    method: 'DELETE',
  });
  if (!result) logger.warn('search.delete_all_skipped', { entity: config.key });
}

export async function searchIds(
  config: SearchableEntity,
  query: string,
  limit: number,
): Promise<string[] | null> {
  if (!config.search) return null;

  const trimmedQuery = query.trim();
  if (!trimmedQuery) return null;

  const response = await meiliFetch<MeiliSearchResponse>(
    `/indexes/${indexNameFor(config)}/search`,
    {
      method: 'POST',
      body: JSON.stringify({
        q: trimmedQuery,
        limit,
        matchingStrategy: 'all',
        showRankingScore: true,
      }),
    },
  );

  if (!response?.hits) return null;

  return response.hits.map((hit) => hit.id);
}
