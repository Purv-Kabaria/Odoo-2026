import { Api } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { listNotifications } from '@/lib/notifications';
import { NotificationListQuerySchema } from '@/types/notification-types';

export async function GET(req: Request) {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();

    const searchParams = new URL(req.url).searchParams;
    const validation = NotificationListQuerySchema.safeParse({
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      category: searchParams.get('category') ?? undefined,
    });
    if (!validation.success) {
      return Api.badRequest('Invalid notification query', validation.error.format());
    }

    const { page, limit, category } = validation.data;
    const { rows, total } = await listNotifications({ userId: user.id, category, page, limit });

    logger.info('notifications.list', { requestId, userId: user.id, count: rows.length });

    const totalPages = Math.max(1, Math.ceil(total / limit));
    return Api.ok(rows, { total, page, limit, totalPages });
  } catch (error) {
    logger.error('notifications.list.failed', error, { requestId });
    return Api.internalError('Failed to load notifications');
  }
}
