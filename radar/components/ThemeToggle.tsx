"use client";
import { Moon, Sun } from "lucide-react";
import { setTheme, useTheme } from "@/lib/themeMode";
import { useLanguage } from "@/components/site/LanguageContext";

/** Switches between the light and dark themes. Maps invert: dark maps in light mode, light maps in dark mode. */
export default function ThemeToggle({ compact = false, className = "" }: { compact?: boolean; className?: string }) {
  const t = useTheme();
  const { t: tr } = useLanguage();
  const next = t === "dark" ? "light" : "dark";
  const label = tr(next === "dark" ? "toDark" : "toLight");
  return (
    <button type="button" onClick={() => setTheme(next)} aria-label={label} title={label}
      className={`flex items-center gap-1.5 rounded-md border border-line px-2 py-1.5 text-[13px] text-muted hover:border-accent/50 hover:text-accent ${className}`}>
      {t === "dark" ? <Sun size={15} aria-hidden /> : <Moon size={15} aria-hidden />}
      {!compact && <span>{tr(t === "dark" ? "light" : "dark")}</span>}
    </button>
  );
}
