"use client";

import * as React from "react";
import { toast } from "sonner";

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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { readApiResponse } from "@/lib/api-client";

type Department = { id: string; name: string };
type UserOption = { id: string; name: string };

export function CreateAuditCycleModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const [departments, setDepartments] = React.useState<Department[]>([]);
  const [users, setUsers] = React.useState<UserOption[]>([]);
  const [name, setName] = React.useState("");
  const [scopeType, setScopeType] = React.useState<"org" | "department" | "location">("org");
  const [scopeDeptId, setScopeDeptId] = React.useState("");
  const [scopeLocation, setScopeLocation] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [auditorIds, setAuditorIds] = React.useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    fetch("/api/departments").then((r) => readApiResponse<{ data: Department[] }>(r, "Failed to load departments")).then((j) => setDepartments(j.data)).catch(() => undefined);
    fetch("/api/users?limit=100").then((r) => readApiResponse<{ data: UserOption[] }>(r, "Failed to load users")).then((j) => setUsers(j.data)).catch(() => undefined);
  }, [open]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/audit-cycles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          scopeDeptId: scopeType === "department" ? scopeDeptId : undefined,
          scopeLocation: scopeType === "location" ? scopeLocation : undefined,
          startDate,
          endDate,
          auditorIds,
        }),
      });
      const json = await readApiResponse<{ data: { id: string } }>(response, "Failed to create audit cycle");
      toast.success("Audit cycle created");
      setName("");
      setScopeType("org");
      setScopeDeptId("");
      setScopeLocation("");
      setStartDate("");
      setEndDate("");
      setAuditorIds([]);
      onCreated(json.data.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create audit cycle");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New audit cycle</DialogTitle>
          <DialogDescription>Verify assets against expected location within a scope and date range.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="audit-name">Name</Label>
            <Input id="audit-name" value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={140} required />
          </div>

          <RadioGroup value={scopeType} onValueChange={(v) => setScopeType(v as typeof scopeType)} className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2"><RadioGroupItem value="org" id="scope-org" /><Label htmlFor="scope-org">Org-wide</Label></div>
            <div className="flex items-center gap-2"><RadioGroupItem value="department" id="scope-dept" /><Label htmlFor="scope-dept">Department</Label></div>
            <div className="flex items-center gap-2"><RadioGroupItem value="location" id="scope-loc" /><Label htmlFor="scope-loc">Location</Label></div>
          </RadioGroup>

          {scopeType === "department" && (
            <Select value={scopeDeptId} onValueChange={setScopeDeptId}>
              <SelectTrigger className="cursor-pointer"><SelectValue placeholder="Select department" /></SelectTrigger>
              <SelectContent>
                {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {scopeType === "location" && (
            <Input placeholder="e.g. HQ Floor 2" value={scopeLocation} onChange={(e) => setScopeLocation(e.target.value)} maxLength={160} />
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="audit-start">Start date</Label>
              <Input id="audit-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="audit-end">End date</Label>
              <Input id="audit-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Auditors</Label>
            <div className="max-h-32 space-y-1 overflow-y-auto border border-border p-2">
              {users.map((u) => (
                <label key={u.id} className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={auditorIds.includes(u.id)}
                    onCheckedChange={(checked) =>
                      setAuditorIds((prev) => (checked ? [...prev, u.id] : prev.filter((id) => id !== u.id)))
                    }
                  />
                  {u.name}
                </label>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={
                isSubmitting ||
                !name ||
                !startDate ||
                !endDate ||
                auditorIds.length === 0 ||
                (scopeType === "department" && !scopeDeptId) ||
                (scopeType === "location" && !scopeLocation)
              }
              className="cursor-pointer"
            >
              {isSubmitting ? "Creating..." : "Create cycle"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
