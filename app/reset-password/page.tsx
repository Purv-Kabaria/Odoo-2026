import Link from "next/link";

import { ResetPasswordForm } from "@/components/pages/reset-password-form";

type ResetPasswordPageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = await searchParams;
  const token = params.token ?? "";

  return (
    <main className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-10 sm:px-6">
      <section className="w-full max-w-sm border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="mb-6 space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight">Create new password</h1>
          <p className="text-sm text-muted-foreground">Choose a new password for your account.</p>
        </div>
        {token ? (
          <ResetPasswordForm token={token} />
        ) : (
          <div className="space-y-4">
            <div className="border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
              This reset link is missing a token.
            </div>
            <Link href="/forgot-password" className="block cursor-pointer text-center text-sm text-primary hover:underline">
              Request a new link
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
