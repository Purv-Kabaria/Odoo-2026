"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { AlertTriangle, Loader2, Sparkles } from "lucide-react";

import { AssignTechnicianModal } from "@/components/modals/assign-technician-modal";
import { RaiseMaintenanceModal } from "@/components/modals/raise-maintenance-modal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { readApiResponse } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type MaintenanceRow = {
  id: string;
  description: string;
  priority: string;
  status: string;
  asset: { id: string; assetTag: string; name: string; status: string; acquisitionCost: string | null };
  raisedBy: { id: string; name: string };
  technician: { id: string; name: string } | null;
  aiRecommendRetirement: boolean | null;
  aiRecommendReason: string | null;
  aiRecommendedAt: string | null;
};

const RETIRED_COLUMN_KEY = "RETIRED_COL";

const COLUMNS = [
  { key: "PENDING", label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "TECHNICIAN_ASSIGNED", label: "Technician Assigned" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "RESOLVED", label: "Resolved" },
  { key: RETIRED_COLUMN_KEY, label: "Retired" },
];

// Only these four moves map onto a real transition endpoint. Backwards or
// skip-ahead drops (and anything into Retired, which isn't droppable) are
// rejected client-side before any request is made.
const LEGAL_DRAG_TRANSITIONS: Record<string, string> = {
  PENDING: "APPROVED",
  APPROVED: "TECHNICIAN_ASSIGNED",
  TECHNICIAN_ASSIGNED: "IN_PROGRESS",
  IN_PROGRESS: "RESOLVED",
};

const COLUMN_LABEL: Record<string, string> = Object.fromEntries(COLUMNS.map((c) => [c.key, c.label]));

function priorityVariant(priority: string): "default" | "secondary" | "outline" | "destructive" {
  if (priority === "URGENT" || priority === "HIGH") return "destructive";
  if (priority === "MEDIUM") return "default";
  return "secondary";
}

// A retired asset's card always shows in Retired regardless of the request's
// own workflow status — retirement is an asset-level fact, not a maintenance
// lifecycle stage.
function columnForItem(item: MaintenanceRow): string {
  if (item.asset.status === "RETIRED") return RETIRED_COLUMN_KEY;
  return item.status;
}

function MaintenanceCard({
  item,
  canDrag,
  children,
}: {
  item: MaintenanceRow;
  canDrag: boolean;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
    data: { status: item.status },
    disabled: !canDrag,
  });

  const style: React.CSSProperties = transform
    ? { transform: CSS.Translate.toString(transform), zIndex: 10 }
    : {};

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(canDrag ? { ...listeners, ...attributes } : {})}
      className={cn(
        "border border-border bg-card p-2 text-xs shadow-sm transition-shadow",
        canDrag && "touch-none cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40",
        item.aiRecommendRetirement && "border-l-4 border-l-destructive",
      )}
    >
      {children}
    </div>
  );
}

function KanbanColumn({
  col,
  count,
  droppable,
  children,
}: {
  col: { key: string; label: string };
  count: number;
  droppable: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key, disabled: !droppable });

  return (
    <div
      ref={droppable ? setNodeRef : undefined}
      className={cn(
        "min-w-0 border border-border bg-card p-3 shadow-sm transition-colors",
        droppable && isOver && "border-primary bg-primary/5",
      )}
    >
      <h2 className="mb-2 truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {col.label} ({count})
      </h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export function MaintenanceBoard({ canDecide, currentUserId }: { canDecide: boolean; currentUserId: string }) {
  const [rows, setRows] = React.useState<MaintenanceRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [showRejected, setShowRejected] = React.useState(false);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [assignTargetId, setAssignTargetId] = React.useState<string | null>(null);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [busyAiId, setBusyAiId] = React.useState<string | null>(null);
  const [retireTargetId, setRetireTargetId] = React.useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

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

  const requestRecommendation = async (id: string) => {
    setBusyAiId(id);
    try {
      const response = await fetch(`/api/maintenance/${id}/recommend-retirement`, { method: "POST" });
      await readApiResponse(response, "Failed to get an AI recommendation");
      toast.success("AI recommendation ready");
      void load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to get an AI recommendation");
    } finally {
      setBusyAiId(null);
    }
  };

  const confirmRetire = async () => {
    if (!retireTargetId) return;
    const id = retireTargetId;
    setRetireTargetId(null);
    try {
      const response = await fetch(`/api/maintenance/${id}/verify-retire`, { method: "POST" });
      await readApiResponse(response, "Failed to retire asset");
      toast.success("Asset retired");
      void load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to retire asset");
    }
  };

  const handleDragStart = (event: DragStartEvent) => setActiveId(String(event.active.id));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const sourceStatus = active.data.current?.status as string | undefined;
    const targetColumn = String(over.id);
    if (!sourceStatus || sourceStatus === targetColumn) return;

    const expected = LEGAL_DRAG_TRANSITIONS[sourceStatus];
    if (expected !== targetColumn) {
      toast.error(
        `Can't move a request from "${COLUMN_LABEL[sourceStatus] ?? sourceStatus}" directly to "${COLUMN_LABEL[targetColumn] ?? targetColumn}".`,
      );
      return;
    }

    const itemId = String(active.id);
    if (targetColumn === "TECHNICIAN_ASSIGNED") {
      // A technician must be chosen — open the same modal the button uses
      // rather than guessing an assignee.
      setAssignTargetId(itemId);
      return;
    }

    const actionForTarget: Record<string, string> = { APPROVED: "approve", IN_PROGRESS: "progress", RESOLVED: "resolve" };
    const action = actionForTarget[targetColumn];
    if (action) void runAction(itemId, action);
  };

  const columns = showRejected ? [{ key: "REJECTED", label: "Rejected" }] : COLUMNS;
  const activeItem = activeId ? (rows.find((r) => r.id === activeId) ?? null) : null;

  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-4 md:px-6 lg:px-8">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Assets</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Maintenance</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">Drag a card to its next stage, or use the actions on each card.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="cursor-pointer" onClick={() => setShowRejected((v) => !v)}>
            {showRejected ? "Show board" : "Show rejected"}
          </Button>
          <Button className="cursor-pointer" onClick={() => setIsModalOpen(true)}>Raise request</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: showRejected ? 1 : 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className={cn("grid gap-3", showRejected ? "" : "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6")}>
            {columns.map((col) => {
              const items = rows.filter((r) => columnForItem(r) === col.key);
              const isRetiredColumn = col.key === RETIRED_COLUMN_KEY;

              return (
                <KanbanColumn key={col.key} col={col} count={items.length} droppable={!isRetiredColumn && !showRejected}>
                  {items.map((item) => {
                    const canDragThisCard =
                      !isRetiredColumn &&
                      ((canDecide && (item.status === "PENDING" || item.status === "APPROVED")) ||
                        ((canDecide || item.technician?.id === currentUserId) &&
                          (item.status === "TECHNICIAN_ASSIGNED" || item.status === "IN_PROGRESS")));

                    return (
                      <MaintenanceCard key={item.id} item={item} canDrag={canDragThisCard}>
                        <div className="mb-1 flex items-center justify-between gap-1">
                          <span className="min-w-0 truncate font-medium">{item.asset.assetTag}</span>
                          <Badge variant={priorityVariant(item.priority)} className="shrink-0">{item.priority}</Badge>
                        </div>
                        <p className="mb-2 text-muted-foreground">{item.description}</p>
                        {item.technician && <p className="mb-2 text-muted-foreground">Tech: {item.technician.name}</p>}

                        {item.aiRecommendRetirement === true && (
                          <div className="mb-2 flex items-start gap-1 border border-destructive/40 bg-destructive/10 p-1.5 text-destructive">
                            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                            <p className="leading-tight">{item.aiRecommendReason ?? "AI recommends retirement"}</p>
                          </div>
                        )}
                        {item.aiRecommendRetirement === false && item.aiRecommendReason && (
                          <p className="mb-2 flex items-start gap-1 text-muted-foreground">
                            <Sparkles className="mt-0.5 h-3 w-3 shrink-0" />
                            <span className="leading-tight">{item.aiRecommendReason}</span>
                          </p>
                        )}

                        <div className="flex flex-wrap gap-1">
                          {canDecide && item.status === "PENDING" && (
                            <>
                              <Button size="sm" className="h-7 cursor-pointer px-2 text-xs" onClick={() => void runAction(item.id, "approve")}>
                                Approve
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 cursor-pointer px-2 text-xs" onClick={() => void runAction(item.id, "reject")}>
                                Reject
                              </Button>
                            </>
                          )}
                          {canDecide && item.status === "APPROVED" && (
                            <Button size="sm" className="h-7 cursor-pointer px-2 text-xs" onClick={() => setAssignTargetId(item.id)}>
                              Assign technician
                            </Button>
                          )}
                          {item.status === "TECHNICIAN_ASSIGNED" && (canDecide || item.technician?.id === currentUserId) && (
                            <Button size="sm" className="h-7 cursor-pointer px-2 text-xs" onClick={() => void runAction(item.id, "progress")}>
                              Start work
                            </Button>
                          )}
                          {item.status === "IN_PROGRESS" && (canDecide || item.technician?.id === currentUserId) && (
                            <Button size="sm" className="h-7 cursor-pointer px-2 text-xs" onClick={() => void runAction(item.id, "resolve")}>
                              Resolve
                            </Button>
                          )}
                          {canDecide && item.status === "RESOLVED" && !isRetiredColumn && (
                            <>
                              {item.aiRecommendRetirement === null && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 cursor-pointer px-2 text-xs"
                                  disabled={busyAiId === item.id}
                                  onClick={() => void requestRecommendation(item.id)}
                                >
                                  {busyAiId === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Get AI recommendation"}
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant={item.aiRecommendRetirement ? "destructive" : "outline"}
                                className="h-7 cursor-pointer px-2 text-xs"
                                onClick={() => setRetireTargetId(item.id)}
                              >
                                Verify &amp; Retire
                              </Button>
                            </>
                          )}
                        </div>
                      </MaintenanceCard>
                    );
                  })}
                  {items.length === 0 && <p className="text-xs text-muted-foreground">No cards.</p>}
                </KanbanColumn>
              );
            })}
          </div>

          <DragOverlay>
            {activeItem ? (
              <div className="w-56 border border-primary bg-card p-2 text-xs shadow-lg">
                <div className="mb-1 flex items-center justify-between gap-1">
                  <span className="min-w-0 truncate font-medium">{activeItem.asset.assetTag}</span>
                  <Badge variant={priorityVariant(activeItem.priority)} className="shrink-0">{activeItem.priority}</Badge>
                </div>
                <p className="truncate text-muted-foreground">{activeItem.description}</p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <RaiseMaintenanceModal open={isModalOpen} onOpenChange={setIsModalOpen} onCreated={() => { setIsModalOpen(false); void load(); }} />
      <AssignTechnicianModal
        open={assignTargetId !== null}
        onOpenChange={(next) => { if (!next) setAssignTargetId(null); }}
        maintenanceId={assignTargetId}
        onAssigned={() => { setAssignTargetId(null); void load(); }}
      />

      <AlertDialog open={retireTargetId !== null} onOpenChange={(next) => { if (!next) setRetireTargetId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retire this asset?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently marks the asset Retired org-wide. It can no longer be allocated, booked, or have new
              maintenance raised against it. This cannot be undone from this screen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
            <AlertDialogAction className="cursor-pointer" onClick={() => void confirmRetire()}>
              Retire asset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
