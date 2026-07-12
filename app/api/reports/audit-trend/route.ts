import { Api } from '@/lib/api';
import { logger } from '@/lib/logger';
import { getJsonCache, setJsonCache } from '@/lib/redis-cache';
import { getAuditTrend } from '@/lib/reports/queries';
import { authorizeReportRequest, reportCacheKey } from '@/lib/reports/route-helpers';

type AuditTrendRow = Awaited<ReturnType<typeof getAuditTrend>>[number];

export async function GET(req: Request) {
  const requestId = crypto.randomUUID();

  try {
    const authResult = await authorizeReportRequest(req);
    if ('error' in authResult) return authResult.error;

    const cacheKey = reportCacheKey('audit-trend', authResult.filters);
    const cached = await getJsonCache<AuditTrendRow[]>(cacheKey);
    if (cached) {
      logger.info('reports.audit_trend.cache_hit', { requestId });
      return Api.ok(cached);
    }

    const data = await getAuditTrend(authResult.filters);
    void setJsonCache(cacheKey, data);
    logger.info('reports.audit_trend', { requestId, userId: authResult.user.id });
    return Api.ok(data);
  } catch (error) {
    logger.error('reports.audit_trend.failed', error, { requestId });
    return Api.internalError('Failed to load audit trend');
  }
}
