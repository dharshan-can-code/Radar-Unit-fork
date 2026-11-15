"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { dirOf, isLanguage, translate, type LanguageCode, type TKey } from "@/lib/i18n/translations";

const KEY = "delta-pulse-language";

type LanguageContextType = {
  language: LanguageCode;
  /** Text direction of the chosen language, applied only to the translated menus. */
  dir: "ltr" | "rtl";
  setLanguage: (language: LanguageCode) => void;
  t: (key: TKey) => string;
};

const LanguageContext = createContext<LanguageContextType | null>(null);

/** The chosen language for the site's menus and controls. Page content stays English, so the document
 *  keeps lang="en" and left-to-right layout; menus carry their own lang and dir. */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (isLanguage(saved)) setLanguageState(saved);
    } catch { /* storage blocked */ }
  }, []);

  const setLanguage = useCallback((next: LanguageCode) => {
    setLanguageState(next);
    try { localStorage.setItem(KEY, next); } catch { /* storage blocked */ }
  }, []);

  const t = useCallback((key: TKey) => translate(language, key), [language]);

  return (
    <LanguageContext.Provider value={{ language, dir: dirOf(language), setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}
