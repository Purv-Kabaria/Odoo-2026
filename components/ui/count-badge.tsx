import { cn } from "@/lib/utils"

interface CountBadgeProps {
  count: number
  className?: string
}

export function CountBadge({ count, className }: CountBadgeProps) {
  if (count <= 0) return null

  const label = count > 99 ? "99+" : String(count)
  const isWide = label.length > 1

  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute -top-1.5 -right-1.5 flex items-center justify-center rounded-full bg-primary font-bold leading-none text-primary-foreground border-2 border-background",
        isWide ? "h-4 min-w-4 px-1 text-[9px]" : "size-4 text-[10px]",
        className
      )}
    >
      <span className="flex h-full w-full items-center justify-center">{label}</span>
    </span>
  )
}
