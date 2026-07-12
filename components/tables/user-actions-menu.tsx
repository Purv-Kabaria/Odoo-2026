"use client";

import * as React from "react";
import { CheckCircle, Shield, Power, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Role } from "@prisma/client";

import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { readApiResponse } from "@/lib/api-client";

type UserActionsMenuProps = {
  row: Record<string, unknown> & { id: string; status?: string; role?: Role };
  onSuccess: () => void;
};

export function UserActionsMenu({ row, onSuccess }: UserActionsMenuProps) {
  const [isRoleModalOpen, setIsRoleModalOpen] = React.useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = React.useState(false);
  
  const [isApproving, setIsApproving] = React.useState(false);
  const [isSubmittingRole, setIsSubmittingRole] = React.useState(false);
  const [isSubmittingStatus, setIsSubmittingStatus] = React.useState(false);

  const [selectedRole, setSelectedRole] = React.useState<Role | "">(row.role ?? "");

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      const response = await fetch(`/api/users/${row.id}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      await readApiResponse(response, "Failed to approve user");
      toast.success("User approved successfully");
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setIsApproving(false);
    }
  };

  const handleRoleChange = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedRole || selectedRole === row.role) {
      setIsRoleModalOpen(false);
      return;
    }
    
    setIsSubmittingRole(true);
    try {
      const response = await fetch(`/api/users/${row.id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: selectedRole }),
      });
      await readApiResponse(response, "Failed to change role");
      toast.success(`Role updated to ${selectedRole}`);
      setIsRoleModalOpen(false);
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setIsSubmittingRole(false);
    }
  };

  const handleStatusChange = async () => {
    const nextStatus = row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setIsSubmittingStatus(true);
    try {
      const response = await fetch(`/api/users/${row.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      await readApiResponse(response, "Failed to change status");
      toast.success(`User marked as ${nextStatus.toLowerCase()}`);
      setIsStatusModalOpen(false);
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setIsSubmittingStatus(false);
    }
  };

  return (
    <>
      <DropdownMenuSeparator />
      
      {row.status === "PENDING_APPROVAL" && (
        <DropdownMenuItem 
          className="cursor-pointer text-emerald-600 dark:text-emerald-500" 
          onClick={(e) => {
            e.preventDefault();
            handleApprove();
          }}
          disabled={isApproving}
        >
          {isApproving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle className="size-4" />} 
          Approve User
        </DropdownMenuItem>
      )}

      <DropdownMenuItem 
        className="cursor-pointer" 
        onClick={(e) => {
          e.preventDefault();
          setIsRoleModalOpen(true);
        }}
      >
        <Shield className="size-4" /> Change Role
      </DropdownMenuItem>

      <DropdownMenuItem 
        className={row.status === "ACTIVE" ? "cursor-pointer text-destructive" : "cursor-pointer"} 
        onClick={(e) => {
          e.preventDefault();
          setIsStatusModalOpen(true);
        }}
      >
        <Power className="size-4" /> {row.status === "ACTIVE" ? "Deactivate" : "Re-activate"}
      </DropdownMenuItem>

      {/* Role Change Modal */}
      <Dialog open={isRoleModalOpen} onOpenChange={setIsRoleModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Role</DialogTitle>
            <DialogDescription>
              Assigning a higher role grants broader permissions. They will need to log in again for all changes to take effect.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRoleChange} className="space-y-4 pt-4">
            <Select value={selectedRole} onValueChange={(val) => setSelectedRole(val as Role)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a role..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EMPLOYEE">Employee</SelectItem>
                <SelectItem value="DEPARTMENT_HEAD">Department Head</SelectItem>
                <SelectItem value="ASSET_MANAGER">Asset Manager</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
              </SelectContent>
            </Select>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsRoleModalOpen(false)} disabled={isSubmittingRole}>Cancel</Button>
              <Button type="submit" disabled={isSubmittingRole}>
                {isSubmittingRole ? "Saving..." : "Save Role"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Status Change Modal */}
      <Dialog open={isStatusModalOpen} onOpenChange={setIsStatusModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{row.status === "ACTIVE" ? "Deactivate User" : "Activate User"}</DialogTitle>
            <DialogDescription>
              {row.status === "ACTIVE" 
                ? "Deactivating this user will instantly terminate their active sessions and prevent them from logging in." 
                : "Activating this user will allow them to log in to the system again."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => setIsStatusModalOpen(false)} disabled={isSubmittingStatus}>Cancel</Button>
            <Button type="button" variant={row.status === "ACTIVE" ? "destructive" : "default"} onClick={handleStatusChange} disabled={isSubmittingStatus}>
              {isSubmittingStatus ? "Saving..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
