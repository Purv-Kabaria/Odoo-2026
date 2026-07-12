import { createItemHandlers } from '@/lib/entities/crud-handlers';
import { productsEntityConfig } from '@/lib/entities/products';

export const { PUT, DELETE } = createItemHandlers(productsEntityConfig);
