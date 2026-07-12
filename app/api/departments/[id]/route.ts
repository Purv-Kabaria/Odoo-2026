import { createItemHandlers } from '@/lib/entities/crud-handlers';
import { departmentsEntityConfig } from '@/lib/entities/departments';

export const { PUT, DELETE } = createItemHandlers(departmentsEntityConfig);
