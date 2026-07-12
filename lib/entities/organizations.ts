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
      key: 'assetSeq',
      label: 'Assets registered',
      type: 'number',
      sortable: true,
      visibleByDefault: true,
      editable: false,
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
    read: ['ADMIN'],
    create: ['ADMIN'],
    update: ['ADMIN'],
    delete: ['ADMIN'],
  },
};
