"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error(JSON.stringify({ level: "error", message: "app.render.failed", digest: error.digest }));
  }, [error.digest]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center px-4 py-10">
      <section className="w-full max-w-md border border-border bg-card p-5 text-center shadow-sm">
        <div className="mx-auto mb-4 flex size-10 items-center justify-center border border-border bg-destructive/10 text-destructive">
          <AlertTriangle className="size-4" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          The page could not be rendered safely. Try again, and check server logs if the issue continues.
        </p>
        <Button type="button" onClick={reset} className="mt-5 cursor-pointer gap-2">
          <RotateCcw className="size-4" />
          Retry
        </Button>
      </section>
    </main>
  );
}
