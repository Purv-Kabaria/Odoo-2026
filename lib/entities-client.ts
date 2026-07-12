import type { FilterRuleInput, SortRuleInput } from "@/lib/entities/query";
import { readApiResponse } from "@/lib/api-client";

export type SearchProvider = "meilisearch" | "postgres" | "none";

export type EntityListParams = {
  page: number;
  limit: number;
  search: string;
  filters?: FilterRuleInput[];
  sorts?: SortRuleInput[];
};

export type EntityListResult<T> = {
  rows: T[];
  totalPages: number;
  totalRows: number;
  searchProvider: SearchProvider;
};

export async function fetchEntityRows<T>(
  resource: string,
  params: EntityListParams
): Promise<EntityListResult<T>> {
  const query = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
    search: params.search,
  });

  if (params.filters && params.filters.length > 0) {
    query.set("filters", JSON.stringify(params.filters));
  }
  if (params.sorts && params.sorts.length > 0) {
    query.set("sorts", JSON.stringify(params.sorts));
  }

  const response = await fetch(`/api/${resource}?${query.toString()}`);
  const json = await readApiResponse<{
    data?: T[];
    meta?: { totalPages?: number; total?: number; searchProvider?: SearchProvider };
  }>(response, `Failed to load ${resource}`);

  return {
    rows: json.data ?? [],
    totalPages: json.meta?.totalPages ?? 1,
    totalRows: json.meta?.total ?? 0,
    searchProvider: json.meta?.searchProvider ?? "none",
  };
}

export async function createEntityRow<T>(resource: string, data: Record<string, unknown>): Promise<T> {
  const response = await fetch(`/api/${resource}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await readApiResponse<{ data: T }>(response, `Failed to create ${resource}`);
  return json.data;
}

export async function updateEntityRow<T>(
  resource: string,
  id: string,
  data: Record<string, unknown>
): Promise<T> {
  const response = await fetch(`/api/${resource}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await readApiResponse<{ data: T }>(response, `Failed to update ${resource}`);
  return json.data;
}

export async function deleteEntityRows(resource: string, ids?: string[]): Promise<number> {
  const response = await fetch(`/api/${resource}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ids && ids.length > 0 ? { ids } : {}),
  });

  const json = await readApiResponse<{ data?: { deleted?: number } }>(
    response,
    `Failed to delete ${resource}`
  );

  return json.data?.deleted ?? 0;
}

export async function bulkUpdateEntityRows(
  resource: string,
  ids: string[],
  field: string,
  value: string | number | boolean | null
): Promise<number> {
  const response = await fetch(`/api/${resource}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, field, value }),
  });

  const json = await readApiResponse<{ data?: { updated?: number } }>(
    response,
    `Failed to update ${resource}`
  );

  return json.data?.updated ?? 0;
}
