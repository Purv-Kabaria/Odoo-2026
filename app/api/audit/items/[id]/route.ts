import { z } from 'zod';

import { recordActivityEvent } from '@/lib/activity-events';
import { Api } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { createNotifications } from '@/lib/notifications';
import { prisma } from '@/lib/prisma';
import { AuditItemMarkSchema } from '@/types/audit-types';

const ParamsSchema = z.object({ id: z.uuid('Invalid audit item identifier') });

export async function PATCH(
  req: Request,
  props: { params: Promise<{ id: string }> },
) {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();

    const params = await props.params;
    const paramsValidation = ParamsSchema.safeParse(params);
    if (!paramsValidation.success) {
      return Api.badRequest('Invalid audit item identifier', paramsValidation.error.format());
    }

    const body = await req.json().catch(() => null);
    const bodyValidation = AuditItemMarkSchema.safeParse(body);
    if (!bodyValidation.success) {
      return Api.badRequest('Invalid audit item update', bodyValidation.error.format());
    }

    const itemId = paramsValidation.data.id;
    const { status, note } = bodyValidation.data;

    const item = await prisma.auditItem.findUnique({
      where: { id: itemId },
      select: {
        cycleId: true,
        cycle: { select: { auditors: { select: { auditorId: true } } } },
      },
    });
    if (!item) return Api.notFound('Audit item not found');

    const isAssignedAuditor = item.cycle.auditors.some(
      (entry) => entry.auditorId === user.id,
    );
    if (user.role !== 'ADMIN' && !isAssignedAuditor) {
      return Api.forbidden("You don't have permission to mark items in this audit cycle");
    }

    // Guarded write: only succeeds while the parent cycle is still ACTIVE,
    // so a mark can't race a concurrent close.
    const updateResult = await prisma.auditItem.updateMany({
      where: { id: itemId, cycle: { status: 'ACTIVE' } },
      data: { status, note: note ?? null, verifiedById: user.id, verifiedAt: new Date() },
    });

    if (updateResult.count !== 1) {
      return Api.conflict('This audit cycle is closed and can no longer be updated');
    }

    const updated = await prisma.auditItem.findUnique({
      where: { id: itemId },
      include: {
        asset: { select: { id: true, assetTag: true, name: true, location: true } },
        verifiedBy: { select: { id: true, name: true } },
      },
    });

    void recordActivityEvent({
      action: 'AUDIT_ITEM_MARKED',
      actorId: user.id,
      entityType: 'auditItem',
      entityId: itemId,
      summary: `${updated?.asset.assetTag ?? 'Asset'} marked ${status.toLowerCase()}`,
      requestId,
      metadata: { cycleId: item.cycleId, status },
    });

    if ((status === 'MISSING' || status === 'DAMAGED') && updated) {
      void (async () => {
        const admins = await prisma.user.findMany({
          where: { role: 'ADMIN' },
          select: { id: true },
        });
        void createNotifications({
          recipientIds: admins.map((admin) => admin.id),
          type: 'AUDIT_DISCREPANCY_FLAGGED',
          title: `${updated.asset.assetTag} flagged ${status.toLowerCase()}`,
          body: updated.note ?? undefined,
          entityType: 'auditItem',
          entityId: itemId,
          metadata: { cycleId: item.cycleId, assetTag: updated.asset.assetTag, status },
        });
      })();
    }

    logger.info('audit.item.mark', { requestId, itemId, status, userId: user.id });

    return Api.ok(updated);
  } catch (error) {
    logger.error('audit.item.mark.failed', error, { requestId });
    return Api.internalError('Failed to update audit item');
  }
}
