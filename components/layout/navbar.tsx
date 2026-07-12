"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Menu, ChevronRight, LogIn, UserPlus, LogOut, Sun, Moon, LayoutDashboard } from "lucide-react"
import Image from "next/image"
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription, SheetHeader } from "@/components/ui/sheet"
import { dashboardHrefForRole } from "@/lib/navigation"
import { useTheme } from "@/components/theme-provider"
import type { NavUser } from "@/types/auth-types"

/**
 * Public-page chrome only (landing, login, signup, forgot/reset password) —
 * authenticated screens use the left sidebar (components/layout/sidebar.tsx)
 * for primary navigation instead. A signed-in user visiting a public page
 * (e.g. the landing page) gets a single "Dashboard" link back into the app
 * rather than a duplicated copy of the sidebar's full nav list.
 */
type NavbarProps = {
  user: NavUser | null
}

export function Navbar({ user }: NavbarProps) {
  const { toggleTheme } = useTheme()
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = React.useState(false)

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" })
      if (!response.ok) {
        throw new Error("Failed to sign out")
      }
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
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
        <div className="flex w-full justify-between items-center">
          <Link href="/" className="flex items-center space-x-2 group cursor-pointer">
            <Image src="/logo.png" alt="AssetFlow" width={28} height={28} className="w-7 h-7 group-hover:opacity-80 transition-opacity" />
            <span className="font-heading font-bold text-lg tracking-tight sm:inline-block">
              AssetFlow
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2">
              {user ? (
                <Button asChild size="sm" className="gap-2 font-medium px-4 cursor-pointer shadow-sm">
                  <Link href={dashboardHrefForRole(user.role)}>
                    <LayoutDashboard className="size-4" />
                    Dashboard
                  </Link>
                </Button>
              ) : (
                <>
                  <Button asChild variant="outline" size="sm" className="font-medium px-4 cursor-pointer shadow-sm">
                    <Link href="/login">Log in</Link>
                  </Button>
                  <Button asChild size="sm" className="font-medium px-4 cursor-pointer shadow-sm">
                    <Link href="/signup">Sign up</Link>
                  </Button>
                </>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="cursor-pointer"
            >
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="sm:hidden cursor-pointer">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle Menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                <SheetHeader>
                  <SheetTitle className="text-left font-heading font-bold text-lg flex items-center gap-2">
                    <Image src="/logo.png" alt="AssetFlow" width={24} height={24} className="w-6 h-6" /> AssetFlow
                  </SheetTitle>
                  <SheetDescription className="sr-only">Site navigation</SheetDescription>
                </SheetHeader>
                <nav className="flex flex-col space-y-3 mt-10 text-sm font-medium">
                  {user ? (
                    <>
                      <Link href={dashboardHrefForRole(user.role)} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-transparent hover:border-border transition-colors cursor-pointer text-foreground/80 hover:text-primary">
                        <LayoutDashboard className="h-4 w-4" />
                        <span className="flex-1">Dashboard</span>
                        <ChevronRight className="h-4 w-4 opacity-50" />
                      </Link>
                      <button
                        type="button"
                        disabled={isLoggingOut}
                        onClick={() => void handleLogout()}
                        className="flex w-full items-center gap-3 p-3 rounded-lg bg-muted/30 border border-transparent hover:border-border transition-colors cursor-pointer text-foreground/80 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <LogOut className="h-4 w-4" />
                        <span className="flex-1 text-left">{isLoggingOut ? "Signing out..." : "Log out"}</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <Link href="/login" className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-transparent hover:border-border transition-colors cursor-pointer text-foreground/80 hover:text-primary">
                        <LogIn className="h-4 w-4" />
                        <span className="flex-1">Log in</span>
                        <ChevronRight className="h-4 w-4 opacity-50" />
                      </Link>
                      <Link href="/signup" className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-transparent hover:border-border transition-colors cursor-pointer text-foreground/80 hover:text-primary">
                        <UserPlus className="h-4 w-4" />
                        <span className="flex-1">Sign up</span>
                        <ChevronRight className="h-4 w-4 opacity-50" />
                      </Link>
                    </>
                  )}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  )
}
