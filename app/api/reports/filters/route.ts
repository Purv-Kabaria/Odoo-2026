import { Api } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { getDistinctCategories } from '@/lib/reports/queries';
import type { UserRole } from '@prisma/client';

const REPORT_ROLES: UserRole[] = ['ADMIN', 'MODERATOR'];

/** Static-ish filter option list, independent of any selected filters —
 * kept separate from /summary so selecting a category can't shrink its
 * own option list out from under the user. */
export async function GET() {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();
    if (!REPORT_ROLES.includes(user.role)) {
      return Api.forbidden("You don't have permission to view reports");
    }

    const categories = await getDistinctCategories();
    return Api.ok({ categories });
  } catch (error) {
    logger.error('reports.filters.failed', error, { requestId });
    return Api.internalError('Failed to load report filter options');
  }
}
