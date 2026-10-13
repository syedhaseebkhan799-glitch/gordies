"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Mode = "system" | "light" | "dark" | "amoled";
export type Wallpaper = "plain" | "dots" | "gradient";
export type Bubble = "round" | "sharp";

export const ACCENTS = {
  blue: "#2563eb",
  green: "#16a34a",
  purple: "#7c3aed",
  red: "#dc2626",
  orange: "#ea580c",
  pink: "#db2777",
} as const;
export type Accent = keyof typeof ACCENTS;

export type ThemeSettings = { mode: Mode; accent: Accent; wallpaper: Wallpaper; bubble: Bubble };

export const THEME_KEY = "gordies-theme";
const DEFAULTS: ThemeSettings = { mode: "system", accent: "blue", wallpaper: "dots", bubble: "round" };

// Same logic as the inline script in layout.tsx (that one runs before paint to avoid a flash).
function apply(s: ThemeSettings) {
  const root = document.documentElement;
  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  root.dataset.theme = s.mode === "system" ? (dark ? "dark" : "light") : s.mode;
  root.dataset.wallpaper = s.wallpaper;
  root.dataset.bubble = s.bubble;
  root.style.setProperty("--accent", ACCENTS[s.accent] ?? ACCENTS.blue);
}

function load(): ThemeSettings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(THEME_KEY) ?? "{}") };
  } catch {
    return DEFAULTS;
  }
}

const ThemeCtx = createContext<{
  theme: ThemeSettings;
  setTheme: (patch: Partial<ThemeSettings>) => void;
}>({ theme: DEFAULTS, setTheme: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeSettings>(() => (typeof window === "undefined" ? DEFAULTS : load()));

  useEffect(() => {
    apply(load());
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply(load());
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const setTheme = useCallback((patch: Partial<ThemeSettings>) => {
    setThemeState((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(THEME_KEY, JSON.stringify(next));
      } catch {}
      apply(next);
      return next;
    });
  }, []);

  return <ThemeCtx.Provider value={{ theme, setTheme }}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);
