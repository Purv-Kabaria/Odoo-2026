const {
  getPositionalArgs,
  requireConfirmation,
  resolveTable,
  countRows,
  truncateTables,
  runScript,
} = require("./db-wipe-utils");

async function main() {
  const tableArg = getPositionalArgs()[0];

  if (!tableArg) {
    console.error("Usage: pnpm db:wipe:table <TableName>");
    process.exit(1);
  }

  const table = await resolveTable(tableArg);
  const rowCount = await countRows(table);

  await requireConfirmation(
    `You are about to permanently delete all ${rowCount} row(s) from the "${table}" table.`
  );

  await truncateTables([table]);

  console.log(`Wiped table "${table}" (${rowCount} row(s) removed).`);
}

runScript(main);
