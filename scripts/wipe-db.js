const {
  requireConfirmation,
  getAppTables,
  countRows,
  truncateTables,
  runScript,
} = require("./db-wipe-utils");

async function main() {
  const tables = await getAppTables();

  if (tables.length === 0) {
    console.log("No application tables to wipe.");
    return;
  }

  const counts = await Promise.all(
    tables.map(async (table) => ({
      table,
      count: await countRows(table),
    }))
  );

  const totalRows = counts.reduce((sum, entry) => sum + entry.count, 0);

  console.log("Tables that will be wiped:");
  for (const { table, count } of counts) {
    console.log(`  - ${table}: ${count} row(s)`);
  }

  await requireConfirmation(
    `You are about to permanently delete all data from ${tables.length} table(s) (${totalRows} total row(s)).`
  );

  await truncateTables(tables);

  console.log(
    `Wiped ${tables.length} table(s) (${totalRows} total row(s) removed).`
  );
}

runScript(main);
