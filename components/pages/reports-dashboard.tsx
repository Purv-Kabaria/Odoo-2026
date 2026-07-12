"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { ChartConfig } from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { readApiResponse } from "@/lib/api-client";

type Summary = {
  totalAssets: number;
  statusBreakdown: Record<string, number>;
  departmentCount: number;
  categoryCount: number;
};
type UtilizationRow = { departmentId: string; departmentName: string; allocatedCount: number };
type MaintenanceFrequencyRow = { month: string; count: number };
type MostUsedRow = { id: string; assetTag: string; name: string; usageCount: number };
type IdleRow = { id: string; assetTag: string; name: string; idleSinceDays: number | null };
type RetirementRow = { id: string; assetTag: string; name: string; acquisitionDate: string | null; ageYears: number | null };
type SpendRow = { categoryId: string; categoryName: string; totalCost: number; assetCount: number };
type HeatmapCell = { dayOfWeek: number; hour: number; count: number };

type ReportsPayload = {
  summary: Summary;
  utilizationByDepartment: UtilizationRow[];
  maintenanceFrequency: MaintenanceFrequencyRow[];
  mostUsedAssets: MostUsedRow[];
  idleAssets: IdleRow[];
  nearingRetirement: RetirementRow[];
  spendByCategory: SpendRow[];
  bookingHeatmap: HeatmapCell[];
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const utilizationChartConfig = {
  allocatedCount: { label: "Allocated assets", color: "var(--chart-1)" },
} satisfies ChartConfig;

const maintenanceChartConfig = {
  count: { label: "Requests", color: "var(--chart-2)" },
} satisfies ChartConfig;

function exportHref(report: string, filters: { idleDays: number; retirementYears: number; months: number }): string {
  const params = new URLSearchParams({
    report,
    idleDays: String(filters.idleDays),
    retirementYears: String(filters.retirementYears),
    months: String(filters.months),
  });
  return `/api/reports/export?${params.toString()}`;
}

function ExportLink({ report, filters }: { report: string; filters: { idleDays: number; retirementYears: number; months: number } }) {
  return (
    <a
      href={exportHref(report, filters)}
      className="text-xs font-medium text-primary hover:underline"
    >
      Export CSV
    </a>
  );
}

function usePrefersReducedMotion(): boolean {
  const [prefers, setPrefers] = React.useState(false);

  React.useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const frame = window.requestAnimationFrame(() => setPrefers(query.matches));
    const onChange = () => setPrefers(query.matches);
    query.addEventListener("change", onChange);
    return () => {
      window.cancelAnimationFrame(frame);
      query.removeEventListener("change", onChange);
    };
  }, []);

  return prefers;
}

const MotionTableRow = motion.create(TableRow);

/**
 * Compact-by-default ranked table (Vercel-dashboard style): shows only the
 * top `compactCount` rows until the caller expands it, rather than dumping
 * every row on first paint. Rows that were already visible keep their React
 * key across a toggle (no remount, no re-animation) — only newly-revealed
 * rows fade in, so collapsing stays instant while expanding feels animated.
 */
function ExpandableTable<T>({
  rows,
  headers,
  rowKey,
  renderCells,
  emptyMessage,
  compactCount = 5,
}: {
  rows: T[];
  headers: string[];
  rowKey: (row: T) => string;
  renderCells: (row: T) => React.ReactNode;
  emptyMessage: string;
  compactCount?: number;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  const hasOverflow = rows.length > compactCount;
  const visibleRows = expanded ? rows : rows.slice(0, compactCount);

  return (
    <div>
      <Table className={expanded ? undefined : "[&_td]:py-1 [&_th]:h-8"}>
        <TableHeader>
          <TableRow>
            {headers.map((header) => (
              <TableHead key={header}>{header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleRows.map((row) => (
            <MotionTableRow
              key={rowKey(row)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.18 }}
            >
              {renderCells(row)}
            </MotionTableRow>
          ))}
        </TableBody>
      </Table>
      {hasOverflow && (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
          className="mt-1.5 flex w-full cursor-pointer items-center justify-center gap-1 rounded-md py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <motion.span
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.18 }}
            className="flex"
          >
            <ChevronDown className="size-3.5" />
          </motion.span>
          {expanded ? "Show less" : `Show all ${rows.length}`}
        </button>
      )}
    </div>
  );
}

function SectionCard({
  title,
  exportKey,
  filters,
  children,
}: {
  title: string;
  exportKey: string;
  filters: { idleDays: number; retirementYears: number; months: number };
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <ExportLink report={exportKey} filters={filters} />
      </div>
      {children}
    </section>
  );
}

function heatmapColor(count: number, max: number): string {
  if (count === 0) return "bg-muted/30";
  const ratio = max > 0 ? count / max : 0;
  if (ratio > 0.75) return "bg-primary/80";
  if (ratio > 0.5) return "bg-primary/55";
  if (ratio > 0.25) return "bg-primary/30";
  return "bg-primary/15";
}

export function ReportsDashboard() {
  const [idleDaysInput, setIdleDaysInput] = React.useState("60");
  const [retirementYearsInput, setRetirementYearsInput] = React.useState("5");
  const [monthsInput, setMonthsInput] = React.useState("6");
  const [filters, setFilters] = React.useState({ idleDays: 60, retirementYears: 5, months: 6 });
  const [data, setData] = React.useState<ReportsPayload | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        idleDays: String(filters.idleDays),
        retirementYears: String(filters.retirementYears),
        months: String(filters.months),
      });
      const response = await fetch(`/api/reports?${params.toString()}`, { cache: "no-store" });
      const json = await readApiResponse<{ data: ReportsPayload }>(response, "Failed to load reports");
      setData(json.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load reports");
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => void load());
    return () => window.cancelAnimationFrame(frame);
  }, [load]);

  const applyFilters = (event: React.FormEvent) => {
    event.preventDefault();
    const idleDays = Math.min(365, Math.max(1, Number(idleDaysInput) || 60));
    const retirementYears = Math.min(50, Math.max(1, Number(retirementYearsInput) || 5));
    const months = Math.min(24, Math.max(1, Number(monthsInput) || 6));
    setFilters({ idleDays, retirementYears, months });
  };

  const maxHeatmapCount = data ? Math.max(0, ...data.bookingHeatmap.map((c) => c.count)) : 0;
  const heatmapLookup = React.useMemo(() => {
    const map = new Map<string, number>();
    data?.bookingHeatmap.forEach((c) => map.set(`${c.dayOfWeek}-${c.hour}`, c.count));
    return map;
  }, [data]);

  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-4 md:px-6 lg:px-8">
      <div className="mb-5 space-y-1">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Assets</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Reports &amp; Analytics</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Actionable operational insight: utilization, maintenance trends, usage, and spend.
        </p>
      </div>

      <form
        onSubmit={applyFilters}
        className="mb-5 flex flex-wrap items-end gap-3 border border-border bg-card p-3 shadow-sm"
      >
        <div className="grid gap-1.5">
          <Label htmlFor="report-idle-days" className="text-xs">Idle threshold (days)</Label>
          <Input
            id="report-idle-days"
            type="number"
            min={1}
            max={365}
            value={idleDaysInput}
            onChange={(e) => setIdleDaysInput(e.target.value)}
            className="h-8 w-28"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="report-retirement-years" className="text-xs">Retirement age (years)</Label>
          <Input
            id="report-retirement-years"
            type="number"
            min={1}
            max={50}
            value={retirementYearsInput}
            onChange={(e) => setRetirementYearsInput(e.target.value)}
            className="h-8 w-28"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="report-months" className="text-xs">Trend window (months)</Label>
          <Input
            id="report-months"
            type="number"
            min={1}
            max={24}
            value={monthsInput}
            onChange={(e) => setMonthsInput(e.target.value)}
            className="h-8 w-28"
          />
        </div>
        <Button type="submit" size="sm" disabled={isLoading} className="cursor-pointer">
          Apply
        </Button>
      </form>

      {isLoading || !data ? (
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64" />)}
        </div>
      ) : (
        <div className="space-y-4">
          {/* KPI tiles */}
          <div className="grid grid-cols-2 gap-3 border border-border bg-card p-4 shadow-sm sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Total assets</p>
              <p className="text-2xl font-semibold tabular-nums">{data.summary.totalAssets}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Departments</p>
              <p className="text-2xl font-semibold tabular-nums">{data.summary.departmentCount}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Categories</p>
              <p className="text-2xl font-semibold tabular-nums">{data.summary.categoryCount}</p>
            </div>
            <div className="min-w-0">
              <p className="mb-1 text-xs text-muted-foreground">By status</p>
              <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs">
                {Object.entries(data.summary.statusBreakdown).map(([status, count]) => (
                  <span key={status} className="text-foreground">
                    {status.replace("_", " ").toLowerCase()}: <span className="font-medium">{count}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Utilization by department" exportKey="utilization-by-department" filters={filters}>
              {data.utilizationByDepartment.length === 0 ? (
                <p className="text-sm text-muted-foreground">No data yet.</p>
              ) : (
                <ChartContainer config={utilizationChartConfig} className="aspect-auto h-64 w-full">
                  <BarChart data={data.utilizationByDepartment} margin={{ left: 0, right: 8 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="departmentName" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
                    <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={28} fontSize={11} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="allocatedCount" fill="var(--color-allocatedCount)" radius={4} />
                  </BarChart>
                </ChartContainer>
              )}
            </SectionCard>

            <SectionCard title="Maintenance frequency" exportKey="maintenance-frequency" filters={filters}>
              {data.maintenanceFrequency.length === 0 ? (
                <p className="text-sm text-muted-foreground">No data yet.</p>
              ) : (
                <ChartContainer config={maintenanceChartConfig} className="aspect-auto h-64 w-full">
                  <LineChart data={data.maintenanceFrequency} margin={{ left: 0, right: 8 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
                    <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={28} fontSize={11} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="count" stroke="var(--color-count)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ChartContainer>
              )}
            </SectionCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Most used assets" exportKey="most-used-assets" filters={filters}>
              <ExpandableTable
                rows={data.mostUsedAssets}
                headers={["Tag", "Name", "Uses"]}
                rowKey={(row) => row.id}
                emptyMessage="No data yet."
                renderCells={(row) => (
                  <>
                    <TableCell className="font-medium">{row.assetTag}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.usageCount}</TableCell>
                  </>
                )}
              />
            </SectionCard>

            <SectionCard title="Idle assets" exportKey="idle-assets" filters={filters}>
              <ExpandableTable
                rows={data.idleAssets}
                headers={["Tag", "Name", "Idle for"]}
                rowKey={(row) => row.id}
                emptyMessage="No idle assets."
                renderCells={(row) => (
                  <>
                    <TableCell className="font-medium">{row.assetTag}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.idleSinceDays !== null ? `${row.idleSinceDays}d` : "—"}</TableCell>
                  </>
                )}
              />
            </SectionCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Nearing retirement" exportKey="nearing-retirement" filters={filters}>
              <ExpandableTable
                rows={data.nearingRetirement}
                headers={["Tag", "Name", "Age"]}
                rowKey={(row) => row.id}
                emptyMessage="No assets nearing retirement."
                renderCells={(row) => (
                  <>
                    <TableCell className="font-medium">{row.assetTag}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.ageYears !== null ? `${row.ageYears}y` : "—"}</TableCell>
                  </>
                )}
              />
            </SectionCard>

            <SectionCard title="Spend by category" exportKey="spend-by-category" filters={filters}>
              <ExpandableTable
                rows={data.spendByCategory}
                headers={["Category", "Assets", "Total cost"]}
                rowKey={(row) => row.categoryId}
                emptyMessage="No acquisition cost data yet."
                renderCells={(row) => (
                  <>
                    <TableCell className="font-medium">{row.categoryName}</TableCell>
                    <TableCell>{row.assetCount}</TableCell>
                    <TableCell>${row.totalCost.toLocaleString()}</TableCell>
                  </>
                )}
              />
            </SectionCard>
          </div>

          <SectionCard title="Resource booking heatmap (peak usage windows)" exportKey="booking-heatmap" filters={filters}>
            {data.bookingHeatmap.length === 0 ? (
              <p className="text-sm text-muted-foreground">No bookings yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <div className="grid min-w-[720px] grid-cols-[auto_repeat(24,minmax(0,1fr))] gap-0.5 text-[10px]">
                  <div />
                  {Array.from({ length: 24 }).map((_, hour) => (
                    <div key={hour} className="text-center text-muted-foreground">{hour}</div>
                  ))}
                  {DAY_LABELS.map((label, dayOfWeek) => (
                    <React.Fragment key={label}>
                      <div className="pr-1 text-right text-muted-foreground">{label}</div>
                      {Array.from({ length: 24 }).map((_, hour) => {
                        const count = heatmapLookup.get(`${dayOfWeek}-${hour}`) ?? 0;
                        return (
                          <div
                            key={hour}
                            title={`${label} ${hour}:00 — ${count} booking${count === 1 ? "" : "s"}`}
                            className={`aspect-square rounded-[2px] ${heatmapColor(count, maxHeatmapCount)}`}
                          />
                        );
                      })}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}
          </SectionCard>
        </div>
      )}
    </main>
  );
}
