/**
 * Statuses ALLOCATED/RESERVED/UNDER_MAINTENANCE/LOST are side effects of
 * their own action endpoints (allocate/book/approve-maintenance/report-lost)
 * — a direct manual status PATCH is only legal when the asset is already at
 * rest (Available) or already terminal (Retired/Disposed). Shared by
 * app/api/assets/[id]/route.ts (PATCH) and
 * app/api/maintenance/[id]/verify-retire/route.ts so the whitelist rule
 * lives in exactly one place.
 */
export const MANUALLY_TRANSITIONABLE_ASSET_STATUSES = ["AVAILABLE", "RETIRED", "DISPOSED"] as const;

export function canManuallyTransitionAssetStatus(currentStatus: string): boolean {
  return (MANUALLY_TRANSITIONABLE_ASSET_STATUSES as readonly string[]).includes(currentStatus);
}
