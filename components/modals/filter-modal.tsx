import * as React from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FilterX, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { validateFilterRules } from "@/lib/entities/query"
import { filterableColumns } from "@/lib/entities/types"
import type { EntityConfig } from "@/lib/entities/types"

export interface FilterRule {
  id: string
  field: string
  operator: "equals" | "not_equals" | "contains"
  value: string
}

const MAX_FILTER_RULES = 10

interface FilterModalProps {
  isOpen: boolean
  onClose: () => void
  entityConfig: EntityConfig
  currentFilters: FilterRule[]
  onApply: (filters: FilterRule[]) => void
}

function filterDraftKey(currentFilters: FilterRule[]): string {
  if (currentFilters.length === 0) return "empty"
  return currentFilters
    .map((f) => `${f.id}:${f.field}:${f.operator}:${f.value}`)
    .join("|")
}

interface FilterModalContentProps {
  onClose: () => void
  entityConfig: EntityConfig
  currentFilters: FilterRule[]
  onApply: (filters: FilterRule[]) => void
}

function FilterModalContent({
  onClose,
  entityConfig,
  currentFilters,
  onApply,
}: FilterModalContentProps) {
  const columns = filterableColumns(entityConfig)
  const [filters, setFilters] = React.useState<FilterRule[]>(() =>
    currentFilters.length > 0 ? [...currentFilters] : []
  )
  const [validationError, setValidationError] = React.useState<string | null>(null)

  const handleAddFilter = () => {
    if (filters.length >= MAX_FILTER_RULES) {
      toast.error(`You can add at most ${MAX_FILTER_RULES} filter rules.`)
      return
    }

    const firstColumn = columns[0]
    setFilters([
      ...filters,
      {
        id: crypto.randomUUID(),
        field: firstColumn.key,
        operator: firstColumn.type === "text" ? "contains" : "equals",
        value: "",
      },
    ])
    setValidationError(null)
  }

  const handleRemoveFilter = (id: string) => {
    setFilters(filters.filter((f) => f.id !== id))
    setValidationError(null)
  }

  const handleUpdateFilter = (id: string, key: keyof FilterRule, value: string) => {
    setFilters(
      filters.map((f) => {
        if (f.id !== id) return f

        const updated = { ...f, [key]: value }
        if (key === "field") {
          const columnConfig = columns.find((c) => c.key === value)
          updated.field = value
          updated.operator = columnConfig?.type === "text" ? "contains" : "equals"
          updated.value = ""
        }
        return updated as FilterRule
      })
    )
    setValidationError(null)
  }

  const handleApply = () => {
    const payload = filters
      .filter((f) => f.field && f.value.trim())
      .map(({ field, operator, value }) => ({
        field,
        operator,
        value: value.trim(),
      }))

    const result = validateFilterRules(entityConfig, payload)

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
    setFilters([])
    setValidationError(null)
  }

  return (
    <DialogContent className="w-[95vw] sm:max-w-[800px] p-0 sm:w-full overflow-visible">
      <div className="p-6">
        <DialogHeader className="mb-6">
          <DialogTitle>Advanced Filtering</DialogTitle>
          <DialogDescription>
            Build queries with multiple conditions. Duplicate and conflicting rules are not allowed.
          </DialogDescription>
        </DialogHeader>

        {validationError && (
          <div className="mb-4 border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {validationError}
          </div>
        )}

        <div className="flex flex-col gap-3">
          {filters.length === 0 && (
            <div className="text-center p-8 border border-dashed border-border text-muted-foreground text-sm bg-muted/20">
              No filters applied. Click below to add a rule.
            </div>
          )}

          {filters.map((filter) => {
            const columnConfig = columns.find((c) => c.key === filter.field)
            return (
              <div
                key={filter.id}
                className="flex flex-col sm:flex-row gap-2 bg-muted/30 p-3 border border-border group relative items-start sm:items-center"
              >
                <Select
                  value={filter.field}
                  onValueChange={(val) => handleUpdateFilter(filter.id, "field", val)}
                >
                  <SelectTrigger className="w-full sm:w-[160px] bg-background shadow-sm h-9 cursor-pointer">
                    <SelectValue placeholder="Column" />
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map((c) => (
                      <SelectItem key={c.key} value={c.key} className="cursor-pointer">
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={filter.operator}
                  onValueChange={(val) => handleUpdateFilter(filter.id, "operator", val)}
                >
                  <SelectTrigger className="w-full sm:w-[140px] bg-background shadow-sm h-9 cursor-pointer">
                    <SelectValue placeholder="Operator" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equals" className="cursor-pointer">
                      Equals
                    </SelectItem>
                    <SelectItem value="not_equals" className="cursor-pointer">
                      Does not equal
                    </SelectItem>
                    {columnConfig?.type === "text" && (
                      <SelectItem value="contains" className="cursor-pointer">
                        Contains
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>

                <div className="flex-1 w-full flex gap-2">
                  {columnConfig?.type === "select" ? (
                    <Select
                      value={filter.value}
                      onValueChange={(val) => handleUpdateFilter(filter.id, "value", val)}
                    >
                      <SelectTrigger className="w-full bg-background shadow-sm h-9 cursor-pointer">
                        <SelectValue placeholder="Select value..." />
                      </SelectTrigger>
                      <SelectContent>
                        {columnConfig.options?.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="cursor-pointer">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={filter.value}
                      onChange={(e) => handleUpdateFilter(filter.id, "value", e.target.value)}
                      placeholder="Type value..."
                      className="shadow-sm h-9"
                    />
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive cursor-pointer shrink-0"
                    onClick={() => handleRemoveFilter(filter.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>

        <Button
          variant="outline"
          className="w-full mt-4 border-dashed border-2 cursor-pointer h-10"
          onClick={handleAddFilter}
          disabled={filters.length >= MAX_FILTER_RULES}
        >
          <Plus className="mr-2 h-4 w-4" /> Add Filter Rule
        </Button>
      </div>

      <div className="bg-muted/50 p-4 border-t border-border flex flex-row justify-between items-center">
        <Button
          type="button"
          variant="ghost"
          onClick={handleClear}
          className="cursor-pointer text-muted-foreground hover:text-foreground px-2 sm:px-4"
        >
          <FilterX className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Clear All</span>
        </Button>
        <div className="flex flex-row flex-1 sm:flex-none justify-end">
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
            Apply Filters
          </Button>
        </div>
      </div>
    </DialogContent>
  )
}

export function FilterModal({
  isOpen,
  onClose,
  entityConfig,
  currentFilters,
  onApply,
}: FilterModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      {isOpen ? (
        <FilterModalContent
          key={filterDraftKey(currentFilters)}
          onClose={onClose}
          entityConfig={entityConfig}
          currentFilters={currentFilters}
          onApply={onApply}
        />
      ) : null}
    </Dialog>
  )
}
