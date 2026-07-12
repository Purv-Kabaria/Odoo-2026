import { redirect } from "next/navigation";

import { ReportsDashboard } from "@/components/pages/reports-dashboard";
import { getCurrentUser } from "@/lib/auth";

export default async function ReportsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN" && user.role !== "MODERATOR") redirect("/account");

  return (
    <main className="mx-auto w-full max-w-[1600px] px-3 py-6 sm:px-4 md:px-6 lg:px-8">
      <div className="mb-5 space-y-1">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Reports
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Analytics & reporting
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Utilization, maintenance signals, and department-level insight — filterable and exportable.
        </p>
      </div>
      <ReportsDashboard />
    </main>
  );
}
