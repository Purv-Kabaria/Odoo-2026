import { Api } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  getBookingHeatmap,
  getIdleAssets,
  getMaintenanceFrequency,
  getMostUsedAssets,
  getNearingRetirement,
  getSpendByCategory,
  getSummary,
  getUtilizationByDepartment,
  reportCacheKey,
} from "@/lib/reports/queries";
import { getJsonCache, setJsonCache } from "@/lib/redis-cache";
import { ReportFiltersSchema } from "@/types/reports-types";

function canViewReports(role: string): boolean {
  return role === "ADMIN" || role === "ASSET_MANAGER";
}

export async function GET(req: Request) {
  const startedAt = performance.now();
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();
    if (!canViewReports(user.role)) return Api.forbidden("Only Admins and Asset Managers can view reports");

    const searchParams = new URL(req.url).searchParams;
    const validation = ReportFiltersSchema.safeParse({
      idleDays: searchParams.get("idleDays") ?? undefined,
      retirementYears: searchParams.get("retirementYears") ?? undefined,
      months: searchParams.get("months") ?? undefined,
    });
    if (!validation.success) return Api.badRequest("Invalid filters", validation.error.format());
    const filters = validation.data;

    const cacheKey = reportCacheKey(user.orgId, "summary", filters);
    const cached = await getJsonCache<Record<string, unknown>>(cacheKey);
    if (cached) return Api.ok(cached, { cache: "redis" });

    const [
      summary,
      utilizationByDepartment,
      maintenanceFrequency,
      mostUsedAssets,
      idleAssets,
      nearingRetirement,
      spendByCategory,
      bookingHeatmap,
    ] = await Promise.all([
      getSummary(user.orgId),
      getUtilizationByDepartment(user.orgId),
      getMaintenanceFrequency(user.orgId, filters.months),
      getMostUsedAssets(user.orgId, 10),
      getIdleAssets(user.orgId, filters.idleDays),
      getNearingRetirement(user.orgId, filters.retirementYears),
      getSpendByCategory(user.orgId),
      getBookingHeatmap(user.orgId),
    ]);

    const payload = {
      summary,
      utilizationByDepartment,
      maintenanceFrequency,
      mostUsedAssets,
      idleAssets,
      nearingRetirement,
      spendByCategory,
      bookingHeatmap,
    };

    void setJsonCache(cacheKey, payload, 60);

    logger.info("reports.summary", {
      requestId,
      durationMs: Math.round(performance.now() - startedAt),
    });

    return Api.ok(payload, { cache: "miss" });
  } catch (error) {
    logger.error("reports.summary.failed", error, { requestId });
    return Api.internalError("Failed to load reports");
  }
}
