const { PrismaClient } = require("@prisma/client");
const readline = require("readline");

const prisma = new PrismaClient();

const SYSTEM_TABLES = new Set(["_prisma_migrations"]);

function getPositionalArgs() {
  return process.argv.slice(2).filter((arg) => arg.length > 0);
}

async function promptConfirmation(message) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await new Promise((resolve) => {
    rl.question(`${message}\nType "yes" to confirm: `, resolve);
  });

  rl.close();

  const normalized = answer.trim().toLowerCase();
  return normalized === "yes" || normalized === "y";
}

async function requireConfirmation(message) {
  const confirmed = await promptConfirmation(message);

  if (!confirmed) {
    console.log("Operation cancelled.");
    process.exit(0);
  }
}

function quoteIdent(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

async function getAppTables() {
  const rows = await prisma.$queryRaw`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `;

  return rows
    .map((row) => row.tablename)
    .filter((name) => !SYSTEM_TABLES.has(name));
}

async function resolveTable(name) {
  const tables = await getAppTables();
  const match = tables.find((table) => table.toLowerCase() === name.toLowerCase());

  if (!match) {
    throw new Error(
      `Table "${name}" not found. Available tables: ${tables.join(", ") || "(none)"}`
    );
  }

  return match;
}

async function countRows(tableName) {
  const [{ count }] = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS count FROM ${quoteIdent(tableName)}`
  );
  return count;
}

async function truncateTables(tableNames) {
  if (tableNames.length === 0) {
    return;
  }

  const quoted = tableNames.map(quoteIdent).join(", ");
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`
  );
}

async function runScript(main) {
  try {
    await main();
  } catch (error) {
    console.error(error.message || error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

module.exports = {
  prisma,
  getPositionalArgs,
  requireConfirmation,
  getAppTables,
  resolveTable,
  countRows,
  truncateTables,
  runScript,
};
