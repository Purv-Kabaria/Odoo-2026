import { notFound, redirect } from "next/navigation";

import { AssetDetail } from "@/components/pages/asset-detail";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const asset = await prisma.asset.findFirst({
    where: { id, orgId: user.orgId },
    include: {
      category: { select: { id: true, name: true } },
      allocations: {
        orderBy: { allocatedAt: "desc" },
        take: 10,
        include: {
          toEmployee: { select: { id: true, name: true } },
          toDepartment: { select: { id: true, name: true } },
        },
      },
      maintenanceRequests: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });
  if (!asset) notFound();

  return (
    <AssetDetail
      asset={JSON.parse(JSON.stringify(asset))}
      canManage={user.role === "ADMIN" || user.role === "ASSET_MANAGER"}
    />
  );
}
