"use client";
// Light / dark theme. The choice is stored per visitor; the first visit follows the
// operating system. An inline script in app/layout.tsx applies it before first paint.
import { useEffect, useState } from "react";

export type ThemeMode = "light" | "dark";
import { THEME_KEY as KEY } from "@/lib/themeBoot";
const EVENT = "dp-theme-change";

export function currentTheme(): ThemeMode {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function setTheme(t: ThemeMode) {
  document.documentElement.dataset.theme = t;
  document.documentElement.style.colorScheme = t;
  try { localStorage.setItem(KEY, t); } catch { /* storage can be blocked */ }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: t }));
}

/** Re-renders when the theme changes (toggle, or another tab). */
export function useTheme(): ThemeMode {
  const [t, setT] = useState<ThemeMode>("light");
  useEffect(() => {
    setT(currentTheme());
    const on = () => setT(currentTheme());
    window.addEventListener(EVENT, on);
    const storage = (e: StorageEvent) => { if (e.key === KEY && (e.newValue === "light" || e.newValue === "dark")) setTheme(e.newValue); };
    window.addEventListener("storage", storage);
    return () => { window.removeEventListener(EVENT, on); window.removeEventListener("storage", storage); };
  }, []);
  return t;
}
