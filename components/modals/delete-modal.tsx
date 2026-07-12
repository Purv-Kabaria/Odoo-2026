import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  crudModalButtonClass,
  crudModalContentClass,
  crudModalDescriptionClass,
  crudModalTitleClass,
} from "@/components/modals/crud-modal-styles"

export interface DeleteModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description?: string
  isLoading?: boolean
}

export function DeleteModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  isLoading,
}: DeleteModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={crudModalContentClass}>
        <DialogHeader className="gap-1 sm:gap-2">
          <DialogTitle className={`${crudModalTitleClass} text-destructive`}>
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription className={crudModalDescriptionClass}>
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter className="mt-2 gap-2 border-t border-border pt-3 sm:mt-4 sm:pt-4">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className={`${crudModalButtonClass} w-full sm:mt-0 sm:w-auto`}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isLoading}
            className={`${crudModalButtonClass} w-full sm:ml-2 sm:w-auto`}
          >
            {isLoading ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
