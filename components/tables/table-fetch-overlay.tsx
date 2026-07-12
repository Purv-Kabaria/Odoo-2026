"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export type TableFetchTrigger =
  | "initial"
  | "search"
  | "pagination"
  | "sort"
  | "filter"
  | "limit"
  | "refresh"

const TRIGGER_LABELS: Record<TableFetchTrigger, string> = {
  initial: "Loading users...",
  search: "Searching...",
  pagination: "Loading page...",
  sort: "Applying sort...",
  filter: "Applying filters...",
  limit: "Updating page size...",
  refresh: "Refreshing...",
}

interface TableFetchOverlayProps {
  isVisible: boolean
  trigger?: TableFetchTrigger | null
  className?: string
}

export function TableFetchOverlay({
  isVisible,
  trigger = "refresh",
  className,
}: TableFetchOverlayProps) {
  const label = trigger ? TRIGGER_LABELS[trigger] : TRIGGER_LABELS.refresh

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className={cn(
            "absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[2px]",
            className
          )}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 4 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col items-center gap-2 border border-border bg-card px-4 py-3 shadow-sm"
          >
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-xs font-medium text-muted-foreground">{label}</span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
