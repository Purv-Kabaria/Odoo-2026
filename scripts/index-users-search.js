const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const MEILI_HOST = process.env.MEILISEARCH_HOST?.replace(/\/$/, "") ?? "http://localhost:7700";
const MEILI_API_KEY = process.env.MEILISEARCH_API_KEY ?? "masterKey";
const BATCH_SIZE = 500;

const indexes = {
  users: process.env.MEILISEARCH_USERS_INDEX ?? "users",
  organizations: process.env.MEILISEARCH_ORGANIZATIONS_INDEX ?? "organizations",
};

function headers() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${MEILI_API_KEY}`,
  };
}

async function meiliRequest(path, options = {}) {
  const response = await fetch(`${MEILI_HOST}${path}`, {
    ...options,
    headers: {
      ...headers(),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Meilisearch request failed (${response.status}): ${text}`);
  }

  return response.json();
}

async function configureIndexes() {
  await Promise.all([
    meiliRequest(`/indexes/${indexes.users}/settings`, {
      method: "PATCH",
      body: JSON.stringify({
        searchableAttributes: ["name", "email", "role"],
        filterableAttributes: ["role", "status"],
        sortableAttributes: ["createdAt", "name", "email", "role"],
        typoTolerance: { enabled: true },
      }),
    }),
    meiliRequest(`/indexes/${indexes.organizations}/settings`, {
      method: "PATCH",
      body: JSON.stringify({
        searchableAttributes: ["name", "slug"],
        sortableAttributes: ["createdAt", "name"],
        typoTolerance: { enabled: true },
      }),
    }),
  ]);
}

async function indexModel({ label, indexName, findMany, toDocument }) {
  let cursor;
  let indexed = 0;

  for (;;) {
    const rows = await findMany({
      take: BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: "asc" },
    });

    if (rows.length === 0) break;

    await meiliRequest(`/indexes/${indexName}/documents`, {
      method: "POST",
      body: JSON.stringify(rows.map(toDocument)),
    });

    indexed += rows.length;
    cursor = rows[rows.length - 1].id;
  }

  console.log(`Indexed ${indexed} ${label} into Meilisearch index "${indexName}".`);
}

async function main() {
  await configureIndexes();

  await indexModel({
    label: "users",
    indexName: indexes.users,
    findMany: (args) => prisma.user.findMany(args),
    toDocument: (user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    }),
  });

  await indexModel({
    label: "organizations",
    indexName: indexes.organizations,
    findMany: (args) => prisma.organization.findMany(args),
    toDocument: (organization) => ({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      createdAt: organization.createdAt.toISOString(),
      updatedAt: organization.updatedAt.toISOString(),
    }),
  });
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
