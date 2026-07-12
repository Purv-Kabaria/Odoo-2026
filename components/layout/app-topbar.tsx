"use client"

import * as React from "react"
import Image from "next/image"
import { Menu } from "lucide-react"

import { Button } from "@/components/ui/button"
import { GlobalSearch } from "@/components/layout/global-search"
import { NotificationBell } from "@/components/layout/notification-bell"
import { Sidebar } from "@/components/layout/sidebar"
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import type { NavUser } from "@/types/auth-types"

type AppTopbarProps = {
  user: NavUser
}

/**
 * Slim utility bar above the main content on every authenticated screen —
 * primary navigation lives in the sidebar, not here. Only carries what
 * doesn't belong in the sidebar: the mobile nav trigger, global search, and
 * live notifications.
 */
export function AppTopbar({ user }: AppTopbarProps) {
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false)

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-3 border-b border-border/40 bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-6">
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <div className="flex items-center gap-2 lg:hidden">
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="cursor-pointer">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle navigation</span>
            </Button>
          </SheetTrigger>
          <Image src="/logo.png" alt="AssetFlow" width={24} height={24} className="h-6 w-6" />
        </div>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">Primary navigation for AssetFlow</SheetDescription>
          <Sidebar user={user} variant="mobile" onNavigate={() => setMobileNavOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex flex-1 items-center justify-end gap-2">
        <GlobalSearch />
        <NotificationBell />
      </div>
    </header>
  )
}
