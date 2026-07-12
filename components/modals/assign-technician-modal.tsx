"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { readApiResponse } from "@/lib/api-client";

type UserOption = { id: string; name: string; email: string };

export function AssignTechnicianModal({
  open,
  onOpenChange,
  maintenanceId,
  onAssigned,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  maintenanceId: string | null;
  onAssigned: () => void;
}) {
  const [users, setUsers] = React.useState<UserOption[]>([]);
  const [technicianId, setTechnicianId] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    fetch("/api/users?limit=100")
      .then((res) => readApiResponse<{ data: UserOption[] }>(res, "Failed to load users"))
      .then((json) => setUsers(json.data))
      .catch(() => undefined);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => setTechnicianId(""));
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!maintenanceId || !technicianId) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/maintenance/${maintenanceId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ technicianId }),
      });
      await readApiResponse(response, "Failed to assign technician");
      toast.success("Technician assigned");
      onAssigned();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to assign technician");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign technician</DialogTitle>
          <DialogDescription>Choose who will carry out this repair.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="assign-technician">Technician</Label>
            <SearchableSelect
              id="assign-technician"
              value={technicianId}
              onValueChange={setTechnicianId}
              options={users.map((u) => ({ value: u.id, label: `${u.name} (${u.email})` }))}
              placeholder="Select a user"
              emptyText="No users found."
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting || !technicianId} className="cursor-pointer">
              {isSubmitting ? "Assigning..." : "Assign"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
