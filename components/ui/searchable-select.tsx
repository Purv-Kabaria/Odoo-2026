"use client"

import * as React from "react"

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"

export type SearchableSelectOption = {
  value: string
  label: string
}

type SearchableSelectProps = {
  value: string
  onValueChange: (value: string) => void
  options: SearchableSelectOption[]
  placeholder?: string
  emptyText?: string
  id?: string
  disabled?: boolean
  className?: string
  "aria-label"?: string
}

/**
 * Drop-in replacement for `<Select>` when the option list is long or
 * fetched from the API (assets, employees, departments, categories) — same
 * value/onValueChange shape, but with type-to-filter search built in. The
 * popover always matches the trigger's width (Combobox's `--anchor-width`
 * CSS var), unlike a plain Select in item-aligned mode.
 */
export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select...",
  emptyText = "No results found.",
  id,
  disabled,
  className,
  ...rest
}: SearchableSelectProps) {
  const selected = React.useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  )

  return (
    <Combobox
      items={options}
      value={selected}
      onValueChange={(next) =>
        onValueChange(next ? (next as SearchableSelectOption).value : "")
      }
      itemToStringLabel={(item) => (item as SearchableSelectOption).label}
      isItemEqualToValue={(a, b) =>
        (a as SearchableSelectOption).value === (b as SearchableSelectOption).value
      }
    >
      <ComboboxInput
        id={id}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
        aria-label={rest["aria-label"]}
      />
      <ComboboxContent>
        <ComboboxEmpty>{emptyText}</ComboboxEmpty>
        <ComboboxList>
          {(item: SearchableSelectOption) => (
            <ComboboxItem key={item.value} value={item} className="cursor-pointer">
              {item.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
