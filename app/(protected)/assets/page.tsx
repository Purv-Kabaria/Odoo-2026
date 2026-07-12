import { redirect } from "next/navigation";

import { EntityManagementPage } from "@/components/pages/entity-management-page";
import { getCurrentUser } from "@/lib/auth";
import { assetsEntityConfig } from "@/lib/entities/assets";
import { canPerform } from "@/lib/entities/types";

export default async function AssetsPage() {
  const user = await getCurrentUser();

  if (!user) redirect("/login");
  if (!canPerform(assetsEntityConfig, "read", user.role)) redirect("/account");

  return (
    <EntityManagementPage entityKey="assets" currentUserRole={user.role} />
  );
}
