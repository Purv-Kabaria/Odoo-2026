export type ReportColumn = { key: string; label: string };

/** Minimal RFC 4180 CSV serialization — quotes/escapes only where needed, CRLF line endings. */
export function rowsToCsv(columns: ReportColumn[], rows: Record<string, unknown>[]): string {
  const escape = (value: unknown): string => {
    const str = value === null || value === undefined ? "" : String(value);
    if (/[",\r\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };

  const lines = [columns.map((col) => escape(col.label)).join(",")];
  for (const row of rows) {
    lines.push(columns.map((col) => escape(row[col.key])).join(","));
  }
  return lines.join("\r\n");
}
