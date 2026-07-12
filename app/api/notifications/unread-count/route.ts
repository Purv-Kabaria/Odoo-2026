import { Api } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { getUnreadCount } from '@/lib/notifications';

export async function GET() {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();

    const count = await getUnreadCount(user.id);
    return Api.ok({ count });
  } catch (error) {
    logger.error('notifications.unread_count.failed', error, { requestId });
    return Api.internalError('Failed to load unread count');
  }
}
