import { createItemHandlers } from '@/lib/entities/crud-handlers';
import { usersEntityConfig } from '@/lib/entities/users';

export const { PUT, DELETE } = createItemHandlers(usersEntityConfig);
