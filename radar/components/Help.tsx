"use client";
import { useEffect } from "react";
import { X } from "lucide-react";
import { Tag } from "@/components/Fingerprint";

const STEPS: [string, string][] = [
  ["Look at the case study", "The page opens on Tonle Sap Lake, Cambodia: 10 real NISAR radar images from June to October 2026. Drag the round ⇔ handle on the map to compare two dates."],
  ["Pick two dates", "The buttons above the map (e.g. 09-11 → 09-23) choose which pair of acquisitions you compare. Red numbers mean the gap was longer than the usual 12 days."],
  ["Change the view", "Before / After shows the radar images. Measured change colours what got brighter (amber) or darker (blue). Screening marks signatures that may be water (cyan) or flooded vegetation (amber)."],
  ["Inspect a spot", "Click the map to inspect a small area, or press Draw region and drag a box. The Radar Change Fingerprint below updates for that area."],
  ["Explore anywhere", "Type a place or coordinates in the search box (e.g. \"Manaus\" or \"22.02, 89.31\"), click a footprint on the Newest acquisitions map, or press Analyse a new place here and click the map."],
  ["Choose acquisitions", "Pick a stack (one satellite track; the best one is pre-selected), choose 2 or more dates, a window size and Quick (80 m, ~10 s) or Detailed (40 m, ~15 s). Press Analyse."],
  ["Share and download", "Share link copies a link that reopens the result. CSV downloads the numbers; Change map downloads the image; Data (JSON) has everything, including where the data came from."],
];

export default function Help({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-auto bg-bg/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="How to use DELTA PULSE" onClick={onClose}>
      <div className="my-8 w-full max-w-3xl rounded-xl border border-line bg-panel p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">How to use DELTA PULSE</h2>
            <p className="mt-1 text-sm text-muted">No radar background needed. For pictures, examples and answers to common questions, open the <a href="/guide" className="text-cyan underline">full User Guide</a>.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-md border border-line p-1.5 text-muted hover:text-text"><X size={16} /></button>
        </div>

        <ol className="mt-5 space-y-3">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan/15 font-mono text-xs text-cyan">{i + 1}</span>
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
          <li><b className="text-cyan">PROVISIONAL</b>: calibrated, partially validated (June–Oct 2026).</li>
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
          <button onClick={onClose} className="rounded-md bg-cyan px-4 py-2 text-sm font-medium text-bg">Got it</button>
          <a href="/guide" className="rounded-md border border-cyan/40 px-4 py-2 text-sm text-cyan hover:bg-cyan/10">Open the full User Guide</a>
        </div>
      </div>
    </div>
  );
}
