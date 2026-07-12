"use client"

import * as React from "react"

type Theme = "light" | "dark"

type ThemeContextValue = {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

type ThemeProviderProps = {
  initialTheme: Theme
  children: React.ReactNode
}

const THEME_COOKIE = "odoo_theme"
const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

const ThemeContext = React.createContext<ThemeContextValue | null>(null)

function persistTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark")
  document.documentElement.style.colorScheme = theme
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax`
}

export function ThemeProvider({ initialTheme, children }: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<Theme>(initialTheme)

  const setTheme = React.useCallback((nextTheme: Theme) => {
    setThemeState(nextTheme)
    persistTheme(nextTheme)
  }, [])

  const toggleTheme = React.useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark")
  }, [setTheme, theme])

  const value = React.useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme,
    }),
    [setTheme, theme, toggleTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = React.useContext(ThemeContext)

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider")
  }

  return context
}
