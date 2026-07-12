import { createCollectionHandlers } from '@/lib/entities/crud-handlers';
import { departmentsEntityConfig } from '@/lib/entities/departments';

export const { GET, POST, PATCH, DELETE } =
  createCollectionHandlers(departmentsEntityConfig);
