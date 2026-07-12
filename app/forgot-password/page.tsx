import Link from "next/link";

import { ForgotPasswordForm } from "@/components/pages/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-10 sm:px-6">
      <section className="w-full max-w-sm border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="mb-6 space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight">Reset password</h1>
          <p className="text-sm text-muted-foreground">Enter your email to receive a reset link.</p>
        </div>
        <ForgotPasswordForm />
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Remembered it?{" "}
          <Link href="/login" className="cursor-pointer text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
