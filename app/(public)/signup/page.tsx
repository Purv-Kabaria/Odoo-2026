import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/pages/auth-form";
import { getCurrentUser } from "@/lib/auth";

export default async function SignupPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/users");
  }

  return (
    <main className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-10 sm:px-6">
      <section className="w-full max-w-sm border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="mb-6 space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight">Create account</h1>
          <p className="text-sm text-muted-foreground">Start your workspace.</p>
        </div>
        <AuthForm mode="signup" />
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
