import Link from "next/link";
import { Compass } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] items-center justify-center px-4 py-10">
      <section className="w-full max-w-md border border-border bg-card p-5 text-center shadow-sm">
        <div className="mx-auto mb-4 flex size-10 items-center justify-center border border-border bg-primary/10 text-primary">
          <Compass className="size-4" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          The route does not exist or was moved. Return home or use the navigation to keep going.
        </p>
        <Button asChild className="mt-5 cursor-pointer">
          <Link href="/">Back to home</Link>
        </Button>
      </section>
    </main>
  );
}
