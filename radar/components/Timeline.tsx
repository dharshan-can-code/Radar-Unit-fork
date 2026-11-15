"use client";
import { useMemo, useState } from "react";
import type { Granule, Inventory, Manifest } from "@/lib/data";

const DAY = 86400000;
// Documented permanent NISAR data gap (ASF NISAR Data User Guide, availability page).
const GAP = { from: Date.parse("2026-07-27T22:03:25Z"), to: Date.parse("2026-08-10T00:55:27Z") };
const MAT_COLOR: Record<string, string> = { VALIDATED: "var(--green)", PROVISIONAL: "var(--cyan)", BETA: "var(--muted)", OTHER: "var(--rose)" };

interface Props {
  inventory: Inventory; manifest: Manifest | null; pairIdx: number; setPairIdx: (i: number) => void;
}

export default function Timeline({ inventory, manifest, pairIdx, setPairIdx }: Props) {
  const first = Object.keys(inventory.areas)[0];
  const [area, setArea] = useState<string>(manifest && inventory.areas[manifest.area] ? manifest.area : first);
  const [picked, setPicked] = useState<Granule | null>(null);
  const inv = inventory.areas[area] ?? inventory.areas[first];
  const { lanes, t0, t1 } = useMemo(() => {
    const g = inv.granules;
    const keys = [...new Set(g.map((x) => `${x.track}${x.direction[0]} · f${x.frame} · ${x.range_bandwidth} MHz`))].sort();
    const ts = g.map((x) => Date.parse(x.date));
    return { lanes: keys, t0: Math.min(...ts) - 6 * DAY, t1: Math.max(...ts) + 6 * DAY };
  }, [inv]);
  const X = (t: number) => ((t - t0) / (t1 - t0)) * 100;
  const pair = manifest?.pairs[pairIdx];
  const processed = new Set(manifest?.area === area ? manifest.observations.map((o) => o.date) : []);
  const months: number[] = [];
  for (let d = new Date(t0); d.getTime() < t1; d.setUTCMonth(d.getUTCMonth() + 1, 1)) months.push(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));

  return (
    <div className="rounded-xl border border-line bg-panel p-5">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex overflow-hidden rounded-md border border-line text-sm">
          {Object.entries(inventory.areas).map(([k, a]) => (
            <button key={k} onClick={() => { setArea(k); setPicked(null); }} aria-pressed={area === k}
              className={`px-3 py-1.5 ${area === k ? "bg-cyan/15 text-cyan" : "text-muted hover:text-text"}`}>{a.name}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 text-[12px] text-muted">
          {Object.entries(MAT_COLOR).filter(([k]) => k !== "OTHER").map(([k, c]) => (
            <span key={k} className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: c }} />{k}</span>
          ))}
          <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-full border border-cyan" />HH only</span>
          <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-4 bg-rose/20" />documented data gap</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="relative min-w-[720px]">
          <div className="relative ml-44 h-5 border-b border-line">
            {months.map((t) => (
              <span key={t} className="absolute -translate-x-1/2 font-mono text-[11px] text-muted" style={{ left: `${X(t)}%` }}>
                {new Date(t).toISOString().slice(0, 7)}
              </span>
            ))}
          </div>
          {lanes.map((lane) => {
            const gs = inv.granules.filter((x) => `${x.track}${x.direction[0]} · f${x.frame} · ${x.range_bandwidth} MHz` === lane);
            const primary = gs.some((x) => x.primary_stack);
            return (
              <div key={lane} className={`flex items-center border-b border-line/50 ${primary ? "bg-cyan/5" : ""}`}>
                <div className="w-44 shrink-0 py-2 pr-2 font-mono text-[11px]">
                  <span className={primary ? "text-cyan" : "text-muted"}>{lane}</span>
                  {primary && <div className="text-[11px] text-cyan/70">primary stack</div>}
                </div>
                <div className="relative h-9 flex-1">
                  <div className="absolute inset-y-0 bg-rose/15" style={{ left: `${X(GAP.from)}%`, width: `${X(GAP.to) - X(GAP.from)}%` }} />
                  {gs.map((x) => {
                    const dual = x.freqA_pols.includes("HV");
                    const isProc = primary && processed.has(x.date) && x.primary_stack;
                    const inPair = isProc && pair && (x.date === pair.before || x.date === pair.after);
                    const col = MAT_COLOR[x.maturity] ?? MAT_COLOR.OTHER;
                    return (
                      <button key={x.scene_name}
                        title={`${x.date} · ${x.maturity} · ${x.crid} · ${x.freqA_pols} · covers ${(x.aoi_overlap_frac * 100).toFixed(0)}% of area${isProc ? " · processed (click to select pair)" : ""}`}
                        aria-label={`${x.date}, track ${x.track}${x.direction[0]}, ${x.maturity}, ${x.freqA_pols}${isProc ? ", processed" : ""}`}
                        aria-pressed={picked?.scene_name === x.scene_name}
                        onClick={() => {
                          setPicked(x);
                          if (!isProc || !manifest) return;
                          const i = manifest.pairs.findIndex((p) => p.after === x.date);
                          setPairIdx(i >= 0 ? i : 0);
                        }}
                        className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full hover:scale-125 ${inPair ? "ring-2 ring-amber ring-offset-1 ring-offset-panel" : picked?.scene_name === x.scene_name ? "ring-2 ring-text ring-offset-1 ring-offset-panel" : ""}`}
                        style={{ left: `${X(Date.parse(x.date))}%`, background: dual ? col : "transparent", border: `1.5px solid ${col}`,
                          opacity: x.aoi_overlap_frac < 0.5 ? 0.45 : 1 }} />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-4 border-t border-line pt-4" aria-live="polite">
        {picked ? (() => {
          const isPrimary = picked.primary_stack;
          const isProc = isPrimary && processed.has(picked.date);
          return (
            <>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-mono text-[15px] text-text">{picked.start_time.slice(0, 16).replace("T", " ")} UTC</span>
                <span className="rounded-sm border px-1.5 py-[3px] font-mono text-[11px] leading-none" style={{ color: MAT_COLOR[picked.maturity] ?? MAT_COLOR.OTHER, borderColor: MAT_COLOR[picked.maturity] ?? MAT_COLOR.OTHER }}>{picked.maturity} {picked.crid}</span>
                <span className={`text-[12px] ${isProc ? "text-green" : "text-muted"}`}>
                  {isProc ? "Processed: part of the analysis on this page" : isPrimary ? "Primary stack, listed in the archive but not processed here" : "Listed in the archive; a different track, frame or bandwidth, so it is not mixed into the analysis"}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  ["Track", `${picked.track} ${picked.direction.toLowerCase()}`],
                  ["Frame", String(picked.frame)],
                  ["Channels", picked.freqA_pols],
                  ["Bandwidth", `${picked.range_bandwidth} MHz`],
                  ["Frame coverage", picked.frame_coverage],
                  ["Covers study area", `${(picked.aoi_overlap_frac * 100).toFixed(0)}%`],
                ].map(([k, v]) => (
                  <div key={k} className="min-w-0">
                    <dt className="text-[12px] text-muted">{k}</dt>
                    <dd className="mt-0.5 truncate font-mono text-[13px] text-text">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 font-mono text-[11px] break-all text-muted">{picked.scene_name}</p>
            </>
          );
        })() : (
          <p className="text-[13px] text-muted">Select any dot to see that acquisition: time, track, channels, release and how much of the study area it covers.</p>
        )}
      </div>
      <p className="mt-4 max-w-[80ch] text-[12px] text-muted">
        Every dot is a real NISAR L2 GCOV granule from the ASF archive that covers ≥25% of the study area ({inventory.source}; retrieved {inventory.generated_utc.slice(0, 10)}).
        Nothing is interpolated between dots. The primary stack keeps one track, frame, bandwidth and processing release so that dates are comparable.
        {manifest?.area === area ? " Click a processed dot to compare it with the observation before it." : ""}
      </p>
    </div>
  );
}
