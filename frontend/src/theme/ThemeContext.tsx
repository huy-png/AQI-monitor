import { createContext, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from "react";

/* eslint-disable react-refresh/only-export-components */

export type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  tint: string;
  setTint: (tint: string) => void;
}

const STORAGE_KEY = "climasense-theme";
const TINT_KEY = "climasense-theme-tint";
export const DEFAULT_TINT = "#38bda9";
const ThemeContext = createContext<ThemeContextValue | null>(null);

function getInitialTheme(): Theme {
  try {
    const savedTheme = globalThis.localStorage.getItem(STORAGE_KEY);
    if (savedTheme === "light" || savedTheme === "dark") return savedTheme;
  } catch { /* Use the system preference when storage is unavailable. */ }

  return globalThis.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [tint, updateTint] = useState(() => {
    try {
      const saved = globalThis.localStorage.getItem(TINT_KEY);
      if (saved && /^#[0-9a-f]{6}$/i.test(saved)) return saved;
    } catch { /* Use the default color. */ }
    return DEFAULT_TINT;
  });

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    try { globalThis.localStorage.setItem(STORAGE_KEY, theme); }
    catch { /* Theme changes still work for this session. */ }
  }, [theme]);

  useLayoutEffect(() => {
    document.documentElement.style.setProperty("--theme-tint", tint);
    try { globalThis.localStorage.setItem(TINT_KEY, tint); }
    catch { /* Color changes still work for this session. */ }
  }, [tint]);

  const value = useMemo(() => ({
    theme, setTheme, tint,
    setTint: (color: string) => {
      if (/^#[0-9a-f]{6}$/i.test(color)) updateTint(color.toLowerCase());
    },
  }), [theme, tint]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }

  return context;
}
