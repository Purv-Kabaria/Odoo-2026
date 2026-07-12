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
  CATEGORY_DOT_CLASS,
  CATEGORY_LABELS,
  type NotificationCategoryValue,
  type NotificationView,
} from "@/lib/notification-display";

type TabValue = "ALL" | "ALERT" | "APPROVAL" | "BOOKING";

const TABS: { value: TabValue; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "ALERT", label: "Alerts" },
  { value: "APPROVAL", label: "Approvals" },
  { value: "BOOKING", label: "Bookings" },
];

const PAGE_SIZE = 20;

export function NotificationsPanel() {
  const [tab, setTab] = React.useState<TabValue>("ALL");
  const [notifications, setNotifications] = React.useState<NotificationView[]>([]);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [isLoading, setIsLoading] = React.useState(true);

  const load = React.useCallback(async (currentTab: TabValue, currentPage: number) => {
    setIsLoading(true);
    try {
      const query = new URLSearchParams({ page: String(currentPage), limit: String(PAGE_SIZE) });
      if (currentTab !== "ALL") query.set("category", currentTab);

      const response = await fetch(`/api/notifications?${query.toString()}`, { cache: "no-store" });
      const json = await readApiResponse<{ data?: NotificationView[]; meta?: { totalPages?: number } }>(
        response,
        "Failed to load notifications",
      );

      setNotifications((current) =>
        currentPage === 1 ? (json.data ?? []) : [...current, ...(json.data ?? [])],
      );
      setTotalPages(json.meta?.totalPages ?? 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load notifications");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => void load(tab, 1));
    return () => window.cancelAnimationFrame(frame);
  }, [tab, load]);

  const handleTabChange = (value: string) => {
    setPage(1);
    setTab(value as TabValue);
  };

  // Live updates while the page is open, same stream the navbar bell uses.
  React.useEffect(() => {
    const source = new EventSource("/api/notifications/stream");
    source.onmessage = (event) => {
      try {
        const notification = JSON.parse(event.data) as NotificationView;
        setNotifications((current) => {
          if (tab !== "ALL" && notification.category !== tab) return current;
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
    if (!target || target.readAt) return;

    setNotifications((current) =>
      current.map((item) => (item.id === id ? { ...item, readAt: new Date().toISOString() } : item)),
    );
    try {
      await fetch(`/api/notifications/${id}`, { method: "PATCH" });
    } catch {
      toast.error("Failed to mark as read");
    }
  };

  const markAllRead = async () => {
    setNotifications((current) => current.map((item) => ({ ...item, readAt: new Date().toISOString() })));
    try {
      await fetch("/api/notifications/read-all", { method: "POST" });
      toast.success("All notifications marked read");
    } catch {
      toast.error("Failed to mark all as read");
    }
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    void load(tab, nextPage);
  };

  const unreadCount = notifications.filter((item) => !item.readAt).length;

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
                    notification.readAt
                      ? "bg-transparent"
                      : CATEGORY_DOT_CLASS[notification.category as NotificationCategoryValue]
                  }`}
                />
                <div className="min-w-0">
                  <p
                    className={`truncate text-sm ${notification.readAt ? "text-muted-foreground" : "font-medium text-foreground"}`}
                  >
                    {notification.title}
                  </p>
                  {notification.body ? (
                    <p className="truncate text-xs text-muted-foreground">{notification.body}</p>
                  ) : null}
                </div>
                <Badge variant="outline" className="hidden shrink-0 rounded-none sm:inline-flex">
                  {CATEGORY_LABELS[notification.category as NotificationCategoryValue]}
                </Badge>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatRelativeTime(notification.createdAt)}
              </span>
            </button>
          ))}
        </div>
      )}

      {page < totalPages ? (
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
