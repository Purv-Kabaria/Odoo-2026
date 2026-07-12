import { OrganizationWriteSchema } from '@/types/entity-types';

import type { EntityConfig } from './types';

export const organizationsEntityConfig: EntityConfig = {
  key: 'organizations',
  label: 'Organizations',
  singularLabel: 'Organization',
  prismaModel: 'organization',
  schema: OrganizationWriteSchema,
  defaultSort: { field: 'createdAt', order: 'desc' },
  search: { indexEnv: 'MEILISEARCH_ORGANIZATIONS_INDEX' },
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
      key: 'slug',
      label: 'Slug',
      type: 'text',
      searchable: true,
      visibleByDefault: true,
    },
    {
      key: 'industry',
      label: 'Industry',
      type: 'text',
      filterable: true,
      searchable: true,
      visibleByDefault: true,
    },
    {
      key: 'region',
      label: 'Region',
      type: 'text',
      filterable: true,
      searchable: true,
      visibleByDefault: true,
    },
    {
      key: 'plan',
      label: 'Plan',
      type: 'select',
      options: [
        { label: 'Starter', value: 'STARTER' },
        { label: 'Growth', value: 'GROWTH' },
        { label: 'Enterprise', value: 'ENTERPRISE' },
      ],
      sortable: true,
      filterable: true,
      searchable: true,
      visibleByDefault: true,
    },
    {
      key: 'seats',
      label: 'Seats',
      type: 'number',
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
    read: ['ADMIN', 'ASSET_MANAGER'],
    create: ['ADMIN', 'ASSET_MANAGER'],
    update: ['ADMIN', 'ASSET_MANAGER'],
    delete: ['ADMIN', 'ASSET_MANAGER'],
  },
};
