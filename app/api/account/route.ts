import { Api } from '@/lib/api';
import { recordActivityEvent } from '@/lib/activity-events';
import { getCurrentUser } from '@/lib/auth';
import { invalidateEntityListCache } from '@/lib/entities/crud-handlers';
import { usersEntityConfig } from '@/lib/entities/users';
import { logger } from '@/lib/logger';
import { upsertInSearch } from '@/lib/meilisearch';
import { prisma } from '@/lib/prisma';
import { AccountProfileSchema } from '@/types/auth-types';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Api.unauthorized();

  return Api.ok(user);
}

export async function PATCH(req: Request) {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();

    const body = await req.json().catch(() => null);
    const validation = AccountProfileSchema.safeParse(body);
    if (!validation.success) {
      return Api.badRequest('Invalid profile data', validation.error.format());
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: validation.data.name,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    void upsertInSearch(usersEntityConfig, [updated]);
    void invalidateEntityListCache(usersEntityConfig);
    void recordActivityEvent({
      orgId: user.orgId,
      action: 'user.profile_updated',
      actorId: user.id,
      entityType: 'user',
      entityId: user.id,
      metadata: { nameChanged: updated.name !== user.name, requestId },
    });

    logger.info('account.update', { requestId, userId: user.id });
    return Api.ok({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
    });
  } catch (error) {
    logger.error('account.update.failed', error, { requestId });
    return Api.internalError('Failed to update profile');
  }
}
