import { createItemHandlers } from '@/lib/entities/crud-handlers';
import { organizationsEntityConfig } from '@/lib/entities/organizations';

export const { PUT, DELETE } = createItemHandlers(organizationsEntityConfig);
