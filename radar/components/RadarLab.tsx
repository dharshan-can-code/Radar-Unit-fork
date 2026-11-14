"use client";
import { useMemo, useState } from "react";
import { FlaskConical } from "lucide-react";
import type { Screening } from "@/lib/data";

/**
 * Interactive TEACHING model of radar scattering. Values are illustrative:
 * the trends follow standard SAR physics (specular water, volume scattering,
 * water-trunk double bounce, shorter wavelengths stopped by canopy), but the
 * numbers are not measurements. Real numbers live in the Fingerprint.
 */
function model(water: number, trees: number, wind: number, band: "L" | "C") {
  const lin = (db: number) => 10 ** (db / 10);
  const pen = band === "L" ? 0.75 : 0.2; // fraction of signal that reaches the ground through canopy
  const reach = 1 - trees * (1 - pen);
  const wet = water > 0.05;
  // ground term: wet = specular (dark unless roughened by wind), dry soil = moderate
  const groundHH = wet ? -24 + 14 * wind : -11;
  const groundHV = wet ? -32 + 9 * wind : -19;
  // canopy volume term (HV-rich); L-band sees trunks/branches, C-band saturates on leaves
  const volHH = -14 + 6 * trees * (band === "C" ? 1.2 : 1);
  const volHV = -20 + 9 * trees * (band === "C" ? 1.1 : 1);
  // double bounce: needs standing water AND trunks, and signal reaching the ground
  const dbl = wet && trees > 0.1 ? Math.min(1, water / 0.6) * trees * reach : 0;
  const dblHH = -1 + 4 * dbl;
  const hh = 10 * Math.log10(lin(groundHH) * reach * (1 - trees * 0.6) + lin(volHH) * trees + (dbl > 0 ? lin(dblHH) * dbl : 0) + 1e-6);
  const hv = 10 * Math.log10(lin(groundHV) * reach * (1 - trees * 0.6) + lin(volHV) * trees + (dbl > 0 ? lin(dblHH - 12) * dbl : 0) + 1e-6);
  return { hh, hv, dbl, reach, wet };
}

export default function RadarLab({ screening }: { screening: Screening | null }) {
  const [water, setWater] = useState(0.8);
  const [trees, setTrees] = useState(0.7);
  const [wind, setWind] = useState(0.1);
  const [band, setBand] = useState<"L" | "C">("L");
  const r = useMemo(() => model(water, trees, wind, band), [water, trees, wind, band]);

  const s = screening;
  const label = !s ? "" :
    r.hh < s.open_water.hh_max_db.value && r.hv < s.open_water.hv_max_db.value ? "open water (cyan)" :
      r.hh > s.double_bounce.hh_min_db.value && r.hh - r.hv > s.double_bounce.hh_minus_hv_min_db.value ? "candidate flooded vegetation (amber)" :
        "no water signature";
  const nTrees = Math.round(trees * 8);
  const waterY = 150 - water * 40;
  const strokeDbl = 1 + r.dbl * 5, strokeVol = 1 + trees * 3 * (band === "C" ? 1.3 : 1);

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="rounded-xl border border-line bg-panel p-5 lg:col-span-3">
        <svg viewBox="0 0 520 220" className="w-full" role="img" aria-label="Radar scattering model">
          <defs>
            <marker id="arL" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#22d3ee" /></marker>
            <marker id="arA" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#f59e0b" /></marker>
            <marker id="arG" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#34d399" /></marker>
          </defs>
          {/* satellite */}
          <g transform="translate(30,14)"><rect width="34" height="12" rx="2" fill="#8b9ab5" /><rect x="-18" y="3" width="16" height="6" fill="#3b82f6" /><rect x="36" y="3" width="16" height="6" fill="#3b82f6" /></g>
          <text x="22" y="44" fill="#8b9ab5" fontSize="10">NISAR · {band === "L" ? "L-band 24 cm" : "C-band 5.6 cm (compare)"}</text>
          {/* ground + water */}
          <rect x="0" y="150" width="520" height="70" fill="#3a2f1f" />
          {r.wet && <rect x="0" y={waterY} width="520" height={220 - waterY} fill="#0e3a52" opacity="0.9" />}
          {r.wet && <path d={`M0 ${waterY} ${Array.from({ length: 27 }, (_, i) => `Q ${i * 20 + 10} ${waterY - 6 * wind} ${i * 20 + 20} ${waterY}`).join(" ")}`} fill="none" stroke="#5fb4d6" strokeWidth="1" opacity="0.7" />}
          {/* trees */}
          {Array.from({ length: nTrees }, (_, i) => {
            const x = 150 + i * 42;
            return <g key={i}><rect x={x - 3} y="88" width="6" height="64" fill="#5b4630" /><circle cx={x} cy="80" r="20" fill="#1f5f3f" opacity="0.85" /></g>;
          })}
          {/* incoming pulse */}
          <line x1="60" y1="30" x2={nTrees ? 190 : 260} y2={r.wet ? waterY : 150} stroke="#22d3ee" strokeWidth="2" markerEnd="url(#arL)" className="lab-pulse" />
          {/* specular reflection away (water, no trees) */}
          {r.wet && nTrees === 0 && <line x1="260" y1={waterY} x2="470" y2="30" stroke="#22d3ee" strokeWidth="2" strokeDasharray="5 4" markerEnd="url(#arL)" opacity={1 - wind * 0.6} />}
          {/* volume scattering */}
          {nTrees > 0 && [[-30, -26], [-8, -34], [18, -30], [32, -12]].map(([dx, dy], i) => (
            <line key={i} x1="192" y1="78" x2={192 + dx} y2={78 + dy} stroke="#34d399" strokeWidth={strokeVol} markerEnd="url(#arG)" opacity="0.85" />
          ))}
          {/* double bounce back to the satellite */}
          {r.dbl > 0.02 && <>
            <line x1="190" y1={waterY} x2="208" y2={waterY - 30} stroke="#f59e0b" strokeWidth={strokeDbl} />
            <line x1="208" y1={waterY - 30} x2="64" y2="34" stroke="#f59e0b" strokeWidth={strokeDbl} strokeDasharray="6 4" markerEnd="url(#arA)" className="lab-pulse" />
          </>}
        </svg>
        <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-muted">
          <span><b className="text-cyan">cyan</b> mirror reflection</span><span><b className="text-green">green</b> volume scattering in leaves</span><span><b className="text-amber">amber</b> double bounce (water under trees)</span>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-panel p-5 lg:col-span-2">
        <div className="flex items-center gap-2 text-sm font-semibold"><FlaskConical size={16} className="text-cyan" />Try it</div>
        {[
          ["Standing water", water, setWater, ["dry", "deep"]],
          ["Trees / crops", trees, setTrees, ["none", "dense"]],
          ["Wind on water", wind, setWind, ["calm", "rough"]],
        ].map(([name, v, set, ends]) => (
          <label key={name as string} className="mt-3 block text-[13px]">
            <span className="flex justify-between"><span>{name as string}</span><span className="text-muted">{(ends as string[])[0]} → {(ends as string[])[1]}</span></span>
            <input type="range" min={0} max={1} step={0.05} value={v as number} onChange={(e) => (set as (n: number) => void)(+e.target.value)} className="w-full" />
          </label>
        ))}
        <div className="mt-3 flex overflow-hidden rounded-md border border-line text-[12px]">
          {(["L", "C"] as const).map((b) => (
            <button key={b} onClick={() => setBand(b)} className={`flex-1 px-3 py-1.5 ${band === b ? "bg-cyan/15 text-cyan" : "text-muted"}`}>
              {b === "L" ? "L-band (NISAR)" : "C-band (shorter)"}
            </button>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 font-mono">
          <div className="rounded-lg bg-panel-2 p-2"><div className="text-[10px] text-muted">HH</div><div className="text-xl text-cyan">{r.hh.toFixed(1)} dB</div></div>
          <div className="rounded-lg bg-panel-2 p-2"><div className="text-[10px] text-muted">HV</div><div className="text-xl text-amber">{r.hv.toFixed(1)} dB</div></div>
        </div>
        <p className="mt-3 text-[13px]">DELTA PULSE would label this: <b className={label.includes("amber") ? "text-amber" : label.includes("cyan") ? "text-cyan" : "text-text"}>{label}</b></p>
        <p className="mt-2 text-[12px] text-muted">
          Try: water + dense trees with L-band, then switch to C-band. The double bounce fades, because short waves are stopped by the leaves.
          That is why NISAR&apos;s L-band can find flooding hidden under forest.
        </p>
        <p className="mt-2 rounded border border-rose/30 bg-rose/5 p-2 text-[11px] text-rose">Teaching model with illustrative numbers, not measurements. Real values are in the Fingerprint and Scatter Lab.</p>
      </div>
    </div>
  );
}
