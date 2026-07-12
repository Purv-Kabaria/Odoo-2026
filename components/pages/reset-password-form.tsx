"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readApiResponse } from "@/lib/api-client";

type ResetPasswordFormProps = {
  token: string;
};

function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [formState, setFormState] = React.useState({
    password: "",
    confirmPassword: "",
  });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...formState }),
      });
      await readApiResponse(response, "Could not reset password");

      toast.success("Password updated");
      router.push("/login");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="space-y-4 pt-1" onSubmit={handleSubmit} noValidate>
      <div className="space-y-2">
        <Label htmlFor="password" className="flex items-center gap-2">
          <LockKeyhole className="size-4 text-muted-foreground" />
          New password
        </Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          value={formState.password}
          onChange={(event) => setFormState((current) => ({ ...current, password: event.target.value }))}
          placeholder="********"
          minLength={8}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm-password" className="flex items-center gap-2">
          <LockKeyhole className="size-4 text-muted-foreground" />
          Confirm password
        </Label>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          value={formState.confirmPassword}
          onChange={(event) =>
            setFormState((current) => ({ ...current, confirmPassword: event.target.value }))
          }
          placeholder="Repeat your password"
          minLength={8}
          required
        />
      </div>

      <Button type="submit" disabled={isSubmitting || !token} className="w-full">
        {isSubmitting ? "Updating..." : "Update password"}
      </Button>
    </form>
  );
}

export { ResetPasswordForm };
