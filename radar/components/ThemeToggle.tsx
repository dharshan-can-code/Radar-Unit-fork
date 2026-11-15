"use client";
import { Moon, Sun } from "lucide-react";
import { setTheme, useTheme } from "@/lib/themeMode";

/** Switches between the light and dark themes. Maps invert: dark maps in light mode, light maps in dark mode. */
export default function ThemeToggle({ compact = false, className = "" }: { compact?: boolean; className?: string }) {
  const t = useTheme();
  const next = t === "dark" ? "light" : "dark";
  return (
    <button type="button" onClick={() => setTheme(next)} aria-label={`Switch to ${next} mode`} title={`Switch to ${next} mode`}
      className={`flex items-center gap-1.5 rounded-md border border-line px-2 py-1.5 text-[13px] text-muted hover:border-accent/50 hover:text-accent ${className}`}>
      {t === "dark" ? <Sun size={15} aria-hidden /> : <Moon size={15} aria-hidden />}
      {!compact && <span>{t === "dark" ? "Light" : "Dark"}</span>}
    </button>
  );
}
