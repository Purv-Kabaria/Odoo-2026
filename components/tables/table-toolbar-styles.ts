/** Shared typography for users table toolbar controls. */
export const tableToolbarTextClass =
  "text-sm font-normal text-foreground"

export const tableToolbarPlaceholderClass =
  "placeholder:text-sm placeholder:font-normal placeholder:text-muted-foreground"

/** Shared sizing for table toolbar inputs and selects. */
export const tableControlBaseClass = [
  "h-9 min-h-9 w-full rounded-none border border-input bg-background shadow-sm",
  tableToolbarTextClass,
  tableToolbarPlaceholderClass,
  "!text-sm md:!text-sm",
].join(" ")

/** Wrapper width — matches one search-toolbar column (half of sm:max-w-md minus gap). */
export const tableControlColumnWidthClass =
  "w-full min-w-0 max-w-[13.75rem] sm:w-[13.75rem]"

/** Dropdown panel matches trigger width (overrides default min-w-36). */
export const selectContentMatchTriggerClass =
  "min-w-0 w-[var(--radix-select-trigger-width)] max-w-[var(--radix-select-trigger-width)] rounded-none text-sm"

export const searchToolbarClass =
  "grid w-full min-w-0 grid-cols-2 gap-2 sm:max-w-md lg:max-w-xl"

export const searchFieldTriggerClass = [
  tableControlBaseClass,
  "!w-full cursor-pointer px-2.5",
  "data-[size=default]:h-9 data-[size=default]:min-h-9",
  "[&_[data-slot=select-value]]:text-sm [&_[data-slot=select-value]]:font-normal [&_[data-slot=select-value]]:text-foreground",
].join(" ")

export const searchInputClass = [tableControlBaseClass, "pl-8 pr-14"].join(" ")

export const pageSizeTriggerClass = [
  tableControlBaseClass,
  "!w-full cursor-pointer px-2.5",
  "data-[size=default]:h-9 data-[size=default]:min-h-9",
  "[&_[data-slot=select-value]]:text-sm [&_[data-slot=select-value]]:font-normal",
].join(" ")

export const tableToolbarButtonClass =
  "h-9 cursor-pointer gap-1.5 rounded-none px-3 text-sm !font-normal shadow-sm [&_svg]:size-4"

export const tableToolbarIconClass = "size-4 shrink-0"

export const tableToolbarSelectItemClass =
  "cursor-pointer text-sm font-normal"
