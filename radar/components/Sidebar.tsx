"use client";
import { useEffect, useState, type ComponentType } from "react";
import {
  Activity, Atom, BookOpen, ChevronsLeft, ChevronsRight, Clock, Droplets, FileText, Fingerprint,
  FlaskConical, Globe2, Map as MapIcon, Radar, Search, Sparkles, Users,
} from "lucide-react";

type Icon = ComponentType<{ size?: number; className?: string }>;

// [section id, label, icon]. The ids must match the ids on the <Section> blocks in page.tsx.
const GROUPS: { title: string; items: [string, string, Icon][] }[] = [
  { title: "Explore the data", items: [["live", "Explore", Search], ["globe", "Globe", Globe2], ["explorer", "Map", MapIcon], ["fingerprint", "Fingerprint", Fingerprint]] },
  { title: "Live and lab", items: [["now", "Water Now", Droplets], ["scatter", "Scatter Lab", Activity], ["timeline", "Timeline", Clock], ["lab", "Radar Lab", FlaskConical]] },
  { title: "Learn more", items: [["impact", "Impact", Users], ["science", "Science", Atom], ["methods", "Methods", FileText]] },
];
const IDS = GROUPS.flatMap((g) => g.items.map(([id]) => id));

interface Props { view: "app" | "story"; setView: (v: "app" | "story") => void }

/** Desktop left sidebar: grouped section links, scroll-spy highlight, Your Story, User guide, collapsible to icons. */
export default function Sidebar({ view, setView }: Props) {
  const [active, setActive] = useState<string>("live");
  const [collapsed, setCollapsed] = useState(false);

  // remember the collapsed state (storage can be blocked, so every access is wrapped)
  useEffect(() => {
    try { setCollapsed(localStorage.getItem("dp-sidebar-collapsed") === "1"); } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    document.documentElement.style.setProperty("--sidebar-w", collapsed ? "4.5rem" : "16rem");
    try { localStorage.setItem("dp-sidebar-collapsed", collapsed ? "1" : "0"); } catch { /* ignore */ }
  }, [collapsed]);

  // highlight the section currently in view
  useEffect(() => {
    if (view !== "app") return;
    const els = IDS.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
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
    <aside aria-label="Sections" style={{ width: "var(--sidebar-w)" }}
      className="fixed inset-y-0 left-0 z-[60] hidden flex-col border-r border-line/80 bg-bg/90 backdrop-blur-xl transition-[width] duration-200 lg:flex">
      {/* brand + collapse */}
      <div className={`flex h-14 shrink-0 items-center ${collapsed ? "justify-center" : "justify-between px-4"}`}>
        <button onClick={() => { setView("app"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          className="flex items-center gap-2 text-[13px] font-semibold tracking-[0.14em] text-cyan" title="DELTA PULSE: back to top">
          <Radar size={18} />{!collapsed && "DELTA PULSE"}
        </button>
        {!collapsed && (
          <button onClick={() => setCollapsed(true)} aria-label="Collapse sidebar" title="Collapse sidebar"
            className="rounded-md p-1.5 text-muted hover:bg-panel-2 hover:text-text"><ChevronsLeft size={16} /></button>
        )}
      </div>

      {/* sections */}
      <nav className="no-scrollbar flex-1 overflow-y-auto px-2 pb-4">
        {GROUPS.map((g, gi) => (
          <div key={g.title} className={gi === 0 ? "mt-1" : "mt-5"}>
            {collapsed
              ? (gi > 0 && <div className="mx-3 mb-2 h-px bg-line" />)
              : <div className="px-3 pb-1.5 text-[12px] text-muted">{g.title}</div>}
            <ul className="space-y-0.5">
              {g.items.map(([id, label, Icon]) => {
                const on = view === "app" && active === id;
                return (
                  <li key={id}>
                    <button onClick={() => go(id)} aria-current={on ? "true" : undefined} title={collapsed ? label : undefined} aria-label={label}
                      className={`relative flex w-full items-center rounded-lg py-2 text-[13px] ${collapsed ? "justify-center px-0" : "gap-3 px-3"} ${on ? "bg-cyan/10 text-cyan before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-cyan" : "text-muted hover:bg-panel-2 hover:text-text"}`}>
                      <Icon size={16} className="shrink-0" />
                      {!collapsed && <span className="truncate">{label}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* story + guide + expand */}
      <div className="shrink-0 space-y-1 border-t border-line/80 p-2">
        <button onClick={() => { setView(view === "story" ? "app" : "story"); window.scrollTo({ top: 0 }); }}
          aria-pressed={view === "story"} title={collapsed ? "Your Story" : undefined} aria-label="Your Story"
          className={`flex w-full items-center rounded-full py-2 text-[13px] font-medium ${collapsed ? "justify-center" : "gap-2 px-3"} ${view === "story" ? "bg-amber text-bg" : "border border-amber/50 text-amber hover:bg-amber/10"}`}>
          <Sparkles size={15} className="shrink-0" />{!collapsed && "Your Story"}
        </button>
        <a href="/guide" title={collapsed ? "User guide" : undefined} aria-label="User guide"
          className={`flex items-center rounded-lg py-2 text-[13px] text-muted hover:bg-panel-2 hover:text-text ${collapsed ? "justify-center" : "gap-3 px-3"}`}>
          <BookOpen size={16} className="shrink-0" />{!collapsed && "User guide"}
        </a>
        {collapsed && (
          <button onClick={() => setCollapsed(false)} aria-label="Expand sidebar" title="Expand sidebar"
            className="flex w-full justify-center rounded-lg py-2 text-muted hover:bg-panel-2 hover:text-text"><ChevronsRight size={16} /></button>
        )}
      </div>
    </aside>
  );
}