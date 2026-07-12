import * as React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import {
  crudModalBodyClass,
  crudModalContentClass,
  crudModalDescriptionClass,
  crudModalTitleClass,
} from "@/components/modals/crud-modal-styles"

export interface EditModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
}

export function EditModal({ isOpen, onClose, title, description, children }: EditModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={crudModalContentClass}>
        <DialogHeader className="gap-1 sm:gap-2">
          <DialogTitle className={crudModalTitleClass}>{title}</DialogTitle>
          {description && (
            <DialogDescription className={crudModalDescriptionClass}>
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        <div className={crudModalBodyClass}>{children}</div>
      </DialogContent>
    </Dialog>
  )
}
