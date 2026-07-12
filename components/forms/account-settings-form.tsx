"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readApiResponse } from "@/lib/api-client";

type AccountSettingsFormProps = {
  initialName: string;
  email: string;
};

export function AccountSettingsForm({
  initialName,
  email,
}: AccountSettingsFormProps) {
  const router = useRouter();
  const [name, setName] = React.useState(initialName);
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [isSavingProfile, setIsSavingProfile] = React.useState(false);
  const [isChangingPassword, setIsChangingPassword] = React.useState(false);

  const handleProfileSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSavingProfile(true);

    try {
      const response = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      await readApiResponse(response, "Failed to update profile");

      toast.success("Profile updated");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update profile");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsChangingPassword(true);

    try {
      const response = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, password, confirmPassword }),
      });

      await readApiResponse(response, "Failed to update password");

      setCurrentPassword("");
      setPassword("");
      setConfirmPassword("");
      toast.success("Password updated");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update password");
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form
        onSubmit={(event) => void handleProfileSubmit(event)}
        className="border border-border bg-card p-4 shadow-sm"
      >
        <div className="mb-4 space-y-1">
          <h2 className="text-base font-semibold tracking-tight">Profile</h2>
          <p className="text-sm text-muted-foreground">
            Keep your visible account details current.
          </p>
        </div>
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="account-name">Name</Label>
            <Input
              id="account-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              minLength={2}
              maxLength={120}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="account-email">Email</Label>
            <Input id="account-email" value={email} disabled />
          </div>
          <Button
            type="submit"
            disabled={isSavingProfile || name.trim().length < 2}
            className="mt-1 w-full cursor-pointer sm:w-fit"
          >
            {isSavingProfile ? "Saving..." : "Save profile"}
          </Button>
        </div>
      </form>

      <form
        onSubmit={(event) => void handlePasswordSubmit(event)}
        className="border border-border bg-card p-4 shadow-sm"
      >
        <div className="mb-4 space-y-1">
          <h2 className="text-base font-semibold tracking-tight">Security</h2>
          <p className="text-sm text-muted-foreground">
            Change your password and keep this session active.
          </p>
        </div>
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="current-password">Current password</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              minLength={8}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirm-new-password">Confirm password</Label>
            <Input
              id="confirm-new-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={8}
              required
            />
          </div>
          <Button
            type="submit"
            disabled={
              isChangingPassword ||
              currentPassword.length < 8 ||
              password.length < 8 ||
              password !== confirmPassword
            }
            className="mt-1 w-full cursor-pointer sm:w-fit"
          >
            {isChangingPassword ? "Updating..." : "Update password"}
          </Button>
        </div>
      </form>
    </div>
  );
}
