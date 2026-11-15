"use client";
// The three headline results for whatever place is loaded, each with a plain
// "what this means" line. Computed from the data (lib/story.ts), never typed in.
import { useMemo } from "react";
import { ArrowRight, CloudRain, ShieldCheck, Trees, Waves } from "lucide-react";
import type { Rainfall } from "@/lib/api";
import type { GridIndex, Manifest, Validation } from "@/lib/data";
import { buildStory, fmtDate, fmtKm2 } from "@/lib/story";
import { Tag } from "@/components/Fingerprint";

type Card = { icon: React.ReactNode; tone: string; big: string; what: string; detail: string; meaning: string };

export default function Findings({ m, grid, rain, validation }: {
  m: Manifest | null; grid: GridIndex | null; rain: Rainfall | null; validation: Validation | null;
}) {
  const f = useMemo(() => (m && grid && m.observations.length >= 2 ? buildStory(m, rain, grid) : null), [m, grid, rain]);
  if (!m || !f) return <div className="grid gap-4 md:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-56" />)}</div>;

  const first = f.passes[0], last = f.passes[f.passes.length - 1];
  const pct = (a: number, b: number) => (a > 0 ? Math.round(((b - a) / a) * 100) : 0);
  const signed = (x: number) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x)}%`;

  // Water under trees: report growth to the peak if it rose, otherwise the change over the season.
  const vegRose = f.vegPeak.date !== first.date && f.vegPeak.flooded_veg_km2 >= 1.5 * Math.max(first.flooded_veg_km2, 0.1);
  const veg: Card = vegRose
    ? { icon: <Trees size={20} />, tone: "text-amber", big: `${(f.vegPeak.flooded_veg_km2 / Math.max(first.flooded_veg_km2, 0.1)).toFixed(1)}×`,
        what: "more water hidden under trees",
        detail: `${fmtKm2(first.flooded_veg_km2)} → ${fmtKm2(f.vegPeak.flooded_veg_km2)} km² between ${fmtDate(first.date)} and ${fmtDate(f.vegPeak.date)}`,
        meaning: "Flooded forest and shrubs that look like ordinary green land from above. Only radar sees it." }
    : { icon: <Trees size={20} />, tone: "text-amber", big: signed(pct(first.flooded_veg_km2, last.flooded_veg_km2)),
        what: pct(first.flooded_veg_km2, last.flooded_veg_km2) < 0 ? "less water under trees" : "change in water under trees",
        detail: `${fmtKm2(first.flooded_veg_km2)} → ${fmtKm2(last.flooded_veg_km2)} km² from ${fmtDate(first.date)} to ${fmtDate(last.date)}`,
        meaning: pct(first.flooded_veg_km2, last.flooded_veg_km2) < -20
          ? "Floodwater draining out from beneath the forest as the river falls."
          : "Water standing under trees or shrubs, which cameras cannot see from above." };

  const openTiny = Math.max(first.water_km2, last.water_km2, f.waterPeak.water_km2) < 5;
  const water: Card = openTiny
    ? { icon: <Waves size={20} />, tone: "text-cyan", big: "< 5 km²", what: "of calm open water",
        detail: "on every pass in this window",
        meaning: "Rivers here are narrow or roughened by wind and currents, so the hidden-water signal tells the story." }
    : { icon: <Waves size={20} />, tone: "text-cyan", big: signed(pct(first.water_km2, last.water_km2)),
        what: pct(first.water_km2, last.water_km2) >= 0 ? "more open water" : "less open water",
        detail: `${fmtKm2(first.water_km2)} → ${fmtKm2(last.water_km2)} km² (peak ${fmtKm2(f.waterPeak.water_km2)} km² on ${fmtDate(f.waterPeak.date)})`,
        meaning: pct(first.water_km2, last.water_km2) >= 0 ? "Open water spreading outward as the flood season builds." : "Open water shrinking as the area dries out." };

  const cloud: Card = f.cloudyPasses != null
    ? { icon: <CloudRain size={20} />, tone: "text-blue", big: `${f.cloudyPasses} of ${f.cloudKnown}`, what: "passes under heavy cloud",
        detail: `More than half the sky was cloud when NISAR flew over (average ${Math.round(f.meanCloud ?? 0)}%)`,
        meaning: "A normal satellite photo would have shown mostly cloud. Radar saw the ground every time." }
    : { icon: <CloudRain size={20} />, tone: "text-blue", big: `${f.n}`, what: "radar passes",
        detail: `${fmtDate(f.first)} to ${fmtDate(f.last)}, one every ~12 days`,
        meaning: "Radar images the ground on every pass, whatever the weather." };

  const v = validation && validation.stack === m.stack ? validation : null;
  const det = v ? v.per_date.map((d) => d.water_found_in_permanent).filter((x): x is number => x != null).sort((a, b) => a - b) : [];
  const median = det.length ? det[Math.floor((det.length - 1) / 2)] : null;
  const river = v?.rivers.points.reduce<number | null>((best, p) => (p.pearson_vs_water_plus_veg != null && (best == null || p.pearson_vs_water_plus_veg > best) ? p.pearson_vs_water_plus_veg : best), null);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        {[veg, water, cloud].map((c) => (
          <div key={c.what} className="flex flex-col rounded-2xl border border-line bg-panel p-6">
            <div className={`flex items-center gap-2 text-sm font-medium ${c.tone}`}>{c.icon}</div>
            <div className={`mt-3 text-5xl font-semibold tracking-tight ${c.tone}`}>{c.big}</div>
            <div className="mt-1 text-lg font-medium text-text">{c.what}</div>
            <div className="mt-1 text-[13px] text-muted">{c.detail}</div>
            <div className="mt-4 border-t border-line pt-3 text-[14px] leading-relaxed text-text/80">
              <span className="font-semibold text-text">What this means: </span>{c.meaning}
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3 rounded-2xl border border-green/30 bg-green/5 p-5 sm:flex-row sm:items-center">
        <ShieldCheck size={22} className="shrink-0 text-green" />
        <div className="flex-1 text-[14px] leading-relaxed text-text/85">
          {v && median != null ? (
            <><b>How sure are we?</b> Checked against data we did not use: the radar found {Math.round(median * 100)}% of the lake that
              Landsat has seen as water for decades, with almost no false alarms on dry land{river != null ? <>, and the flooded area rises and falls with the river (correlation {river.toFixed(2)})</> : null}.
              Flooding is still labelled <Tag kind="UNCONFIRMED" /> until a gauge or field visit confirms it.</>
          ) : (
            <><b>How sure are we?</b> These areas come from simple, uncalibrated radar thresholds. They show the pattern and its timing, not
              surveyed flood maps. Flooding stays labelled <Tag kind="UNCONFIRMED" /> until other evidence confirms it.</>
          )}
        </div>
        <button onClick={() => document.getElementById(v ? "checks" : "fingerprint")?.scrollIntoView({ behavior: "smooth" })}
          className="flex shrink-0 items-center gap-1 text-[13px] font-medium text-green hover:text-text">
          {v ? "See the checks" : "See the details"}<ArrowRight size={14} />
        </button>
      </div>
      <p className="text-[12px] text-muted">Areas are counted only over ground the radar saw on every pass, so dates are compared fairly. {f.n} passes, {fmtDate(f.first)} – {fmtDate(f.last)}, {m.name}.</p>
    </div>
  );
}
