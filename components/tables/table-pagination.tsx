"use client"

import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  pageSizeTriggerClass,
  selectContentMatchTriggerClass,
  tableControlColumnWidthClass,
  tableToolbarSelectItemClass,
  tableToolbarTextClass,
} from "@/components/tables/table-toolbar-styles"
import type { TableFetchTrigger } from "@/components/tables/table-fetch-overlay"

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const

interface TablePaginationProps {
  page: number
  totalPages: number
  limit: number
  totalUsers: number
  rowsOnPage: number
  isFetching: boolean
  fetchTrigger: TableFetchTrigger | null
  isDisabled?: boolean
  onPageChange: (page: number) => void
  onLimitChange: (limit: number) => void
}

export function TablePagination({
  page,
  totalPages,
  limit,
  totalUsers,
  rowsOnPage,
  isFetching,
  fetchTrigger,
  isDisabled = false,
  onPageChange,
  onLimitChange,
}: TablePaginationProps) {
  const safeTotalPages = Math.max(1, totalPages)
  const isPaginationLoading = isFetching && fetchTrigger === "pagination"
  const controlsDisabled = isDisabled || isFetching

  const rangeStart = totalUsers === 0 ? 0 : (page - 1) * limit + 1
  const rangeEnd = totalUsers === 0 ? 0 : Math.min(page * limit, totalUsers)

  const isFirstPage = page <= 1
  const isLastPage = page >= safeTotalPages || totalUsers === 0

  const goToPrevious = () => onPageChange(Math.max(1, page - 1))
  const goToNext = () => onPageChange(Math.min(safeTotalPages, page + 1))

  return (
    <div className="w-full min-w-0 space-y-2 border-t border-border pt-3 sm:space-y-3 sm:pt-4">
      <p className="w-full min-w-0 text-center text-xs leading-snug text-muted-foreground sm:text-left sm:text-sm">
        {isFetching ? (
          <span className="inline-flex items-center justify-center gap-2 sm:justify-start">
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
            <span>Updating results...</span>
          </span>
        ) : (
          <span className="block truncate sm:inline">
            Showing{" "}
            <span className="font-medium text-foreground">{rangeStart}</span>
            {"–"}
            <span className="font-medium text-foreground">{rangeEnd}</span> of{" "}
            <span className="font-medium text-foreground">{totalUsers}</span>
            {rowsOnPage === 1 ? " entry" : " entries"}
          </span>
        )}
      </p>

      <div className="flex w-full min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <label
            htmlFor="users-page-size"
            className={`shrink-0 ${tableToolbarTextClass} text-muted-foreground`}
          >
            <span className="sm:hidden">Per page</span>
            <span className="hidden sm:inline">Rows per page</span>
          </label>
          <div className={tableControlColumnWidthClass}>
            <Select
              value={limit.toString()}
              onValueChange={(value) => onLimitChange(Number(value))}
              disabled={controlsDisabled}
            >
              <SelectTrigger
                id="users-page-size"
                aria-label="Rows per page"
                className={pageSizeTriggerClass}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                className={selectContentMatchTriggerClass}
                position="popper"
                sideOffset={4}
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem
                    key={size}
                    value={size.toString()}
                    className={tableToolbarSelectItemClass}
                  >
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <nav
          aria-label="Table pagination"
          className="flex shrink-0 items-center gap-1"
        >
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={goToPrevious}
            disabled={isFirstPage || controlsDisabled}
            aria-label="Go to previous page"
            className={cn(
              "size-9 shrink-0 cursor-pointer rounded-none sm:w-auto sm:px-2.5",
              "disabled:pointer-events-none disabled:opacity-50"
            )}
          >
            {isPaginationLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 sm:mr-1" aria-hidden />
                <span className={`hidden sm:inline ${tableToolbarTextClass}`}>Previous</span>
              </>
            )}
          </Button>

          <span
            className={`min-w-13 shrink-0 px-2 text-center tabular-nums text-muted-foreground sm:min-w-14 ${tableToolbarTextClass}`}
            aria-live="polite"
            aria-atomic="true"
          >
            <span className="text-foreground">{page}</span>
            <span className="mx-0.5 text-muted-foreground/80">/</span>
            <span>{safeTotalPages}</span>
          </span>

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={goToNext}
            disabled={isLastPage || controlsDisabled}
            aria-label="Go to next page"
            className={cn(
              "size-9 shrink-0 cursor-pointer rounded-none sm:w-auto sm:px-2.5",
              "disabled:pointer-events-none disabled:opacity-50"
            )}
          >
            {isPaginationLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <span className={`hidden sm:inline ${tableToolbarTextClass}`}>Next</span>
                <ChevronRight className="h-4 w-4 sm:ml-1" aria-hidden />
              </>
            )}
          </Button>
        </nav>
      </div>
    </div>
  )
}
