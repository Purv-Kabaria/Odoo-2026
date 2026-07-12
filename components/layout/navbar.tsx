"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Menu, ChevronRight, LogIn, UserPlus, LogOut, Sun, Moon, LayoutDashboard } from "lucide-react"
import Image from "next/image"
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { dashboardHrefForRole, navigationLinksForRole } from "@/lib/navigation"
import { useTheme } from "@/components/theme-provider"
import type { NavUser } from "@/types/auth-types"

type NavbarProps = {
  user: NavUser | null
}

function initialsFor(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

export function Navbar({ user }: NavbarProps) {
  const { toggleTheme } = useTheme()
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = React.useState(false)
  const roleLinks = user ? navigationLinksForRole(user.role) : []

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
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center space-x-2 group cursor-pointer">
              <Image src="/logo.png" alt="AssetFlow" width={28} height={28} className="w-7 h-7 group-hover:opacity-80 transition-opacity" />
              <span className="font-heading font-bold text-lg tracking-tight sm:inline-block">
                AssetFlow
              </span>
            </Link>
            {user ? (
              <nav className="hidden md:flex items-center space-x-6 text-sm font-medium">
                {roleLinks.map((link) => (
                  <Link key={link.href} href={link.href} className="flex items-center gap-2 transition-colors hover:text-primary text-foreground/70 cursor-pointer">
                    <link.icon className="h-4 w-4" /> {link.title}
                  </Link>
                ))}
              </nav>
            ) : null}
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2">
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 px-3 font-medium shadow-sm cursor-pointer">
                      <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                        {initialsFor(user.name)}
                      </span>
                      {user.name}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <Link href={dashboardHrefForRole(user.role)}>
                        <LayoutDashboard className="size-4" />
                        Dashboard
                      </Link>
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
              className="cursor-pointer md:mr-2"
            >
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden cursor-pointer">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle Menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                <SheetHeader>
                  <SheetTitle className="text-left font-heading font-bold text-lg flex items-center gap-2">
                    <Image src="/logo.png" alt="AssetFlow" width={24} height={24} className="w-6 h-6" /> AssetFlow
                  </SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col space-y-3 mt-10 text-sm font-medium">
                  {user
                    ? roleLinks.map((link) => (
                        <div key={link.href}>
                          <Link href={link.href} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-transparent hover:border-border transition-colors cursor-pointer text-foreground/80 hover:text-primary">
                            <link.icon className="h-4 w-4" />
                            <span className="flex-1">{link.title}</span>
                            <ChevronRight className="h-4 w-4 opacity-50" />
                          </Link>
                        </div>
                      ))
                    : null}

                  <div className="pt-4 mt-4 border-t border-border/40 space-y-3">
                    {user ? (
                      <button
                        type="button"
                        disabled={isLoggingOut}
                        onClick={() => void handleLogout()}
                        className="flex w-full items-center gap-3 p-3 rounded-lg bg-muted/30 border border-transparent hover:border-border transition-colors cursor-pointer text-foreground/80 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <LogOut className="h-4 w-4" />
                        <span className="flex-1 text-left">{isLoggingOut ? "Signing out..." : "Log out"}</span>
                      </button>
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
                  </div>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  )
}
