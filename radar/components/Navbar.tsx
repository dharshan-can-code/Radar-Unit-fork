"use client";
import { useEffect, useState } from "react";
import { BookOpen, Radar, Sparkles } from "lucide-react";

export const SECTIONS: [string, string][] = [
  ["live", "Explore"],
  ["globe", "Globe"],
  ["explorer", "Map"],
  ["fingerprint", "Fingerprint"],
  ["now", "Water Now"],
  ["scatter", "Scatter Lab"],
  ["timeline", "Timeline"],
  ["lab", "Radar Lab"],
  ["impact", "Impact"],
  ["science", "Science"],
  ["methods", "Methods"],
];

interface Props { view: "app" | "story"; setView: (v: "app" | "story") => void }

/** Sticky top navigation: every section, the "Your Story" tab and the User Guide. */
export default function Navbar({ view, setView }: Props) {
  const [active, setActive] = useState<string>("live");

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

  const go = (id: string) => {
    if (view !== "app") { setView("app"); setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }), 60); return; }
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <nav aria-label="Sections" className="sticky top-0 z-[60] -mx-4 border-b border-line bg-bg/85 px-4 backdrop-blur sm:-mx-6 sm:px-6">
      <div className="no-scrollbar flex h-12 items-center gap-1 overflow-x-auto whitespace-nowrap text-[13px]">
        <button onClick={() => { setView("app"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          className="mr-2 flex shrink-0 items-center gap-1.5 font-mono text-[12px] font-semibold tracking-widest text-cyan">
          <Radar size={15} />DELTA PULSE
        </button>
        {SECTIONS.map(([id, label]) => (
          <button key={id} onClick={() => go(id)} aria-current={view === "app" && active === id ? "true" : undefined}
            className={`shrink-0 rounded-md px-2.5 py-1.5 transition-colors ${view === "app" && active === id ? "bg-cyan/15 text-cyan" : "text-muted hover:text-text"}`}>
            {label}
          </button>
        ))}
        <span className="mx-1 h-5 w-px shrink-0 bg-line" />
        <button onClick={() => { setView(view === "story" ? "app" : "story"); window.scrollTo({ top: 0 }); }}
          aria-pressed={view === "story"}
          className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors ${view === "story" ? "bg-amber text-bg" : "border border-amber/50 text-amber hover:bg-amber/10"}`}>
          <Sparkles size={14} />Your Story
        </button>
        <a href="/guide" className="ml-auto flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-muted hover:text-text">
          <BookOpen size={14} />User guide
        </a>
      </div>
    </nav>
  );
}
