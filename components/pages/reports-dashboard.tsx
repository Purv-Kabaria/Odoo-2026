"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  Boxes,
  Calendar,
  CalendarClock,
  Clock,
  Download,
  Gauge,
  MapPin,
  PackageX,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Wallet,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { readApiResponse } from "@/lib/api-client";
import { formatTableDate } from "@/lib/date-format";
import { fetchEntityRows } from "@/lib/entities-client";
import { ASSET_STATUS_COLORS, ASSET_STATUS_LABELS } from "@/lib/reports/status-colors";
import type { AssetStatus } from "@prisma/client";

type AssetSummaryRow = {
  id: string;
  assetTag: string;
  name: string;
  category: string;
  location: string | null;
  acquisitionDate: string | null;
  department: { id: string; name: string } | null;
};

type SummaryData = {
  totalAssets: number;
  statusCounts: Partial<Record<AssetStatus, number>>;
  departmentCount: number;
  nearingRetirementCount: number;
  auditPassRate: number | null;
  auditedCount: number;
  newAssetsThisPeriod: number;
  newAssetsPriorPeriod: number;
  newAssetsDelta: number;
};

type DepartmentSummaryRow = {
  departmentId: string;
  departmentName: string;
  counts: Partial<Record<AssetStatus, number>>;
};

type AuditTrendRow = { month: string; missing: number; damaged: number };

type AssetActivityData = {
  mostAudited: (AssetSummaryRow & { auditTouches: number })[];
  idle: (AssetSummaryRow & { updatedAt: string })[];
};

type MaintenanceOutlookData = {
  nearingRetirement: AssetSummaryRow[];
  flaggedDamaged: (AssetSummaryRow & { flaggedAt: string | null; note: string | null })[];
};

type SpendRow = { category: string; totalCostCents: number; assetCount: number };

type AuditorRow = {
  auditorId: string;
  name: string;
  email: string;
  verified: number;
  missing: number;
  damaged: number;
  totalItems: number;
  passRate: number | null;
};

type DepartmentOption = { id: string; name: string };

const ASSET_STATUS_KEYS = Object.keys(ASSET_STATUS_LABELS) as AssetStatus[];

const DEFAULT_FILTERS = {
  departmentId: "",
  category: "",
  status: "",
  dateFrom: "",
  dateTo: "",
  idleDays: "60",
  retirementYears: "5",
};

type FiltersState = typeof DEFAULT_FILTERS;

function buildQuery(filters: FiltersState): string {
  const params = new URLSearchParams();
  if (filters.departmentId) params.set("departmentId", filters.departmentId);
  if (filters.category) params.set("category", filters.category);
  if (filters.status) params.set("status", filters.status);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  if (filters.idleDays) params.set("idleDays", filters.idleDays);
  if (filters.retirementYears) params.set("retirementYears", filters.retirementYears);
  return params.toString();
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatPercent(ratio: number | null): string {
  if (ratio === null) return "—";
  return `${Math.round(ratio * 100)}%`;
}

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month) return monthKey;
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: "short",
    year: "2-digit",
  });
}

function SectionCard({
  title,
  description,
  icon: Icon,
  exportKey,
  query,
  children,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  exportKey?: string;
  query?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-none">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Icon className="size-4 shrink-0 text-primary" />
              <CardTitle>{title}</CardTitle>
            </div>
            <CardDescription>{description}</CardDescription>
          </div>
          {exportKey ? (
            <Button asChild variant="outline" size="sm" className="shrink-0 cursor-pointer rounded-none">
              <a href={`/api/reports/export/${exportKey}${query ? `?${query}` : ""}`}>
                <Download className="size-3.5" />
                CSV
              </a>
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function KpiTile({
  label,
  value,
  icon: Icon,
  detail,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  detail?: string;
}) {
  return (
    <Card size="sm" className="rounded-none">
      <CardContent className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center border border-border bg-primary/10 text-primary">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold tracking-tight text-foreground">{value}</p>
          {detail ? <p className="truncate text-xs text-muted-foreground">{detail}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-6 text-center text-sm text-muted-foreground">
        {message}
      </TableCell>
    </TableRow>
  );
}

export function ReportsDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filters, setFilters] = React.useState<FiltersState>(() => ({
    departmentId: searchParams.get("departmentId") ?? "",
    category: searchParams.get("category") ?? "",
    status: searchParams.get("status") ?? "",
    dateFrom: searchParams.get("dateFrom") ?? "",
    dateTo: searchParams.get("dateTo") ?? "",
    idleDays: searchParams.get("idleDays") ?? "60",
    retirementYears: searchParams.get("retirementYears") ?? "5",
  }));

  const [departments, setDepartments] = React.useState<DepartmentOption[]>([]);
  const [categories, setCategories] = React.useState<string[]>([]);

  const [isLoading, setIsLoading] = React.useState(true);
  const [summary, setSummary] = React.useState<SummaryData | null>(null);
  const [departmentSummary, setDepartmentSummary] = React.useState<DepartmentSummaryRow[]>([]);
  const [auditTrend, setAuditTrend] = React.useState<AuditTrendRow[]>([]);
  const [assetActivity, setAssetActivity] = React.useState<AssetActivityData>({
    mostAudited: [],
    idle: [],
  });
  const [maintenanceOutlook, setMaintenanceOutlook] = React.useState<MaintenanceOutlookData>({
    nearingRetirement: [],
    flaggedDamaged: [],
  });
  const [spendByCategory, setSpendByCategory] = React.useState<SpendRow[]>([]);
  const [auditorPerformance, setAuditorPerformance] = React.useState<AuditorRow[]>([]);

  const query = React.useMemo(() => buildQuery(filters), [filters]);

  // Filter option lists load once — independent of the selected filters.
  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void (async () => {
        try {
          const [departmentResult, filterMeta] = await Promise.all([
            fetchEntityRows<DepartmentOption>("departments", { page: 1, limit: 100, search: "" }),
            fetch("/api/reports/filters", { cache: "no-store" }).then((res) =>
              readApiResponse<{ data?: { categories?: string[] } }>(res, "Failed to load filters"),
            ),
          ]);
          setDepartments(departmentResult.rows);
          setCategories(filterMeta.data?.categories ?? []);
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Failed to load filter options");
        }
      })();
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const loadReports = React.useCallback(async (q: string) => {
    setIsLoading(true);
    try {
      const [
        summaryRes,
        departmentSummaryRes,
        auditTrendRes,
        assetActivityRes,
        maintenanceOutlookRes,
        spendRes,
        auditorRes,
      ] = await Promise.all([
        fetch(`/api/reports/summary?${q}`, { cache: "no-store" }),
        fetch(`/api/reports/department-summary?${q}`, { cache: "no-store" }),
        fetch(`/api/reports/audit-trend?${q}`, { cache: "no-store" }),
        fetch(`/api/reports/asset-activity?${q}`, { cache: "no-store" }),
        fetch(`/api/reports/maintenance-outlook?${q}`, { cache: "no-store" }),
        fetch(`/api/reports/spend-by-category?${q}`, { cache: "no-store" }),
        fetch(`/api/reports/auditor-performance?${q}`, { cache: "no-store" }),
      ]);

      const [
        summaryJson,
        departmentSummaryJson,
        auditTrendJson,
        assetActivityJson,
        maintenanceOutlookJson,
        spendJson,
        auditorJson,
      ] = await Promise.all([
        readApiResponse<{ data?: SummaryData }>(summaryRes, "Failed to load summary"),
        readApiResponse<{ data?: DepartmentSummaryRow[] }>(departmentSummaryRes, "Failed to load department summary"),
        readApiResponse<{ data?: AuditTrendRow[] }>(auditTrendRes, "Failed to load audit trend"),
        readApiResponse<{ data?: AssetActivityData }>(assetActivityRes, "Failed to load asset activity"),
        readApiResponse<{ data?: MaintenanceOutlookData }>(maintenanceOutlookRes, "Failed to load maintenance outlook"),
        readApiResponse<{ data?: SpendRow[] }>(spendRes, "Failed to load spend by category"),
        readApiResponse<{ data?: AuditorRow[] }>(auditorRes, "Failed to load auditor performance"),
      ]);

      setSummary(summaryJson.data ?? null);
      setDepartmentSummary(departmentSummaryJson.data ?? []);
      setAuditTrend(auditTrendJson.data ?? []);
      setAssetActivity(assetActivityJson.data ?? { mostAudited: [], idle: [] });
      setMaintenanceOutlook(maintenanceOutlookJson.data ?? { nearingRetirement: [], flaggedDamaged: [] });
      setSpendByCategory(spendJson.data ?? []);
      setAuditorPerformance(auditorJson.data ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load reports");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounced so typing into a threshold input doesn't fire a request per keystroke.
  React.useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadReports(query);
      router.replace(query ? `/reports?${query}` : "/reports", { scroll: false });
    }, 300);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, loadReports]);

  const updateFilter = <K extends keyof FiltersState>(key: K, value: FiltersState[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const resetFilters = () => setFilters(DEFAULT_FILTERS);

  const departmentChartData = React.useMemo(
    () =>
      departmentSummary.map((row) => ({
        departmentName: row.departmentName,
        ...row.counts,
      })),
    [departmentSummary],
  );

  const statusChartConfig = React.useMemo(() => {
    const config: ChartConfig = {};
    for (const status of ASSET_STATUS_KEYS) {
      config[status] = { label: ASSET_STATUS_LABELS[status], color: ASSET_STATUS_COLORS[status] };
    }
    return config;
  }, []);

  const auditTrendChartData = React.useMemo(
    () => auditTrend.map((row) => ({ ...row, monthLabel: formatMonthLabel(row.month) })),
    [auditTrend],
  );

  const auditTrendConfig: ChartConfig = {
    missing: { label: "Missing", color: "var(--destructive)" },
    damaged: { label: "Damaged", color: "var(--chart-3)" },
  };

  const spendChartConfig: ChartConfig = {
    totalCostCents: { label: "Spend", color: "var(--chart-1)" },
  };

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <Card className="rounded-none">
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <div className="grid gap-1.5">
            <Label className="text-xs">Department</Label>
            <Select
              value={filters.departmentId || "all"}
              onValueChange={(value) => updateFilter("departmentId", value === "all" ? "" : value)}
            >
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {departments.map((department) => (
                  <SelectItem key={department.id} value={department.id}>
                    {department.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">Category</Label>
            <Select
              value={filters.category || "all"}
              onValueChange={(value) => updateFilter("category", value === "all" ? "" : value)}
            >
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">Status</Label>
            <Select
              value={filters.status || "all"}
              onValueChange={(value) => updateFilter("status", value === "all" ? "" : value)}
            >
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {ASSET_STATUS_KEYS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {ASSET_STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">Date from</Label>
            <Input
              type="date"
              value={filters.dateFrom}
              onChange={(event) => updateFilter("dateFrom", event.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">Date to</Label>
            <Input
              type="date"
              value={filters.dateTo}
              onChange={(event) => updateFilter("dateTo", event.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">Idle after (days)</Label>
            <Input
              type="number"
              min={1}
              max={365}
              value={filters.idleDays}
              onChange={(event) => updateFilter("idleDays", event.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">Retirement age (years)</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                min={1}
                max={50}
                value={filters.retirementYears}
                onChange={(event) => updateFilter("retirementYears", event.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 cursor-pointer rounded-none"
                onClick={resetFilters}
              >
                Reset
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI row */}
      {isLoading && !summary ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-20 rounded-none" />
          ))}
        </div>
      ) : summary ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <KpiTile label="Total Assets" value={String(summary.totalAssets)} icon={Boxes} />
          <KpiTile
            label="Available"
            value={String(summary.statusCounts.AVAILABLE ?? 0)}
            icon={ShieldCheck}
          />
          <KpiTile
            label="Allocated"
            value={String(summary.statusCounts.ALLOCATED ?? 0)}
            icon={Gauge}
          />
          <KpiTile
            label="Under Maintenance"
            value={String(summary.statusCounts.UNDER_MAINTENANCE ?? 0)}
            icon={Wrench}
          />
          <KpiTile label="Lost" value={String(summary.statusCounts.LOST ?? 0)} icon={PackageX} />
          <KpiTile label="Departments" value={String(summary.departmentCount)} icon={MapPin} />
          <KpiTile
            label="Nearing Retirement"
            value={String(summary.nearingRetirementCount)}
            icon={CalendarClock}
          />
          <KpiTile
            label="Audit Pass Rate"
            value={formatPercent(summary.auditPassRate)}
            icon={summary.newAssetsDelta >= 0 ? TrendingUp : TrendingDown}
            detail={`${summary.newAssetsDelta >= 0 ? "+" : ""}${summary.newAssetsDelta} assets vs prior period`}
          />
        </div>
      ) : null}

      {/* Charts */}
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard
          title="Utilization by department"
          description="Asset status distribution across departments."
          icon={MapPin}
          exportKey="department-summary"
          query={query}
        >
          {isLoading ? (
            <Skeleton className="h-64 rounded-none" />
          ) : departmentChartData.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No asset data for this filter.</p>
          ) : (
            <ChartContainer config={statusChartConfig} className="aspect-auto h-64 w-full">
              <BarChart data={departmentChartData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="departmentName" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} fontSize={11} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                {ASSET_STATUS_KEYS.map((status) => (
                  <Bar
                    key={status}
                    dataKey={status}
                    stackId="status"
                    fill={ASSET_STATUS_COLORS[status]}
                    radius={[1, 1, 1, 1]}
                  />
                ))}
              </BarChart>
            </ChartContainer>
          )}
        </SectionCard>

        <SectionCard
          title="Maintenance frequency"
          description="Audit discrepancies (Missing / Damaged) found per month — the real repair signal available today."
          icon={AlertTriangle}
          exportKey="audit-trend"
          query={query}
        >
          {isLoading ? (
            <Skeleton className="h-64 rounded-none" />
          ) : auditTrendChartData.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No closed audit cycles in this range.</p>
          ) : (
            <ChartContainer config={auditTrendConfig} className="aspect-auto h-64 w-full">
              <LineChart data={auditTrendChartData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="monthLabel" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} fontSize={11} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Line
                  type="monotone"
                  dataKey="missing"
                  stroke="var(--destructive)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="damaged"
                  stroke="var(--chart-3)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ChartContainer>
          )}
        </SectionCard>
      </div>

      {/* Usage lists */}
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard
          title="Most-audited assets"
          description="Ranked by audit-check frequency — the closest real usage signal until Booking/Allocation ships."
          icon={TrendingUp}
          exportKey="asset-activity-most-audited"
          query={query}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead>Department</TableHead>
                <TableHead className="text-right">Audit touches</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <EmptyRow colSpan={3} message="Loading…" />
              ) : assetActivity.mostAudited.length === 0 ? (
                <EmptyRow colSpan={3} message="No audited assets in this filter." />
              ) : (
                assetActivity.mostAudited.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      {row.assetTag} · {row.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.department?.name ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono">{row.auditTouches}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </SectionCard>

        <SectionCard
          title="Idle assets"
          description={`Available assets with no recorded activity in ${filters.idleDays} days.`}
          icon={Clock}
          exportKey="asset-activity-idle"
          query={query}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Last touched</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <EmptyRow colSpan={3} message="Loading…" />
              ) : assetActivity.idle.length === 0 ? (
                <EmptyRow colSpan={3} message="No idle assets in this filter." />
              ) : (
                assetActivity.idle.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      {row.assetTag} · {row.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.location ?? "—"}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatTableDate(row.updatedAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </SectionCard>
      </div>

      {/* Maintenance outlook */}
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard
          title="Nearing retirement"
          description={`Assets ${filters.retirementYears}+ years old, not yet retired or disposed.`}
          icon={CalendarClock}
          exportKey="maintenance-outlook-retirement"
          query={query}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead>Department</TableHead>
                <TableHead className="text-right">Acquired</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <EmptyRow colSpan={3} message="Loading…" />
              ) : maintenanceOutlook.nearingRetirement.length === 0 ? (
                <EmptyRow colSpan={3} message="No assets nearing retirement." />
              ) : (
                maintenanceOutlook.nearingRetirement.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      {row.assetTag} · {row.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.department?.name ?? "—"}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatTableDate(row.acquisitionDate)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </SectionCard>

        <SectionCard
          title="Flagged for maintenance"
          description="Latest audit mark is Damaged and the asset hasn't been actioned yet."
          icon={Wrench}
          exportKey="maintenance-outlook-flagged"
          query={query}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead>Department</TableHead>
                <TableHead className="text-right">Flagged</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <EmptyRow colSpan={3} message="Loading…" />
              ) : maintenanceOutlook.flaggedDamaged.length === 0 ? (
                <EmptyRow colSpan={3} message="Nothing flagged for maintenance." />
              ) : (
                maintenanceOutlook.flaggedDamaged.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      {row.assetTag} · {row.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.department?.name ?? "—"}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatTableDate(row.flaggedAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </SectionCard>
      </div>

      {/* Bonus: spend + auditor performance */}
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard
          title="Spend by category"
          description="Acquisition cost total by asset category."
          icon={Wallet}
          exportKey="spend-by-category"
          query={query}
        >
          {isLoading ? (
            <Skeleton className="h-64 rounded-none" />
          ) : spendByCategory.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No cost data for this filter.</p>
          ) : (
            <ChartContainer config={spendChartConfig} className="aspect-auto h-64 w-full">
              <BarChart data={spendByCategory}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="category" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  tickFormatter={(value: number) => formatCents(value)}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => formatCents(Number(value))}
                    />
                  }
                />
                <Bar dataKey="totalCostCents" fill="var(--chart-1)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ChartContainer>
          )}
        </SectionCard>

        <SectionCard
          title="Auditor performance"
          description="Items verified per auditor and their pass rate."
          icon={ShieldCheck}
          exportKey="auditor-performance"
          query={query}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Auditor</TableHead>
                <TableHead className="text-right">Verified</TableHead>
                <TableHead className="text-right">Flagged</TableHead>
                <TableHead className="text-right">Pass rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <EmptyRow colSpan={4} message="Loading…" />
              ) : auditorPerformance.length === 0 ? (
                <EmptyRow colSpan={4} message="No auditor activity in this filter." />
              ) : (
                auditorPerformance.map((row) => (
                  <TableRow key={row.auditorId}>
                    <TableCell className="min-w-0 truncate">{row.name}</TableCell>
                    <TableCell className="text-right font-mono">{row.verified}</TableCell>
                    <TableCell className="text-right font-mono">{row.missing + row.damaged}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="rounded-none">
                        {formatPercent(row.passRate)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </SectionCard>
      </div>

      {/* Booking heatmap — honest placeholder, no fabricated data */}
      <Card className="rounded-none border-dashed">
        <CardContent className="flex min-h-40 flex-col items-center justify-center gap-2 text-center">
          <Calendar className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">Resource booking heatmap</p>
          <p className="max-w-md text-xs text-muted-foreground">
            Activates once the Resource Booking module ships — peak usage windows need real reservation
            data, which doesn&apos;t exist yet.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
