import type { SearchableEntity } from "./types";

/**
 * Columns metadata only, for Meilisearch indexing reuse via
 * `lib/meilisearch.ts` — Assets aren't registered in `entityRegistry`
 * since create/update need bespoke logic (tag generation, custom-field
 * validation) the generic CRUD engine can't express.
 */
export const assetSearchConfig: SearchableEntity = {
  key: "assets",
  search: { indexEnv: "MEILISEARCH_ASSETS_INDEX" },
  columns: [
    { key: "name", label: "Name", type: "text", searchable: true, sortable: true },
    { key: "assetTag", label: "Tag", type: "text", searchable: true, sortable: true },
    { key: "serialNumber", label: "Serial", type: "text", searchable: true },
    { key: "status", label: "Status", type: "select", filterable: true, sortable: true, options: [] },
    { key: "location", label: "Location", type: "text", filterable: true },
    { key: "createdAt", label: "Created", type: "date", sortable: true },
  ],
};
