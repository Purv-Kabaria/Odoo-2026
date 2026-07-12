import type { Prisma } from "@prisma/client";

import { Api } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { assetSearchConfig } from "@/lib/entities/assets";
import { departmentsEntityConfig } from "@/lib/entities/departments";
import { organizationsEntityConfig } from "@/lib/entities/organizations";
import { canPerform } from "@/lib/entities/types";
import { usersEntityConfig } from "@/lib/entities/users";
import { logger } from "@/lib/logger";
import { searchIds } from "@/lib/meilisearch";
import { prisma } from "@/lib/prisma";
import { GlobalSearchQuerySchema, type GlobalSearchResult } from "@/types/search-types";

const GROUP_LIMIT = 5;

async function searchAssets(orgId: string, q: string): Promise<GlobalSearchResult[]> {
  const meiliIds = await searchIds(assetSearchConfig, q, GROUP_LIMIT, orgId);
  const where: Prisma.AssetWhereInput = { orgId };
  if (meiliIds !== null) {
    where.id = { in: meiliIds };
  } else {
    where.OR = [
      { assetTag: { equals: q.toUpperCase() } },
      { serialNumber: { equals: q } },
      { name: { contains: q, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.asset.findMany({
    where,
    take: GROUP_LIMIT,
    select: { id: true, assetTag: true, name: true, status: true },
  });

  return rows.map((row) => ({
    id: row.id,
    title: `${row.assetTag} — ${row.name}`,
    subtitle: row.status,
    href: `/assets/${row.id}`,
  }));
}

async function searchUsers(orgId: string, q: string): Promise<GlobalSearchResult[]> {
  const meiliIds = await searchIds(usersEntityConfig, q, GROUP_LIMIT, orgId);
  const where: Prisma.UserWhereInput = { orgId };
  if (meiliIds !== null) {
    where.id = { in: meiliIds };
  } else {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.user.findMany({
    where,
    take: GROUP_LIMIT,
    select: { id: true, name: true, email: true },
  });

  return rows.map((row) => ({
    id: row.id,
    title: row.name,
    subtitle: row.email,
    href: `/users?q=${encodeURIComponent(row.email)}`,
  }));
}

async function searchDepartments(orgId: string, q: string): Promise<GlobalSearchResult[]> {
  const rows = await prisma.department.findMany({
    where: { orgId, name: { contains: q, mode: "insensitive" } },
    take: GROUP_LIMIT,
    select: { id: true, name: true },
  });

  return rows.map((row) => ({
    id: row.id,
    title: row.name,
    subtitle: "Department",
    href: `/departments?q=${encodeURIComponent(row.name)}`,
  }));
}

async function searchOrganizations(orgId: string, q: string): Promise<GlobalSearchResult[]> {
  // tenantScope for Organization is "id equals my own orgId" (it's the tenant
  // root, not a child row) — a single direct lookup, no need for Meilisearch.
  const rows = await prisma.organization.findMany({
    where: {
      id: orgId,
      OR: [{ name: { contains: q, mode: "insensitive" } }, { slug: { contains: q, mode: "insensitive" } }],
    },
    take: GROUP_LIMIT,
    select: { id: true, name: true, slug: true },
  });

  return rows.map((row) => ({
    id: row.id,
    title: row.name,
    subtitle: row.slug,
    href: `/organizations?q=${encodeURIComponent(row.name)}`,
  }));
}

export async function GET(req: Request) {
  const requestId = crypto.randomUUID();
  const startedAt = performance.now();

  try {
    const user = await getCurrentUser();
    if (!user) return Api.unauthorized();

    const searchParams = new URL(req.url).searchParams;
    const validation = GlobalSearchQuerySchema.safeParse({
      q: searchParams.get("q") ?? undefined,
    });
    if (!validation.success) {
      return Api.badRequest("Invalid search query", validation.error.format());
    }

    const q = validation.data.q;
    if (!q) {
      return Api.ok({ assets: [], users: [], departments: [], organizations: [] });
    }

    const canReadUsers = canPerform(usersEntityConfig, "read", user.role);
    const canReadDepartments = canPerform(departmentsEntityConfig, "read", user.role);
    const canReadOrganizations = canPerform(organizationsEntityConfig, "read", user.role);

    const [assets, users, departments, organizations] = await Promise.all([
      searchAssets(user.orgId, q),
      canReadUsers ? searchUsers(user.orgId, q) : Promise.resolve([]),
      canReadDepartments ? searchDepartments(user.orgId, q) : Promise.resolve([]),
      canReadOrganizations ? searchOrganizations(user.orgId, q) : Promise.resolve([]),
    ]);

    logger.info("search.global", {
      requestId,
      durationMs: Math.round(performance.now() - startedAt),
      queryLength: q.length,
      assetCount: assets.length,
      userCount: users.length,
      departmentCount: departments.length,
      organizationCount: organizations.length,
    });

    return Api.ok({ assets, users, departments, organizations });
  } catch (error) {
    logger.error("search.global.failed", error, { requestId });
    return Api.internalError("Search failed");
  }
}
