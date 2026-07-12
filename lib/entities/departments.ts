import { DepartmentWriteSchema } from '@/types/entity-types';

import type { EntityConfig } from './types';

export const departmentsEntityConfig: EntityConfig = {
  key: 'departments',
  label: 'Departments',
  singularLabel: 'Department',
  prismaModel: 'department',
  schema: DepartmentWriteSchema,
  defaultSort: { field: 'name', order: 'asc' },
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
    read: ['ADMIN', 'MODERATOR', 'USER'],
    create: ['ADMIN', 'MODERATOR'],
    update: ['ADMIN', 'MODERATOR'],
    delete: ['ADMIN'],
  },
};
