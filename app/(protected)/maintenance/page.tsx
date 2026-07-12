import { redirect } from "next/navigation";

import { MaintenanceBoard } from "@/components/pages/maintenance-board";
import { getCurrentUser } from "@/lib/auth";

export default async function MaintenancePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <MaintenanceBoard
      canDecide={user.role === "ADMIN" || user.role === "ASSET_MANAGER"}
      currentUserId={user.id}
    />
  );
}
