import { Api } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { rowsToCsv, type ReportColumn } from "@/lib/reports/csv";
import { rowsToDocx } from "@/lib/reports/docx";
import { rowsToPdf } from "@/lib/reports/pdf";
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

// Human-readable everywhere a user can see it — the file name, the PDF/DOCX
// title, and (via each exporter's `columns`) every column header. Nobody
// downloading a report should see a raw camelCase field name or a
// kebab-case route key.
const REPORT_TITLES: Record<ReportExportKey, string> = {
  "utilization-by-department": "Utilization by Department",
  "maintenance-frequency": "Maintenance Frequency",
  "most-used-assets": "Most Used Assets",
  "idle-assets": "Idle Assets",
  "nearing-retirement": "Assets Nearing Retirement",
  "spend-by-category": "Spend by Category",
  "booking-heatmap": "Resource Booking Heatmap",
};

const EXPORTERS: Record<
  ReportExportKey,
  (
    orgId: string,
    filters: { idleDays: number; retirementYears: number; months: number },
  ) => Promise<{ columns: ReportColumn[]; rows: Record<string, unknown>[] }>
> = {
  "utilization-by-department": async (orgId) => ({
    columns: [
      { key: "departmentName", label: "Department" },
      { key: "allocatedCount", label: "Allocated Assets" },
    ],
    rows: await getUtilizationByDepartment(orgId),
  }),
  "maintenance-frequency": async (orgId, f) => ({
    columns: [
      { key: "month", label: "Month" },
      { key: "count", label: "Requests" },
    ],
    rows: await getMaintenanceFrequency(orgId, f.months),
  }),
  "most-used-assets": async (orgId) => ({
    columns: [
      { key: "assetTag", label: "Asset Tag" },
      { key: "name", label: "Name" },
      { key: "usageCount", label: "Usage Count" },
    ],
    rows: await getMostUsedAssets(orgId, 100),
  }),
  "idle-assets": async (orgId, f) => ({
    columns: [
      { key: "assetTag", label: "Asset Tag" },
      { key: "name", label: "Name" },
      { key: "idleSinceDays", label: "Idle (Days)" },
    ],
    rows: await getIdleAssets(orgId, f.idleDays, 200),
  }),
  "nearing-retirement": async (orgId, f) => ({
    columns: [
      { key: "assetTag", label: "Asset Tag" },
      { key: "name", label: "Name" },
      { key: "ageYears", label: "Age (Years)" },
    ],
    rows: await getNearingRetirement(orgId, f.retirementYears, 200),
  }),
  "spend-by-category": async (orgId) => ({
    columns: [
      { key: "categoryName", label: "Category" },
      { key: "totalCost", label: "Total Cost" },
      { key: "assetCount", label: "Asset Count" },
    ],
    rows: await getSpendByCategory(orgId),
  }),
  "booking-heatmap": async (orgId) => ({
    columns: [
      { key: "dayOfWeek", label: "Day of Week" },
      { key: "hour", label: "Hour" },
      { key: "count", label: "Bookings" },
    ],
    rows: await getBookingHeatmap(orgId),
  }),
};

const CONTENT_TYPES = {
  csv: "text/csv; charset=utf-8",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
} as const;

export async function GET(req: Request) {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();
    if (!canViewReports(user.role)) return Api.forbidden("Only Admins and Asset Managers can export reports");

    const searchParams = new URL(req.url).searchParams;
    const validation = ReportExportQuerySchema.safeParse({
      report: searchParams.get("report") ?? undefined,
      format: searchParams.get("format") ?? undefined,
      idleDays: searchParams.get("idleDays") ?? undefined,
      retirementYears: searchParams.get("retirementYears") ?? undefined,
      months: searchParams.get("months") ?? undefined,
    });
    if (!validation.success) return Api.badRequest("Invalid export request", validation.error.format());
    const { report, format, ...filters } = validation.data;

    const { columns, rows } = await EXPORTERS[report](user.orgId, filters);
    const title = REPORT_TITLES[report];

    // Buffer's ArrayBufferLike generic (which includes SharedArrayBuffer)
    // doesn't satisfy the stricter DOM BlobPart/BodyInit types, which
    // require a plain ArrayBuffer — Uint8Array.from() copies into a
    // freshly-allocated one instead of reusing Buffer's underlying buffer.
    let body: string | Blob;
    if (format === "pdf") {
      body = new Blob([Uint8Array.from(await rowsToPdf(title, columns, rows))]);
    } else if (format === "docx") {
      body = new Blob([Uint8Array.from(await rowsToDocx(title, columns, rows))]);
    } else {
      body = rowsToCsv(columns, rows);
    }

    logger.info("reports.export", { requestId, report, format, rowCount: rows.length });

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": CONTENT_TYPES[format],
        "Content-Disposition": `attachment; filename="${title}.${format}"`,
      },
    });
  } catch (error) {
    logger.error("reports.export.failed", error, { requestId });
    return Api.internalError("Failed to export report");
  }
}
