import { Api } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();

    const categories = await prisma.assetCategory.findMany({
      where: { orgId: user.orgId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, fieldSchema: true },
    });

    return Api.ok(categories);
  } catch (error) {
    logger.error("categories.list.failed", error, { requestId });
    return Api.internalError("Failed to load categories");
  }
}
