import { DepartmentWriteSchema } from '@/types/entity-types';

import type { EntityConfig } from './types';

export const departmentsEntityConfig: EntityConfig = {
  key: 'departments',
  label: 'Departments',
  singularLabel: 'Department',
  prismaModel: 'department',
  schema: DepartmentWriteSchema,
  defaultSort: { field: 'createdAt', order: 'desc' },
  search: { indexEnv: 'MEILISEARCH_DEPARTMENTS_INDEX' },
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
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { label: 'Active', value: 'ACTIVE' },
        { label: 'Inactive', value: 'INACTIVE' },
        { label: 'Archived', value: 'ARCHIVED' },
      ],
      sortable: true,
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
    read: ['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD', 'EMPLOYEE'],
    create: ['ADMIN', 'ASSET_MANAGER'],
    update: ['ADMIN', 'ASSET_MANAGER'],
    delete: ['ADMIN'],
  },
};
