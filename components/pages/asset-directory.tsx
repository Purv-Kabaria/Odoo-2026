"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { QrScannerModal } from "@/components/modals/qr-scanner-modal";

import { AssetFormModal } from "@/components/modals/asset-form-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TablePagination } from "@/components/tables/table-pagination";
import { readApiResponse } from "@/lib/api-client";
import { humanizeEnum } from "@/lib/labels";

type AssetRow = {
  id: string;
  assetTag: string;
  name: string;
  status: string;
  location: string | null;
  isBookable: boolean;
  condition: string;
  category: { id: string; name: string };
};

type Category = { id: string; name: string };

const STATUS_OPTIONS = ["AVAILABLE", "ALLOCATED", "RESERVED", "UNDER_MAINTENANCE", "LOST", "RETIRED", "DISPOSED"];

export function AssetDirectory({ canRegister }: { canRegister: boolean }) {
  const [rows, setRows] = React.useState<AssetRow[]>([]);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(10);
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [status, setStatus] = React.useState<string>("all");
  const [category, setCategory] = React.useState<string>("all");
  const [isLoading, setIsLoading] = React.useState(true);
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  React.useEffect(() => {
    fetch("/api/categories")
      .then((res) => readApiResponse<{ data: Category[] }>(res, "Failed to load categories"))
      .then((json) => setCategories(json.data))
      .catch(() => undefined);
  }, []);

  const loadAssets = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (status !== "all") params.set("status", status);
      if (category !== "all") params.set("category", category);

      const response = await fetch(`/api/assets?${params.toString()}`, { cache: "no-store" });
      const json = await readApiResponse<{ data: AssetRow[]; meta?: { total: number } }>(
        response,
        "Failed to load assets",
      );
      setRows(json.data);
      setTotal(json.meta?.total ?? json.data.length);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load assets");
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, debouncedSearch, status, category]);

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void loadAssets();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loadAssets]);

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => setPage(1));
    return () => window.cancelAnimationFrame(frame);
  }, [debouncedSearch, status, category]);

  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-4 md:px-6 lg:px-8">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Assets</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Asset Directory</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Register assets and track them centrally by tag, serial, category, and status.
          </p>
        </div>
        {canRegister && (
          <Button className="w-fit cursor-pointer" onClick={() => setIsModalOpen(true)}>
            <Plus className="size-4" />
            Register asset
          </Button>
        )}
      </div>

      <div className="mb-4 flex flex-col gap-2 border border-border bg-card p-3 shadow-sm sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by tag, serial, or name..."
              className="pl-8"
            />
          </div>
          <QrScannerModal
            onScanSuccess={(tag) => {
              setSearch(tag);
              toast.success(`Scanned: ${tag}`);
            }}
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-full cursor-pointer sm:w-44"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full cursor-pointer sm:w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>{humanizeEnum(s)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border border-border bg-card shadow-sm">
        {isLoading ? (
          <div className="grid gap-2 p-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex min-h-40 flex-col items-center justify-center gap-2 p-8 text-center">
            <p className="text-sm font-medium">No assets found</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              {canRegister ? "Register your first asset to get started." : "No assets match your filters."}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tag</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Location</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((asset) => (
                <TableRow key={asset.id} className="cursor-pointer">
                  <TableCell>
                    <Link href={`/assets/${asset.id}`} className="font-medium text-primary hover:underline">
                      {asset.assetTag}
                    </Link>
                  </TableCell>
                  <TableCell>{asset.name}</TableCell>
                  <TableCell>{asset.category.name}</TableCell>
                  <TableCell><StatusBadge kind="assetStatus" status={asset.status} /></TableCell>
                  <TableCell className="text-muted-foreground">{asset.location ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <div className="p-3">
          <TablePagination
            page={page}
            totalPages={Math.max(1, Math.ceil(total / limit))}
            limit={limit}
            totalUsers={total}
            rowsOnPage={rows.length}
            isFetching={isLoading}
            fetchTrigger={null}
            onPageChange={setPage}
            onLimitChange={(next) => { setLimit(next); setPage(1); }}
          />
        </div>
      </div>

      <AssetFormModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        categories={categories}
        onCreated={() => { setIsModalOpen(false); void loadAssets(); }}
      />
    </main>
  );
}
