import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ListChecks } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { entityRegistry } from "@/lib/entities/registry";
import { canPerform } from "@/lib/entities/types";

export default async function ModeratorPage() {
  const user = await getCurrentUser();

  if (!user) redirect("/login");
  if (user.role !== "ADMIN" && user.role !== "ASSET_MANAGER") redirect("/account");

  const accessibleEntities = entityRegistry.filter((config) =>
    canPerform(config, "read", user.role),
  );

  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-4 md:px-6 lg:px-8">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Asset Manager panel
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Operations
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Review and maintain the records your role can safely manage.
          </p>
        </div>
        <Badge variant="outline" className="w-fit">
          Asset Manager access
        </Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {accessibleEntities.map((config) => (
          <Card key={config.key} size="sm">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle>{config.label}</CardTitle>
                  <CardDescription>
                    Search, filter, sort, select, and update records from one table.
                  </CardDescription>
                </div>
                <ListChecks className="size-4 shrink-0 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {(["create", "update", "delete"] as const).map((action) => (
                <Badge
                  key={action}
                  variant={canPerform(config, action, user.role) ? "secondary" : "outline"}
                >
                  {action}
                </Badge>
              ))}
            </CardContent>
            <div className="border-t border-border p-3">
              <Button asChild size="sm" className="w-full cursor-pointer">
                <Link href={`/${config.key}`}>
                  Open {config.label}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </main>
  );
}
