"use client";
import { Languages } from "lucide-react";
import { LANGUAGES, type LanguageCode } from "@/lib/i18n/translations";
import { useLanguage } from "@/components/site/LanguageContext";

/** Picks the language of the menus and controls. The tooltip says page content stays in English. */
export default function LanguageSelector({ className = "" }: { className?: string }) {
  const { language, setLanguage, t } = useLanguage();
  return (
    <label title={t("note")}
      className={`flex items-center gap-1.5 rounded-md border border-line px-2 py-1.5 text-[13px] text-muted focus-within:border-accent/60 hover:border-accent/50 hover:text-accent ${className}`}>
      <Languages size={15} aria-hidden className="shrink-0" />
      <select value={language} onChange={(e) => setLanguage(e.target.value as LanguageCode)} aria-label={t("language")}
        className="w-full max-w-[9rem] cursor-pointer bg-transparent text-inherit outline-none">
        {LANGUAGES.map((l) => <option key={l.code} value={l.code} lang={l.code} className="bg-bg text-text">{l.name}</option>)}
      </select>
    </label>
  );
}
