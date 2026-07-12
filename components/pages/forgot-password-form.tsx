"use client";

import * as React from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readApiResponse } from "@/lib/api-client";

function ForgotPasswordForm() {
  const [email, setEmail] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSubmitted, setIsSubmitted] = React.useState(false);
  const [resetUrl, setResetUrl] = React.useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await readApiResponse<{
        data?: { message?: string; resetUrl?: string | null };
      }>(response, "Unable to request password reset");

      setResetUrl(json.data?.resetUrl ?? null);
      setIsSubmitted(true);
      toast.success(json.data?.message ?? "Check your email for a reset link.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to request password reset");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="space-y-4">
        <div className="border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
          If the email matches an account, a reset link has been sent.
        </div>
        <Button asChild className="w-full">
          <Link href="/login" className="cursor-pointer">
            Back to sign in
          </Link>
        </Button>
        {resetUrl ? (
          <Button asChild variant="outline" className="w-full">
            <Link href={resetUrl} className="cursor-pointer">
              Continue to reset password
            </Link>
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <form className="space-y-4 pt-1" onSubmit={handleSubmit} noValidate>
      <div className="space-y-2">
        <Label htmlFor="email" className="flex items-center gap-2">
          <Mail className="size-4 text-muted-foreground" />
          Email address
        </Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
        />
      </div>

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? "Sending..." : "Send reset link"}
      </Button>
    </form>
  );
}

export { ForgotPasswordForm };
