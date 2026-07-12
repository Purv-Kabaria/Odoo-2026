import { organizationsEntityConfig } from './organizations';
import { productsEntityConfig } from './products';
import type { EntityConfig } from './types';
import { usersEntityConfig } from './users';

/**
 * Every entity the admin/moderator panels know about. Add a new entity by
 * defining its config (see users.ts/products.ts for the pattern) and
 * appending it here — the sidebar nav and route dispatch pick it up
 * automatically, no other wiring needed.
 */
export const entityRegistry: EntityConfig[] = [
  usersEntityConfig,
  productsEntityConfig,
  organizationsEntityConfig,
];

export function getEntityConfig(key: string): EntityConfig | undefined {
  return entityRegistry.find((config) => config.key === key);
}
