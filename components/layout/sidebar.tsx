"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { toast } from "sonner"
import { Activity, LogOut, Moon, Sun, UserCircle } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useTheme } from "@/components/theme-provider"
import { cn } from "@/lib/utils"
import { roleLabel } from "@/lib/labels"
import { primaryNavigationLinksForRole } from "@/lib/navigation"
import type { NavUser } from "@/types/auth-types"

function initialsFor(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

type SidebarProps = {
  user: NavUser
  /** Rendered inside a Sheet on mobile — hides the desktop-only chrome (logo header stays, since the Sheet supplies its own). */
  variant?: "desktop" | "mobile"
  onNavigate?: () => void
}

/**
 * Primary navigation for every authenticated screen, in the exact fixed
 * order the problem statement's mockup uses: Dashboard, Organization Setup,
 * Assets, Allocation & Transfer, Resource Booking, Maintenance, Audit,
 * Reports, Notifications. See lib/navigation.ts for the role-filtering rules.
 */
export function Sidebar({ user, variant = "desktop", onNavigate }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { toggleTheme } = useTheme()
  const [isLoggingOut, setIsLoggingOut] = React.useState(false)
  const links = primaryNavigationLinksForRole(user.role)

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" })
      if (!response.ok) throw new Error("Failed to sign out")
      toast.success("Signed out")
      router.push("/")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to sign out")
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <div className={cn("flex h-full flex-col bg-sidebar text-sidebar-foreground", variant === "desktop" && "border-r border-sidebar-border")}>
      {variant === "desktop" ? (
        <div className="flex h-16 shrink-0 items-center gap-2 border-b border-sidebar-border px-5">
          <Link href="/" className="flex items-center gap-2 group cursor-pointer">
            <Image src="/logo.png" alt="AssetFlow" width={26} height={26} className="h-[26px] w-[26px] group-hover:opacity-80 transition-opacity" />
            <span className="font-heading font-bold text-base tracking-tight">AssetFlow</span>
          </Link>
        </div>
      ) : null}

      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="flex flex-col gap-1">
          {links.map((link) => {
            const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`)
            return (
              <Link
                key={link.title}
                href={link.href}
                onClick={onNavigate}
                title={link.title}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <link.icon className="size-4 shrink-0" />
                <span className="truncate">{link.title}</span>
              </Link>
            )
          })}
        </nav>
      </ScrollArea>

      <div className="shrink-0 border-t border-sidebar-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 px-2 cursor-pointer"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {initialsFor(user.name)}
              </span>
              <span className="flex min-w-0 flex-1 flex-col items-start text-left">
                <span className="w-full truncate text-sm font-medium">{user.name}</span>
                <Badge variant="outline" className="mt-0.5 h-4 px-1.5 text-[10px] font-normal">
                  {roleLabel(user.role)}
                </Badge>
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-56">
            <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link href="/account">
                <UserCircle className="size-4" />
                Account
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link href="/activity">
                <Activity className="size-4" />
                Activity log
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={toggleTheme} className="cursor-pointer">
              <Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              Toggle theme
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={isLoggingOut}
              onClick={() => void handleLogout()}
              className="cursor-pointer"
            >
              <LogOut className="size-4" />
              {isLoggingOut ? "Signing out..." : "Log out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
