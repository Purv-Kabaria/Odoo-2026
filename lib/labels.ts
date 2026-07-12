import type { Role } from "@prisma/client";

/**
 * Single source of truth for turning a `Role` enum value into copy a user
 * should actually see — every place that would otherwise print the raw
 * enum (sidebar user card, activity feed, etc.) reuses this instead of
 * re-deriving its own label map.
 */
export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  ASSET_MANAGER: "Asset Manager",
  DEPARTMENT_HEAD: "Department Head",
  EMPLOYEE: "Employee",
};

export function roleLabel(role: Role): string {
  return ROLE_LABELS[role];
}

/**
 * Generic fallback for any enum-shaped string ("UNDER_MAINTENANCE",
 * "asset.created") that doesn't have a bespoke label map — every
 * ALL_CAPS/snake_case/dot.case value the API returns must go through this
 * (or a specific `*_LABELS` map below) before it reaches JSX, never
 * rendered raw.
 */
export function humanizeEnum(value: string): string {
  return value
    .toLowerCase()
    .split(/[._]/)
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}
