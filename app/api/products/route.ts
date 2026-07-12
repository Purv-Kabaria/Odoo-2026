import { createCollectionHandlers } from '@/lib/entities/crud-handlers';
import { productsEntityConfig } from '@/lib/entities/products';

export const { GET, POST, PATCH, DELETE } =
  createCollectionHandlers(productsEntityConfig);
