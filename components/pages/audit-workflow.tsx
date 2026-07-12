"use client";

import * as React from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  ClipboardCheck,
  Lock,
  Plus,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  crudModalButtonClass,
  crudModalContentClass,
  crudModalTitleClass,
} from "@/components/modals/crud-modal-styles";
import { readApiResponse } from "@/lib/api-client";
import { fetchEntityRows } from "@/lib/entities-client";
import { formatTableDate } from "@/lib/date-format";
import type { UserRole } from "@prisma/client";

type ScopeType = "DEPARTMENT" | "LOCATION";
type CycleStatus = "ACTIVE" | "CLOSED";
type ItemStatus = "PENDING" | "VERIFIED" | "MISSING" | "DAMAGED";

type PersonRef = { id: string; name: string; email: string };

type CycleListItem = {
  id: string;
  name: string;
  scopeType: ScopeType;
  department: { id: string; name: string } | null;
  location: string | null;
  startDate: string;
  endDate: string;
  status: CycleStatus;
  closedAt: string | null;
  createdAt: string;
  auditors: PersonRef[];
  totalItems: number;
  verifiedItems: number;
  flaggedItems: number;
};

type CycleItem = {
  id: string;
  asset: { id: string; assetTag: string; name: string; location: string | null };
  expectedLocation: string | null;
  status: ItemStatus;
  note: string | null;
  verifiedBy: { id: string; name: string } | null;
  verifiedAt: string | null;
};

type Discrepancy = {
  id: string;
  assetTag: string;
  assetName: string;
  expectedLocation: string | null;
  type: "MISSING" | "DAMAGED";
  note: string | null;
  resolvedAssetStatus: string | null;
};

type CycleDetail = Omit<CycleListItem, "auditors"> & {
  createdBy: PersonRef | null;
  closedBy: PersonRef | null;
  auditors: PersonRef[];
  items: CycleItem[];
  discrepancies: Discrepancy[];
};

type DepartmentOption = { id: string; name: string };

type CurrentUser = { id: string; role: UserRole };

function scopeSummary(cycle: Pick<CycleListItem, "scopeType" | "department" | "location">) {
  if (cycle.scopeType === "DEPARTMENT") return cycle.department?.name ?? "Unscoped department";
  return cycle.location ?? "Unscoped location";
}

function statusBadgeClass(status: ItemStatus | Discrepancy["type"]) {
  if (status === "VERIFIED") {
    return "border-chart-2/30 bg-chart-2/15 text-chart-2";
  }
  if (status === "MISSING") {
    return "border-destructive/30 bg-destructive/10 text-destructive";
  }
  if (status === "DAMAGED") {
    return "border-chart-3/30 bg-chart-3/15 text-chart-3";
  }
  return "border-border bg-muted text-muted-foreground";
}

function ItemStatusBadge({ status }: { status: ItemStatus }) {
  const label =
    status === "PENDING"
      ? "Pending"
      : status[0] + status.slice(1).toLowerCase();
  return (
    <Badge variant="outline" className={`rounded-none ${statusBadgeClass(status)}`}>
      {label}
    </Badge>
  );
}

function CycleStatusBadge({ status }: { status: CycleStatus }) {
  return (
    <Badge
      variant="outline"
      className={
        status === "ACTIVE"
          ? "rounded-none border-primary/30 bg-primary/10 text-primary"
          : "rounded-none border-border bg-muted text-muted-foreground"
      }
    >
      {status === "ACTIVE" ? "Active" : "Closed"}
    </Badge>
  );
}

const emptyCreateForm = {
  name: "",
  scopeType: "DEPARTMENT" as ScopeType,
  departmentId: "",
  location: "",
  startDate: "",
  endDate: "",
};

export function AuditWorkflow({ currentUser }: { currentUser: CurrentUser }) {
  const isAdmin = currentUser.role === "ADMIN";

  const [cycles, setCycles] = React.useState<CycleListItem[]>([]);
  const [isLoadingList, setIsLoadingList] = React.useState(true);

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<CycleDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = React.useState(false);
  const [notesDraft, setNotesDraft] = React.useState<Record<string, string>>({});
  const [markingItemId, setMarkingItemId] = React.useState<string | null>(null);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [form, setForm] = React.useState(emptyCreateForm);
  const [departments, setDepartments] = React.useState<DepartmentOption[]>([]);
  const [auditorOptions, setAuditorOptions] = React.useState<PersonRef[]>([]);
  const [selectedAuditorIds, setSelectedAuditorIds] = React.useState<Set<string>>(new Set());
  const [loadingOptions, setLoadingOptions] = React.useState(false);

  const [closeConfirmOpen, setCloseConfirmOpen] = React.useState(false);
  const [closing, setClosing] = React.useState(false);

  const loadCycles = React.useCallback(async () => {
    setIsLoadingList(true);
    try {
      const response = await fetch("/api/audit/cycles?limit=50", { cache: "no-store" });
      const json = await readApiResponse<{ data?: CycleListItem[] }>(
        response,
        "Failed to load audit cycles",
      );
      setCycles(json.data ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load audit cycles");
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  const loadDetail = React.useCallback(async (id: string) => {
    setIsLoadingDetail(true);
    try {
      const response = await fetch(`/api/audit/cycles/${id}`, { cache: "no-store" });
      const json = await readApiResponse<{ data?: CycleDetail }>(
        response,
        "Failed to load audit cycle",
      );
      if (json.data) {
        setDetail(json.data);
        setNotesDraft(
          Object.fromEntries(json.data.items.map((item) => [item.id, item.note ?? ""])),
        );
      }
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

  const openDetail = (id: string) => setSelectedId(id);
  const backToList = () => {
    setSelectedId(null);
    setDetail(null);
    void loadCycles();
  };

  const openCreateModal = async () => {
    setCreateOpen(true);
    setForm(emptyCreateForm);
    setSelectedAuditorIds(new Set());
    setLoadingOptions(true);
    try {
      const [departmentResult, userResult] = await Promise.all([
        fetchEntityRows<DepartmentOption>("departments", {
          page: 1,
          limit: 100,
          search: "",
          filters: [{ field: "status", operator: "equals", value: "ACTIVE" }],
        }),
        fetchEntityRows<PersonRef>("users", { page: 1, limit: 100, search: "" }),
      ]);
      setDepartments(departmentResult.rows);
      setAuditorOptions(userResult.rows);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load departments and auditors",
      );
    } finally {
      setLoadingOptions(false);
    }
  };

  const toggleAuditor = (id: string) => {
    setSelectedAuditorIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (selectedAuditorIds.size === 0) {
      toast.error("Assign at least one auditor.");
      return;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/audit/cycles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          scopeType: form.scopeType,
          departmentId: form.scopeType === "DEPARTMENT" ? form.departmentId : undefined,
          location: form.scopeType === "LOCATION" ? form.location : undefined,
          startDate: form.startDate,
          endDate: form.endDate,
          auditorIds: Array.from(selectedAuditorIds),
        }),
      });
      await readApiResponse(response, "Failed to create audit cycle");
      toast.success("Audit cycle created");
      setCreateOpen(false);
      await loadCycles();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create audit cycle");
    } finally {
      setCreating(false);
    }
  };

  const handleMark = async (itemId: string, status: Exclude<ItemStatus, "PENDING">) => {
    setMarkingItemId(itemId);
    try {
      const response = await fetch(`/api/audit/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note: notesDraft[itemId] || undefined }),
      });
      await readApiResponse(response, "Failed to update audit item");
      if (selectedId) await loadDetail(selectedId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update audit item");
    } finally {
      setMarkingItemId(null);
    }
  };

  const handleClose = async () => {
    if (!selectedId) return;
    setClosing(true);
    try {
      const response = await fetch(`/api/audit/cycles/${selectedId}/close`, { method: "POST" });
      await readApiResponse(response, "Failed to close audit cycle");
      toast.success("Audit cycle closed — discrepancy report generated");
      setCloseConfirmOpen(false);
      await loadDetail(selectedId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to close audit cycle");
    } finally {
      setClosing(false);
    }
  };

  const isAssignedAuditor = (cycle: { auditors: PersonRef[] }) =>
    cycle.auditors.some((auditor) => auditor.id === currentUser.id);

  const canMark = (cycle: CycleDetail) =>
    cycle.status === "ACTIVE" && (isAdmin || isAssignedAuditor(cycle));

  if (selectedId) {
    return (
      <section className="space-y-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="cursor-pointer rounded-none"
          onClick={backToList}
        >
          <ArrowLeft className="size-4" />
          Back to cycles
        </Button>

        {isLoadingDetail || !detail ? (
          <div className="grid gap-3">
            <Skeleton className="h-24 rounded-none" />
            <Skeleton className="h-64 rounded-none" />
          </div>
        ) : (
          <>
            <div className="space-y-2 border border-border bg-card p-3 shadow-sm sm:p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <h2 className="text-base font-semibold sm:text-lg">{detail.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {scopeSummary(detail)} · {formatTableDate(detail.startDate)} –{" "}
                    {formatTableDate(detail.endDate)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Auditors: {detail.auditors.map((auditor) => auditor.name).join(", ") || "None assigned"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <CycleStatusBadge status={detail.status} />
                  {isAdmin && detail.status === "ACTIVE" ? (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="cursor-pointer rounded-none"
                      onClick={() => setCloseConfirmOpen(true)}
                    >
                      <Lock className="size-4" />
                      Close audit cycle
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>

            {detail.flaggedItems > 0 ? (
              <div className="flex items-center gap-2 border border-chart-3/40 bg-chart-3/10 p-3 text-sm text-chart-3">
                <AlertTriangle className="size-4 shrink-0" />
                {detail.flaggedItems} asset{detail.flaggedItems === 1 ? "" : "s"} flagged — discrepancy
                report {detail.status === "CLOSED" ? "generated automatically" : "will be generated on close"}
              </div>
            ) : null}

            {detail.status === "CLOSED" && detail.discrepancies.length > 0 ? (
              <div className="space-y-2 border border-border bg-card p-3 shadow-sm sm:p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <ClipboardCheck className="size-4 text-primary" />
                  Discrepancy report (frozen)
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th className="py-2 pr-2 font-medium">Asset</th>
                        <th className="py-2 pr-2 font-medium">Expected location</th>
                        <th className="py-2 pr-2 font-medium">Type</th>
                        <th className="py-2 pr-2 font-medium">Resolution</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.discrepancies.map((row) => (
                        <tr key={row.id} className="border-b border-border last:border-0">
                          <td className="py-2 pr-2">
                            {row.assetTag} · {row.assetName}
                          </td>
                          <td className="py-2 pr-2 text-muted-foreground">
                            {row.expectedLocation ?? "—"}
                          </td>
                          <td className="py-2 pr-2">
                            <Badge variant="outline" className={`rounded-none ${statusBadgeClass(row.type)}`}>
                              {row.type[0] + row.type.slice(1).toLowerCase()}
                            </Badge>
                          </td>
                          <td className="py-2 pr-2 text-muted-foreground">
                            {row.resolvedAssetStatus
                              ? `Asset set to ${row.resolvedAssetStatus[0]}${row.resolvedAssetStatus.slice(1).toLowerCase()}`
                              : "Reported, no status change"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            <div className="space-y-2 border border-border bg-card p-3 shadow-sm sm:p-4">
              <h3 className="text-sm font-semibold">Checklist</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-2 font-medium">Asset</th>
                      <th className="py-2 pr-2 font-medium">Expected location</th>
                      <th className="py-2 pr-2 font-medium">Verification</th>
                      {canMark(detail) ? <th className="py-2 pr-2 font-medium">Note</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {detail.items.map((item) => (
                      <tr key={item.id} className="border-b border-border last:border-0">
                        <td className="py-2 pr-2">
                          {item.asset.assetTag} · {item.asset.name}
                        </td>
                        <td className="py-2 pr-2 text-muted-foreground">
                          {item.expectedLocation ?? "—"}
                        </td>
                        <td className="py-2 pr-2">
                          {canMark(detail) ? (
                            <div className="flex flex-wrap gap-1.5">
                              <Button
                                type="button"
                                size="sm"
                                variant={item.status === "VERIFIED" ? "default" : "outline"}
                                disabled={markingItemId === item.id}
                                className="h-7 cursor-pointer rounded-none px-2 text-xs"
                                onClick={() => void handleMark(item.id, "VERIFIED")}
                              >
                                <CheckCircle2 className="size-3.5" />
                                Verified
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant={item.status === "MISSING" ? "destructive" : "outline"}
                                disabled={markingItemId === item.id}
                                className="h-7 cursor-pointer rounded-none px-2 text-xs"
                                onClick={() => void handleMark(item.id, "MISSING")}
                              >
                                <Ban className="size-3.5" />
                                Missing
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={markingItemId === item.id}
                                className={`h-7 cursor-pointer rounded-none px-2 text-xs ${item.status === "DAMAGED" ? statusBadgeClass("DAMAGED") : ""}`}
                                onClick={() => void handleMark(item.id, "DAMAGED")}
                              >
                                <Wrench className="size-3.5" />
                                Damaged
                              </Button>
                            </div>
                          ) : (
                            <ItemStatusBadge status={item.status} />
                          )}
                        </td>
                        {canMark(detail) ? (
                          <td className="py-2 pr-2">
                            <Input
                              value={notesDraft[item.id] ?? ""}
                              onChange={(event) =>
                                setNotesDraft((current) => ({
                                  ...current,
                                  [item.id]: event.target.value,
                                }))
                              }
                              placeholder="Optional note"
                              className="h-7 w-40 text-xs"
                            />
                          </td>
                        ) : null}
                      </tr>
                    ))}
                    {detail.items.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                          No assets were in scope when this cycle was created.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        <Dialog open={closeConfirmOpen} onOpenChange={setCloseConfirmOpen}>
          <DialogContent className={crudModalContentClass}>
            <DialogHeader className="gap-1 sm:gap-2">
              <DialogTitle className={`${crudModalTitleClass} text-destructive`}>
                Close this audit cycle?
              </DialogTitle>
              <DialogDescription>
                This locks the checklist, freezes the discrepancy report, and sets any confirmed-missing
                assets to Lost. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-2 gap-2 border-t border-border pt-3 sm:mt-4 sm:pt-4">
              <Button
                variant="outline"
                onClick={() => setCloseConfirmOpen(false)}
                disabled={closing}
                className={`${crudModalButtonClass} w-full sm:w-auto`}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => void handleClose()}
                disabled={closing}
                className={`${crudModalButtonClass} w-full sm:w-auto`}
              >
                {closing ? "Closing..." : "Close cycle"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 border border-border bg-card p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold">Audit cycles</h2>
          <p className="text-xs text-muted-foreground">
            Structured verification cycles with auto-generated discrepancy reports.
          </p>
        </div>
        {isAdmin ? (
          <Button
            type="button"
            size="sm"
            className="w-full cursor-pointer rounded-none sm:w-auto"
            onClick={() => void openCreateModal()}
          >
            <Plus className="size-4" />
            New audit cycle
          </Button>
        ) : null}
      </div>

      {isLoadingList ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-36 rounded-none" />
          ))}
        </div>
      ) : cycles.length === 0 ? (
        <div className="flex min-h-56 flex-col items-center justify-center gap-2 border border-dashed border-border bg-muted/20 p-8 text-center">
          <ClipboardCheck className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No audit cycles yet</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            {isAdmin
              ? "Create a cycle to scope and assign an asset verification pass."
              : "You have not been assigned to any audit cycle."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cycles.map((cycle) => (
            <button
              key={cycle.id}
              type="button"
              onClick={() => openDetail(cycle.id)}
              className="cursor-pointer space-y-2 border border-border bg-card p-3 text-left shadow-sm transition-colors hover:bg-muted/40"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="min-w-0 truncate text-sm font-semibold">{cycle.name}</h3>
                <CycleStatusBadge status={cycle.status} />
              </div>
              <p className="text-xs text-muted-foreground">{scopeSummary(cycle)}</p>
              <p className="text-xs text-muted-foreground">
                {formatTableDate(cycle.startDate)} – {formatTableDate(cycle.endDate)}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                Auditors: {cycle.auditors.map((auditor) => auditor.name).join(", ") || "None"}
              </p>
              <div className="flex items-center justify-between pt-1 text-xs">
                <span className="text-muted-foreground">
                  {cycle.verifiedItems}/{cycle.totalItems} verified
                </span>
                {cycle.flaggedItems > 0 ? (
                  <Badge variant="outline" className={`rounded-none ${statusBadgeClass("MISSING")}`}>
                    {cycle.flaggedItems} flagged
                  </Badge>
                ) : null}
              </div>
            </button>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[min(90vh,720px)] w-[calc(100%-1.25rem)] gap-4 overflow-y-auto rounded-none p-4 sm:w-full sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New audit cycle</DialogTitle>
            <DialogDescription>
              Scope by department or location, set the date range, and assign auditors. The checklist is
              generated automatically from in-scope assets.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="audit-name">Name</Label>
              <Input
                id="audit-name"
                required
                value={form.name}
                onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))}
                placeholder="Q3 audit: Engineering dept"
              />
            </div>

            <div className="grid gap-1.5">
              <Label>Scope</Label>
              <Select
                value={form.scopeType}
                onValueChange={(value: ScopeType) => setForm((f) => ({ ...f, scopeType: value }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DEPARTMENT">Department</SelectItem>
                  <SelectItem value="LOCATION">Location</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.scopeType === "DEPARTMENT" ? (
              <div className="grid gap-1.5">
                <Label>Department</Label>
                <Select
                  value={form.departmentId}
                  onValueChange={(value) => setForm((f) => ({ ...f, departmentId: value }))}
                  disabled={loadingOptions}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((department) => (
                      <SelectItem key={department.id} value={department.id}>
                        {department.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="grid gap-1.5">
                <Label htmlFor="audit-location">Location</Label>
                <Input
                  id="audit-location"
                  required
                  value={form.location}
                  onChange={(event) => setForm((f) => ({ ...f, location: event.target.value }))}
                  placeholder="3rd Floor Storeroom"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="audit-start">Start date</Label>
                <Input
                  id="audit-start"
                  type="date"
                  required
                  value={form.startDate}
                  onChange={(event) => setForm((f) => ({ ...f, startDate: event.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="audit-end">End date</Label>
                <Input
                  id="audit-end"
                  type="date"
                  required
                  value={form.endDate}
                  onChange={(event) => setForm((f) => ({ ...f, endDate: event.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>Auditors</Label>
              <div className="max-h-40 overflow-y-auto border border-border p-2">
                {loadingOptions ? (
                  <Skeleton className="h-20 rounded-none" />
                ) : auditorOptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No employees available.</p>
                ) : (
                  <div className="grid gap-1.5">
                    {auditorOptions.map((option) => (
                      <label
                        key={option.id}
                        className="flex cursor-pointer items-center gap-2 text-sm"
                      >
                        <Checkbox
                          checked={selectedAuditorIds.has(option.id)}
                          onCheckedChange={() => toggleAuditor(option.id)}
                        />
                        <span className="truncate">
                          {option.name} <span className="text-xs text-muted-foreground">({option.email})</span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="mt-1 gap-2 border-t border-border pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={creating}
                className={`${crudModalButtonClass} w-full sm:w-auto`}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={creating || loadingOptions}
                className={`${crudModalButtonClass} w-full sm:w-auto`}
              >
                {creating ? "Creating..." : "Create cycle"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
