import { filterableColumns, searchableColumns, sortableColumns } from './types';
import type { EntityColumn, EntityConfig } from './types';

const MAX_PAGE_SIZE = 100;
const MAX_OFFSET_ROWS = 100_000;

export type FilterOperator = 'equals' | 'not_equals' | 'contains';
export type FilterRuleInput = {
  field: string;
  operator: FilterOperator;
  value: string;
};
export type SortRuleInput = { sortBy: string; sortOrder: 'asc' | 'desc' };
export type QueryValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

function normalizeValue(value: string): string {
  return value.trim();
}

function columnByKey(
  config: EntityConfig,
  key: string,
): EntityColumn | undefined {
  return config.columns.find((column) => column.key === key);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function validateFilterRules(
  config: EntityConfig,
  raw: unknown,
): QueryValidationResult<FilterRuleInput[]> {
  if (!Array.isArray(raw)) {
    return { success: false, error: 'Filters must be a JSON array' };
  }
  if (raw.length > 10) {
    return { success: false, error: 'At most 10 filter rules are allowed' };
  }

  const allowedKeys = new Set(
    filterableColumns(config).map((column) => column.key),
  );
  const rules: FilterRuleInput[] = [];

  for (const item of raw) {
    if (
      !isPlainObject(item) ||
      typeof item.field !== 'string' ||
      typeof item.operator !== 'string' ||
      typeof item.value !== 'string'
    ) {
      return { success: false, error: 'Invalid filter rule shape' };
    }

    const { field, operator, value } = item;
    if (!allowedKeys.has(field)) {
      return { success: false, error: `"${field}" is not a filterable column` };
    }
    if (
      operator !== 'equals' &&
      operator !== 'not_equals' &&
      operator !== 'contains'
    ) {
      return { success: false, error: `Invalid filter operator "${operator}"` };
    }
    if (!value.trim()) {
      return { success: false, error: 'Filter value is required' };
    }

    const column = columnByKey(config, field);
    if (column?.type === 'select' && operator === 'contains') {
      return {
        success: false,
        error: `"Contains" is not allowed for ${column.label}. Use equals or does not equal.`,
      };
    }

    rules.push({ field, operator, value });
  }

  const signatures = new Set<string>();
  for (const rule of rules) {
    const signature = `${rule.field}:${rule.operator}:${normalizeValue(rule.value).toLowerCase()}`;
    if (signatures.has(signature)) {
      const label = columnByKey(config, rule.field)?.label ?? rule.field;
      return {
        success: false,
        error: `Duplicate filter: ${label} ${rule.operator} "${rule.value}"`,
      };
    }
    signatures.add(signature);
  }

  const byField = new Map<string, FilterRuleInput[]>();
  for (const rule of rules) {
    const existing = byField.get(rule.field) ?? [];
    existing.push(rule);
    byField.set(rule.field, existing);
  }

  for (const [field, fieldRules] of byField) {
    const label = columnByKey(config, field)?.label ?? field;
    const equalsRules = fieldRules.filter((rule) => rule.operator === 'equals');
    const notEqualsRules = fieldRules.filter(
      (rule) => rule.operator === 'not_equals',
    );
    const containsRules = fieldRules.filter(
      (rule) => rule.operator === 'contains',
    );

    if (equalsRules.length > 1) {
      const values = equalsRules.map((rule) =>
        normalizeValue(rule.value).toLowerCase(),
      );
      if (new Set(values).size > 1) {
        return {
          success: false,
          error: `Conflicting filters on ${label}: cannot require multiple different "equals" values.`,
        };
      }
    }

    if (containsRules.length > 1) {
      const values = containsRules.map((rule) =>
        normalizeValue(rule.value).toLowerCase(),
      );
      if (new Set(values).size > 1) {
        return {
          success: false,
          error: `Conflicting filters on ${label}: cannot apply multiple different "contains" values.`,
        };
      }
    }

    for (const equalsRule of equalsRules) {
      const value = normalizeValue(equalsRule.value);
      const conflict = notEqualsRules.find(
        (rule) =>
          normalizeValue(rule.value).toLowerCase() === value.toLowerCase(),
      );
      if (conflict) {
        return {
          success: false,
          error: `Conflicting filters on ${label}: cannot equal and not equal "${value}" at the same time.`,
        };
      }
    }

    for (const containsRule of containsRules) {
      const value = normalizeValue(containsRule.value);
      const conflictingNotEquals = notEqualsRules.find(
        (rule) =>
          normalizeValue(rule.value).toLowerCase() === value.toLowerCase(),
      );
      if (conflictingNotEquals) {
        return {
          success: false,
          error: `Conflicting filters on ${label}: cannot contain and not equal "${value}" at the same time.`,
        };
      }

      const conflictingEquals = equalsRules.find((rule) => {
        const eq = normalizeValue(rule.value).toLowerCase();
        const needle = value.toLowerCase();
        return eq !== needle && !eq.includes(needle) && !needle.includes(eq);
      });
      if (conflictingEquals) {
        return {
          success: false,
          error: `Conflicting filters on ${label}: "equals" and "contains" cannot be combined with incompatible values.`,
        };
      }
    }
  }

  return { success: true, data: rules };
}

export function validateSortRules(
  config: EntityConfig,
  raw: unknown,
): QueryValidationResult<SortRuleInput[]> {
  if (!Array.isArray(raw)) {
    return { success: false, error: 'Sorts must be a JSON array' };
  }

  const allowedKeys = new Set(
    sortableColumns(config).map((column) => column.key),
  );
  if (raw.length > allowedKeys.size) {
    return {
      success: false,
      error: `At most ${allowedKeys.size} sort rules are allowed`,
    };
  }

  const rules: SortRuleInput[] = [];
  for (const item of raw) {
    if (
      !isPlainObject(item) ||
      typeof item.sortBy !== 'string' ||
      (item.sortOrder !== 'asc' && item.sortOrder !== 'desc')
    ) {
      return { success: false, error: 'Invalid sort rule shape' };
    }

    const { sortBy, sortOrder } = item;
    if (!allowedKeys.has(sortBy)) {
      return { success: false, error: `"${sortBy}" is not a sortable column` };
    }
    rules.push({ sortBy, sortOrder });
  }

  const seenFields = new Map<string, 'asc' | 'desc'>();
  for (const rule of rules) {
    const existingOrder = seenFields.get(rule.sortBy);
    if (existingOrder !== undefined) {
      if (existingOrder === rule.sortOrder) {
        return {
          success: false,
          error: `Duplicate sort on "${rule.sortBy}". Each column can only be sorted once.`,
        };
      }
      return {
        success: false,
        error: `Conflicting sort on "${rule.sortBy}": cannot sort ascending and descending at the same time.`,
      };
    }
    seenFields.set(rule.sortBy, rule.sortOrder);
  }

  return { success: true, data: rules };
}

function buildSearchCondition(
  config: EntityConfig,
  query: string,
): Record<string, unknown> | null {
  if (!query) return null;

  const fields = searchableColumns(config);
  if (fields.length === 0) return null;

  const or: Record<string, unknown>[] = [];
  for (const column of fields) {
    if (column.type === 'select' && column.options) {
      const normalized = query.trim().toUpperCase();
      const match = column.options.find(
        (option) => option.value.toUpperCase() === normalized,
      );
      if (match) {
        or.push({ [column.key]: match.value });
      }
      continue;
    }
    or.push({ [column.key]: { contains: query, mode: 'insensitive' } });
  }

  return or.length > 0 ? { OR: or } : null;
}

export function buildWhere(
  config: EntityConfig,
  {
    search,
    filters,
    searchIds,
  }: { search: string; filters: FilterRuleInput[]; searchIds?: string[] },
): Record<string, unknown> {
  const and: Record<string, unknown>[] = [];

  if (searchIds !== undefined) {
    if (searchIds.length === 0) return { id: { in: [] } };
    and.push({ id: { in: searchIds } });
  } else {
    const searchCondition = buildSearchCondition(config, search.trim());
    if (searchCondition) and.push(searchCondition);
  }

  for (const filter of filters) {
    const value = normalizeValue(filter.value);
    if (filter.operator === 'equals') {
      and.push({ [filter.field]: value });
    } else if (filter.operator === 'not_equals') {
      and.push({ [filter.field]: { not: value } });
    } else {
      and.push({ [filter.field]: { contains: value, mode: 'insensitive' } });
    }
  }

  return and.length > 0 ? { AND: and } : {};
}

export function buildOrderBy(
  config: EntityConfig,
  sorts: SortRuleInput[],
): Record<string, unknown> | Record<string, unknown>[] {
  if (sorts.length === 0) {
    return { [config.defaultSort.field]: config.defaultSort.order };
  }
  return sorts.map((sort) => ({ [sort.sortBy]: sort.sortOrder }));
}

export function parsePaginationParams(
  pageRaw: string | null,
  limitRaw: string | null,
): { page: number; limit: number } | { error: string } {
  const page = pageRaw === null ? 1 : Number(pageRaw);
  if (!Number.isInteger(page) || page < 1) {
    return { error: 'Page must be a positive whole number' };
  }

  const limit = limitRaw === null ? 10 : Number(limitRaw);
  if (!Number.isInteger(limit)) {
    return { error: 'Limit must be a whole number' };
  }

  if (limit < 1 || limit > MAX_PAGE_SIZE) {
    return { error: `Limit must be between 1 and ${MAX_PAGE_SIZE}` };
  }

  if ((page - 1) * limit > MAX_OFFSET_ROWS) {
    return {
      error: `Page is too deep for offset pagination. Narrow the filters or search within the first ${MAX_OFFSET_ROWS} rows.`,
    };
  }

  return { page, limit };
}

export type ParsedListQuery = {
  page: number;
  limit: number;
  search: string;
  filters: FilterRuleInput[];
  sorts: SortRuleInput[];
};

export function parseListQuery(
  config: EntityConfig,
  searchParams: URLSearchParams,
): ParsedListQuery | { error: string } {
  const pagination = parsePaginationParams(
    searchParams.get('page'),
    searchParams.get('limit'),
  );
  if ('error' in pagination) return pagination;

  const search = (searchParams.get('search') ?? '').trim();
  if (search.length > 200) return { error: 'Search query is too long' };

  const rawFilters = searchParams.get('filters');
  let filters: FilterRuleInput[] = [];
  if (rawFilters) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawFilters);
    } catch {
      return { error: 'Invalid filters JSON' };
    }
    const result = validateFilterRules(config, parsed);
    if (!result.success) return { error: result.error };
    filters = result.data;
  }

  const rawSorts = searchParams.get('sorts');
  let sorts: SortRuleInput[] = [];
  if (rawSorts) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawSorts);
    } catch {
      return { error: 'Invalid sorts JSON' };
    }
    const result = validateSortRules(config, parsed);
    if (!result.success) return { error: result.error };
    sorts = result.data;
  }

  return {
    page: pagination.page,
    limit: pagination.limit,
    search,
    filters,
    sorts,
  };
}
