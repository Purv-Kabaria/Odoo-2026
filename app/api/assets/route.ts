import { createCollectionHandlers } from '@/lib/entities/crud-handlers';
import { assetsEntityConfig } from '@/lib/entities/assets';

export const { GET, POST, PATCH, DELETE } =
  createCollectionHandlers(assetsEntityConfig);
