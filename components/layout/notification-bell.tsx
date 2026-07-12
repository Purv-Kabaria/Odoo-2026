"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { readApiResponse } from "@/lib/api-client";
import { formatRelativeTime } from "@/lib/date-format";
import { dotClassForType, type NotificationView } from "@/lib/notification-display";

const RECENT_LIMIT = 8;

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [recent, setRecent] = React.useState<NotificationView[]>([]);

  React.useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch("/api/notifications/unread-count", { cache: "no-store" });
        const json = await readApiResponse<{ data?: { count: number } }>(
          response,
          "Failed to load notifications",
        );
        if (!cancelled) setUnreadCount(json.data?.count ?? 0);
      } catch {
        // Silent — the bell just starts at 0 if this fails.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    const source = new EventSource("/api/notifications/stream");

    source.onmessage = (event) => {
      try {
        const notification = JSON.parse(event.data) as NotificationView;
        setRecent((current) => [notification, ...current].slice(0, RECENT_LIMIT));
        setUnreadCount((current) => current + 1);
        toast(notification.title, { description: notification.body ?? undefined });
      } catch {
        // Ignore malformed frames (e.g. a stray heartbeat comment slipping through).
      }
    };

    return () => source.close();
  }, []);

  const markOneRead = async (id: string) => {
    const target = recent.find((item) => item.id === id);
    if (!target || target.isRead) return;

    setRecent((current) =>
      current.map((item) => (item.id === id ? { ...item, isRead: true } : item)),
    );
    setUnreadCount((current) => Math.max(0, current - 1));

    try {
      await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    } catch {
      // Best-effort — the panel/next SSE refresh will reconcile state.
    }
  };

  const markAllRead = async () => {
    setRecent((current) => current.map((item) => ({ ...item, readAt: new Date().toISOString() })));
    setUnreadCount(0);
    try {
      await fetch("/api/notifications/read-all", { method: "POST" });
    } catch {
      toast.error("Failed to mark all as read");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative cursor-pointer rounded-none">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 ? (
            <Badge className="absolute -top-1 -right-1 h-4 min-w-4 justify-center rounded-full px-1 text-[10px]">
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          ) : null}
          <span className="sr-only">Notifications</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          {unreadCount > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 cursor-pointer gap-1 rounded-none px-1.5 text-xs"
              onClick={() => void markAllRead()}
            >
              <CheckCheck className="size-3.5" />
              Mark all read
            </Button>
          ) : null}
        </div>
        <DropdownMenuSeparator />
        {recent.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">No notifications yet</p>
        ) : (
          recent.map((notification) => (
            <DropdownMenuItem
              key={notification.id}
              className="flex cursor-pointer items-start gap-2 whitespace-normal py-2"
              onClick={() => void markOneRead(notification.id)}
            >
              <span
                className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
                  notification.isRead ? "bg-transparent" : dotClassForType(notification.type)
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-foreground">{notification.title}</p>
                <p className="text-[11px] text-muted-foreground">
                  {formatRelativeTime(notification.createdAt)}
                </p>
              </div>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="cursor-pointer justify-center text-xs">
          <Link href="/notifications">View all</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
