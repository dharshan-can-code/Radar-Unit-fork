"use client";
import { useEffect, useState } from "react";
import { BookOpen, Menu, Sparkles, X } from "lucide-react";
import { BrandMark } from "@/components/ui";

/** Every section of the analysis view, in page order. */
export const SECTIONS: [string, string][] = [
  ["how", "How it works"],
  ["findings", "Findings"],
  ["explorer", "Map"],
  ["fingerprint", "What changed"],
  ["checks", "Is it real?"],
  ["places", "Other places"],
  ["impact", "Who it helps"],
  ["deeper", "Go deeper"],
];
const LABEL = new Map(SECTIONS);

/** The same destinations, organised by what a visitor is trying to do (used by the menu). */
const GROUPS: { name: string; ids: string[] }[] = [
  { name: "Explore", ids: ["findings", "explorer", "fingerprint", "places"] },
  { name: "Evidence", ids: ["checks"] },
  { name: "Science", ids: ["how", "deeper"] },
  { name: "Impact", ids: ["impact"] },
];

interface Props { view: "app" | "story"; setView: (v: "app" | "story") => void }

/** Top navigation for screens narrower than xl: the two views, a menu of every section, and the User Guide.
 *  From xl up the Sidebar takes over (components/Sidebar.tsx). */
export default function Navbar({ view, setView }: Props) {
  const [active, setActive] = useState<string>("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (view !== "app") return;
    const els = SECTIONS.map(([id]) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (vis[0]) setActive(vis[0].target.id);
    }, { rootMargin: "-80px 0px -55% 0px" });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [view]);

  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);

  const go = (id: string) => {
    setOpen(false);
    if (view !== "app") { setView("app"); setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }), 60); return; }
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };
  const show = (v: "app" | "story") => { setOpen(false); setView(v); window.scrollTo({ top: 0 }); };
  const here = view === "app" ? active : "";

  return (
    <nav aria-label="Main" className="sticky top-0 z-[60] border-b border-line bg-bg/90 backdrop-blur-md xl:hidden">
      <div className="mx-auto flex h-[52px] max-w-[1400px] items-center gap-2 px-4 sm:gap-3 sm:px-6">
        <button onClick={() => { setOpen(false); setView("app"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          className="flex shrink-0 items-center gap-2 font-display text-[14px] font-semibold tracking-[0.04em] text-text sm:text-[15px]">
          <span className="text-cyan"><BrandMark /></span>DELTA PULSE
        </button>

        <div role="group" aria-label="View" className="flex shrink-0 rounded-md border border-line p-0.5 text-[13px] sm:ml-1">
          <button onClick={() => show("app")} aria-pressed={view === "app"}
            className={`rounded-[3px] px-2 py-1 sm:px-2.5 ${view === "app" ? "bg-cyan/15 text-cyan" : "text-muted hover:text-text"}`}>
            Analysis
          </button>
          <button onClick={() => show("story")} aria-pressed={view === "story"}
            className={`flex items-center gap-1.5 rounded-[3px] px-2 py-1 sm:px-2.5 ${view === "story" ? "bg-amber/15 text-amber" : "text-muted hover:text-text"}`}>
            <Sparkles size={13} className="hidden min-[400px]:block" />Your Story
          </button>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          {here && <span className="mr-1 hidden text-[13px] text-muted sm:inline">{LABEL.get(here)}</span>}
          <a href="/guide" className="hidden items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] text-muted hover:text-text sm:flex">
            <BookOpen size={14} />User guide
          </a>
          <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="site-menu" aria-label={open ? "Close menu" : "Open menu"}
            className="flex items-center gap-1.5 rounded-md border border-line px-2 py-1.5 text-[13px] text-text hover:border-line-strong sm:px-2.5">
            {open ? <X size={16} /> : <Menu size={16} />}<span className="hidden sm:inline">Menu</span>
          </button>
        </div>
      </div>

      {open && (
        <div id="site-menu" className="panel-in border-t border-line bg-bg">
          <div className="mx-auto grid max-h-[calc(100svh-52px)] max-w-[1400px] gap-x-8 gap-y-5 overflow-y-auto px-4 py-5 sm:grid-cols-3 sm:px-6 lg:grid-cols-5">
            <div>
              <div className="text-[12px] text-muted">Story</div>
              <button onClick={() => show("story")} className={`mt-1 flex w-full items-center gap-1.5 py-1.5 text-left text-[15px] ${view === "story" ? "text-amber" : "text-text hover:text-amber"}`}>
                <Sparkles size={14} />Your Story
              </button>
            </div>
            {GROUPS.map((g) => (
              <div key={g.name}>
                <div className="text-[12px] text-muted">{g.name}</div>
                <ul className="mt-1">
                  {g.ids.map((id) => (
                    <li key={id}>
                      <button onClick={() => go(id)} aria-current={here === id ? "true" : undefined}
                        className={`w-full py-1.5 text-left text-[15px] ${here === id ? "text-cyan" : "text-text hover:text-cyan"}`}>
                        {LABEL.get(id)}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <a href="/guide" className="flex items-center gap-1.5 border-t border-line pt-4 text-[15px] text-text hover:text-cyan sm:col-span-3 lg:col-span-5">
              <BookOpen size={15} />User guide
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}
