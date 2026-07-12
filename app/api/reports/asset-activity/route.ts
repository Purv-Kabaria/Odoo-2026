import { Api } from '@/lib/api';
import { logger } from '@/lib/logger';
import { getAssetActivity } from '@/lib/reports/queries';
import { authorizeReportRequest } from '@/lib/reports/route-helpers';

export async function GET(req: Request) {
  const requestId = crypto.randomUUID();

  try {
    const authResult = await authorizeReportRequest(req);
    if ('error' in authResult) return authResult.error;

    const data = await getAssetActivity(authResult.filters);
    logger.info('reports.asset_activity', { requestId, userId: authResult.user.id });
    return Api.ok(data);
  } catch (error) {
    logger.error('reports.asset_activity.failed', error, { requestId });
    return Api.internalError('Failed to load asset activity');
  }
}
