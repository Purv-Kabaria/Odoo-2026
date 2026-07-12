"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Lock,
  MapPin,
  Plus,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { CreateAuditCycleModal } from "@/components/modals/create-audit-cycle-modal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/textarea";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { readApiResponse } from "@/lib/api-client";
import { formatTableDate } from "@/lib/date-format";

type CycleListItem = {
  id: string;
  name: string;
  status: string;
  startDate: string;
  endDate: string;
  scopeDept: { id: string; name: string } | null;
  scopeLocation: string | null;
  auditors: { auditor: { id: string; name: string } }[];
  _count: { items: number };
};

type AuditItem = {
  id: string;
  verification: string;
  notes: string | null;
  asset: { id: string; assetTag: string; name: string; location: string | null };
  auditedBy: { id: string; name: string } | null;
};

type CycleDetail = CycleListItem & {
  items: AuditItem[];
  discrepancyReport: { summary: { totalItems: number; verified: number; missing: number; damaged: number; stillPending: number } } | null;
};

export function AuditWorkspace({ canManage, currentUserId }: { canManage: boolean; currentUserId: string }) {
  const [cycles, setCycles] = React.useState<CycleListItem[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<CycleDetail | null>(null);
  const [isLoadingList, setIsLoadingList] = React.useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = React.useState(false);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [notesDraft, setNotesDraft] = React.useState<Record<string, string>>({});
  const prefersReducedMotion = usePrefersReducedMotion();

  const loadCycles = React.useCallback(async () => {
    setIsLoadingList(true);
    try {
      const response = await fetch("/api/audit-cycles?limit=50", { cache: "no-store" });
      const json = await readApiResponse<{ data: CycleListItem[] }>(response, "Failed to load audit cycles");
      setCycles(json.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load audit cycles");
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  const loadDetail = React.useCallback(async (id: string) => {
    setIsLoadingDetail(true);
    try {
      const response = await fetch(`/api/audit-cycles/${id}`, { cache: "no-store" });
      const json = await readApiResponse<{ data: CycleDetail }>(response, "Failed to load audit cycle");
      setDetail(json.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load audit cycle");
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => void loadCycles());
    return () => window.cancelAnimationFrame(frame);
  }, [loadCycles]);

  React.useEffect(() => {
    if (!selectedId) return;
    const frame = window.requestAnimationFrame(() => void loadDetail(selectedId));
    return () => window.cancelAnimationFrame(frame);
  }, [selectedId, loadDetail]);

  const markItem = async (itemId: string, verification: string) => {
    try {
      const response = await fetch(`/api/audit-items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verification, notes: notesDraft[itemId] || undefined }),
      });
      await readApiResponse(response, "Failed to record verification");
      if (selectedId) void loadDetail(selectedId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to record verification");
    }
  };

  const closeCycle = async () => {
    if (!selectedId) return;
    if (!window.confirm("Close this audit cycle? This locks all verifications and cannot be undone.")) return;
    try {
      const response = await fetch(`/api/audit-cycles/${selectedId}/close`, { method: "POST" });
      await readApiResponse(response, "Failed to close audit cycle");
      toast.success("Audit cycle closed");
      void loadDetail(selectedId);
      void loadCycles();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to close audit cycle");
    }
  };

  const liveFlaggedCount = detail
    ? detail.items.filter((i) => i.verification === "MISSING" || i.verification === "DAMAGED").length
    : 0;

  const itemTransition = prefersReducedMotion ? { duration: 0 } : { duration: 0.18 };

  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-4 md:px-6 lg:px-8">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Assets</p>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            <ClipboardCheck className="size-6 text-primary" />
            Asset Audit
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Structured verification cycles: assign auditors, verify assets, catch discrepancies.
          </p>
        </div>
        {canManage && (
          <Button className="w-fit cursor-pointer" onClick={() => setIsModalOpen(true)}>
            <Plus className="size-4" />
            New audit cycle
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <section className="border border-border bg-card p-3 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold">Cycles</h2>
          {isLoadingList ? (
            <div className="grid gap-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : cycles.length === 0 ? (
            <div className="flex min-h-32 flex-col items-center justify-center gap-2 border border-dashed border-border p-6 text-center">
              <ClipboardList className="size-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No audit cycles yet.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {cycles.map((c, index) => (
                <motion.li
                  key={c.id}
                  initial={prefersReducedMotion ? undefined : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...itemTransition, delay: prefersReducedMotion ? 0 : index * 0.03 }}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full cursor-pointer border p-2 text-left text-sm transition-colors ${selectedId === c.id ? "border-primary bg-primary/5" : "border-border hover:border-foreground/30"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate font-medium">{c.name}</span>
                      <StatusBadge kind="auditCycleStatus" status={c.status} className="shrink-0" />
                    </div>
                    <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                      <MapPin className="size-3 shrink-0" />
                      {c.scopeDept?.name ?? c.scopeLocation ?? "Org-wide"} — {c._count.items} assets
                    </p>
                  </button>
                </motion.li>
              ))}
            </ul>
          )}
        </section>

        <section className="border border-border bg-card p-4 shadow-sm">
          {!selectedId ? (
            <div className="flex min-h-40 flex-col items-center justify-center gap-2 text-center">
              <ClipboardCheck className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Select an audit cycle to view its checklist.</p>
            </div>
          ) : isLoadingDetail || !detail ? (
            <div className="grid gap-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : (
            <motion.div
              key={detail.id}
              initial={prefersReducedMotion ? undefined : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={itemTransition}
              className="space-y-4"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold">{detail.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {formatTableDate(detail.startDate)} – {formatTableDate(detail.endDate)} — Auditors:{" "}
                    {detail.auditors.map((a) => a.auditor.name).join(", ")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge kind="auditCycleStatus" status={detail.status} />
                  {canManage && detail.status !== "CLOSED" && (
                    <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => void closeCycle()}>
                      <Lock className="size-3.5" />
                      Close Audit Cycle
                    </Button>
                  )}
                </div>
              </div>

              {detail.status !== "CLOSED" && liveFlaggedCount > 0 && (
                <div className="flex items-start gap-2 border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <span>{liveFlaggedCount} asset{liveFlaggedCount === 1 ? "" : "s"} flagged — discrepancy report generated automatically on close.</span>
                </div>
              )}
              {detail.discrepancyReport && (
                <div className="border border-border bg-muted/30 p-3 text-sm">
                  <p className="flex items-center gap-1.5 font-medium">
                    <ClipboardList className="size-4" />
                    Discrepancy report
                  </p>
                  <p className="text-muted-foreground">
                    {detail.discrepancyReport.summary.verified} verified, {detail.discrepancyReport.summary.missing} missing (→ Lost),{" "}
                    {detail.discrepancyReport.summary.damaged} damaged (→ maintenance raised), {detail.discrepancyReport.summary.stillPending} never verified.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                {detail.items.map((item, index) => {
                  const canMark = detail.status !== "CLOSED" && (canManage || detail.auditors.some((a) => a.auditor.id === currentUserId));
                  return (
                    <motion.div
                      key={item.id}
                      initial={prefersReducedMotion ? undefined : { opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ ...itemTransition, delay: prefersReducedMotion ? 0 : Math.min(index, 10) * 0.02 }}
                      className="flex flex-col gap-2 border border-border p-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">{item.asset.assetTag} — {item.asset.name}</p>
                        <p className="text-xs text-muted-foreground">Expected: {item.asset.location ?? "—"}</p>
                      </div>
                      {canMark ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <Textarea
                            placeholder="Notes (optional)"
                            value={notesDraft[item.id] ?? item.notes ?? ""}
                            onChange={(e) => setNotesDraft((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            className="h-8 min-h-8 w-40 resize-none py-1 text-xs"
                          />
                          <Button size="sm" className="h-7 cursor-pointer px-2 text-xs" onClick={() => void markItem(item.id, "VERIFIED")}>
                            <CheckCircle2 className="size-3.5" />
                            Verified
                          </Button>
                          <Button size="sm" variant="destructive" className="h-7 cursor-pointer px-2 text-xs" onClick={() => void markItem(item.id, "MISSING")}>
                            <XCircle className="size-3.5" />
                            Missing
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 cursor-pointer px-2 text-xs" onClick={() => void markItem(item.id, "DAMAGED")}>
                            <AlertTriangle className="size-3.5" />
                            Damaged
                          </Button>
                        </div>
                      ) : (
                        <StatusBadge kind="auditVerification" status={item.verification} />
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </section>
      </div>

      <CreateAuditCycleModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onCreated={(id) => { setIsModalOpen(false); void loadCycles(); setSelectedId(id); }}
      />
    </main>
  );
}
