import { redirect } from "next/navigation";

import { InviteUserModal } from "@/components/modals/invite-user-modal";
import { EntityManagementPage } from "@/components/pages/entity-management-page";
import { getCurrentUser } from "@/lib/auth";
import { usersEntityConfig } from "@/lib/entities/users";
import { canPerform } from "@/lib/entities/types";

export default async function UsersPage() {
  const user = await getCurrentUser();

  if (!user) redirect("/login");
  if (!canPerform(usersEntityConfig, "read", user.role)) redirect("/account");

  return (
    <EntityManagementPage
      entityKey="users"
      currentUserRole={user.role}
      headerActions={user.role === "ADMIN" ? <InviteUserModal /> : undefined}
    />
  );
}
