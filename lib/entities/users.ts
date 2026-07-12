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
  tenantScope: (orgId) => ({ orgId }),
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
      // "Pending Approval" is set only by the invite flow and cleared
      // automatically once the invited user sets their password — included
      // here so a pending row still renders/round-trips correctly in the
      // directory table, not as something to hand-pick. The DB's
      // User_password_or_pending_check constraint rejects any attempt to
      // flip a still-passwordless user to Active from this form.
      options: [
        { label: 'Pending Approval', value: 'PENDING_APPROVAL' },
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
    // No generic "create" here — the generic form has no path to a hashed
    // password or an invite token, so it would silently create a
    // permanently-unusable account (PENDING_APPROVAL, no password, no
    // invite link ever sent). Account creation goes through /signup or
    // POST /api/users/invite instead, both of which handle that properly.
    create: [],
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
