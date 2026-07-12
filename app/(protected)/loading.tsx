import { Skeleton } from "@/components/ui/skeleton";

export default function ProtectedLoading() {
  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-4 md:px-6 lg:px-8">
      <div className="mb-5 space-y-2">
        <Skeleton className="h-3 w-32 rounded-none" />
        <Skeleton className="h-8 w-56 rounded-none" />
        <Skeleton className="h-4 w-full max-w-xl rounded-none" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-10 w-full rounded-none" />
        <Skeleton className="h-72 w-full rounded-none" />
        <Skeleton className="h-10 w-full rounded-none" />
      </div>
    </main>
  );
}
