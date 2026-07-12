import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowRight, type LucideIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type RouteStat = {
  label: string
  value: string
  detail: string
}

type RouteLink = {
  href: string
  label: string
}

type RouteShellProps = {
  eyebrow: string
  title: string
  description: string
  badge?: string
  cta?: RouteLink
  secondaryCta?: RouteLink
  stats?: RouteStat[]
  children: ReactNode
  className?: string
}

type ShellCardProps = {
  title: string
  description?: string
  icon?: LucideIcon
  className?: string
  children?: ReactNode
}

function ShellCard({ title, description, icon: Icon, className, children }: ShellCardProps) {
  return (
    <Card className={cn("border-border/70 bg-card/90 shadow-sm backdrop-blur", className)}>
      <CardHeader>
        <div className="flex items-start gap-3">
          {Icon ? (
            <div className="flex size-10 items-center justify-center border border-border bg-primary/10 text-primary">
              <Icon className="size-4" />
            </div>
          ) : null}
          <div className="space-y-1">
            <CardTitle>{title}</CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
        </div>
      </CardHeader>
      {children ? <CardContent>{children}</CardContent> : null}
    </Card>
  )
}

function RouteShell({
  eyebrow,
  title,
  description,
  badge,
  cta,
  secondaryCta,
  stats,
  children,
  className,
}: RouteShellProps) {
  return (
    <section className={cn("relative overflow-hidden bg-background py-10 md:py-14", className)}>
      <div className="absolute inset-x-0 top-0 -z-10 h-40 bg-primary/5" />
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-6 text-center">
          <div className="flex flex-col items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
              {eyebrow}
            </span>
            {badge ? (
              <Badge variant="outline" className="px-3 py-1 text-[11px] uppercase tracking-[0.2em]">
                {badge}
              </Badge>
            ) : null}
          </div>
          <div className="space-y-4">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              {title}
            </h1>
            <p className="mx-auto max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              {description}
            </p>
          </div>
          {(cta || secondaryCta) ? (
            <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              {cta ? (
                <Button asChild className="group">
                  <Link href={cta.href}>
                    {cta.label}
                    <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </Button>
              ) : null}
              {secondaryCta ? (
                <Button asChild variant="outline">
                  <Link href={secondaryCta.href}>{secondaryCta.label}</Link>
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>

        {stats?.length ? (
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {stats.map((stat) => (
              <ShellCard key={stat.label} title={stat.value} description={stat.detail} />
            ))}
          </div>
        ) : null}

        <div className="mt-10">{children}</div>
      </div>
    </section>
  )
}

export { RouteShell, ShellCard }
