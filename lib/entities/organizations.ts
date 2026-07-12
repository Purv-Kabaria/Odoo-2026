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
  // An org's own row is its tenant boundary, not a foreign-keyed child of
  // one — scope every operation to "id equals my own orgId" so this table
  // can never list/edit/delete another tenant's organization.
  tenantScope: (orgId) => ({ id: orgId }),
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
    read: ['ADMIN', 'ASSET_MANAGER'],
    // Creating a new org row here is unreachable-by-design once tenantScope
    // is applied (a freshly created row's id can never equal the caller's
    // existing orgId, so it would immediately vanish from every subsequent
    // list/read) and deleting your own org is a catastrophic, irreversible,
    // cross-cutting action that has no business being a generic bulk-select
    // table action — both are intentionally disabled.
    create: [],
    update: ['ADMIN', 'ASSET_MANAGER'],
    delete: [],
  },
};
