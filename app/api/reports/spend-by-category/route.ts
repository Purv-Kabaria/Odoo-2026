import { Api } from '@/lib/api';
import { logger } from '@/lib/logger';
import { getSpendByCategory } from '@/lib/reports/queries';
import { authorizeReportRequest } from '@/lib/reports/route-helpers';

export async function GET(req: Request) {
  const requestId = crypto.randomUUID();

  try {
    const authResult = await authorizeReportRequest(req);
    if ('error' in authResult) return authResult.error;

    const data = await getSpendByCategory(authResult.filters);
    logger.info('reports.spend_by_category', { requestId, userId: authResult.user.id });
    return Api.ok(data);
  } catch (error) {
    logger.error('reports.spend_by_category.failed', error, { requestId });
    return Api.internalError('Failed to load spend by category');
  }
}
