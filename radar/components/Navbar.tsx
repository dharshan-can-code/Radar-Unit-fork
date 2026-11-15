"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Menu, Sparkles, X } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageSelector from "@/components/site/LanguageSelector";
import { useLanguage } from "@/components/site/LanguageContext";
import { BrandMark } from "@/components/ui";
import { PAGES, STORY } from "@/components/site/nav";
import { useNavLinks } from "@/components/Sidebar";

/** Top navigation for screens narrower than xl: the current page, Your Story, a menu of every page and
 *  section, and the User Guide. From xl up the Sidebar takes over (components/Sidebar.tsx). */
export default function Navbar() {
  const { pathname, current, target, onClick, isOn, href } = useNavLinks();
  const [open, setOpen] = useState(false);
  const { t, language, dir } = useLanguage();
  const story = pathname === STORY;

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);

  return (
    <nav aria-label="Main" lang={language} className="sticky top-0 z-[60] border-b border-line bg-bg/90 backdrop-blur-md xl:hidden">
      <div className="mx-auto flex h-[52px] max-w-[1400px] items-center gap-2 px-4 sm:gap-3 sm:px-6">
        <Link href={href("/")} onClick={() => setOpen(false)}
          className="flex shrink-0 items-center gap-2 font-display text-[14px] font-semibold tracking-[0.04em] text-text sm:text-[15px]">
          <span className="text-accent"><BrandMark /></span>DELTA PULSE
        </Link>

        <Link href={href(STORY)} aria-current={story ? "page" : undefined}
          className={`flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-[13px] sm:ml-1 sm:px-2.5 ${story ? "border-amber bg-amber/15 text-amber" : "border-line text-muted hover:border-amber/50 hover:text-amber"}`}>
          <Sparkles size={13} className="hidden min-[400px]:block" />{t("story")}
        </Link>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          {current && <span className="mr-1 hidden text-[13px] text-muted sm:inline">{t(current.key)}</span>}
          <LanguageSelector className="hidden sm:flex" />
          <ThemeToggle compact />
          <Link href="/guide" className="hidden items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] text-muted hover:text-text sm:flex">
            <BookOpen size={14} />{t("guide")}
          </Link>
          <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="site-menu" aria-label={open ? t("closeMenu") : t("openMenu")}
            className="flex items-center gap-1.5 rounded-md border border-line px-2 py-1.5 text-[13px] text-text hover:border-line-strong sm:px-2.5">
            {open ? <X size={16} /> : <Menu size={16} />}<span className="hidden sm:inline">{t("menu")}</span>
          </button>
        </div>
      </div>

      {open && (
        <div id="site-menu" dir={dir} className="panel-in border-t border-line bg-bg">
          <div className="mx-auto grid max-h-[calc(100svh-52px)] max-w-[1400px] gap-x-8 gap-y-5 overflow-y-auto px-4 py-5 sm:grid-cols-3 lg:grid-cols-5 sm:px-6">
            {PAGES.map((p) => {
              const here = p.href === pathname;
              return (
                <div key={p.href}>
                  <Link href={href(p.href)} onClick={() => setOpen(false)} aria-current={here ? "page" : undefined}
                    className={`text-[12px] ${here ? "text-accent" : "text-muted hover:text-text"}`}>{t(p.key)}</Link>
                  <ul className="mt-1">
                    {p.items.map((x) => {
                      const on = isOn(p, x);
                      return (
                        <li key={x.id}>
                          <Link href={target(p, x)} onClick={(e) => onClick(p, x, e, () => setOpen(false))} aria-current={on ? "location" : undefined}
                            className={`block w-full py-1.5 text-left text-[15px] ${on ? "text-accent" : "text-text hover:text-accent"}`}>
                            {t(x.key)}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
            <div>
              <div className="text-[12px] text-muted">{t("storyGroup")}</div>
              <Link href={href(STORY)} onClick={() => setOpen(false)}
                className={`mt-1 flex w-full items-center gap-1.5 py-1.5 text-left text-[15px] ${story ? "text-amber" : "text-text hover:text-amber"}`}>
                <Sparkles size={14} />{t("story")}
              </Link>
            </div>
            <div className="sm:hidden"><LanguageSelector className="w-fit" /></div>
            <Link href="/guide" className="flex items-center gap-1.5 border-t border-line pt-4 text-[15px] text-text hover:text-accent sm:col-span-3 lg:col-span-5">
              <BookOpen size={15} />{t("guide")}
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
