import { prisma } from "@/lib/prisma";

/** Assets currently allocated per department (direct, or via an employee in that department). */
export async function getUtilizationByDepartment(orgId: string) {
  const departments = await prisma.department.findMany({
    where: { orgId, status: "ACTIVE" },
    select: { id: true, name: true },
  });

  const counts = await Promise.all(
    departments.map(async (dept) => {
      const count = await prisma.allocation.count({
        where: {
          status: "ACTIVE",
          asset: { orgId },
          OR: [{ toDepartmentId: dept.id }, { toEmployee: { departmentId: dept.id } }],
        },
      });
      return { departmentId: dept.id, departmentName: dept.name, allocatedCount: count };
    }),
  );

  return counts.sort((a, b) => b.allocatedCount - a.allocatedCount);
}

/** Maintenance requests raised per month, most recent N months. */
export async function getMaintenanceFrequency(orgId: string, months: number) {
  const since = new Date();
  since.setMonth(since.getMonth() - months + 1);
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const rows = await prisma.$queryRaw<{ month: Date; count: bigint }[]>`
    SELECT date_trunc('month', "createdAt") AS month, COUNT(*) AS count
    FROM "MaintenanceRequest"
    WHERE "assetId" IN (SELECT id FROM "Asset" WHERE "orgId" = ${orgId}::uuid)
      AND "createdAt" >= ${since}
    GROUP BY month
    ORDER BY month ASC
  `;

  return rows.map((r) => ({ month: r.month.toISOString().slice(0, 7), count: Number(r.count) }));
}

/** Top assets by combined allocation + booking activity (all-time). */
export async function getMostUsedAssets(orgId: string, limit: number) {
  const rows = await prisma.$queryRaw<
    { id: string; assetTag: string; name: string; allocations: bigint; bookings: bigint }[]
  >`
    SELECT a.id, a."assetTag", a.name,
      COALESCE(alloc.cnt, 0) AS allocations,
      COALESCE(book.cnt, 0) AS bookings
    FROM "Asset" a
    LEFT JOIN (SELECT "assetId", COUNT(*) AS cnt FROM "Allocation" GROUP BY "assetId") alloc ON alloc."assetId" = a.id
    LEFT JOIN (SELECT "assetId", COUNT(*) AS cnt FROM "Booking" WHERE status <> 'CANCELLED' GROUP BY "assetId") book ON book."assetId" = a.id
    WHERE a."orgId" = ${orgId}::uuid
    ORDER BY (COALESCE(alloc.cnt, 0) + COALESCE(book.cnt, 0)) DESC
    LIMIT ${limit}
  `;

  return rows
    .map((r) => ({
      id: r.id,
      assetTag: r.assetTag,
      name: r.name,
      usageCount: Number(r.allocations) + Number(r.bookings),
    }))
    .filter((r) => r.usageCount > 0);
}

/** Assets with no allocation/booking/maintenance activity in the last `idleDays` days. */
export async function getIdleAssets(orgId: string, idleDays: number, limit = 20) {
  const cutoff = new Date(Date.now() - idleDays * 24 * 60 * 60 * 1000);

  const rows = await prisma.$queryRaw<
    { id: string; assetTag: string; name: string; lastActivity: Date | null }[]
  >`
    SELECT a.id, a."assetTag", a.name,
      GREATEST(
        COALESCE(alloc.last, a."createdAt"),
        COALESCE(book.last, a."createdAt"),
        COALESCE(maint.last, a."createdAt")
      ) AS "lastActivity"
    FROM "Asset" a
    LEFT JOIN (SELECT "assetId", MAX("allocatedAt") AS last FROM "Allocation" GROUP BY "assetId") alloc ON alloc."assetId" = a.id
    LEFT JOIN (SELECT "assetId", MAX("startTime") AS last FROM "Booking" GROUP BY "assetId") book ON book."assetId" = a.id
    LEFT JOIN (SELECT "assetId", MAX("createdAt") AS last FROM "MaintenanceRequest" GROUP BY "assetId") maint ON maint."assetId" = a.id
    WHERE a."orgId" = ${orgId}::uuid
      AND a.status = 'AVAILABLE'
      AND GREATEST(
        COALESCE(alloc.last, a."createdAt"),
        COALESCE(book.last, a."createdAt"),
        COALESCE(maint.last, a."createdAt")
      ) < ${cutoff}
    ORDER BY "lastActivity" ASC
    LIMIT ${limit}
  `;

  return rows.map((r) => ({
    id: r.id,
    assetTag: r.assetTag,
    name: r.name,
    idleSinceDays: r.lastActivity ? Math.floor((Date.now() - r.lastActivity.getTime()) / 86400000) : null,
  }));
}

/** Assets whose age exceeds the retirement threshold, oldest first. */
export async function getNearingRetirement(orgId: string, retirementYears: number, limit = 20) {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - retirementYears);

  const assets = await prisma.asset.findMany({
    where: {
      orgId,
      status: { notIn: ["RETIRED", "DISPOSED"] },
      acquisitionDate: { not: null, lte: cutoff },
    },
    orderBy: { acquisitionDate: "asc" },
    take: limit,
    select: { id: true, assetTag: true, name: true, acquisitionDate: true },
  });

  return assets.map((a) => ({
    ...a,
    ageYears: a.acquisitionDate
      ? Math.floor((Date.now() - a.acquisitionDate.getTime()) / (365.25 * 86400000))
      : null,
  }));
}

/** Acquisition cost summed by category — ranking/reporting only, never accounting (AGENTS.md Non-Goals). */
export async function getSpendByCategory(orgId: string) {
  const rows = await prisma.asset.groupBy({
    by: ["categoryId"],
    where: { orgId, acquisitionCost: { not: null } },
    _sum: { acquisitionCost: true },
    _count: { _all: true },
  });

  const categories = await prisma.assetCategory.findMany({
    where: { id: { in: rows.map((r) => r.categoryId) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(categories.map((c) => [c.id, c.name]));

  return rows
    .map((r) => ({
      categoryId: r.categoryId,
      categoryName: nameById.get(r.categoryId) ?? "Unknown",
      totalCost: r._sum.acquisitionCost ? Number(r._sum.acquisitionCost) : 0,
      assetCount: r._count._all,
    }))
    .sort((a, b) => b.totalCost - a.totalCost);
}

/** Booking density bucketed by weekday (0=Sun) x hour-of-day — peak usage windows. */
export async function getBookingHeatmap(orgId: string) {
  const rows = await prisma.$queryRaw<{ dow: number; hour: number; count: bigint }[]>`
    SELECT EXTRACT(DOW FROM "startTime")::int AS dow, EXTRACT(HOUR FROM "startTime")::int AS hour, COUNT(*) AS count
    FROM "Booking"
    WHERE "assetId" IN (SELECT id FROM "Asset" WHERE "orgId" = ${orgId}::uuid)
      AND status <> 'CANCELLED'
    GROUP BY dow, hour
    ORDER BY dow, hour
  `;

  return rows.map((r) => ({ dayOfWeek: r.dow, hour: r.hour, count: Number(r.count) }));
}

export async function getSummary(orgId: string) {
  const [total, byStatus, departmentCount, categoryCount] = await Promise.all([
    prisma.asset.count({ where: { orgId } }),
    prisma.asset.groupBy({ by: ["status"], where: { orgId }, _count: { _all: true } }),
    prisma.department.count({ where: { orgId, status: "ACTIVE" } }),
    prisma.assetCategory.count({ where: { orgId } }),
  ]);

  return {
    totalAssets: total,
    statusBreakdown: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
    departmentCount,
    categoryCount,
  };
}

export function reportCacheKey(orgId: string, report: string, filters: Record<string, unknown>): string {
  const payload = JSON.stringify({ orgId, report, filters });
  return `reports:${Buffer.from(payload).toString("base64url")}`;
}
