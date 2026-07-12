import { Api } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { rowsToCsv } from "@/lib/reports/csv";
import {
  getBookingHeatmap,
  getIdleAssets,
  getMaintenanceFrequency,
  getMostUsedAssets,
  getNearingRetirement,
  getSpendByCategory,
  getUtilizationByDepartment,
} from "@/lib/reports/queries";
import { REPORT_EXPORT_KEYS, ReportExportQuerySchema } from "@/types/reports-types";

function canViewReports(role: string): boolean {
  return role === "ADMIN" || role === "ASSET_MANAGER";
}

type ReportExportKey = (typeof REPORT_EXPORT_KEYS)[number];

const EXPORTERS: Record<ReportExportKey, (orgId: string, filters: { idleDays: number; retirementYears: number; months: number }) => Promise<{ columns: string[]; rows: Record<string, unknown>[] }>> = {
  "utilization-by-department": async (orgId) => ({
    columns: ["departmentName", "allocatedCount"],
    rows: await getUtilizationByDepartment(orgId),
  }),
  "maintenance-frequency": async (orgId, f) => ({
    columns: ["month", "count"],
    rows: await getMaintenanceFrequency(orgId, f.months),
  }),
  "most-used-assets": async (orgId) => ({
    columns: ["assetTag", "name", "usageCount"],
    rows: await getMostUsedAssets(orgId, 100),
  }),
  "idle-assets": async (orgId, f) => ({
    columns: ["assetTag", "name", "idleSinceDays"],
    rows: await getIdleAssets(orgId, f.idleDays, 200),
  }),
  "nearing-retirement": async (orgId, f) => ({
    columns: ["assetTag", "name", "ageYears"],
    rows: await getNearingRetirement(orgId, f.retirementYears, 200),
  }),
  "spend-by-category": async (orgId) => ({
    columns: ["categoryName", "totalCost", "assetCount"],
    rows: await getSpendByCategory(orgId),
  }),
  "booking-heatmap": async (orgId) => ({
    columns: ["dayOfWeek", "hour", "count"],
    rows: await getBookingHeatmap(orgId),
  }),
};

export async function GET(req: Request) {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();
    if (!canViewReports(user.role)) return Api.forbidden("Only Admins and Asset Managers can export reports");

    const searchParams = new URL(req.url).searchParams;
    const validation = ReportExportQuerySchema.safeParse({
      report: searchParams.get("report") ?? undefined,
      idleDays: searchParams.get("idleDays") ?? undefined,
      retirementYears: searchParams.get("retirementYears") ?? undefined,
      months: searchParams.get("months") ?? undefined,
    });
    if (!validation.success) return Api.badRequest("Invalid export request", validation.error.format());
    const { report, ...filters } = validation.data;

    const { columns, rows } = await EXPORTERS[report](user.orgId, filters);
    const csv = rowsToCsv(columns, rows);

    logger.info("reports.export", { requestId, report, rowCount: rows.length });

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${report}.csv"`,
      },
    });
  } catch (error) {
    logger.error("reports.export.failed", error, { requestId });
    return Api.internalError("Failed to export report");
  }
}
