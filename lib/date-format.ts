const tableDateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  timeZone: "UTC",
});

export function formatTableDate(value: string | Date | null | undefined) {
  if (!value) return "-";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return tableDateFormatter.format(date);
}

const RELATIVE_UNITS: [string, number][] = [
  ["y", 365 * 24 * 60 * 60 * 1000],
  ["mo", 30 * 24 * 60 * 60 * 1000],
  ["d", 24 * 60 * 60 * 1000],
  ["h", 60 * 60 * 1000],
  ["m", 60 * 1000],
];

/** "2m ago" / "18m ago" / "1h ago" / "3d ago" — matches the mockup's compact
 * style. Falls back to "just now" under a minute and the absolute date past
 * a year, since a bare "1y ago" stops being a useful signal. */
export function formatRelativeTime(value: string | Date | null | undefined): string {
  if (!value) return "-";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60 * 1000) return "just now";

  for (const [suffix, unitMs] of RELATIVE_UNITS) {
    if (diffMs >= unitMs) {
      if (suffix === "y") return formatTableDate(date);
      return `${Math.floor(diffMs / unitMs)}${suffix} ago`;
    }
  }

  return "just now";
}
