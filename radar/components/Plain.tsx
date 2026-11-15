"use client";
// Plain-language guides: how to read the map, and what the Fingerprint result means.
import { BoxSelect, Layers, MousePointerClick, SplitSquareHorizontal } from "lucide-react";
import type { Mode } from "@/components/Explorer";
import type { Fingerprint as FP, Verdict } from "@/lib/data";
import { fmtDate } from "@/lib/story";

const MODES: { v: Mode; icon: React.ReactNode; title: string; body: React.ReactNode }[] = [
  { v: "compare", icon: <SplitSquareHorizontal size={15} />, title: "Before / After",
    body: <>Drag the handle to compare two dates. <b className="text-text">Black</b> is calm water, which reflects the radar away. <b className="text-text">Light grey</b> is land, trees and towns.</> },
  { v: "change", icon: <Layers size={15} />, title: "Measured change",
    body: <><Chip c="bg-map-veg" /> <b className="text-text">Amber</b>: the echo got stronger, often water rising under trees. <Chip c="bg-map-darker" /> <b className="text-text">Blue</b>: the echo got weaker, often new open water or drying plants.</> },
  { v: "screening", icon: <BoxSelect size={15} />, title: "Screening",
    body: <><Chip c="bg-map-water" /> <b className="text-text">Cyan</b>: looks like open water. <Chip c="bg-map-veg" /> <b className="text-text">Orange</b>: looks like water under trees. These are signatures, not confirmed floods.</> },
];

function Chip({ c }: { c: string }) {
  return <i className={`inline-block h-2.5 w-2.5 translate-y-[1px] ${c}`} />;
}

/** One line under the map: how to read the view that is on screen, and what to do next. */
export function MapGuide({ mode }: { mode: Mode }) {
  const x = MODES.find((k) => k.v === mode) ?? MODES[0];
  return (
    <div className="grid gap-x-10 gap-y-2 border-t border-line px-3 py-3 text-[13px] leading-relaxed text-text/75 sm:px-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <p key={x.v} className="fade-in flex items-start gap-2">
        <span className="mt-[3px] shrink-0 text-accent">{x.icon}</span>
        <span><span className="font-semibold text-text">{x.title}.</span> {x.body}</span>
      </p>
      <p className="flex items-start gap-2">
        <MousePointerClick size={15} className="mt-[3px] shrink-0 text-green" />
        <span><span className="font-semibold text-text">Then pick an area.</span> Click a spot or draw a box on the map. The panel below explains what changed there.</span>
      </p>
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
    tone = "border-amber/50 bg-amber/[0.06]";
    head = "Water is likely rising here";
    body = d1 - d0 >= 0.2
      ? `Between ${a} and ${b}, the "water under trees" echo spread from ${Math.round(d0 * 100)}% to ${Math.round(d1 * 100)}% of this area. That is the radar pattern of floodwater rising beneath forest or shrubs.`
      : hh.delta_mean_db < 0
        ? `Between ${a} and ${b}, the ground turned radar-dark, the way calm open water looks. This area may have become flooded.`
        : `Between ${a} and ${b}, the echo brightened much more in one radar channel than the other, the pattern of water rising beneath vegetation.`;
  } else if (verdict === "Radar change detected") {
    tone = "border-blue/50 bg-blue/[0.06]";
    head = "Something changed, but it isn't clearly water";
    body = `The radar echo changed between ${a} and ${b}, but not in a pattern that clearly points to water. Growing crops, wet leaves or a mix of land types can do this. Try a smaller area.`;
  } else if (verdict === "No significant radar change") {
    tone = "border-line bg-panel";
    head = "Little changed here";
    body = `Between ${a} and ${b}, the echo across this area changed by less than a doubling or halving, our threshold for a real change. Try another date pair or a smaller area.`;
  } else {
    tone = "border-rose/50 bg-rose/[0.06]";
    head = "Not enough radar data here";
    body = "Too little of this area was measured on both dates to say anything. Pick a spot inside the radar image.";
  }
  // The average echo can hide a big shift in where the "water under trees" signature is.
  if (verdict !== "Possible inundation-related signal" && verdict !== "Insufficient evidence" && Math.abs(d1 - d0) >= 0.1) {
    head = d1 < d0 ? "Water may be draining from under the trees" : "Water may be rising under the trees";
    tone = "border-amber/40 bg-amber/[0.06]";
    body += d1 < d0
      ? ` However, the "water under trees" echo shrank from ${Math.round(d0 * 100)}% to ${Math.round(d1 * 100)}% of the area, a sign that water may be draining from under the vegetation.`
      : ` However, the "water under trees" echo grew from ${Math.round(d0 * 100)}% to ${Math.round(d1 * 100)}% of the area, a sign that water may be rising under the vegetation.`;
  }
  return (
    <div className={`mb-4 rounded-lg border p-5 sm:p-7 ${tone}`}>
      <h3 className="text-2xl leading-tight font-medium sm:text-[2rem]">{head}</h3>
      <p className="mt-3 max-w-[70ch] text-[15px] leading-relaxed text-text/85 sm:text-[16px]">{body} Nothing here is confirmed on the ground; the details below show the evidence and what is still missing.</p>
      <details className="mt-4 text-[13px] text-muted">
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
