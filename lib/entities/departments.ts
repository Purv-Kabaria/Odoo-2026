import { DepartmentWriteSchema } from '@/types/entity-types';

import type { EntityConfig } from './types';

export const departmentsEntityConfig: EntityConfig = {
  key: 'departments',
  label: 'Departments',
  singularLabel: 'Department',
  prismaModel: 'department',
  schema: DepartmentWriteSchema,
  defaultSort: { field: 'name', order: 'asc' },
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
      key: 'headId',
      label: 'Head',
      type: 'text',
      visibleByDefault: true,
      // The API attaches `headName` (resolved via a Prisma `include`) since
      // the raw value here is just an id — see app/api/departments/route.ts.
      format: (value, row) => (value ? ((row?.headName as string | null) ?? 'Unknown') : ''),
    },
    {
      key: 'parentDepartmentId',
      label: 'Parent department',
      type: 'text',
      visibleByDefault: true,
      format: (value, row) => (value ? ((row?.parentDepartmentName as string | null) ?? 'Unknown') : ''),
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
    // No generic POST route exists for departments today (app/api/departments/route.ts
    // only implements GET) — kept restrictive/consistent rather than opening a path
    // that isn't actually wired up.
    create: [],
    update: ['ADMIN', 'ASSET_MANAGER'],
    delete: ['ADMIN'],
  },
};
