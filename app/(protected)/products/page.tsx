import { redirect } from "next/navigation";

import { EntityManagementPage } from "@/components/pages/entity-management-page";
import { getCurrentUser } from "@/lib/auth";
import { productsEntityConfig } from "@/lib/entities/products";
import { canPerform } from "@/lib/entities/types";

export default async function ProductsPage() {
  const user = await getCurrentUser();

  if (!user) redirect("/login");
  if (!canPerform(productsEntityConfig, "read", user.role)) redirect("/account");

  return (
    <EntityManagementPage entityKey="products" currentUserRole={user.role} />
  );
}
