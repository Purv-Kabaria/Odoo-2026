"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Building2, Package, Search, UserRound } from "lucide-react"

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command"
import { readApiResponse } from "@/lib/api-client"
import type { GlobalSearchResponse, GlobalSearchResult } from "@/types/search-types"

const SEARCH_DEBOUNCE_MS = 300

const EMPTY_RESULTS: GlobalSearchResponse = {
  assets: [],
  users: [],
  departments: [],
  organizations: [],
}

const GROUPS: { key: keyof GlobalSearchResponse; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "assets", label: "Assets", icon: Package },
  { key: "users", label: "Employees", icon: UserRound },
  { key: "departments", label: "Departments", icon: Building2 },
  { key: "organizations", label: "Organizations", icon: Building2 },
]

export function GlobalSearch() {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [results, setResults] = React.useState<GlobalSearchResponse>(EMPTY_RESULTS)
  const [isLoading, setIsLoading] = React.useState(false)
  const sequenceRef = React.useRef(0)

  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setOpen((current) => !current)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const trimmedQuery = query.trim()

  const runSearch = React.useCallback((searchQuery: string) => {
    setIsLoading(true)
    const sequence = sequenceRef.current + 1
    sequenceRef.current = sequence

    fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`)
      .then((response) => readApiResponse<{ data: GlobalSearchResponse }>(response, "Search failed"))
      .then((json) => {
        if (sequenceRef.current !== sequence) return
        setResults(json.data)
      })
      .catch(() => {
        if (sequenceRef.current !== sequence) return
        setResults(EMPTY_RESULTS)
      })
      .finally(() => {
        if (sequenceRef.current === sequence) setIsLoading(false)
      })
  }, [])

  React.useEffect(() => {
    if (!open || !trimmedQuery) return

    const debounce = window.setTimeout(() => runSearch(trimmedQuery), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(debounce)
  }, [open, trimmedQuery, runSearch])

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) {
      setQuery("")
      setResults(EMPTY_RESULTS)
      setIsLoading(false)
    }
  }

  const handleSelect = (result: GlobalSearchResult) => {
    handleOpenChange(false)
    router.push(result.href)
  }

  const hasAnyResults = GROUPS.some((group) => results[group.key].length > 0)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-2 rounded-lg border border-input/40 bg-input/20 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-input/70 hover:text-foreground cursor-pointer"
      >
        <Search className="size-3.5" />
        <span>Search...</span>
        <CommandShortcut className="ml-4 text-[10px]">⌘K</CommandShortcut>
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex md:hidden items-center justify-center rounded-lg p-2 text-muted-foreground hover:text-foreground cursor-pointer"
        aria-label="Search"
      >
        <Search className="size-5" />
      </button>

      <CommandDialog
        open={open}
        onOpenChange={handleOpenChange}
        title="Search AssetFlow"
        description="Search assets, employees, departments, and organizations"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search assets, employees, departments..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {!query.trim() ? (
              <CommandEmpty>Type to search across AssetFlow.</CommandEmpty>
            ) : isLoading ? (
              <CommandEmpty>Searching...</CommandEmpty>
            ) : !hasAnyResults ? (
              <CommandEmpty>No results for &ldquo;{query}&rdquo;.</CommandEmpty>
            ) : (
              GROUPS.map((group) => {
                const items = results[group.key]
                if (items.length === 0) return null
                const Icon = group.icon
                return (
                  <CommandGroup key={group.key} heading={group.label}>
                    {items.map((item) => (
                      <CommandItem
                        key={`${group.key}-${item.id}`}
                        value={`${group.key}-${item.id}`}
                        onSelect={() => handleSelect(item)}
                        className="cursor-pointer"
                      >
                        <Icon className="size-4" />
                        <span className="flex-1 truncate">{item.title}</span>
                        {item.subtitle ? (
                          <span className="text-xs text-muted-foreground">{item.subtitle}</span>
                        ) : null}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )
              })
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
