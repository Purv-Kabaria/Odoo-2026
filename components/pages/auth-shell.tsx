import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowLeft, ShieldCheck } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type AuthShellProps = {
  title: string
  description: string
  badge: string
  eyebrow?: string
  footerHref: string
  footerLabel: string
  children: ReactNode
  className?: string
}

function AuthShell({ title, description, badge, eyebrow, footerHref, footerLabel, children, className }: AuthShellProps) {
  return (
    <section className={cn("relative overflow-hidden bg-background py-10 md:py-14", className)}>
      <div className="absolute inset-x-0 top-0 -z-10 h-40 bg-primary/5" />
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 sm:px-6 lg:px-8 lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="space-y-6">
          {eyebrow ? (
            <span className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              {eyebrow}
            </span>
          ) : null}
          <Badge variant="outline" className="px-3 py-1 text-[11px] uppercase tracking-[0.2em]">
            {badge}
          </Badge>
          <div className="space-y-4">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              {title}
            </h1>
            <p className="max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
              {description}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card/80 p-4 shadow-sm backdrop-blur">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-primary/10 text-primary">
                <ShieldCheck className="size-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Security first</p>
                <p className="text-xs text-muted-foreground">Minimal client surface and clear server boundaries.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card/80 p-4 shadow-sm backdrop-blur">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-primary/10 text-primary">
                <ShieldCheck className="size-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Fast by default</p>
                <p className="text-xs text-muted-foreground">Server-rendered pages with no unnecessary data fetching.</p>
              </div>
            </div>
          </div>

          <Button asChild variant="outline" className="group w-fit">
            <Link href={footerHref}>
              <ArrowLeft className="mr-2 size-4 transition-transform group-hover:-translate-x-0.5" />
              {footerLabel}
            </Link>
          </Button>
        </div>

        <Card className="border-border/70 bg-card/95 shadow-sm backdrop-blur">
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </div>
    </section>
  )
}

export { AuthShell }
