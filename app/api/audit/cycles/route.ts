import type { Prisma } from '@prisma/client';

import { recordActivityEvent } from '@/lib/activity-events';
import { Api } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { createNotifications } from '@/lib/notifications';
import { prisma } from '@/lib/prisma';
import { AuditCycleCreateSchema, AuditCycleListQuerySchema } from '@/types/audit-types';

/**
 * ADMIN scopes/creates every cycle; "auditor" is a per-cycle assignment
 * rather than a role, so a non-admin only ever sees cycles they've been
 * assigned to (see AGENTS.md §6 — authorization is checked fresh per
 * request, never from a client-supplied field).
 */
export async function GET(req: Request) {
  const requestId = crypto.randomUUID();
  const startedAt = performance.now();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();

    const searchParams = new URL(req.url).searchParams;
    const validation = AuditCycleListQuerySchema.safeParse({
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    });
    if (!validation.success) {
      return Api.badRequest('Invalid audit cycle query', validation.error.format());
    }

    const { page, limit } = validation.data;
    const skip = (page - 1) * limit;
    const where: Prisma.AuditCycleWhereInput =
      user.role === 'ADMIN' ? {} : { auditors: { some: { auditorId: user.id } } };

    const [cycles, total] = await Promise.all([
      prisma.auditCycle.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: limit,
        include: {
          department: { select: { id: true, name: true } },
          auditors: {
            include: { auditor: { select: { id: true, name: true, email: true } } },
          },
          _count: { select: { items: true } },
        },
      }),
      prisma.auditCycle.count({ where }),
    ]);

    const cycleIds = cycles.map((cycle) => cycle.id);
    const statusCounts = cycleIds.length
      ? await prisma.auditItem.groupBy({
          by: ['cycleId', 'status'],
          where: { cycleId: { in: cycleIds } },
          _count: { _all: true },
        })
      : [];

    const countsByCycle = new Map<string, { verified: number; flagged: number }>();
    for (const row of statusCounts) {
      const bucket = countsByCycle.get(row.cycleId) ?? { verified: 0, flagged: 0 };
      if (row.status === 'VERIFIED') bucket.verified += row._count._all;
      if (row.status === 'MISSING' || row.status === 'DAMAGED') bucket.flagged += row._count._all;
      countsByCycle.set(row.cycleId, bucket);
    }

    const rows = cycles.map((cycle) => {
      const counts = countsByCycle.get(cycle.id) ?? { verified: 0, flagged: 0 };
      return {
        id: cycle.id,
        name: cycle.name,
        scopeType: cycle.scopeType,
        department: cycle.department,
        location: cycle.location,
        startDate: cycle.startDate,
        endDate: cycle.endDate,
        status: cycle.status,
        closedAt: cycle.closedAt,
        createdAt: cycle.createdAt,
        auditors: cycle.auditors.map((entry) => entry.auditor),
        totalItems: cycle._count.items,
        verifiedItems: counts.verified,
        flaggedItems: counts.flagged,
      };
    });

    logger.info('audit.cycle.list', {
      requestId,
      durationMs: Math.round(performance.now() - startedAt),
      count: rows.length,
      total,
    });

    const totalPages = Math.max(1, Math.ceil(total / limit));
    return Api.ok(rows, { total, page, limit, totalPages });
  } catch (error) {
    logger.error('audit.cycle.list.failed', error, { requestId });
    return Api.internalError('Failed to load audit cycles');
  }
}

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();
    if (user.role !== 'ADMIN') {
      return Api.forbidden('Only an admin can create audit cycles');
    }

    const body = await req.json().catch(() => null);
    const validation = AuditCycleCreateSchema.safeParse(body);
    if (!validation.success) {
      return Api.badRequest('Invalid audit cycle data', validation.error.format());
    }

    const { name, scopeType, departmentId, location, startDate, endDate, auditorIds } =
      validation.data;

    if (scopeType === 'DEPARTMENT') {
      const department = await prisma.department.findUnique({
        where: { id: departmentId },
        select: { id: true },
      });
      if (!department) return Api.badRequest('Selected department does not exist');
    }

    const auditors = await prisma.user.findMany({
      where: { id: { in: auditorIds } },
      select: { id: true },
    });
    if (auditors.length !== auditorIds.length) {
      return Api.badRequest('One or more selected auditors do not exist');
    }

    const { cycle, itemCount } = await prisma.$transaction(async (tx) => {
      const createdCycle = await tx.auditCycle.create({
        data: {
          name,
          scopeType,
          departmentId: scopeType === 'DEPARTMENT' ? departmentId : null,
          location: scopeType === 'LOCATION' ? location : null,
          startDate,
          endDate,
          createdById: user.id,
        },
      });

      await tx.auditCycleAuditor.createMany({
        data: auditorIds.map((auditorId) => ({
          cycleId: createdCycle.id,
          auditorId,
        })),
      });

      const scopedAssets = await tx.asset.findMany({
        where:
          scopeType === 'DEPARTMENT'
            ? { departmentId, status: { notIn: ['RETIRED', 'DISPOSED'] } }
            : { location, status: { notIn: ['RETIRED', 'DISPOSED'] } },
        select: { id: true, location: true },
      });

      if (scopedAssets.length > 0) {
        await tx.auditItem.createMany({
          data: scopedAssets.map((asset) => ({
            cycleId: createdCycle.id,
            assetId: asset.id,
            expectedLocation: asset.location,
          })),
        });
      }

      return { cycle: createdCycle, itemCount: scopedAssets.length };
    });

    void recordActivityEvent({
      action: 'AUDIT_CYCLE_CREATED',
      actorId: user.id,
      entityType: 'auditCycle',
      entityId: cycle.id,
      summary: `Audit cycle "${name}" created with ${itemCount} asset(s) in scope`,
      requestId,
      metadata: { scopeType, itemCount, auditorCount: auditorIds.length },
    });
    void createNotifications({
      recipientIds: auditorIds,
      type: 'AUDIT_CYCLE_ASSIGNED',
      title: `You were assigned to audit cycle "${name}"`,
      entityType: 'auditCycle',
      entityId: cycle.id,
      metadata: { scopeType, itemCount },
    });

    logger.info('audit.cycle.create', { requestId, cycleId: cycle.id, itemCount });

    return Api.created({ ...cycle, itemCount });
  } catch (error) {
    logger.error('audit.cycle.create.failed', error, { requestId });
    return Api.internalError('Failed to create audit cycle');
  }
}
