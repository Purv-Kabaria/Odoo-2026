import { z } from 'zod';

import { Api } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

const ParamsSchema = z.object({ id: z.uuid('Invalid audit cycle identifier') });

export async function GET(
  _req: Request,
  props: { params: Promise<{ id: string }> },
) {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();

    const params = await props.params;
    const validation = ParamsSchema.safeParse(params);
    if (!validation.success) {
      return Api.badRequest('Invalid audit cycle identifier', validation.error.format());
    }

    const cycle = await prisma.auditCycle.findUnique({
      where: { id: validation.data.id },
      include: {
        department: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        closedBy: { select: { id: true, name: true, email: true } },
        auditors: {
          include: { auditor: { select: { id: true, name: true, email: true } } },
        },
        items: {
          orderBy: [{ createdAt: 'asc' }],
          include: {
            asset: { select: { id: true, assetTag: true, name: true, location: true } },
            verifiedBy: { select: { id: true, name: true } },
          },
        },
        discrepancies: { orderBy: [{ createdAt: 'asc' }] },
      },
    });

    if (!cycle) return Api.notFound('Audit cycle not found');

    const isAssignedAuditor = cycle.auditors.some(
      (entry) => entry.auditorId === user.id,
    );
    if (user.role !== 'ADMIN' && !isAssignedAuditor) {
      return Api.forbidden("You don't have access to this audit cycle");
    }

    const flaggedItems = cycle.items.filter(
      (item) => item.status === 'MISSING' || item.status === 'DAMAGED',
    ).length;

    logger.info('audit.cycle.detail', { requestId, cycleId: cycle.id, userId: user.id });

    return Api.ok({
      id: cycle.id,
      name: cycle.name,
      scopeType: cycle.scopeType,
      department: cycle.department,
      location: cycle.location,
      startDate: cycle.startDate,
      endDate: cycle.endDate,
      status: cycle.status,
      createdBy: cycle.createdBy,
      closedBy: cycle.closedBy,
      closedAt: cycle.closedAt,
      createdAt: cycle.createdAt,
      auditors: cycle.auditors.map((entry) => entry.auditor),
      items: cycle.items.map((item) => ({
        id: item.id,
        asset: item.asset,
        expectedLocation: item.expectedLocation,
        status: item.status,
        note: item.note,
        verifiedBy: item.verifiedBy,
        verifiedAt: item.verifiedAt,
      })),
      totalItems: cycle.items.length,
      flaggedItems,
      discrepancies: cycle.status === 'CLOSED' ? cycle.discrepancies : [],
    });
  } catch (error) {
    logger.error('audit.cycle.detail.failed', error, { requestId });
    return Api.internalError('Failed to load audit cycle');
  }
}
