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
        { label: 'Moderator', value: 'MODERATOR' },
        { label: 'User', value: 'USER' },
      ],
      sortable: true,
      filterable: true,
      searchable: true,
      visibleByDefault: true,
    },
    {
      key: 'location',
      label: 'Location',
      type: 'text',
      filterable: true,
      searchable: true,
      visibleByDefault: false,
    },
    {
      key: 'gender',
      label: 'Gender',
      type: 'select',
      options: [
        { label: 'Male', value: 'Male' },
        { label: 'Female', value: 'Female' },
        { label: 'Other', value: 'Other' },
      ],
      filterable: true,
      searchable: true,
      visibleByDefault: false,
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
    read: ['ADMIN', 'MODERATOR'],
    create: ['ADMIN', 'MODERATOR'],
    update: ['ADMIN', 'MODERATOR'],
    delete: ['ADMIN'],
  },
  // Any signed-in Moderator can update a user's profile fields, but only an
  // Admin can promote/demote a role — prevents a Moderator from granting
  // themselves (or anyone) Admin access.
  restrictedFields: {
    fields: ['role'],
    allowedRoles: ['ADMIN'],
  },
};
