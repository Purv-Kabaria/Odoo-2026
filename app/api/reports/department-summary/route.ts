import { Api } from '@/lib/api';
import { logger } from '@/lib/logger';
import { getJsonCache, setJsonCache } from '@/lib/redis-cache';
import { getDepartmentSummary } from '@/lib/reports/queries';
import { authorizeReportRequest, reportCacheKey } from '@/lib/reports/route-helpers';

type DepartmentSummaryRow = Awaited<ReturnType<typeof getDepartmentSummary>>[number];

export async function GET(req: Request) {
  const requestId = crypto.randomUUID();

  try {
    const authResult = await authorizeReportRequest(req);
    if ('error' in authResult) return authResult.error;

    const cacheKey = reportCacheKey('department-summary', authResult.filters);
    const cached = await getJsonCache<DepartmentSummaryRow[]>(cacheKey);
    if (cached) {
      logger.info('reports.department_summary.cache_hit', { requestId });
      return Api.ok(cached);
    }

    const data = await getDepartmentSummary(authResult.filters);
    void setJsonCache(cacheKey, data);
    logger.info('reports.department_summary', { requestId, userId: authResult.user.id });
    return Api.ok(data);
  } catch (error) {
    logger.error('reports.department_summary.failed', error, { requestId });
    return Api.internalError('Failed to load department summary');
  }
}
