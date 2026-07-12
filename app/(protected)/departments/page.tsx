import { redirect } from "next/navigation";

import { EntityManagementPage } from "@/components/pages/entity-management-page";
import { getCurrentUser } from "@/lib/auth";
import { departmentsEntityConfig } from "@/lib/entities/departments";
import { canPerform } from "@/lib/entities/types";

export default async function DepartmentsPage() {
  const user = await getCurrentUser();

  if (!user) redirect("/login");
  if (!canPerform(departmentsEntityConfig, "read", user.role)) redirect("/account");

  return (
    <EntityManagementPage entityKey="departments" currentUserRole={user.role} />
  );
}
