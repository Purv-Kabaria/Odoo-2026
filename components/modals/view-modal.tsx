import * as React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import {
  crudModalBodyClass,
  crudModalDescriptionClass,
  crudModalTitleClass,
  crudModalViewContentClass,
} from "@/components/modals/crud-modal-styles"

export interface ViewModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
}

export function ViewModal({ isOpen, onClose, title, description, children }: ViewModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={crudModalViewContentClass}>
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
