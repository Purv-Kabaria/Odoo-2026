import { redirect } from "next/navigation";

import { AssetDirectory } from "@/components/pages/asset-directory";
import { getCurrentUser } from "@/lib/auth";

export default async function AssetsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <AssetDirectory canRegister={user.role === "ADMIN" || user.role === "ASSET_MANAGER"} />;
}
