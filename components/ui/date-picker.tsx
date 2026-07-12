"use client"

import * as React from "react"
import { format, isValid, parseISO } from "date-fns"
import { CalendarIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

type DatePickerProps = {
  /** ISO `yyyy-MM-dd`, or `""` for unset — same wire format `<input type="date">` used, so callers don't change shape. */
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  id?: string
  disabled?: boolean
  className?: string
  /** Earliest selectable date (inclusive). */
  minDate?: Date
  /** Latest selectable date (inclusive). */
  maxDate?: Date
}

/**
 * Popover + Calendar date picker with the same `value`/`onValueChange`
 * contract as a raw `<input type="date">` — a drop-in replacement that
 * swaps the browser's inconsistent native date widget for one calendar UI
 * used everywhere in the app.
 */
export function DatePicker({
  value,
  onValueChange,
  placeholder = "Pick a date",
  id,
  disabled,
  className,
  minDate,
  maxDate,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  const selected = React.useMemo(() => {
    if (!value) return undefined
    const parsed = parseISO(value);
    return isValid(parsed) ? parsed : undefined
  }, [value])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start gap-2 font-normal cursor-pointer",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="size-4 shrink-0" />
          {selected ? format(selected, "MMM d, yyyy") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => {
            onValueChange(date ? format(date, "yyyy-MM-dd") : "")
            setOpen(false)
          }}
          disabled={
            minDate && maxDate
              ? { before: minDate, after: maxDate }
              : minDate
                ? { before: minDate }
                : maxDate
                  ? { after: maxDate }
                  : undefined
          }
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}
