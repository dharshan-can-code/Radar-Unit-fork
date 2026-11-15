"use client";
// Advanced tools behind tabs, so the main page stays readable.
import { Activity, CalendarDays, FlaskConical, FileText, Microscope, Waves } from "lucide-react";

export interface DeepTab { id: string; label: string; icon: React.ReactNode; blurb: string; render: () => React.ReactNode }

export const DEEP_ICONS = {
  now: <Waves size={15} />, scatter: <Activity size={15} />, lab: <FlaskConical size={15} />,
  timeline: <CalendarDays size={15} />, science: <Microscope size={15} />, methods: <FileText size={15} />,
};

/** Controlled: the page owns which tool is open, so the sidebar can open one directly. */
export default function DeepDive({ tabs, active, onActiveChange: setActive }: { tabs: DeepTab[]; active: string; onActiveChange: (id: string) => void }) {
  const t = tabs.find((x) => x.id === active) ?? tabs[0];
  const onKey = (e: React.KeyboardEvent) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = tabs[(tabs.findIndex((x) => x.id === t.id) + d + tabs.length) % tabs.length];
    setActive(next.id);
    document.getElementById(`deep-tab-${next.id}`)?.focus();
  };
  return (
    <div>
      <div role="tablist" aria-label="Advanced tools" onKeyDown={onKey} className="no-scrollbar flex overflow-x-auto border-b border-line">
        {tabs.map((x) => (
          <button key={x.id} role="tab" id={`deep-tab-${x.id}`} aria-selected={x.id === t.id} aria-controls="deep-panel" tabIndex={x.id === t.id ? 0 : -1} onClick={() => setActive(x.id)}
            className={`relative flex shrink-0 items-center gap-2 px-3.5 py-3 text-[14px] font-medium whitespace-nowrap sm:px-4 ${x.id === t.id ? "text-text" : "text-muted hover:text-text"}`}>
            <span className={x.id === t.id ? "text-accent" : ""}>{x.icon}</span>{x.label}
            <span aria-hidden className={`absolute inset-x-2 -bottom-px h-0.5 bg-accent transition-opacity duration-200 ${x.id === t.id ? "opacity-100" : "opacity-0"}`} />
          </button>
        ))}
      </div>
      <p className="mt-5 mb-5 max-w-[70ch] text-[15px] text-text/75">{t.blurb}</p>
      <div role="tabpanel" id="deep-panel" aria-labelledby={`deep-tab-${t.id}`} key={t.id} className="fade-in">{t.render()}</div>
    </div>
  );
}
