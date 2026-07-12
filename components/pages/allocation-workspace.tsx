"use client";

import * as React from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { readApiResponse } from "@/lib/api-client";
import { formatTableDate } from "@/lib/date-format";

type Option = { id: string; name: string };
type Asset = { id: string; assetTag: string; name: string; status: string; isBookable: boolean };
type AllocationRow = {
  id: string;
  allocatedAt: string;
  expectedReturnDate: string | null;
  status: string;
  asset: { id: string; assetTag: string; name: string; status: string };
  toEmployee: Option | null;
  toDepartment: Option | null;
};
type TransferRow = {
  id: string;
  reason: string;
  status: string;
  asset: { assetTag: string; name: string };
  fromEmployee: Option | null;
  toEmployee: Option | null;
};

export function AllocationWorkspace({ canAllocate, canApprove }: { canAllocate: boolean; canApprove: boolean }) {
  const [assets, setAssets] = React.useState<Asset[]>([]);
  const [employees, setEmployees] = React.useState<Option[]>([]);
  const [departments, setDepartments] = React.useState<Option[]>([]);
  const [allocations, setAllocations] = React.useState<AllocationRow[]>([]);
  const [transfers, setTransfers] = React.useState<TransferRow[]>([]);
  const [scope, setScope] = React.useState<"mine" | "department" | "all">(canAllocate ? "all" : "mine");
  const [isLoading, setIsLoading] = React.useState(true);

  const [assetId, setAssetId] = React.useState("");
  const [targetType, setTargetType] = React.useState<"employee" | "department">("employee");
  const [targetId, setTargetId] = React.useState("");
  const [expectedReturnDate, setExpectedReturnDate] = React.useState("");
  const [conflict, setConflict] = React.useState<string | null>(null);
  const [transferTo, setTransferTo] = React.useState("");
  const [transferReason, setTransferReason] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [assetsRes, allocRes, transferRes] = await Promise.all([
        canAllocate ? fetch("/api/assets?status=AVAILABLE&limit=100") : null,
        fetch(`/api/allocations?scope=${scope}&limit=50`),
        canApprove ? fetch("/api/transfers?status=REQUESTED") : null,
      ]);
      if (assetsRes) {
        const json = await readApiResponse<{ data: Asset[] }>(assetsRes, "Failed to load assets");
        setAssets(json.data.filter((a) => !a.isBookable));
      }
      const allocJson = await readApiResponse<{ data: AllocationRow[] }>(allocRes, "Failed to load allocations");
      setAllocations(allocJson.data);
      if (transferRes) {
        const transferJson = await readApiResponse<{ data: TransferRow[] }>(transferRes, "Failed to load transfers");
        setTransfers(transferJson.data);
      }
      if (canAllocate) {
        const usersRes = await fetch("/api/users?limit=100");
        const usersJson = await readApiResponse<{ data: (Option & { role: string })[] }>(usersRes, "Failed to load employees");
        setEmployees(usersJson.data);
        const deptRes = await fetch("/api/departments");
        const deptJson = await readApiResponse<{ data: Option[] }>(deptRes, "Failed to load departments");
        setDepartments(deptJson.data);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  }, [scope, canAllocate, canApprove]);

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => void load());
    return () => window.cancelAnimationFrame(frame);
  }, [load]);

  const handleAllocate = async (event: React.FormEvent) => {
    event.preventDefault();
    setConflict(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/allocations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId,
          toEmployeeId: targetType === "employee" ? targetId : undefined,
          toDepartmentId: targetType === "department" ? targetId : undefined,
          expectedReturnDate: expectedReturnDate || undefined,
        }),
      });

      if (response.status === 409) {
        const json = await response.json().catch(() => ({}));
        setConflict(json.error?.message ?? "This asset is already allocated.");
        return;
      }

      await readApiResponse(response, "Failed to allocate asset");
      toast.success("Asset allocated");
      setAssetId("");
      setTargetId("");
      setExpectedReturnDate("");
      void load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to allocate asset");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTransferSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId, toEmployeeId: transferTo, reason: transferReason }),
      });
      await readApiResponse(response, "Failed to submit transfer request");
      toast.success("Transfer request submitted");
      setConflict(null);
      setAssetId("");
      setTransferTo("");
      setTransferReason("");
      void load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit transfer request");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReturn = async (allocationId: string) => {
    try {
      const response = await fetch(`/api/allocations/${allocationId}/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnCondition: "GOOD" }),
      });
      await readApiResponse(response, "Failed to process return");
      toast.success("Asset marked as returned");
      void load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to process return");
    }
  };

  const decideTransfer = async (id: string, decision: "approve" | "reject") => {
    try {
      const response = await fetch(`/api/transfers/${id}/${decision}`, { method: "POST" });
      await readApiResponse(response, `Failed to ${decision} transfer`);
      toast.success(`Transfer ${decision}d`);
      void load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to ${decision} transfer`);
    }
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-3 py-6 sm:px-4 md:px-6 lg:px-8">
      <div className="mb-5 space-y-1">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Assets</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Allocation & Transfer</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">Manage who holds what, with conflict-safe transfers.</p>
      </div>

      {canAllocate && (
        <section className="mb-5 border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">Allocate an asset</h2>

          {conflict ? (
            <div className="space-y-3">
              <div className="border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{conflict}</div>
              <form onSubmit={(e) => void handleTransferSubmit(e)} className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>From</Label>
                    <Input value="Current holder" disabled />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="transfer-to">To</Label>
                    <Select value={transferTo} onValueChange={setTransferTo}>
                      <SelectTrigger id="transfer-to" className="cursor-pointer"><SelectValue placeholder="Select employee" /></SelectTrigger>
                      <SelectContent>
                        {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="transfer-reason">Reason</Label>
                  <Textarea id="transfer-reason" value={transferReason} onChange={(e) => setTransferReason(e.target.value)} maxLength={500} required />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={isSubmitting || !transferTo || !transferReason} className="cursor-pointer">Submit Request</Button>
                  <Button type="button" variant="outline" className="cursor-pointer" onClick={() => setConflict(null)}>Cancel</Button>
                </div>
              </form>
            </div>
          ) : (
            <form onSubmit={(e) => void handleAllocate(e)} className="grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor="alloc-asset">Asset</Label>
                <Select value={assetId} onValueChange={setAssetId}>
                  <SelectTrigger id="alloc-asset" className="cursor-pointer"><SelectValue placeholder="Select an available asset" /></SelectTrigger>
                  <SelectContent>
                    {assets.map((a) => <SelectItem key={a.id} value={a.id}>{a.assetTag} — {a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <RadioGroup value={targetType} onValueChange={(v) => { setTargetType(v as "employee" | "department"); setTargetId(""); }} className="flex gap-4">
                <div className="flex items-center gap-2"><RadioGroupItem value="employee" id="target-employee" /><Label htmlFor="target-employee">Employee</Label></div>
                <div className="flex items-center gap-2"><RadioGroupItem value="department" id="target-department" /><Label htmlFor="target-department">Department</Label></div>
              </RadioGroup>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="alloc-target">{targetType === "employee" ? "Employee" : "Department"}</Label>
                  <Select value={targetId} onValueChange={setTargetId}>
                    <SelectTrigger id="alloc-target" className="cursor-pointer"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {(targetType === "employee" ? employees : departments).map((o) => (
                        <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="alloc-return-date">Expected return date</Label>
                  <Input id="alloc-return-date" type="date" value={expectedReturnDate} onChange={(e) => setExpectedReturnDate(e.target.value)} />
                </div>
              </div>
              <Button type="submit" disabled={isSubmitting || !assetId || !targetId} className="w-fit cursor-pointer">
                {isSubmitting ? "Allocating..." : "Allocate"}
              </Button>
            </form>
          )}
        </section>
      )}

      {canApprove && transfers.length > 0 && (
        <section className="mb-5 border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">Transfer approval queue</h2>
          <ul className="space-y-2">
            {transfers.map((t) => (
              <li key={t.id} className="flex flex-col gap-2 border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm">
                  <span className="font-medium">{t.asset.assetTag} — {t.asset.name}</span>{" "}
                  <span className="text-muted-foreground">from {t.fromEmployee?.name ?? "—"} to {t.toEmployee?.name}</span>
                  <p className="text-xs text-muted-foreground">{t.reason}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="cursor-pointer" onClick={() => void decideTransfer(t.id, "approve")}>Approve</Button>
                  <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => void decideTransfer(t.id, "reject")}>Reject</Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Allocations</h2>
          <Select value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
            <SelectTrigger className="w-40 cursor-pointer"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="mine">Held by me</SelectItem>
              <SelectItem value="department">My department</SelectItem>
              {canAllocate && <SelectItem value="all">All</SelectItem>}
            </SelectContent>
          </Select>
        </div>
        {isLoading ? (
          <div className="grid gap-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : allocations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No allocations found.</p>
        ) : (
          <ul className="space-y-2">
            {allocations.map((a) => (
              <li key={a.id} className="flex flex-col gap-2 border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm">
                  <span className="font-medium">{a.asset.assetTag} — {a.asset.name}</span>{" "}
                  <span className="text-muted-foreground">→ {a.toEmployee?.name ?? a.toDepartment?.name}</span>
                  <p className="text-xs text-muted-foreground">
                    Allocated {formatTableDate(a.allocatedAt)}
                    {a.expectedReturnDate ? ` — due ${formatTableDate(a.expectedReturnDate)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={a.status === "ACTIVE" ? "default" : "secondary"}>{a.status}</Badge>
                  {canAllocate && a.status === "ACTIVE" && (
                    <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => void handleReturn(a.id)}>Mark returned</Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
