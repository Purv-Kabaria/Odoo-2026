import { ProductWriteSchema } from '@/types/entity-types';

import type { EntityConfig } from './types';

export const productsEntityConfig: EntityConfig = {
  key: 'products',
  label: 'Products',
  singularLabel: 'Product',
  prismaModel: 'product',
  schema: ProductWriteSchema,
  defaultSort: { field: 'createdAt', order: 'desc' },
  search: { indexEnv: 'MEILISEARCH_PRODUCTS_INDEX' },
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
      key: 'sku',
      label: 'SKU',
      type: 'text',
      sortable: true,
      searchable: true,
      visibleByDefault: true,
    },
    {
      key: 'category',
      label: 'Category',
      type: 'text',
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
        { label: 'Draft', value: 'DRAFT' },
        { label: 'Archived', value: 'ARCHIVED' },
      ],
      sortable: true,
      filterable: true,
      searchable: true,
      visibleByDefault: true,
    },
    {
      key: 'priceCents',
      label: 'Price (cents)',
      type: 'number',
      sortable: true,
      visibleByDefault: true,
      format: (value) => `$${(Number(value) / 100).toFixed(2)}`,
    },
    {
      key: 'stock',
      label: 'Stock',
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
    read: ['ADMIN', 'MODERATOR'],
    create: ['ADMIN', 'MODERATOR'],
    update: ['ADMIN', 'MODERATOR'],
    delete: ['ADMIN', 'MODERATOR'],
  },
};
