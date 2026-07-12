"use client";

import * as React from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RaiseMaintenanceModal } from "@/components/modals/raise-maintenance-modal";
import { Skeleton } from "@/components/ui/skeleton";
import { readApiResponse } from "@/lib/api-client";

type MaintenanceRow = {
  id: string;
  description: string;
  priority: string;
  status: string;
  asset: { id: string; assetTag: string; name: string };
  raisedBy: { id: string; name: string };
  technician: { id: string; name: string } | null;
};

const COLUMNS = [
  { key: "PENDING", label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "TECHNICIAN_ASSIGNED", label: "Technician Assigned" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "RESOLVED", label: "Resolved" },
];

function priorityVariant(priority: string): "default" | "secondary" | "outline" | "destructive" {
  if (priority === "URGENT" || priority === "HIGH") return "destructive";
  if (priority === "MEDIUM") return "default";
  return "secondary";
}

export function MaintenanceBoard({ canDecide, currentUserId }: { canDecide: boolean; currentUserId: string }) {
  const [rows, setRows] = React.useState<MaintenanceRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [showRejected, setShowRejected] = React.useState(false);
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const url = showRejected ? "/api/maintenance?status=REJECTED" : "/api/maintenance";
      const response = await fetch(url, { cache: "no-store" });
      const json = await readApiResponse<{ data: MaintenanceRow[] }>(response, "Failed to load maintenance requests");
      setRows(json.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load maintenance requests");
    } finally {
      setIsLoading(false);
    }
  }, [showRejected]);

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => void load());
    return () => window.cancelAnimationFrame(frame);
  }, [load]);

  const runAction = async (id: string, action: string, body?: Record<string, unknown>) => {
    try {
      const response = await fetch(`/api/maintenance/${id}/${action}`, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      await readApiResponse(response, `Failed to ${action}`);
      toast.success("Updated");
      void load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to ${action}`);
    }
  };

  const columns = showRejected ? [{ key: "REJECTED", label: "Rejected" }] : COLUMNS;

  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-4 md:px-6 lg:px-8">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Assets</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Maintenance</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">Repairs route through approval before work starts.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="cursor-pointer" onClick={() => setShowRejected((v) => !v)}>
            {showRejected ? "Show board" : "Show rejected"}
          </Button>
          <Button className="cursor-pointer" onClick={() => setIsModalOpen(true)}>Raise request</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {columns.map((col) => {
            const items = rows.filter((r) => r.status === col.key);
            return (
              <div key={col.key} className="border border-border bg-card p-3 shadow-sm">
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {col.label} ({items.length})
                </h2>
                <div className="space-y-2">
                  {items.map((item) => (
                    <div key={item.id} className="border border-border p-2 text-xs">
                      <div className="mb-1 flex items-center justify-between gap-1">
                        <span className="font-medium">{item.asset.assetTag}</span>
                        <Badge variant={priorityVariant(item.priority)}>{item.priority}</Badge>
                      </div>
                      <p className="mb-2 text-muted-foreground">{item.description}</p>
                      {item.technician && <p className="mb-2 text-muted-foreground">Tech: {item.technician.name}</p>}

                      {canDecide && item.status === "PENDING" && (
                        <div className="flex gap-1">
                          <Button size="sm" className="h-7 cursor-pointer px-2 text-xs" onClick={() => void runAction(item.id, "approve")}>Approve</Button>
                          <Button size="sm" variant="outline" className="h-7 cursor-pointer px-2 text-xs" onClick={() => void runAction(item.id, "reject")}>Reject</Button>
                        </div>
                      )}
                      {canDecide && item.status === "APPROVED" && (
                        <Button
                          size="sm"
                          className="h-7 cursor-pointer px-2 text-xs"
                          onClick={() => {
                            const technicianId = window.prompt("Technician user id");
                            if (technicianId) void runAction(item.id, "assign", { technicianId });
                          }}
                        >
                          Assign technician
                        </Button>
                      )}
                      {item.status === "TECHNICIAN_ASSIGNED" && (canDecide || item.technician?.id === currentUserId) && (
                        <Button size="sm" className="h-7 cursor-pointer px-2 text-xs" onClick={() => void runAction(item.id, "progress")}>Start work</Button>
                      )}
                      {item.status === "IN_PROGRESS" && (canDecide || item.technician?.id === currentUserId) && (
                        <Button size="sm" className="h-7 cursor-pointer px-2 text-xs" onClick={() => void runAction(item.id, "resolve")}>Resolve</Button>
                      )}
                    </div>
                  ))}
                  {items.length === 0 && <p className="text-xs text-muted-foreground">No cards.</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <RaiseMaintenanceModal open={isModalOpen} onOpenChange={setIsModalOpen} onCreated={() => { setIsModalOpen(false); void load(); }} />
    </main>
  );
}
