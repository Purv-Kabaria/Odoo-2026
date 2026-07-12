import { Skeleton } from "@/components/ui/skeleton";

export default function ProtectedLoading() {
  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-4 md:px-6 lg:px-8">
      <div className="mb-5 space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </main>
  );
}
