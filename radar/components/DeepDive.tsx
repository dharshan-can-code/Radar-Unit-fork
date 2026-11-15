"use client";
// Advanced tools behind tabs, so the main page stays readable.
import { useState } from "react";
import { Activity, CalendarDays, FlaskConical, FileText, Microscope, Waves } from "lucide-react";

export interface DeepTab { id: string; label: string; icon: React.ReactNode; blurb: string; render: () => React.ReactNode }

export const DEEP_ICONS = {
  now: <Waves size={15} />, scatter: <Activity size={15} />, lab: <FlaskConical size={15} />,
  timeline: <CalendarDays size={15} />, science: <Microscope size={15} />, methods: <FileText size={15} />,
};

export default function DeepDive({ tabs }: { tabs: DeepTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id);
  const t = tabs.find((x) => x.id === active) ?? tabs[0];
  return (
    <div>
      <div role="tablist" aria-label="Advanced tools" className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {tabs.map((x) => (
          <button key={x.id} role="tab" aria-selected={x.id === t.id} onClick={() => setActive(x.id)}
            className={`flex shrink-0 items-center gap-2 rounded-lg border px-3.5 py-2 text-[13px] font-medium transition-colors ${x.id === t.id ? "border-cyan/60 bg-cyan/10 text-cyan" : "border-line bg-panel text-muted hover:text-text"}`}>
            {x.icon}{x.label}
          </button>
        ))}
      </div>
      <p className="mt-3 mb-4 max-w-3xl text-[14px] text-text/75">{t.blurb}</p>
      <div role="tabpanel">{t.render()}</div>
    </div>
  );
}
