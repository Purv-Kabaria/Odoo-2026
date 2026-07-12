import type { AssetStatus } from '@prisma/client';

/**
 * AssetStatus is state, not identity, so it never draws from the
 * categorical chart-1..5 token order — each status gets one fixed,
 * reserved token reused everywhere a status renders (chart fills, badges).
 * The app has no dedicated status ramp, so this reuses the closest
 * semantic chart/destructive tokens: teal for the healthy state, the
 * primary hue for "in active use," amber for "needs attention," red for
 * the critical state, and a muted gray for end-of-life states.
 */
export const ASSET_STATUS_COLORS: Record<AssetStatus, string> = {
  AVAILABLE: 'var(--chart-2)',
  ALLOCATED: 'var(--chart-1)',
  RESERVED: 'var(--chart-4)',
  UNDER_MAINTENANCE: 'var(--chart-3)',
  LOST: 'var(--destructive)',
  RETIRED: 'var(--muted-foreground)',
  DISPOSED: 'var(--muted-foreground)',
};

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  AVAILABLE: 'Available',
  ALLOCATED: 'Allocated',
  RESERVED: 'Reserved',
  UNDER_MAINTENANCE: 'Under Maintenance',
  LOST: 'Lost',
  RETIRED: 'Retired',
  DISPOSED: 'Disposed',
};
