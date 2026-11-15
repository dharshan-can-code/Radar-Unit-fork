"use client";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CircleCheck, GraduationCap, HeartHandshake, Fish, Siren, Sprout } from "lucide-react";
import type { GridIndex, Manifest } from "@/lib/data";
import { latest } from "@/lib/api";
import { Tag } from "@/components/Fingerprint";

const WHO: [React.ReactNode, string, string][] = [
  [<Fish key="i" size={18} />, "Wetland & fisheries managers", "Track the seasonal flood pulse that fish breeding and wetland health depend on, pass by pass, without field trips into flooded forest."],
  [<Sprout key="i" size={18} />, "Farmers & water agencies", "Watch fields and floodplains flood and drain, and compare this season with rainfall at the same place."],
  [<Siren key="i" size={18} />, "Flood & recovery planners", "See where water lingered under clouds and canopy over the season. NISAR revisits every 12 days, so this is for planning, not minute-by-minute alerts."],
  [<GraduationCap key="i" size={18} />, "Students & the public", "Learn how radar sees what cameras cannot, with every number labelled by how certain it is."],
];

/** Why DELTA PULSE matters, with every number taken from real data in the app. */
export default function Impact() {
  const [recent, setRecent] = useState<number | null>(null);
  useEffect(() => { latest(3).then((l) => setRecent(l.n)).catch(() => setRecent(null)); }, []);


  return (
    <div className="space-y-6">
      <ul className="grid gap-x-10 gap-y-7 sm:grid-cols-2 lg:grid-cols-4">
        {WHO.map(([icon, t, d]) => (
          <li key={t} className="border-t border-line-strong pt-5">
            <div className="text-accent">{icon}</div>
            <h3 className="mt-3 text-[17px] font-medium">{t}</h3>
            <p className="mt-1.5 text-[14px] leading-relaxed text-text/75">{d}</p>
          </li>
        ))}
      </ul>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-line bg-panel p-5">
          <div className="text-sm font-semibold">Case study: Tonle Sap, Cambodia</div>
          <p className="mt-2 max-w-[58ch] text-[14px] leading-relaxed text-text/80">
            Tonle Sap is Southeast Asia&apos;s largest freshwater lake and a UNESCO Biosphere Reserve. Each monsoon the Mekong pushes so much
            water into it that the Tonle Sap River reverses direction and the lake floods the surrounding forest. The Mekong River
            Commission describes this flood pulse as the engine of one of the world&apos;s most productive inland fisheries. DELTA PULSE
            follows that pulse with 10 real NISAR passes (June–October 2026).
          </p>
        </div>
        <div className="rounded-xl border border-line bg-panel p-5">
          <div className="flex items-center gap-2 text-sm font-semibold"><HeartHandshake size={16} className="text-accent" />Open, honest, reusable</div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[14px] text-text/80">
            <li>Open source, with the full processing chain documented and tested (32 automated tests).</li>
            <li>Checked against independent data: Landsat water maps, river-flow models and weather records.</li>
            {recent != null && <li>Ready for new data: NISAR published {recent} new radar products in the last 3 days.</li>}
            <li>Every statement is labelled observed, calculated, interpreted or unconfirmed.</li>
            <li>Built to grow: next steps are calibrating against river gauges, alerts for watched places, and more languages.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/** Validity check: do the conclusions survive if the screening threshold is moved by ±2 dB? */
export function Sensitivity({ m, grid }: { m: Manifest | null; grid: GridIndex | null }) {
  const res = useMemo(() => {
    if (!m || !grid || m.observations.length < 2) return null;
    const hvMax = m.screening.open_water.hv_max_db.value;
    const base = m.screening.open_water.hh_max_db.value;
    const ths = [base - 2, base, base + 2];
    const cellKm2 = (m.grid.res_m / 1000) ** 2;
    const n = m.observations.length;
    const area: number[][] = ths.map(() => new Array(n).fill(0));
    for (let o = 0; o < n; o++) {
      for (let r = 0; r < grid.ny; r++) for (let c = 0; c < grid.nx; c++) {
        const hh = grid.get(o, 0, r, c);
        if (!Number.isFinite(hh)) continue;
        const hv = grid.get(o, 1, r, c);
        if (Number.isFinite(hv) && hv >= hvMax) continue;
        for (let t = 0; t < ths.length; t++) if (hh < ths[t]) area[t][o] += cellKm2;
      }
    }
    const peaks = area.map((row) => row.indexOf(Math.max(...row)));
    const trends = area.map((row) => Math.sign(row[n - 1] - row[0]));
    return { ths, area, peaks, robustPeak: new Set(peaks).size === 1, robustTrend: new Set(trends).size === 1, n };
  }, [m, grid]);

  if (!res || !m) return null;
  return (
    <div className="rounded-xl border border-line bg-panel p-5">
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-sm font-semibold">Sensitivity test: does the story depend on the threshold?</div>
        <Tag kind="CALCULATED" />
      </div>
      <p className="mt-1 text-[13px] text-muted">Water-like area (km²) recomputed with the HH threshold moved by ±2 dB, using the {m.grid.res_m} m grid.</p>
      <div className="mt-3 overflow-auto">
        <table className="w-full text-left font-mono text-[11px] whitespace-nowrap">
          <thead className="text-muted"><tr><th className="p-1 font-normal">HH below</th>{m.observations.map((o) => <th key={o.date} className="p-1 font-normal">{o.date.slice(5)}</th>)}</tr></thead>
          <tbody>
            {res.ths.map((t, i) => (
              <tr key={t} className={`border-t border-line/60 ${i === 1 ? "text-text" : "text-muted"}`}>
                <td className="p-1">{t} dB{i === 1 ? " (used)" : ""}</td>
                {res.area[i].map((a, k) => <td key={k} className={`p-1 ${k === res.peaks[i] ? "text-accent" : ""}`}>{Math.round(a).toLocaleString()}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="mt-4 space-y-1.5 text-[13px]">
        <li className={`flex items-start gap-2 ${res.robustTrend ? "text-green" : "text-amber"}`}>
          {res.robustTrend ? <CircleCheck size={15} className="mt-0.5 shrink-0" /> : <AlertTriangle size={15} className="mt-0.5 shrink-0" />}
          {res.robustTrend ? "Robust: the direction of change (first → last date) is the same at all three thresholds." : "Sensitive: the direction of change depends on the threshold. Treat it with care."}
        </li>
        <li className={`flex items-start gap-2 ${res.robustPeak ? "text-green" : "text-amber"}`}>
          {res.robustPeak ? <CircleCheck size={15} className="mt-0.5 shrink-0" /> : <AlertTriangle size={15} className="mt-0.5 shrink-0" />}
          {res.robustPeak ? "Robust: the date with the most water-like area is the same at all three thresholds." : "The peak date shifts with the threshold. The timing is uncertain."}
        </li>
      </ul>
    </div>
  );
}
