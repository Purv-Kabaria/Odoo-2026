import { departmentsEntityConfig } from './departments';
import { organizationsEntityConfig } from './organizations';
import type { EntityConfig } from './types';
import { usersEntityConfig } from './users';

/**
 * Every entity the admin/moderator panels know about. Add a new entity by
 * defining its config (see users.ts for the pattern) and appending it here
 * — the sidebar nav and route dispatch pick it up automatically, no other
 * wiring needed.
 */
export const entityRegistry: EntityConfig[] = [
  usersEntityConfig,
  organizationsEntityConfig,
  departmentsEntityConfig,
];

export function getEntityConfig(key: string): EntityConfig | undefined {
  return entityRegistry.find((config) => config.key === key);
}
