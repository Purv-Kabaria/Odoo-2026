import type { UserRole } from '@prisma/client';

import { Api } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { ReportFiltersSchema } from '@/types/reports-types';
import type { ReportFilters } from '@/types/reports-types';

/** Reports is manager-facing; no Department Head role exists yet, so
 * access is org-wide for the two roles that already see every entity. */
const REPORT_ROLES: UserRole[] = ['ADMIN', 'MODERATOR'];

type AuthorizedRequest = {
  user: { id: string; role: UserRole };
  filters: ReportFilters;
};

export async function authorizeReportRequest(
  req: Request,
): Promise<AuthorizedRequest | { error: ReturnType<typeof Api.unauthorized> }> {
  const user = await getCurrentUser();
  if (!user) return { error: Api.unauthorized() };
  if (!REPORT_ROLES.includes(user.role)) {
    return { error: Api.forbidden("You don't have permission to view reports") };
  }

  const searchParams = new URL(req.url).searchParams;
  const validation = ReportFiltersSchema.safeParse({
    departmentId: searchParams.get('departmentId') ?? undefined,
    category: searchParams.get('category') ?? undefined,
    status: searchParams.get('status') ?? undefined,
    dateFrom: searchParams.get('dateFrom') ?? undefined,
    dateTo: searchParams.get('dateTo') ?? undefined,
    idleDays: searchParams.get('idleDays') ?? undefined,
    retirementYears: searchParams.get('retirementYears') ?? undefined,
  });
  if (!validation.success) {
    return { error: Api.badRequest('Invalid report filters', validation.error.format()) };
  }

  return { user, filters: validation.data };
}

export function reportCacheKey(report: string, filters: ReportFilters): string {
  const payload = JSON.stringify(filters, (_key, value) =>
    value instanceof Date ? value.toISOString() : value,
  );
  return `reports:${report}:${Buffer.from(payload).toString('base64url')}`;
}
