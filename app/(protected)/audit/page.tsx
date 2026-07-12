import { redirect } from "next/navigation";

import { AuditWorkspace } from "@/components/pages/audit-workspace";
import { getCurrentUser } from "@/lib/auth";

export default async function AuditPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <AuditWorkspace canManage={user.role === "ADMIN"} currentUserId={user.id} />;
}
