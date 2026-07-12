import { createCollectionHandlers } from '@/lib/entities/crud-handlers';
import { usersEntityConfig } from '@/lib/entities/users';

export const { GET, POST, PATCH, DELETE } =
  createCollectionHandlers(usersEntityConfig);
