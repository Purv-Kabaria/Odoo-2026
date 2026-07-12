import { redirect } from "next/navigation";

import { EntityManagementPage } from "@/components/pages/entity-management-page";
import { getCurrentUser } from "@/lib/auth";
import { organizationsEntityConfig } from "@/lib/entities/organizations";
import { canPerform } from "@/lib/entities/types";

export default async function OrganizationsPage() {
  const user = await getCurrentUser();

  if (!user) redirect("/login");
  if (!canPerform(organizationsEntityConfig, "read", user.role)) {
    redirect("/account");
  }

  return (
    <EntityManagementPage
      entityKey="organizations"
      currentUserRole={user.role}
    />
  );
}
