/** RFC4180-ish CSV serialization — flat rows only, explicit column order so
 * the output is stable regardless of key insertion order upstream. */
function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = value instanceof Date ? value.toISOString() : String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replaceAll('"', '""')}"`;
  }
  return str;
}

export function rowsToCsv(columns: string[], rows: Record<string, unknown>[]): string {
  const header = columns.join(',');
  const lines = rows.map((row) => columns.map((column) => escapeCsvValue(row[column])).join(','));
  return [header, ...lines].join('\r\n');
}
