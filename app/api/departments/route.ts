import { Api } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { departmentsEntityConfig } from "@/lib/entities/departments";
import { buildOrderBy, buildWhere, parseListQuery } from "@/lib/entities/query";
import { canPerform } from "@/lib/entities/types";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

/**
 * Not routed through `createCollectionHandlers` like the other generic
 * entities (users/organizations) because this list also needs to resolve
 * `headId`/`parentDepartmentId` to display names for the table — something
 * the generic engine's plain `findMany` (no `include`) can't do. Still uses
 * the same query helpers (`parseListQuery`/`buildWhere`/`buildOrderBy`) so
 * search/filter/sort/pagination behave identically to every other entity
 * table, including the `{ data, meta }` envelope the pagination footer reads.
 */
export async function GET(req: Request) {
  const requestId = crypto.randomUUID();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();
    if (!canPerform(departmentsEntityConfig, "read", user.role)) return Api.forbidden();

    const searchParams = new URL(req.url).searchParams;
    const parsed = parseListQuery(departmentsEntityConfig, searchParams);
    if ("error" in parsed) return Api.badRequest(parsed.error);
    const { page, limit, search, filters, sorts } = parsed;
    const skip = (page - 1) * limit;

    const where = {
      AND: [buildWhere(departmentsEntityConfig, { search, filters }), { orgId: user.orgId }],
    };
    const orderBy = buildOrderBy(departmentsEntityConfig, sorts);

    const [rows, total] = await Promise.all([
      prisma.department.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          head: { select: { name: true } },
          parent: { select: { name: true } },
        },
      }),
      prisma.department.count({ where }),
    ]);

    const data = rows.map(({ head, parent, ...row }) => ({
      ...row,
      headName: head?.name ?? null,
      parentDepartmentName: parent?.name ?? null,
    }));

    return Api.ok(data, {
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) {
    logger.error("departments.list.failed", error, { requestId });
    return Api.internalError("Failed to load departments");
  }
}
