"use client";

import * as React from "react";
import { CheckCheck, ClipboardList } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { readApiResponse } from "@/lib/api-client";
import { formatRelativeTime } from "@/lib/date-format";
import {
  dotClassForType,
  TYPE_TO_FILTER,
  type NotificationFilterValue,
  type NotificationView,
} from "@/lib/notification-display";

type TabValue = "all" | NotificationFilterValue;

const TABS: { value: TabValue; label: string }[] = [
  { value: "all", label: "All" },
  { value: "alerts", label: "Alerts" },
  { value: "approvals", label: "Approvals" },
  { value: "bookings", label: "Bookings" },
];

const PAGE_SIZE = 20;

export function NotificationsPanel() {
  const [tab, setTab] = React.useState<TabValue>("all");
  const [notifications, setNotifications] = React.useState<NotificationView[]>([]);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const load = React.useCallback(async (currentTab: TabValue, cursor?: string) => {
    setIsLoading(true);
    try {
      const query = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (currentTab !== "all") query.set("filter", currentTab);
      if (cursor) query.set("cursor", cursor);

      const response = await fetch(`/api/notifications?${query.toString()}`, { cache: "no-store" });
      const json = await readApiResponse<{ data?: NotificationView[]; meta?: { nextCursor?: string | null } }>(
        response,
        "Failed to load notifications",
      );

      setNotifications((current) => (cursor ? [...current, ...(json.data ?? [])] : (json.data ?? [])));
      setNextCursor(json.meta?.nextCursor ?? null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load notifications");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => void load(tab));
    return () => window.cancelAnimationFrame(frame);
  }, [tab, load]);

  const handleTabChange = (value: string) => {
    setTab(value as TabValue);
  };

  // Live updates while the page is open, same stream the navbar bell uses.
  React.useEffect(() => {
    const source = new EventSource("/api/notifications/stream");
    source.onmessage = (event) => {
      try {
        const notification = JSON.parse(event.data) as NotificationView;
        setNotifications((current) => {
          if (tab !== "all" && TYPE_TO_FILTER[notification.type] !== tab) return current;
          return [notification, ...current];
        });
      } catch {
        // Ignore malformed frames.
      }
    };
    return () => source.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markRead = async (id: string) => {
    const target = notifications.find((item) => item.id === id);
    if (!target || target.isRead) return;

    setNotifications((current) =>
      current.map((item) => (item.id === id ? { ...item, isRead: true } : item)),
    );
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    } catch {
      toast.error("Failed to mark as read");
    }
  };

  const markAllRead = async () => {
    setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
    try {
      await fetch("/api/notifications/read-all", { method: "POST" });
      toast.success("All notifications marked read");
    } catch {
      toast.error("Failed to mark all as read");
    }
  };

  const loadMore = () => {
    if (nextCursor) void load(tab, nextCursor);
  };

  const unreadCount = notifications.filter((item) => !item.isRead).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={tab} onValueChange={handleTabChange}>
          <TabsList>
            {TABS.map((item) => (
              <TabsTrigger key={item.value} value={item.value} className="cursor-pointer">
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {unreadCount > 0 ? (
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer gap-1.5 rounded-none"
            onClick={() => void markAllRead()}
          >
            <CheckCheck className="size-4" />
            Mark all read
          </Button>
        ) : null}
      </div>

      {isLoading && notifications.length === 0 ? (
        <div className="grid gap-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-14 rounded-none" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex min-h-56 flex-col items-center justify-center gap-2 border border-dashed border-border bg-muted/20 p-8 text-center">
          <ClipboardList className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No notifications</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            You&apos;ll see asset, audit, and workflow updates here as they happen.
          </p>
        </div>
      ) : (
        <div className="border border-border bg-card">
          {notifications.map((notification, index) => (
            <button
              key={notification.id}
              type="button"
              onClick={() => void markRead(notification.id)}
              className={`flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/40 ${
                index !== notifications.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className={`size-2 shrink-0 rounded-full ${
                    notification.isRead ? "bg-transparent" : dotClassForType(notification.type)
                  }`}
                />
                <div className="min-w-0">
                  <p
                    className={`truncate text-sm ${notification.isRead ? "text-muted-foreground" : "font-medium text-foreground"}`}
                  >
                    {notification.title}
                  </p>
                  {notification.body ? (
                    <p className="truncate text-xs text-muted-foreground">{notification.body}</p>
                  ) : null}
                </div>
                {TYPE_TO_FILTER[notification.type] ? (
                  <Badge variant="outline" className="hidden shrink-0 rounded-none sm:inline-flex">
                    {TYPE_TO_FILTER[notification.type]}
                  </Badge>
                ) : null}
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatRelativeTime(notification.createdAt)}
              </span>
            </button>
          ))}
        </div>
      )}

      {nextCursor ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer rounded-none"
            disabled={isLoading}
            onClick={loadMore}
          >
            {isLoading ? "Loading…" : "Load more"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
