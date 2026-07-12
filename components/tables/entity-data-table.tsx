"use client";

import * as React from "react";
import { Columns3, Eye, Filter, Loader2, MoreHorizontal, Pencil, Plus, Search, SlidersHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { BulkEditModal } from "@/components/modals/bulk-edit-modal";
import { CreateModal } from "@/components/modals/create-modal";
import {
  crudModalButtonClass,
  crudModalFooterClass,
  crudViewFieldsClass,
} from "@/components/modals/crud-modal-styles";
import { DeleteModal } from "@/components/modals/delete-modal";
import { EditModal } from "@/components/modals/edit-modal";
import { FilterModal, type FilterRule } from "@/components/modals/filter-modal";
import { SortModal, type SortRule } from "@/components/modals/sort-modal";
import { ViewModal } from "@/components/modals/view-modal";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CountBadge } from "@/components/ui/count-badge";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { defaultFormValues, EntityForm, valuesFromRow, type EntityFormValues } from "@/components/forms/entity-form";
import { TablePagination } from "@/components/tables/table-pagination";
import {
  searchInputClass,
  tableToolbarButtonClass,
  tableToolbarIconClass,
  tableToolbarTextClass,
} from "@/components/tables/table-toolbar-styles";
import { formatTableDate } from "@/lib/date-format";
import {
  bulkUpdateEntityRows,
  createEntityRow,
  deleteEntityRows,
  fetchEntityRows,
  updateEntityRow,
  type SearchProvider,
} from "@/lib/entities-client";
import { canPerform } from "@/lib/entities/types";
import type { EntityColumn, EntityConfig } from "@/lib/entities/types";
import type { Role } from "@prisma/client";

const SEARCH_DEBOUNCE_MS = 300;

type EntityRow = Record<string, unknown> & { id: string };
type DeleteTarget = { type: "single"; id: string } | { type: "selected" } | { type: "all" };

function storageKey(config: EntityConfig): string {
  return `entity-table-columns:${config.key}`;
}

function defaultVisibleColumns(config: EntityConfig): Set<string> {
  return new Set(config.columns.filter((column) => column.visibleByDefault !== false).map((column) => column.key));
}

function renderCellValue(column: EntityColumn, value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  if (column.format) return column.format(value);
  if (column.type === "date") return formatTableDate(value as string);
  if (column.type === "boolean") return value ? "Yes" : "No";
  if (column.type === "select") {
    const option = column.options?.find((opt) => opt.value === value);
    return option?.label ?? String(value);
  }
  return String(value);
}

type EntityDataTableProps = {
  config: EntityConfig;
  currentUserRole: Role;
};

export function EntityDataTable({ config, currentUserRole }: EntityDataTableProps) {
  const canCreate = canPerform(config, "create", currentUserRole);
  const canUpdate = canPerform(config, "update", currentUserRole);
  const canDelete = canPerform(config, "delete", currentUserRole);

  const [rows, setRows] = React.useState<EntityRow[]>([]);
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(10);
  const [totalPages, setTotalPages] = React.useState(1);
  const [totalRows, setTotalRows] = React.useState(0);
  const [searchProvider, setSearchProvider] = React.useState<SearchProvider>("none");
  const [searchInput, setSearchInput] = React.useState("");
  const [appliedSearch, setAppliedSearch] = React.useState("");
  const [isFetching, setIsFetching] = React.useState(true);

  const [filters, setFilters] = React.useState<FilterRule[]>([]);
  const [sorts, setSorts] = React.useState<SortRule[]>([]);
  const [isFilterModalOpen, setIsFilterModalOpen] = React.useState(false);
  const [isSortModalOpen, setIsSortModalOpen] = React.useState(false);

  const [visibleColumns, setVisibleColumns] = React.useState<Set<string>>(() => defaultVisibleColumns(config));
  React.useEffect(() => {
    let frame = 0;
    try {
      const raw = window.localStorage.getItem(storageKey(config));
      if (!raw) return;
      const parsed = JSON.parse(raw) as string[];
      const validKeys = new Set(config.columns.map((column) => column.key));
      const restored = parsed.filter((key) => validKeys.has(key));
      if (restored.length > 0) {
        frame = window.requestAnimationFrame(() => {
          setVisibleColumns(new Set(restored));
        });
      }
    } catch {
      // Malformed or stale localStorage values fall back to defaults.
    }
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.key]);
  React.useEffect(() => {
    window.localStorage.setItem(storageKey(config), JSON.stringify(Array.from(visibleColumns)));
  }, [config, visibleColumns]);

  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = React.useState<DeleteTarget | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isBulkEditOpen, setIsBulkEditOpen] = React.useState(false);
  const [isBulkEditing, setIsBulkEditing] = React.useState(false);

  const [viewRow, setViewRow] = React.useState<EntityRow | null>(null);
  const [editRow, setEditRow] = React.useState<EntityRow | null>(null);
  const [editValues, setEditValues] = React.useState<EntityFormValues>({});
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [createValues, setCreateValues] = React.useState<EntityFormValues>(() => defaultFormValues(config));
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const loadSequenceRef = React.useRef(0);

  const load = React.useCallback(() => {
    const sequence = loadSequenceRef.current + 1;
    loadSequenceRef.current = sequence;
    setIsFetching(true);
    fetchEntityRows<EntityRow>(config.key, {
      page,
      limit,
      search: appliedSearch,
      filters: filters.map(({ field, operator, value }) => ({ field, operator, value })),
      sorts: sorts.map(({ sortBy, sortOrder }) => ({ sortBy, sortOrder })),
    })
      .then((result) => {
        if (loadSequenceRef.current !== sequence) return;
        setRows(result.rows);
        setTotalPages(result.totalPages);
        setTotalRows(result.totalRows);
        setSearchProvider(result.searchProvider);
        setSelectedIds(new Set());
      })
      .catch((error) => {
        if (loadSequenceRef.current !== sequence) return;
        toast.error(error instanceof Error ? error.message : `Failed to load ${config.label.toLowerCase()}`);
      })
      .finally(() => {
        if (loadSequenceRef.current === sequence) setIsFetching(false);
      });
  }, [config.key, config.label, page, limit, appliedSearch, filters, sorts]);

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(load);
    return () => window.cancelAnimationFrame(frame);
  }, [load]);

  React.useEffect(() => {
    const debounce = window.setTimeout(() => {
      setPage(1);
      setAppliedSearch(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(debounce);
  }, [searchInput]);

  const visibleIds = React.useMemo(() => rows.map((row) => row.id), [rows]);

  const toggleRow = (id: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleAllVisible = (checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const id of visibleIds) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  const toggleColumn = (key: string, checked: boolean) => {
    setVisibleColumns((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(key);
      } else if (next.size > 1) {
        next.delete(key);
      }
      return next;
    });
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await createEntityRow(config.key, createValues);
      toast.success(`${config.singularLabel} created`);
      setIsCreateOpen(false);
      setCreateValues(defaultFormValues(config));
      setPage(1);
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to create ${config.singularLabel.toLowerCase()}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editRow) return;
    setIsSubmitting(true);
    try {
      await updateEntityRow(config.key, editRow.id, editValues);
      toast.success(`${config.singularLabel} updated`);
      setEditRow(null);
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to update ${config.singularLabel.toLowerCase()}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const ids =
        deleteTarget.type === "single"
          ? [deleteTarget.id]
          : deleteTarget.type === "selected"
            ? Array.from(selectedIds)
            : undefined;
      const deleted = await deleteEntityRows(config.key, ids);
      toast.success(`Deleted ${deleted} ${config.label.toLowerCase()} entr${deleted === 1 ? "y" : "ies"}`);
      setDeleteTarget(null);
      setSelectedIds(new Set());
      setPage(1);
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to delete ${config.label.toLowerCase()}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkEdit = async (field: string, value: string | number | boolean | null) => {
    setIsBulkEditing(true);
    try {
      const updated = await bulkUpdateEntityRows(config.key, Array.from(selectedIds), field, value);
      toast.success(`Updated ${updated} ${config.label.toLowerCase()} entr${updated === 1 ? "y" : "ies"}`);
      setIsBulkEditOpen(false);
      setSelectedIds(new Set());
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to update ${config.label.toLowerCase()}`);
    } finally {
      setIsBulkEditing(false);
    }
  };

  const activeColumns = config.columns.filter((column) => visibleColumns.has(column.key));

  const tableColumns: ColumnDef<EntityRow>[] = [
    ...activeColumns.map((column) => ({
      header: column.label,
      cell: (row: EntityRow) => renderCellValue(column, row[column.key]),
    })),
    {
      header: "Actions",
      className: "w-12 text-right",
      cell: (row: EntityRow) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8 cursor-pointer">
              <MoreHorizontal className="size-4" />
              <span className="sr-only">Row actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="cursor-pointer" onClick={() => setViewRow(row)}>
              <Eye className="size-4" /> View
            </DropdownMenuItem>
            {canUpdate ? (
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => {
                  setEditRow(row);
                  setEditValues(valuesFromRow(config, row));
                }}
              >
                <Pencil className="size-4" /> Edit
              </DropdownMenuItem>
            ) : null}
            {canDelete ? (
              <DropdownMenuItem
                variant="destructive"
                className="cursor-pointer"
                onClick={() => setDeleteTarget({ type: "single", id: row.id })}
              >
                <Trash2 className="size-4" /> Delete
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="w-full min-w-0 space-y-4 overflow-hidden">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm">
          {isFetching && appliedSearch ? (
            <Loader2 className={`absolute top-1/2 left-2.5 -translate-y-1/2 animate-spin text-primary ${tableToolbarIconClass}`} />
          ) : (
            <Search className={`absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground ${tableToolbarIconClass}`} />
          )}
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={`Search ${config.label.toLowerCase()}...`}
            className={searchInputClass}
          />
          {searchInput ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSearchInput("")}
              className={`absolute right-0 top-0 h-9 px-2.5 cursor-pointer ${tableToolbarTextClass} text-muted-foreground`}
            >
              Clear
            </Button>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Button type="button" variant="outline" className={tableToolbarButtonClass} onClick={() => setIsFilterModalOpen(true)}>
              <Filter className={tableToolbarIconClass} /> Filters
            </Button>
            <CountBadge count={filters.length} />
          </div>
          <div className="relative">
            <Button type="button" variant="outline" className={tableToolbarButtonClass} onClick={() => setIsSortModalOpen(true)}>
              <SlidersHorizontal className={tableToolbarIconClass} /> Sort
            </Button>
            <CountBadge count={sorts.length} />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" className={tableToolbarButtonClass}>
                <Columns3 className={tableToolbarIconClass} /> Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {config.columns.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.key}
                  checked={visibleColumns.has(column.key)}
                  onCheckedChange={(checked) => toggleColumn(column.key, checked === true)}
                  onSelect={(event) => event.preventDefault()}
                  className="cursor-pointer"
                >
                  {column.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {canCreate ? (
            <Button
              type="button"
              className={tableToolbarButtonClass}
              onClick={() => {
                setCreateValues(defaultFormValues(config));
                setIsCreateOpen(true);
              }}
            >
              <Plus className={tableToolbarIconClass} /> New {config.singularLabel}
            </Button>
          ) : null}
        </div>
      </div>

      {selectedIds.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border border-border bg-muted/30 px-3 py-2">
          <span className={tableToolbarTextClass}>{selectedIds.size} selected</span>
          {canUpdate ? (
            <Button type="button" variant="outline" className={tableToolbarButtonClass} onClick={() => setIsBulkEditOpen(true)}>
              <Pencil className={tableToolbarIconClass} /> Edit selected
            </Button>
          ) : null}
          {canDelete ? (
            <Button
              type="button"
              variant="outline"
              className={tableToolbarButtonClass}
              onClick={() => setDeleteTarget({ type: "selected" })}
            >
              <Trash2 className={tableToolbarIconClass} /> Delete selected
            </Button>
          ) : null}
          <Button type="button" variant="ghost" className={tableToolbarButtonClass} onClick={() => setSelectedIds(new Set())}>
            Clear
          </Button>
        </div>
      ) : canDelete && totalRows > 0 ? (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="destructive"
            className={tableToolbarButtonClass}
            onClick={() => setDeleteTarget({ type: "all" })}
          >
            <Trash2 className={tableToolbarIconClass} /> Delete all
          </Button>
        </div>
      ) : null}

      {appliedSearch ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="border border-border bg-card px-2 py-1">
            Search engine: {searchProvider === "meilisearch" ? "Meilisearch" : searchProvider === "postgres" ? "Postgres fallback" : "Idle"}
          </span>
          {searchProvider === "postgres" ? (
            <span className="text-destructive">Meilisearch is unavailable, so database search is active.</span>
          ) : null}
        </div>
      ) : null}

      <DataTable
        columns={tableColumns}
        data={rows}
        isLoading={isFetching}
        loadingTrigger={appliedSearch ? "search" : "refresh"}
        emptyMessage={`No ${config.label.toLowerCase()} found.`}
        getRowKey={(row) => row.id}
        getRowId={(row) => row.id}
        selectedIds={selectedIds}
        onToggleRow={toggleRow}
        onToggleAllVisible={toggleAllVisible}
      />

      <div className="grid gap-3 md:hidden">
        {isFetching && rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 border border-border bg-card p-8 shadow-sm">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-xs font-medium text-muted-foreground">Loading {config.label.toLowerCase()}...</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex justify-center border border-border bg-card p-8 text-muted-foreground shadow-sm">
            No {config.label.toLowerCase()} found.
          </div>
        ) : (
          rows.map((row) => (
            <div key={row.id} className="border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={selectedIds.has(row.id)}
                  onCheckedChange={(checked) => toggleRow(row.id, checked === true)}
                  aria-label="Select row"
                  className="mt-1 cursor-pointer"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  {activeColumns.map((column) => (
                    <div key={column.key} className="flex justify-between gap-2 text-xs">
                      <span className="text-muted-foreground">{column.label}</span>
                      <span className="truncate font-medium">{renderCellValue(column, row[column.key])}</span>
                    </div>
                  ))}
                  <div className="flex justify-end pt-1">
                    <Button type="button" variant="ghost" size="sm" className="cursor-pointer" onClick={() => setViewRow(row)}>
                      <Eye className="size-4" />
                    </Button>
                    {canUpdate ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="cursor-pointer"
                        onClick={() => {
                          setEditRow(row);
                          setEditValues(valuesFromRow(config, row));
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                    ) : null}
                    {canDelete ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="cursor-pointer text-destructive"
                        onClick={() => setDeleteTarget({ type: "single", id: row.id })}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <TablePagination
        page={page}
        totalPages={totalPages}
        limit={limit}
        totalUsers={totalRows}
        rowsOnPage={rows.length}
        isFetching={isFetching}
        fetchTrigger={appliedSearch ? "search" : "refresh"}
        isDisabled={isFetching || isDeleting}
        onPageChange={setPage}
        onLimitChange={(nextLimit) => {
          setLimit(nextLimit);
          setPage(1);
        }}
      />

      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        entityConfig={config}
        currentFilters={filters}
        onApply={(next) => {
          setFilters(next);
          setPage(1);
        }}
      />

      <SortModal
        isOpen={isSortModalOpen}
        onClose={() => setIsSortModalOpen(false)}
        entityConfig={config}
        currentSorts={sorts}
        onApply={(next) => {
          setSorts(next);
          setPage(1);
        }}
      />

      <BulkEditModal
        isOpen={isBulkEditOpen}
        onClose={() => setIsBulkEditOpen(false)}
        entityConfig={config}
        selectedCount={selectedIds.size}
        onApply={handleBulkEdit}
        isLoading={isBulkEditing}
      />

      <DeleteModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
        title={
          deleteTarget?.type === "all"
            ? `Delete all ${config.label.toLowerCase()}`
            : deleteTarget?.type === "selected"
              ? `Delete selected ${config.label.toLowerCase()}`
              : `Delete ${config.singularLabel.toLowerCase()}`
        }
        description={
          deleteTarget?.type === "all"
            ? `This will permanently delete all ${totalRows} ${config.label.toLowerCase()} entries.`
            : deleteTarget?.type === "selected"
              ? `This will permanently delete ${selectedIds.size} selected ${config.label.toLowerCase()} entries.`
              : `This will permanently delete this ${config.singularLabel.toLowerCase()}.`
        }
        isLoading={isDeleting}
      />

      <ViewModal
        isOpen={viewRow !== null}
        onClose={() => setViewRow(null)}
        title={config.singularLabel}
        description={`Full details for this ${config.singularLabel.toLowerCase()}.`}
      >
        {viewRow ? (
          <div className={crudViewFieldsClass}>
            {config.columns.map((column) => (
              <div key={column.key} className="flex items-center justify-between gap-3">
                <span className="field-label text-muted-foreground">{column.label}</span>
                <span className="field-value font-medium">{renderCellValue(column, viewRow[column.key])}</span>
              </div>
            ))}
          </div>
        ) : null}
      </ViewModal>

      <CreateModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title={`New ${config.singularLabel}`}
        description={`Add a new ${config.singularLabel.toLowerCase()} entry.`}
      >
        <form onSubmit={(event) => void handleCreate(event)} className="space-y-4">
          <EntityForm config={config} values={createValues} onChange={setCreateValues} disabled={isSubmitting} />
          <div className={crudModalFooterClass}>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateOpen(false)}
              disabled={isSubmitting}
              className={`${crudModalButtonClass} w-full sm:w-auto`}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className={`${crudModalButtonClass} w-full sm:ml-2 sm:w-auto`}>
              {isSubmitting ? "Creating..." : "Create"}
            </Button>
          </div>
        </form>
      </CreateModal>

      <EditModal
        isOpen={editRow !== null}
        onClose={() => setEditRow(null)}
        title={`Edit ${config.singularLabel}`}
        description={`Update this ${config.singularLabel.toLowerCase()}.`}
      >
        <form onSubmit={(event) => void handleUpdate(event)} className="space-y-4">
          <EntityForm config={config} values={editValues} onChange={setEditValues} disabled={isSubmitting} />
          <div className={crudModalFooterClass}>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditRow(null)}
              disabled={isSubmitting}
              className={`${crudModalButtonClass} w-full sm:w-auto`}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className={`${crudModalButtonClass} w-full sm:ml-2 sm:w-auto`}>
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </EditModal>
    </div>
  );
}
