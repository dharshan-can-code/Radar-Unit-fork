"use client";
import { useEffect, useState, type ComponentType } from "react";
import {
  Activity, BookOpen, CalendarDays, ChevronsLeft, ChevronsRight, Droplets, FileText, Fingerprint,
  FlaskConical, Globe2, Map as MapIcon, Microscope, Radar, Search, ShieldCheck, Sparkles, Users, Waves,
} from "lucide-react";
import { BrandMark } from "@/components/ui";

type Icon = ComponentType<{ size?: number; className?: string }>;
interface Item { id: string; label: string; icon: Icon; /** a tool inside the "Go deeper" tabs, not a section of its own */ tab?: boolean }

// Section ids must match the ids on the <Section> blocks in page.tsx; tab ids must match the
// DeepDive tabs there. The tools used to be sections of their own and now live behind tabs in
// #deeper, so those links open the tab and scroll to it.
const GROUPS: { title: string; items: Item[] }[] = [
  { title: "Start here", items: [
    { id: "how", label: "How it works", icon: Radar },
    { id: "findings", label: "Findings", icon: Droplets },
  ] },
  { title: "Explore the data", items: [
    { id: "explorer", label: "Map", icon: MapIcon },
    { id: "fingerprint", label: "What changed", icon: Fingerprint },
    { id: "checks", label: "Is it real?", icon: ShieldCheck },
    { id: "live", label: "Search a place", icon: Search },
    { id: "globe", label: "Globe", icon: Globe2 },
  ] },
  { title: "Live and lab", items: [
    { id: "now", label: "Water now", icon: Waves, tab: true },
    { id: "scatter", label: "Scatter Lab", icon: Activity, tab: true },
    { id: "lab", label: "Radar Lab", icon: FlaskConical, tab: true },
    { id: "timeline", label: "Every pass", icon: CalendarDays, tab: true },
  ] },
  { title: "Learn more", items: [
    { id: "impact", label: "Who it helps", icon: Users },
    { id: "science", label: "The physics", icon: Microscope, tab: true },
    { id: "methods", label: "Methods & data", icon: FileText, tab: true },
  ] },
];
const DEEPER = "deeper";
const SPY_IDS = [...GROUPS.flatMap((g) => g.items.filter((x) => !x.tab).map((x) => x.id)), DEEPER];

interface Props {
  view: "app" | "story"; setView: (v: "app" | "story") => void;
  /** The tool that is open in the "Go deeper" tabs, and a way to open another. */
  tab: string; onOpenTab: (id: string) => void;
}

/** Desktop left sidebar (xl and up): grouped section links, scroll-spy highlight, Your Story,
 *  User guide, collapsible to icons. Narrower screens use the top bar in Navbar.tsx. */
export default function Sidebar({ view, setView, tab, onOpenTab }: Props) {
  const [active, setActive] = useState<string>("");
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
    const els = SPY_IDS.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (vis[0]) setActive(vis[0].target.id);
    }, { rootMargin: "-80px 0px -55% 0px" });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [view]);

  const go = (x: Item) => {
    if (x.tab) onOpenTab(x.id);
    const target = x.tab ? DEEPER : x.id;
    if (view !== "app") { setView("app"); setTimeout(() => document.getElementById(target)?.scrollIntoView({ behavior: "smooth" }), 60); return; }
    document.getElementById(target)?.scrollIntoView({ behavior: "smooth" });
  };
  const isOn = (x: Item) => view === "app" && (x.tab ? active === DEEPER && tab === x.id : active === x.id);

  return (
    <aside aria-label="Sections" style={{ width: "var(--sidebar-w)" }}
      className="fixed inset-y-0 left-0 z-[60] hidden flex-col border-r border-line bg-bg transition-[width] duration-200 motion-reduce:transition-none xl:flex">
      {/* brand + collapse */}
      <div className={`flex h-[52px] shrink-0 items-center border-b border-line ${collapsed ? "justify-center" : "justify-between pr-2 pl-4"}`}>
        <button onClick={() => { setView("app"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          className="flex items-center gap-2 font-display text-[15px] font-semibold tracking-[0.04em] text-text" title="DELTA PULSE: back to top"
          aria-label="DELTA PULSE: back to top">
          <span className="text-cyan"><BrandMark /></span>{!collapsed && "DELTA PULSE"}
        </button>
        {!collapsed && (
          <button onClick={() => setCollapsed(true)} aria-label="Collapse sidebar" title="Collapse sidebar"
            className="rounded-md p-1.5 text-muted hover:bg-panel hover:text-text"><ChevronsLeft size={16} /></button>
        )}
      </div>

      {/* sections */}
      <nav aria-label="Main" className="no-scrollbar flex-1 overflow-y-auto px-2 pt-3 pb-4">
        {GROUPS.map((g, gi) => (
          <div key={g.title} className={gi === 0 ? "" : "mt-4"}>
            {collapsed
              ? (gi > 0 && <div className="mx-3 mb-2 h-px bg-line" />)
              : <div className="px-3 pb-1.5 text-[12px] text-muted">{g.title}</div>}
            <ul className="space-y-0.5">
              {g.items.map((x) => {
                const on = isOn(x);
                return (
                  <li key={x.id}>
                    <button onClick={() => go(x)} aria-current={on ? "true" : undefined} title={collapsed ? x.label : undefined} aria-label={x.label}
                      className={`flex w-full items-center rounded-md py-1.5 text-[13px] ${collapsed ? "justify-center px-0" : "gap-3 px-3"} ${on ? "bg-cyan/10 text-cyan" : "text-muted hover:bg-panel hover:text-text"}`}>
                      <x.icon size={16} className="shrink-0" />
                      {!collapsed && <span className="truncate">{x.label}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* story + guide + expand */}
      <div className="shrink-0 space-y-1 border-t border-line p-2">
        <button onClick={() => { setView(view === "story" ? "app" : "story"); window.scrollTo({ top: 0 }); }}
          aria-pressed={view === "story"} title={collapsed ? "Your Story" : undefined} aria-label="Your Story"
          className={`flex w-full items-center rounded-md border py-2 text-[13px] font-medium ${collapsed ? "justify-center" : "gap-3 px-3"} ${view === "story" ? "border-amber bg-amber/15 text-amber" : "border-amber/45 text-amber hover:border-amber hover:bg-amber/10"}`}>
          <Sparkles size={15} className="shrink-0" />{!collapsed && "Your Story"}
        </button>
        <a href="/guide" title={collapsed ? "User guide" : undefined} aria-label="User guide"
          className={`flex items-center rounded-md py-2 text-[13px] text-muted hover:bg-panel hover:text-text ${collapsed ? "justify-center" : "gap-3 px-3"}`}>
          <BookOpen size={16} className="shrink-0" />{!collapsed && "User guide"}
        </a>
        {collapsed && (
          <button onClick={() => setCollapsed(false)} aria-label="Expand sidebar" title="Expand sidebar"
            className="flex w-full justify-center rounded-md py-2 text-muted hover:bg-panel hover:text-text"><ChevronsRight size={16} /></button>
        )}
      </div>
    </aside>
  );
}
