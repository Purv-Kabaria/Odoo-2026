"use client";

import { AlertCircle } from "lucide-react";

import { EntityDataTable } from "@/components/tables/entity-data-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getEntityConfig } from "@/lib/entities/registry";
import type { UserRole } from "@prisma/client";

type EntityManagementPageProps = {
  entityKey: string;
  currentUserRole: UserRole;
};

export function EntityManagementPage({
  entityKey,
  currentUserRole,
}: EntityManagementPageProps) {
  const config = getEntityConfig(entityKey);

  if (!config) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Unknown resource</AlertTitle>
          <AlertDescription>
            This management page is not registered in the entity registry.
          </AlertDescription>
        </Alert>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-4 md:px-6 lg:px-8">
      <div className="mb-4 flex flex-col gap-1 sm:mb-5">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Management
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {config.label}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Configure columns, search, filter, sort, select, and mutate{" "}
              {config.label.toLowerCase()} from one optimized table.
            </p>
          </div>
        </div>
      </div>

      <EntityDataTable config={config} currentUserRole={currentUserRole} />
    </main>
  );
}
