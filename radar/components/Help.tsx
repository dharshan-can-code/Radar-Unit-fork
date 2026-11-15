"use client";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Tag } from "@/components/Fingerprint";

const STEPS: [string, string][] = [
  ["Start with the case study", "The app opens on Tonle Sap Lake, Cambodia: 10 real NISAR radar images from June to October 2026. Start here explains the idea; Explore a place shows the short answer, then the map."],
  ["Pick two dates", "The buttons above the map (e.g. 11 Sept → 23 Sept) choose which two satellite passes you compare. Drag the round handle on the map to slide between them. Red numbers mean the gap was longer than the usual 12 days."],
  ["Change the view", "Before and after shows the radar images. What changed colours where the echo got stronger (amber) or weaker (blue). Likely water marks ground that looks like open water (cyan) or water under trees (amber)."],
  ["Ask about an area", "Click the map to ask about a small area, or press Draw region and drag a box. The answer appears right under the map, and the evidence section below it shows every number."],
  ["Explore anywhere", "Press Choose another place at the top of Explore a place. Then open a saved example, type a place or coordinates (e.g. \"Manaus\" or \"22.02, 89.31\"), or click a footprint on the Newest acquisitions globe."],
  ["Choose acquisitions", "Pick a stack (one satellite track; the best one is pre-selected), choose 2 or more dates, a window size and Quick (80 m, ~10 s) or Detailed (40 m, ~15 s). Press Analyse."],
  ["Share and download", "Share link copies a link that reopens the result. CSV downloads the numbers; Change map downloads the image; Data (JSON) has everything, including where the data came from."],
];

export default function Help({ onClose }: { onClose: () => void }) {
  const closeBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  // Move focus into the dialog, stop the page scrolling behind it, and put focus back on close.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    closeBtn.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = overflow; before?.focus?.(); };
  }, []);
  return (
    <div className="fade-in fixed inset-0 z-[100] flex items-start justify-center overflow-auto bg-bg/85 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="How to use DELTA PULSE" onClick={onClose}>
      <div className="panel-in my-8 w-full max-w-3xl rounded-lg border border-line-strong bg-panel p-6 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)] sm:p-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-medium">How to use DELTA PULSE</h2>
            <p className="mt-1 text-sm text-muted">No radar background needed. For pictures, examples and answers to common questions, open the <a href="/guide" className="text-accent underline">full User Guide</a>.</p>
          </div>
          <button ref={closeBtn} onClick={onClose} aria-label="Close" className="rounded-md border border-line p-1.5 text-muted hover:text-text"><X size={16} /></button>
        </div>

        <ol className="mt-5 space-y-3">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15 font-mono text-xs text-accent">{i + 1}</span>
              <div><div className="text-sm font-semibold text-text">{t}</div><p className="text-[13px] leading-relaxed text-muted">{d}</p></div>
            </li>
          ))}
        </ol>

        <h3 className="mt-6 text-sm font-semibold">What the labels mean</h3>
        <ul className="mt-2 space-y-1.5 text-[13px] text-muted">
          <li className="flex gap-2"><Tag kind="OBSERVED" /> measured directly (by NISAR, or a dataset such as rainfall)</li>
          <li className="flex gap-2"><Tag kind="CALCULATED" /> maths on those measurements (averages, changes)</li>
          <li className="flex gap-2"><Tag kind="INTERPRETED" /> a possible explanation; other explanations exist</li>
          <li className="flex gap-2"><Tag kind="UNCONFIRMED" /> needs more evidence before anyone should rely on it</li>
        </ul>

        <h3 className="mt-6 text-sm font-semibold">Product badges</h3>
        <ul className="mt-2 space-y-1 text-[13px] text-muted">
          <li><b className="text-green">VALIDATED</b>: NASA&apos;s fully validated science release (from 21 Oct 2026).</li>
          <li><b className="text-accent">PROVISIONAL</b>: calibrated, partially validated (June–Oct 2026).</li>
          <li><b className="text-amber">URGENT RESPONSE</b>: published fastest, for events. Newest data, but not a validated science release.</li>
          <li>Different releases are never mixed in one comparison, because the numbers would not be comparable.</li>
        </ul>

        <h3 className="mt-6 text-sm font-semibold">Good to know</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-muted">
          <li>Everything shown is real data: NISAR from NASA&apos;s ASF archive, rainfall from ERA5 via Open-Meteo. Nothing is simulated.</li>
          <li>NISAR passes over a place about every 12 days. &quot;Live&quot; means the archive is searched right now; the newest image may be days old.</li>
          <li>Radar change alone never proves flooding. The app tells you what extra evidence would be needed.</li>
          <li>If live search is offline, the Tonle Sap case study still works. To run live search yourself, start the server with <code className="text-text">npm.cmd run api</code> in the radar folder.</li>
        </ul>
        <div className="mt-6 flex gap-3">
          <button onClick={onClose} className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent">Got it</button>
          <a href="/guide" className="rounded-md border border-accent/40 px-4 py-2 text-sm text-accent hover:bg-accent/10">Open the full User Guide</a>
        </div>
      </div>
    </div>
  );
}
