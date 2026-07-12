import { redirect } from "next/navigation";

import { StorageManager } from "@/components/pages/storage-manager";
import { getCurrentUser } from "@/lib/auth";

export default async function StoragePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-4 md:px-6 lg:px-8">
      <div className="mb-5 space-y-1">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Storage
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Objects
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Store and retrieve files through a local S3-compatible object store.
        </p>
      </div>
      <StorageManager />
    </main>
  );
}
