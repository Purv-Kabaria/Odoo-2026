"use client";

import * as React from "react";
import { Activity, Clock, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { readApiResponse } from "@/lib/api-client";
import { formatTableDate } from "@/lib/date-format";
import type { Prisma, Role } from "@prisma/client";

type ActivityEvent = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Prisma.JsonValue | null;
  createdAt: string;
  actor: {
    id: string;
    name: string;
    email: string;
    role: Role;
  } | null;
};

type ActivityResponse = {
  data?: ActivityEvent[];
};

const POLL_INTERVAL_MS = 15000;

/** `action` is a free-text string, either "domain.verb" or "DOMAIN_VERB" (activityLog.create call sites use both) — title-case either for display. */
function actionLabel(action: string): string {
  return action
    .toLowerCase()
    .split(/[._]/)
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

function mergeEvents(current: ActivityEvent[], incoming: ActivityEvent[]): ActivityEvent[] {
  const byId = new Map<string, ActivityEvent>();
  for (const event of [...incoming, ...current]) {
    byId.set(event.id, event);
  }
  return Array.from(byId.values())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
    .slice(0, 50);
}

export function ActivityFeed() {
  const [events, setEvents] = React.useState<ActivityEvent[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [lastLoadedAt, setLastLoadedAt] = React.useState<string | null>(null);
  const lastLoadedAtRef = React.useRef<string | null>(null);

  const loadActivity = React.useCallback(
    async ({ onlyNew = false }: { onlyNew?: boolean } = {}) => {
      if (onlyNew) setIsRefreshing(true);
      else setIsLoading(true);

      try {
        const query = new URLSearchParams({ limit: onlyNew ? "20" : "30" });
        if (onlyNew && lastLoadedAtRef.current) {
          query.set("since", lastLoadedAtRef.current);
        }

        const response = await fetch(`/api/activity?${query.toString()}`, {
          cache: "no-store",
        });
        const json = await readApiResponse<ActivityResponse>(
          response,
          "Failed to load activity",
        );
        const nextEvents = json.data ?? [];

        setEvents((current) => (onlyNew ? mergeEvents(current, nextEvents) : nextEvents));
        const loadedAt = new Date().toISOString();
        lastLoadedAtRef.current = loadedAt;
        setLastLoadedAt(loadedAt);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load activity");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [],
  );

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void loadActivity();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [loadActivity]);

  React.useEffect(() => {
    const interval = window.setInterval(() => {
      void loadActivity({ onlyNew: true });
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [loadActivity]);

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 border border-border bg-card p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Activity className="size-4 text-primary" />
            Activity stream
          </h2>
          <p className="text-xs text-muted-foreground">
            Database-backed change events with lightweight polling refresh.
            {lastLoadedAt ? ` Last checked ${formatTableDate(lastLoadedAt)}.` : ""}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isRefreshing}
          onClick={() => void loadActivity({ onlyNew: true })}
          className="w-full cursor-pointer sm:w-auto"
        >
          <RefreshCw className={isRefreshing ? "size-4 animate-spin" : "size-4"} />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-20" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="flex min-h-44 flex-col items-center justify-center gap-2 border border-dashed border-border bg-muted/20 p-8 text-center">
          <Clock className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No activity yet</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Create, update, delete, upload, or call an LLM route to populate this stream.
          </p>
        </div>
      ) : (
        <div className="grid gap-2">
          {events.map((event) => (
            <article
              key={event.id}
              className="grid gap-2 border border-border bg-card p-3 shadow-sm sm:grid-cols-[1fr_auto]"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    {actionLabel(event.action)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {event.entityType}
                    {event.entityId ? `:${event.entityId.slice(0, 8)}` : ""}
                  </span>
                </div>
                <p className="text-sm font-medium text-foreground">
                  {actionLabel(event.action)} — {event.entityType}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {event.actor ? `${event.actor.name} (${event.actor.role.toLowerCase()})` : "System"}
                </p>
              </div>
              <time className="text-xs text-muted-foreground sm:text-right">
                {formatTableDate(event.createdAt)}
              </time>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
