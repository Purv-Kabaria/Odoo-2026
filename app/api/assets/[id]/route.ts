import { createItemHandlers } from '@/lib/entities/crud-handlers';
import { assetsEntityConfig } from '@/lib/entities/assets';

export const { PUT, DELETE } = createItemHandlers(assetsEntityConfig);
