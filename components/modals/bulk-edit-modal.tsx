"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  crudModalButtonClass,
  crudModalContentClass,
  crudModalDescriptionClass,
  crudModalFooterClass,
  crudModalTitleClass,
} from "@/components/modals/crud-modal-styles"
import type { EntityColumn, EntityConfig } from "@/lib/entities/types"

type BulkEditModalProps = {
  isOpen: boolean
  onClose: () => void
  entityConfig: EntityConfig
  selectedCount: number
  onApply: (field: string, value: string | number | boolean | null) => Promise<void>
  isLoading?: boolean
}

function bulkEditableColumns(config: EntityConfig): EntityColumn[] {
  return config.columns.filter(
    (column) =>
      column.editable !== false &&
      (column.type === "select" || column.type === "text" || column.type === "number" || column.type === "boolean")
  )
}

export function BulkEditModal({
  isOpen,
  onClose,
  entityConfig,
  selectedCount,
  onApply,
  isLoading,
}: BulkEditModalProps) {
  const columns = bulkEditableColumns(entityConfig)
  const [field, setField] = React.useState(columns[0]?.key ?? "")
  const [value, setValue] = React.useState("")

  React.useEffect(() => {
    let frame = 0
    if (isOpen) {
      frame = window.requestAnimationFrame(() => {
        setField(columns[0]?.key ?? "")
        setValue("")
      })
    }
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const activeColumn = columns.find((c) => c.key === field)

  const handleApply = async () => {
    if (!activeColumn) return
    if (activeColumn.type === "number" && !Number.isFinite(Number(value))) return
    const parsedValue =
      activeColumn.type === "number"
        ? Number(value)
        : activeColumn.type === "boolean"
          ? value === "true"
          : value
    await onApply(activeColumn.key, parsedValue)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={crudModalContentClass}>
        <DialogHeader className="gap-1 sm:gap-2">
          <DialogTitle className={crudModalTitleClass}>Edit {selectedCount} selected</DialogTitle>
          <DialogDescription className={crudModalDescriptionClass}>
            Choose a field and a new value to apply to every selected row.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          <div className="grid gap-2">
            <Label>Field</Label>
            <Select
              value={field}
              onValueChange={(next) => {
                setField(next)
                setValue("")
              }}
            >
              <SelectTrigger className="rounded-none shadow-sm cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-none">
                {columns.map((c) => (
                  <SelectItem key={c.key} value={c.key} className="cursor-pointer">
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>New value</Label>
            {activeColumn?.type === "select" ? (
              <Select value={value} onValueChange={setValue}>
                <SelectTrigger className="rounded-none shadow-sm cursor-pointer">
                  <SelectValue placeholder="Select a value..." />
                </SelectTrigger>
                <SelectContent className="rounded-none">
                  {activeColumn.options?.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="cursor-pointer">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : activeColumn?.type === "boolean" ? (
              <Select value={value} onValueChange={setValue}>
                <SelectTrigger className="rounded-none shadow-sm cursor-pointer">
                  <SelectValue placeholder="Select a value..." />
                </SelectTrigger>
                <SelectContent className="rounded-none">
                  <SelectItem value="true" className="cursor-pointer">
                    True
                  </SelectItem>
                  <SelectItem value="false" className="cursor-pointer">
                    False
                  </SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Input
                type={activeColumn?.type === "number" ? "number" : "text"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="rounded-none shadow-sm"
              />
            )}
          </div>
        </div>

        <DialogFooter className={crudModalFooterClass}>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className={`${crudModalButtonClass} w-full sm:w-auto`}
          >
            Cancel
          </Button>
          <Button
            onClick={() => void handleApply()}
            disabled={isLoading || !value}
            className={`${crudModalButtonClass} w-full sm:ml-2 sm:w-auto`}
          >
            {isLoading ? "Updating..." : `Update ${selectedCount}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
