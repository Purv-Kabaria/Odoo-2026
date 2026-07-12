"use client";

import * as React from "react";
import { UserPlus } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { readApiResponse } from "@/lib/api-client";
type Department = { id: string; name: string };

const INVITE_ROLES = [
  { label: "Employee", value: "EMPLOYEE" },
  { label: "Department Head", value: "DEPARTMENT_HEAD" },
  { label: "Asset Manager", value: "ASSET_MANAGER" },
];

type InviteUserModalProps = {
  onSuccess?: () => void;
  triggerClassName?: string;
};

export function InviteUserModal({ onSuccess, triggerClassName }: InviteUserModalProps) {
  const [open, setOpen] = React.useState(false);
  const [departments, setDepartments] = React.useState<Department[]>([]);
  const [email, setEmail] = React.useState("");
  const [name, setName] = React.useState("");
  const [role, setRole] = React.useState("EMPLOYEE");
  const [departmentId, setDepartmentId] = React.useState<string>("none");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    fetch("/api/departments")
      .then((res) => readApiResponse<{ data: Department[] }>(res, "Failed to load departments"))
      .then((json) => setDepartments(json.data))
      .catch(() => undefined);
  }, [open]);

  const reset = () => {
    setEmail("");
    setName("");
    setRole("EMPLOYEE");
    setDepartmentId("none");
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name,
          role,
          departmentId: departmentId === "none" ? null : departmentId,
        }),
      });
      await readApiResponse(response, "Failed to send invite");
      toast.success("User invited successfully! An invitation email has been sent.");
      setOpen(false);
      reset();
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send invite");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <Button className={triggerClassName ?? "w-fit cursor-pointer"} onClick={() => setOpen(true)}>
        <UserPlus className="size-4" />
        Invite user
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a user</DialogTitle>
          <DialogDescription>
            They&apos;ll receive a link to set their password. Admin can only be granted later, from this directory.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void handleSubmit(event)} className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              maxLength={254}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="invite-name">Name</Label>
            <Input
              id="invite-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              minLength={2}
              maxLength={120}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger id="invite-role" className="cursor-pointer"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INVITE_ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="invite-department">Department</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger id="invite-department" className="cursor-pointer"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting || !email || !name} className="cursor-pointer">
              {isSubmitting ? "Sending..." : "Send invite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

