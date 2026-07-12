import { z } from 'zod';

import { recordActivityEvent } from '@/lib/activity-events';
import { Api } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { assetsEntityConfig } from '@/lib/entities/assets';
import { invalidateEntityListCache } from '@/lib/entities/crud-handlers';
import { logger } from '@/lib/logger';
import { upsertInSearch } from '@/lib/meilisearch';
import { prisma } from '@/lib/prisma';

const ParamsSchema = z.object({ id: z.uuid('Invalid audit cycle identifier') });

/**
 * Closing a cycle is the exactly-once transition: freeze flagged items into
 * AuditDiscrepancy (denormalized snapshot — see schema comment) and flip
 * confirmed-missing assets to Lost. The `updateMany` guard below is the
 * same compare-and-swap pattern as `reset-password`'s token consumption —
 * it makes concurrent close requests race safely instead of double-applying
 * the asset status flips.
 */
export async function POST(
  _req: Request,
  props: { params: Promise<{ id: string }> },
) {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();
    if (user.role !== 'ADMIN') {
      return Api.forbidden('Only an admin can close an audit cycle');
    }

    const params = await props.params;
    const validation = ParamsSchema.safeParse(params);
    if (!validation.success) {
      return Api.badRequest('Invalid audit cycle identifier', validation.error.format());
    }

    const cycleId = validation.data.id;
    const closedAt = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const closed = await tx.auditCycle.updateMany({
        where: { id: cycleId, status: 'ACTIVE' },
        data: { status: 'CLOSED', closedAt, closedById: user.id },
      });
      if (closed.count !== 1) {
        return { alreadyClosed: true as const };
      }

      const flaggedItems = await tx.auditItem.findMany({
        where: { cycleId, status: { in: ['MISSING', 'DAMAGED'] } },
        include: { asset: { select: { assetTag: true, name: true } } },
      });

      if (flaggedItems.length > 0) {
        await tx.auditDiscrepancy.createMany({
          data: flaggedItems.map((item) => ({
            cycleId,
            assetId: item.assetId,
            assetTag: item.asset.assetTag,
            assetName: item.asset.name,
            expectedLocation: item.expectedLocation,
            type: item.status === 'MISSING' ? ('MISSING' as const) : ('DAMAGED' as const),
            note: item.note,
            resolvedAssetStatus: item.status === 'MISSING' ? ('LOST' as const) : null,
          })),
        });
      }

      const missingAssetIds = flaggedItems
        .filter((item) => item.status === 'MISSING')
        .map((item) => item.assetId);

      if (missingAssetIds.length > 0) {
        await tx.asset.updateMany({
          where: { id: { in: missingAssetIds } },
          data: { status: 'LOST' },
        });
      }

      return {
        alreadyClosed: false as const,
        flaggedCount: flaggedItems.length,
        lostAssetIds: missingAssetIds,
      };
    });

    if (result.alreadyClosed) {
      return Api.conflict('This audit cycle is already closed');
    }

    if (result.lostAssetIds.length > 0) {
      const changedAssets = await prisma.asset.findMany({
        where: { id: { in: result.lostAssetIds } },
      });
      void upsertInSearch(assetsEntityConfig, changedAssets);
    }
    void invalidateEntityListCache(assetsEntityConfig);
    void recordActivityEvent({
      action: 'AUDIT_CYCLE_CLOSED',
      actorId: user.id,
      entityType: 'auditCycle',
      entityId: cycleId,
      summary: `Audit cycle closed — ${result.flaggedCount} flagged, ${result.lostAssetIds.length} marked Lost`,
      requestId,
      metadata: {
        flaggedCount: result.flaggedCount,
        lostCount: result.lostAssetIds.length,
      },
    });

    logger.info('audit.cycle.close', {
      requestId,
      cycleId,
      flaggedCount: result.flaggedCount,
      lostCount: result.lostAssetIds.length,
    });

    return Api.ok({
      id: cycleId,
      status: 'CLOSED',
      flaggedCount: result.flaggedCount,
      lostCount: result.lostAssetIds.length,
    });
  } catch (error) {
    logger.error('audit.cycle.close.failed', error, { requestId });
    return Api.internalError('Failed to close audit cycle');
  }
}
