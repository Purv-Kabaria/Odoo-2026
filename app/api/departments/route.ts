import { Api } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();

    const departments = await prisma.department.findMany({
      where: { orgId: user.orgId, status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, headId: true, parentDepartmentId: true },
    });

    return Api.ok(departments);
  } catch (error) {
    logger.error("departments.list.failed", error, { requestId });
    return Api.internalError("Failed to load departments");
  }
}
