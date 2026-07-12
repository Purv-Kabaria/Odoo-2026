import { Api } from '@/lib/api';
import { logger } from '@/lib/logger';
import { getAuditorPerformance } from '@/lib/reports/queries';
import { authorizeReportRequest } from '@/lib/reports/route-helpers';

export async function GET(req: Request) {
  const requestId = crypto.randomUUID();

  try {
    const authResult = await authorizeReportRequest(req);
    if ('error' in authResult) return authResult.error;

    const data = await getAuditorPerformance(authResult.filters);
    logger.info('reports.auditor_performance', { requestId, userId: authResult.user.id });
    return Api.ok(data);
  } catch (error) {
    logger.error('reports.auditor_performance.failed', error, { requestId });
    return Api.internalError('Failed to load auditor performance');
  }
}
