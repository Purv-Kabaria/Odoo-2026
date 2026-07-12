import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import type { ReportFilters } from '@/types/reports-types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Department + category are the two dimensions every asset-scoped report
 * can safely compose with, regardless of what else the report intrinsically
 * filters by (e.g. idle assets are AVAILABLE by definition — a free status
 * filter wouldn't compose sensibly there, so callers add status themselves
 * where it's meaningful). */
function baseAssetWhere(filters: ReportFilters): Prisma.AssetWhereInput {
  return {
    ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
    ...(filters.category ? { category: filters.category } : {}),
  };
}

function withStatus(
  where: Prisma.AssetWhereInput,
  filters: ReportFilters,
): Prisma.AssetWhereInput {
  return filters.status ? { ...where, status: filters.status } : where;
}

const assetSummarySelect = {
  id: true,
  assetTag: true,
  name: true,
  category: true,
  location: true,
  acquisitionDate: true,
  department: { select: { id: true, name: true } },
} satisfies Prisma.AssetSelect;

// --- KPI summary -----------------------------------------------------------

export async function getSummary(filters: ReportFilters) {
  const assetWhere = withStatus(baseAssetWhere(filters), filters);
  const now = new Date();
  const periodEnd = filters.dateTo ?? now;
  const periodStart = filters.dateFrom ?? new Date(periodEnd.getTime() - 30 * DAY_MS);
  const periodLengthMs = periodEnd.getTime() - periodStart.getTime();
  const priorStart = new Date(periodStart.getTime() - periodLengthMs);

  const retirementCutoff = new Date(now);
  retirementCutoff.setFullYear(retirementCutoff.getFullYear() - filters.retirementYears);

  const [
    totalAssets,
    byStatus,
    departmentCount,
    nearingRetirementCount,
    auditItemCounts,
    newAssetsThisPeriod,
    newAssetsPriorPeriod,
  ] = await Promise.all([
    prisma.asset.count({ where: assetWhere }),
    prisma.asset.groupBy({
      by: ['status'],
      where: baseAssetWhere(filters),
      _count: { _all: true },
    }),
    prisma.department.count({ where: { status: 'ACTIVE' } }),
    prisma.asset.count({
      where: {
        ...baseAssetWhere(filters),
        acquisitionDate: { lte: retirementCutoff },
        status: { notIn: ['RETIRED', 'DISPOSED'] },
      },
    }),
    prisma.auditItem.groupBy({
      by: ['status'],
      where: {
        status: { not: 'PENDING' },
        ...(filters.dateFrom || filters.dateTo
          ? { verifiedAt: { gte: periodStart, lte: periodEnd } }
          : {}),
      },
      _count: { _all: true },
    }),
    prisma.asset.count({ where: { createdAt: { gte: periodStart, lte: periodEnd } } }),
    prisma.asset.count({ where: { createdAt: { gte: priorStart, lt: periodStart } } }),
  ]);

  const statusCounts = Object.fromEntries(
    byStatus.map((row) => [row.status, row._count._all]),
  );

  const verified = auditItemCounts.find((r) => r.status === 'VERIFIED')?._count._all ?? 0;
  const missing = auditItemCounts.find((r) => r.status === 'MISSING')?._count._all ?? 0;
  const damaged = auditItemCounts.find((r) => r.status === 'DAMAGED')?._count._all ?? 0;
  const totalAudited = verified + missing + damaged;

  return {
    totalAssets,
    statusCounts,
    departmentCount,
    nearingRetirementCount,
    auditPassRate: totalAudited > 0 ? verified / totalAudited : null,
    auditedCount: totalAudited,
    newAssetsThisPeriod,
    newAssetsPriorPeriod,
    newAssetsDelta: newAssetsThisPeriod - newAssetsPriorPeriod,
  };
}

// --- Department-wise asset distribution ------------------------------------

export async function getDepartmentSummary(filters: ReportFilters) {
  const [grouped, departments] = await Promise.all([
    prisma.asset.groupBy({
      by: ['departmentId', 'status'],
      where: baseAssetWhere(filters),
      _count: { _all: true },
    }),
    prisma.department.findMany({ select: { id: true, name: true } }),
  ]);

  const departmentNames = new Map(departments.map((d) => [d.id, d.name]));

  type DepartmentBucket = {
    departmentId: string;
    departmentName: string;
    counts: Record<string, number>;
  };

  const byDepartment = new Map<string, DepartmentBucket>();
  for (const row of grouped) {
    const departmentId = row.departmentId ?? 'unassigned';
    const departmentName = row.departmentId
      ? (departmentNames.get(row.departmentId) ?? 'Unknown')
      : 'Unassigned';
    const bucket =
      byDepartment.get(departmentId) ?? { departmentId, departmentName, counts: {} };
    bucket.counts[row.status] = row._count._all;
    byDepartment.set(departmentId, bucket);
  }

  return Array.from(byDepartment.values()).sort((a, b) =>
    a.departmentName.localeCompare(b.departmentName),
  );
}

// --- Audit discrepancy trend (maintenance-frequency proxy) -----------------

type TrendRow = { month: Date; type: 'MISSING' | 'DAMAGED'; count: bigint };

export async function getAuditTrend(filters: ReportFilters) {
  const now = new Date();
  const dateTo = filters.dateTo ?? now;
  const dateFrom = filters.dateFrom ?? new Date(dateTo.getTime() - 365 * DAY_MS);
  const departmentId = filters.departmentId ?? null;

  const rows = await prisma.$queryRaw<TrendRow[]>`
    SELECT date_trunc('month', ad."createdAt") AS month, ad.type AS type, COUNT(*)::int AS count
    FROM "AuditDiscrepancy" ad
    JOIN "AuditCycle" ac ON ac.id = ad."cycleId"
    WHERE ad."createdAt" >= ${dateFrom}
      AND ad."createdAt" <= ${dateTo}
      AND (${departmentId}::uuid IS NULL OR ac."departmentId" = ${departmentId}::uuid)
    GROUP BY date_trunc('month', ad."createdAt"), ad.type
    ORDER BY month ASC
  `;

  const byMonth = new Map<string, { month: string; missing: number; damaged: number }>();
  for (const row of rows) {
    const key = row.month.toISOString().slice(0, 7);
    const bucket = byMonth.get(key) ?? { month: key, missing: 0, damaged: 0 };
    if (row.type === 'MISSING') bucket.missing = Number(row.count);
    if (row.type === 'DAMAGED') bucket.damaged = Number(row.count);
    byMonth.set(key, bucket);
  }

  return Array.from(byMonth.values()).sort((a, b) => a.month.localeCompare(b.month));
}

// --- Asset activity: most-audited (usage proxy) + idle ---------------------

export async function getAssetActivity(filters: ReportFilters) {
  const assetWhere = withStatus(baseAssetWhere(filters), filters);
  const dateRange =
    filters.dateFrom || filters.dateTo
      ? { gte: filters.dateFrom, lte: filters.dateTo }
      : undefined;

  const grouped = await prisma.auditItem.groupBy({
    by: ['assetId'],
    where: {
      status: { not: 'PENDING' },
      ...(dateRange ? { verifiedAt: dateRange } : {}),
      asset: assetWhere,
    },
    _count: { _all: true },
  });

  const topAssetIds = grouped
    .sort((a, b) => b._count._all - a._count._all)
    .slice(0, 10)
    .map((g) => g.assetId);

  const topAssets = topAssetIds.length
    ? await prisma.asset.findMany({
        where: { id: { in: topAssetIds } },
        select: assetSummarySelect,
      })
    : [];
  const assetsById = new Map(topAssets.map((a) => [a.id, a]));
  const countsById = new Map(grouped.map((g) => [g.assetId, g._count._all]));

  const mostAudited = topAssetIds
    .map((id) => {
      const asset = assetsById.get(id);
      if (!asset) return null;
      return { ...asset, auditTouches: countsById.get(id) ?? 0 };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  // Idle: AVAILABLE assets (by definition — a free status filter wouldn't
  // compose sensibly with "idle") with no recent audit or activity signal.
  const idleCutoff = new Date(Date.now() - filters.idleDays * DAY_MS);
  const candidates = await prisma.asset.findMany({
    where: { status: 'AVAILABLE', ...baseAssetWhere(filters) },
    select: { ...assetSummarySelect, updatedAt: true },
  });

  if (candidates.length === 0) {
    return { mostAudited, idle: [] };
  }

  const candidateIds = candidates.map((c) => c.id);
  const [recentAudits, recentActivity] = await Promise.all([
    prisma.auditItem.findMany({
      where: { assetId: { in: candidateIds }, verifiedAt: { gte: idleCutoff } },
      select: { assetId: true },
      distinct: ['assetId'],
    }),
    prisma.activityEvent.findMany({
      where: { entityType: 'assets', entityId: { in: candidateIds }, createdAt: { gte: idleCutoff } },
      select: { entityId: true },
      distinct: ['entityId'],
    }),
  ]);

  const activeIds = new Set<string>([
    ...recentAudits.map((r) => r.assetId),
    ...recentActivity.map((r) => r.entityId as string),
  ]);

  const idle = candidates
    .filter((asset) => !activeIds.has(asset.id))
    .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime())
    .slice(0, 25);

  return { mostAudited, idle };
}

// --- Maintenance outlook: nearing retirement + audit-flagged damaged -------

export async function getMaintenanceOutlook(filters: ReportFilters) {
  const now = new Date();
  const retirementCutoff = new Date(now);
  retirementCutoff.setFullYear(retirementCutoff.getFullYear() - filters.retirementYears);

  const nearingRetirement = await prisma.asset.findMany({
    where: {
      ...baseAssetWhere(filters),
      acquisitionDate: { lte: retirementCutoff },
      status: { notIn: ['RETIRED', 'DISPOSED'] },
    },
    orderBy: { acquisitionDate: 'asc' },
    take: 25,
    select: assetSummarySelect,
  });

  // "Flagged for maintenance" = the asset's most recent resolved audit mark
  // (of any kind) is DAMAGED and it hasn't already been actioned — a later
  // VERIFIED mark clears the flag, so this isn't just "ever marked damaged."
  const resolvedItems = await prisma.auditItem.findMany({
    where: {
      status: { not: 'PENDING' },
      asset: {
        ...baseAssetWhere(filters),
        status: { notIn: ['UNDER_MAINTENANCE', 'RETIRED', 'DISPOSED', 'LOST'] },
      },
    },
    orderBy: [{ verifiedAt: 'desc' }],
    select: {
      assetId: true,
      status: true,
      verifiedAt: true,
      note: true,
      asset: { select: assetSummarySelect },
    },
  });

  const latestByAsset = new Map<string, (typeof resolvedItems)[number]>();
  for (const item of resolvedItems) {
    if (!latestByAsset.has(item.assetId)) latestByAsset.set(item.assetId, item);
  }

  const flaggedDamaged = Array.from(latestByAsset.values())
    .filter((item) => item.status === 'DAMAGED')
    .slice(0, 25)
    .map((item) => ({
      ...item.asset,
      flaggedAt: item.verifiedAt,
      note: item.note,
    }));

  return { nearingRetirement, flaggedDamaged };
}

// --- Spend by category -------------------------------------------------

export async function getSpendByCategory(filters: ReportFilters) {
  const grouped = await prisma.asset.groupBy({
    by: ['category'],
    where: {
      ...withStatus(baseAssetWhere(filters), filters),
      acquisitionCostCents: { not: null },
    },
    _sum: { acquisitionCostCents: true },
    _count: { _all: true },
  });

  return grouped
    .map((row) => ({
      category: row.category,
      totalCostCents: row._sum.acquisitionCostCents ?? 0,
      assetCount: row._count._all,
    }))
    .sort((a, b) => b.totalCostCents - a.totalCostCents);
}

// --- Auditor performance leaderboard ----------------------------------

export async function getAuditorPerformance(filters: ReportFilters) {
  const dateRange =
    filters.dateFrom || filters.dateTo
      ? { gte: filters.dateFrom, lte: filters.dateTo }
      : undefined;

  const grouped = await prisma.auditItem.groupBy({
    by: ['verifiedById', 'status'],
    where: {
      verifiedById: { not: null },
      status: { not: 'PENDING' },
      ...(dateRange ? { verifiedAt: dateRange } : {}),
    },
    _count: { _all: true },
  });

  const byAuditor = new Map<string, { verified: number; missing: number; damaged: number }>();
  for (const row of grouped) {
    if (!row.verifiedById) continue;
    const bucket = byAuditor.get(row.verifiedById) ?? { verified: 0, missing: 0, damaged: 0 };
    if (row.status === 'VERIFIED') bucket.verified += row._count._all;
    if (row.status === 'MISSING') bucket.missing += row._count._all;
    if (row.status === 'DAMAGED') bucket.damaged += row._count._all;
    byAuditor.set(row.verifiedById, bucket);
  }

  const auditorIds = Array.from(byAuditor.keys());
  const users = auditorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: auditorIds } },
        select: { id: true, name: true, email: true },
      })
    : [];

  return users
    .map((user) => {
      const bucket = byAuditor.get(user.id) ?? { verified: 0, missing: 0, damaged: 0 };
      const total = bucket.verified + bucket.missing + bucket.damaged;
      return {
        auditorId: user.id,
        name: user.name,
        email: user.email,
        verified: bucket.verified,
        missing: bucket.missing,
        damaged: bucket.damaged,
        totalItems: total,
        passRate: total > 0 ? bucket.verified / total : null,
      };
    })
    .sort((a, b) => b.totalItems - a.totalItems)
    .slice(0, 15);
}

// --- Filter metadata -----------------------------------------------------

export async function getDistinctCategories(): Promise<string[]> {
  const rows = await prisma.asset.findMany({
    distinct: ['category'],
    select: { category: true },
    orderBy: { category: 'asc' },
  });
  return rows.map((r) => r.category);
}
