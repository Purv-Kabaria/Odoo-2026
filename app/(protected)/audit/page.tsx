import { redirect } from "next/navigation";

import { AuditWorkflow } from "@/components/pages/audit-workflow";
import { getCurrentUser } from "@/lib/auth";

export default async function AuditPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-4 md:px-6 lg:px-8">
      <div className="mb-5 space-y-1">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Audit
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Asset audit cycles
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Scope a verification cycle, assign auditors, and let the system generate the checklist and
          discrepancy report automatically.
        </p>
      </div>
      <AuditWorkflow currentUser={{ id: user.id, role: user.role }} />
    </main>
  );
}
