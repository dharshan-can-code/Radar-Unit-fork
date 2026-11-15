"use client";
// Plain-language guides: how to read the map, and what the Fingerprint result means.
import { BoxSelect, Layers, MousePointerClick, SplitSquareHorizontal } from "lucide-react";
import type { Mode } from "@/components/Explorer";
import type { Fingerprint as FP, Verdict } from "@/lib/data";
import { fmtDate } from "@/lib/story";

const MODES: { v: Mode; icon: React.ReactNode; title: string; body: React.ReactNode }[] = [
  { v: "compare", icon: <SplitSquareHorizontal size={16} />, title: "Before / After",
    body: <>Drag the slider to compare two dates. <b>Black</b> is calm water (it reflects the radar away). <b>Light grey</b> is land, trees and towns.</> },
  { v: "change", icon: <Layers size={16} />, title: "Measured change",
    body: <><Chip c="bg-amber" /> <b>Amber</b>: the echo got stronger, often water rising under trees. <Chip c="bg-blue" /> <b>Blue</b>: the echo got weaker, often new open water or drying plants.</> },
  { v: "screening", icon: <BoxSelect size={16} />, title: "Screening",
    body: <><Chip c="bg-cyan" /> <b>Cyan</b>: looks like open water. <Chip c="bg-amber" /> <b>Orange</b>: looks like water under trees. These are signatures, not confirmed floods.</> },
];

function Chip({ c }: { c: string }) {
  return <i className={`inline-block h-2.5 w-2.5 translate-y-[1px] rounded-sm ${c}`} />;
}

export function MapGuide({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  return (
    <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_1fr_1fr_0.9fr]">
      {MODES.map((x) => (
        <button key={x.v} onClick={() => setMode(x.v)} aria-pressed={mode === x.v}
          className={`rounded-xl border p-4 text-left text-[13px] leading-relaxed transition-colors ${mode === x.v ? "border-cyan/60 bg-cyan/5" : "border-line bg-panel hover:border-cyan/30"}`}>
          <div className={`flex items-center gap-2 text-sm font-semibold ${mode === x.v ? "text-cyan" : "text-text"}`}>{x.icon}{x.title}</div>
          <div className="mt-1.5 text-text/75">{x.body}</div>
        </button>
      ))}
      <div className="rounded-xl border border-dashed border-line p-4 text-[13px] leading-relaxed text-text/75">
        <div className="flex items-center gap-2 text-sm font-semibold text-text"><MousePointerClick size={16} className="text-green" />Then pick an area</div>
        <div className="mt-1.5">Click a spot or draw a box on the map. The panel below explains what changed there.</div>
      </div>
    </div>
  );
}

const share = (x: Record<string, number>) => { const t = (x.water ?? 0) + (x.double ?? 0) + (x.other ?? 0); return t ? (x.double ?? 0) / t : 0; };

export function PlainVerdict({ fp, verdict }: { fp: FP; verdict: Verdict }) {
  const a = fmtDate(fp.before.date), b = fmtDate(fp.after.date);
  const [hh] = fp.channels;
  const d0 = share(fp.screening.before), d1 = share(fp.screening.after);
  let head: string, body: string, tone: string;
  if (verdict === "Possible inundation-related signal") {
    tone = "border-amber/50 bg-amber/5";
    head = "Water is likely rising here";
    body = d1 - d0 >= 0.2
      ? `Between ${a} and ${b}, the "water under trees" echo spread from ${Math.round(d0 * 100)}% to ${Math.round(d1 * 100)}% of this area. That is the radar pattern of floodwater rising beneath forest or shrubs.`
      : hh.delta_mean_db < 0
        ? `Between ${a} and ${b}, the ground turned radar-dark, the way calm open water looks. This area may have become flooded.`
        : `Between ${a} and ${b}, the echo brightened much more in one radar channel than the other, the pattern of water rising beneath vegetation.`;
  } else if (verdict === "Radar change detected") {
    tone = "border-blue/50 bg-blue/5";
    head = "Something changed, but it isn't clearly water";
    body = `The radar echo changed between ${a} and ${b}, but not in a pattern that clearly points to water. Growing crops, wet leaves or a mix of land types can do this. Try a smaller area.`;
  } else if (verdict === "No significant radar change") {
    tone = "border-line bg-panel";
    head = "Little changed here";
    body = `Between ${a} and ${b}, the echo across this area changed by less than a doubling or halving, our threshold for a real change. Try another date pair or a smaller area.`;
  } else {
    tone = "border-rose/50 bg-rose/5";
    head = "Not enough radar data here";
    body = "Too little of this area was measured on both dates to say anything. Pick a spot inside the radar image.";
  }
  // The average echo can hide a big shift in where the "water under trees" signature is.
  if (verdict !== "Possible inundation-related signal" && verdict !== "Insufficient evidence" && Math.abs(d1 - d0) >= 0.1) {
    head = d1 < d0 ? "Water may be draining from under the trees" : "Water may be rising under the trees";
    tone = "border-amber/40 bg-amber/5";
    body += d1 < d0
      ? ` However, the "water under trees" echo shrank from ${Math.round(d0 * 100)}% to ${Math.round(d1 * 100)}% of the area, a sign that water may be draining from under the vegetation.`
      : ` However, the "water under trees" echo grew from ${Math.round(d0 * 100)}% to ${Math.round(d1 * 100)}% of the area, a sign that water may be rising under the vegetation.`;
  }
  return (
    <div className={`mb-4 rounded-2xl border p-5 sm:p-6 ${tone}`}>
      <div className="text-[12px] font-medium tracking-[0.14em] text-muted uppercase">In plain words</div>
      <div className="mt-1 text-2xl font-semibold">{head}</div>
      <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-text/85">{body} Nothing here is confirmed on the ground; the details below show the evidence and what is still missing.</p>
      <details className="mt-3 text-[13px] text-muted">
        <summary className="cursor-pointer text-text/80 hover:text-text">How to read the numbers below</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li><b className="text-text">dB (decibels)</b> measure how strong the radar echo is. <b className="text-text">+3 dB means twice as strong</b>, −3 dB means half.</li>
          <li><b className="text-text">HH</b> and <b className="text-text">HV</b> are two ways the radar sends and listens. HH lights up strongly when water stands under trunks; HV responds to leaves and branches.</li>
          <li>The <b className="text-text">bar charts</b> show how many map cells got brighter (amber, right) or darker (blue, left), and by how much.</li>
          <li>The <b className="text-text">time series</b> shows the average echo on every pass, so you can see when change happened.</li>
        </ul>
      </details>
    </div>
  );
}
