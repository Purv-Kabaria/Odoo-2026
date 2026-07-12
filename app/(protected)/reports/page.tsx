import { redirect } from "next/navigation";

import { ReportsDashboard } from "@/components/pages/reports-dashboard";
import { getCurrentUser } from "@/lib/auth";

export default async function ReportsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN" && user.role !== "ASSET_MANAGER") redirect("/assets");

  return <ReportsDashboard />;
}
