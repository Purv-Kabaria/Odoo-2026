import { createCollectionHandlers } from '@/lib/entities/crud-handlers';
import { organizationsEntityConfig } from '@/lib/entities/organizations';

export const { GET, POST, PATCH, DELETE } = createCollectionHandlers(
  organizationsEntityConfig,
);
