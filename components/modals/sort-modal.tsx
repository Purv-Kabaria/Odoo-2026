import * as React from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowDown, ArrowUp, Plus, Trash2, GripVertical } from "lucide-react"
import { toast } from "sonner"
import { validateSortRules } from "@/lib/entities/query"
import { sortableColumns } from "@/lib/entities/types"
import type { EntityConfig } from "@/lib/entities/types"

export interface SortRule {
  id: string
  sortBy: string
  sortOrder: "asc" | "desc"
}

interface SortModalProps {
  isOpen: boolean
  onClose: () => void
  entityConfig: EntityConfig
  currentSorts: SortRule[]
  onApply: (sorts: SortRule[]) => void
}

function buildInitialSorts(currentSorts: SortRule[], defaultField: string): SortRule[] {
  if (currentSorts.length > 0) {
    return [...currentSorts]
  }
  return [
    {
      id: crypto.randomUUID(),
      sortBy: defaultField,
      sortOrder: "desc",
    },
  ]
}

function sortDraftKey(currentSorts: SortRule[]): string {
  if (currentSorts.length === 0) return "empty"
  return currentSorts
    .map((s) => `${s.id}:${s.sortBy}:${s.sortOrder}`)
    .join("|")
}

interface SortModalContentProps {
  onClose: () => void
  entityConfig: EntityConfig
  currentSorts: SortRule[]
  onApply: (sorts: SortRule[]) => void
}

function SortModalContent({
  onClose,
  entityConfig,
  currentSorts,
  onApply,
}: SortModalContentProps) {
  const columns = sortableColumns(entityConfig)
  const [sorts, setSorts] = React.useState<SortRule[]>(() =>
    buildInitialSorts(currentSorts, entityConfig.defaultSort.field)
  )
  const [validationError, setValidationError] = React.useState<string | null>(null)

  const maxSortRules = columns.length
  const usedSortFields = new Set(sorts.map((s) => s.sortBy))

  const handleAddSort = () => {
    if (sorts.length >= maxSortRules) {
      toast.error("Every sortable column already has a rule.")
      return
    }

    const nextField = columns.find((col) => !usedSortFields.has(col.key))
    if (!nextField) {
      toast.error("No more columns available to sort.")
      return
    }

    setSorts([
      ...sorts,
      {
        id: crypto.randomUUID(),
        sortBy: nextField.key,
        sortOrder: "asc",
      },
    ])
    setValidationError(null)
  }

  const handleRemoveSort = (id: string) => {
    setSorts(sorts.filter((s) => s.id !== id))
    setValidationError(null)
  }

  const handleUpdateSort = (id: string, field: keyof SortRule, value: string) => {
    if (field === "sortBy") {
      const duplicate = sorts.some((s) => s.id !== id && s.sortBy === value)
      if (duplicate) {
        const message = `"${value}" is already used in another sort rule.`
        setValidationError(message)
        toast.error(message)
        return
      }
    }

    setSorts(sorts.map((s) => (s.id === id ? { ...s, [field]: value } : s)))
    setValidationError(null)
  }

  const handleApply = () => {
    const payload = sorts
      .filter((s) => s.sortBy)
      .map(({ sortBy, sortOrder }) => ({ sortBy, sortOrder }))

    const result = validateSortRules(entityConfig, payload)

    if (!result.success) {
      setValidationError(result.error)
      toast.error(result.error)
      return
    }

    onApply(
      result.data.map((rule) => ({
        ...rule,
        id: crypto.randomUUID(),
      }))
    )
    onClose()
  }

  const handleClear = () => {
    setSorts([])
    setValidationError(null)
  }

  return (
    <DialogContent className="w-[95vw] sm:max-w-[600px] p-0 sm:w-full overflow-visible">
      <div className="p-6">
        <DialogHeader className="mb-6">
          <DialogTitle>Advanced Sorting</DialogTitle>
          <DialogDescription>
            Rules apply top to bottom. Each column can only be sorted once, in one direction.
          </DialogDescription>
        </DialogHeader>

        {validationError && (
          <div className="mb-4 border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {validationError}
          </div>
        )}

        <div className="flex flex-col gap-3">
          {sorts.length === 0 && (
            <div className="text-center p-8 border border-dashed border-border text-muted-foreground text-sm bg-muted/20">
              No sort rules. Add a rule or apply to use the default order.
            </div>
          )}

          {sorts.map((sort) => {
            const takenByOthers = new Set(
              sorts.filter((s) => s.id !== sort.id).map((s) => s.sortBy)
            )

            return (
              <div
                key={sort.id}
                className="flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-muted/30 p-3 border border-border group relative"
              >
                <div className="hidden sm:flex items-center text-muted-foreground cursor-grab active:cursor-grabbing">
                  <GripVertical className="h-4 w-4" />
                </div>

                <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-center">
                  <Select
                    value={sort.sortBy}
                    onValueChange={(val) => handleUpdateSort(sort.id, "sortBy", val)}
                  >
                    <SelectTrigger className="w-full bg-background shadow-sm h-9 cursor-pointer">
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      {columns.map((col) => (
                        <SelectItem
                          key={col.key}
                          value={col.key}
                          disabled={takenByOthers.has(col.key)}
                          className="cursor-pointer"
                        >
                          {col.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="flex gap-1 w-full sm:w-auto">
                    <Button
                      variant={sort.sortOrder === "asc" ? "default" : "outline"}
                      size="sm"
                      className="flex-1 sm:flex-none shadow-sm h-9 px-3 cursor-pointer"
                      onClick={() => handleUpdateSort(sort.id, "sortOrder", "asc")}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={sort.sortOrder === "desc" ? "default" : "outline"}
                      size="sm"
                      className="flex-1 sm:flex-none shadow-sm h-9 px-3 cursor-pointer"
                      onClick={() => handleUpdateSort(sort.id, "sortOrder", "desc")}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive cursor-pointer ml-1"
                      onClick={() => handleRemoveSort(sort.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <Button
          variant="outline"
          className="w-full mt-4 border-dashed border-2 cursor-pointer h-10"
          onClick={handleAddSort}
          disabled={sorts.length >= maxSortRules}
        >
          <Plus className="mr-2 h-4 w-4" /> Add Sort Level
        </Button>
      </div>

      <div className="bg-muted/50 p-4 border-t border-border flex flex-row justify-between items-center">
        <Button
          type="button"
          variant="ghost"
          onClick={handleClear}
          className="cursor-pointer text-muted-foreground hover:text-foreground"
        >
          Clear All
        </Button>
        <div className="flex flex-row justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="cursor-pointer flex-1 sm:flex-none"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleApply}
            className="cursor-pointer flex-1 sm:flex-none ml-2"
          >
            Apply Rules
          </Button>
        </div>
      </div>
    </DialogContent>
  )
}

export function SortModal({
  isOpen,
  onClose,
  entityConfig,
  currentSorts,
  onApply,
}: SortModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      {isOpen ? (
        <SortModalContent
          key={sortDraftKey(currentSorts)}
          onClose={onClose}
          entityConfig={entityConfig}
          currentSorts={currentSorts}
          onApply={onApply}
        />
      ) : null}
    </Dialog>
  )
}
