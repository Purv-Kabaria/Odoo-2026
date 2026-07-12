import { Api } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { markAllNotificationsRead } from '@/lib/notifications';

export async function POST() {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();

    const count = await markAllNotificationsRead(user.id);
    logger.info('notifications.mark_all_read', { requestId, userId: user.id, count });
    return Api.ok({ updated: count });
  } catch (error) {
    logger.error('notifications.mark_all_read.failed', error, { requestId });
    return Api.internalError('Failed to update notifications');
  }
}
