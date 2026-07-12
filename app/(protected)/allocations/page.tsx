import { redirect } from "next/navigation";

import { AllocationWorkspace } from "@/components/pages/allocation-workspace";
import { getCurrentUser } from "@/lib/auth";

export default async function AllocationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <AllocationWorkspace
      canAllocate={user.role === "ADMIN" || user.role === "ASSET_MANAGER"}
      canApprove={user.role === "ADMIN" || user.role === "ASSET_MANAGER" || user.role === "DEPARTMENT_HEAD"}
    />
  );
}
