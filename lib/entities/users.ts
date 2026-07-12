import { UserWriteSchema } from '@/types/user-types';

import type { EntityConfig } from './types';

export const usersEntityConfig: EntityConfig = {
  key: 'users',
  label: 'Users',
  singularLabel: 'User',
  prismaModel: 'user',
  schema: UserWriteSchema,
  defaultSort: { field: 'createdAt', order: 'desc' },
  search: { indexEnv: 'MEILISEARCH_USERS_INDEX' },
  columns: [
    {
      key: 'name',
      label: 'Name',
      type: 'text',
      sortable: true,
      searchable: true,
      visibleByDefault: true,
    },
    {
      key: 'email',
      label: 'Email',
      type: 'email',
      sortable: true,
      searchable: true,
      visibleByDefault: true,
    },
    {
      key: 'role',
      label: 'Role',
      type: 'select',
      options: [
        { label: 'Admin', value: 'ADMIN' },
        { label: 'Asset Manager', value: 'ASSET_MANAGER' },
        { label: 'Department Head', value: 'DEPARTMENT_HEAD' },
        { label: 'Employee', value: 'EMPLOYEE' },
      ],
      sortable: true,
      filterable: true,
      searchable: true,
      visibleByDefault: true,
    },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { label: 'Active', value: 'ACTIVE' },
        { label: 'Inactive', value: 'INACTIVE' },
      ],
      sortable: true,
      filterable: true,
      visibleByDefault: true,
    },
    {
      key: 'createdAt',
      label: 'Created',
      type: 'date',
      sortable: true,
      visibleByDefault: true,
      editable: false,
    },
  ],
  permissions: {
    read: ['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD'],
    create: ['ADMIN', 'ASSET_MANAGER'],
    update: ['ADMIN', 'ASSET_MANAGER'],
    delete: ['ADMIN'],
  },
  // Any signed-in Asset Manager can update a user's profile fields, but only an
  // Admin can promote/demote a role — prevents a Moderator from granting
  // themselves (or anyone) Admin access.
  restrictedFields: {
    fields: ['role'],
    allowedRoles: ['ADMIN'],
  },
};
