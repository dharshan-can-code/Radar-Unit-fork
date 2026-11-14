"use client";
// Independent checks of the screening (public/data/<area>/validation.json,
// written by scripts/validation/validate_area.py). None of these datasets was
// used to make the radar layers or thresholds.
import { ShieldCheck } from "lucide-react";
import { Tag } from "@/components/Fingerprint";
import type { Validation } from "@/lib/data";

const pc = (x: number | null | undefined, d = 0) => (x == null ? "–" : `${(x * 100).toFixed(d)}%`);
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const i = (s.length - 1) / 2; return (s[Math.floor(i)] + s[Math.ceil(i)]) / 2; };

export default function ValidationPanel({ v }: { v: Validation }) {
  const det = v.per_date.map((d) => d.water_found_in_permanent).filter((x): x is number => x != null);
  const fa = v.per_date.map((d) => d.water_flagged_on_never_water_land).filter((x): x is number => x != null);
  const cur = v.jrc.threshold_sweep.current_hh_max_db;
  const looser = v.jrc.threshold_sweep.rows.find((r) => r.hh_max_db === cur + 2);
  const dist = v.flooded_veg_by_distance;
  const fi = dist.dates.indexOf(dist.first), pi = dist.dates.indexOf(dist.peak);
  const winds = v.per_date.map((d) => d.wind_ms).filter((x): x is number => x != null);
  const low = v.per_date.filter((d) => d.water_found_in_permanent != null && d.water_found_in_permanent < 0.75);

  return (
    <div className="rounded-xl border border-green/30 bg-panel p-5">
      <div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck size={16} className="text-green" />Independent checks</div>
      <p className="mt-1 max-w-3xl text-[13px] text-muted">
        We compared the radar screening with data that were <b className="text-text">not</b> used to make it. Agreement is supporting evidence, not proof:
        the optical water record describes 1984–2021 and river flow is a model.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Block title="Does the “water-like” class find real water?" tag="CALCULATED">
          <p>
            On <b className="text-text">{v.jrc.cells.permanent.toLocaleString()}</b> cells that Landsat saw as water in at least 90% of observations
            (JRC Global Surface Water), the radar flagged a median <b className="text-cyan">{pc(median(det))}</b> as water-like
            (range {pc(Math.min(...det))}–{pc(Math.max(...det))} across the 10 passes).
          </p>
          <p className="mt-2">
            On <b className="text-text">{v.jrc.cells.never.toLocaleString()}</b> cells Landsat never saw wet, it flagged at most
            <b className="text-cyan"> {pc(Math.max(...fa), 1)}</b> as water. False alarms on dry land are essentially zero.
          </p>
          {looser && (
            <p className="mt-2 text-[12px]">
              The {cur} dB threshold is cautious: at {cur + 2} dB it would find {pc(looser.water_found_in_permanent)} of permanent water with
              {" "}{pc(looser.water_flagged_on_never_water_land, 1)} false alarms. We did not tune it on this, because never-wet land (mostly forest and hills) is an easy test.
            </p>
          )}
          <MiniBars rows={v.per_date.map((d) => ({ label: d.date.slice(5), value: d.water_found_in_permanent }))} color="bg-cyan" />
        </Block>

        <Block title="Is the flooded-forest signal where floods should be?" tag="CALCULATED">
          <p>
            Share of land Landsat never saw wet that shows the double-bounce signature, by distance from the permanent lake,
            on {dist.first} and at the peak ({dist.peak}):
          </p>
          <table className="mt-2 w-full text-left font-mono text-[11px]">
            <thead className="text-muted"><tr><th className="py-1">distance</th><th>{dist.first.slice(5)}</th><th>{dist.peak.slice(5)}</th><th>new area</th></tr></thead>
            <tbody>
              {dist.rows.map((r) => (
                <tr key={r.band} className="border-t border-line/60">
                  <td className="py-1">{r.band}</td><td>{pc(r.flooded_veg_share_never_wet[fi])}</td>
                  <td className="text-amber">{pc(r.flooded_veg_share_never_wet[pi])}</td><td>{Math.round(r.new_flooded_veg_km2).toLocaleString()} km²</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[12px]">
            <Tag kind="INTERPRETED" /> The signal grows most within 20 km of the lake, the flooded-forest belt, which optical satellites
            cannot see under the canopy. Weaker growth far from the lake is more likely crops or wet leaves.
          </p>
        </Block>

        <Block title="Does it follow the river?" tag="CALCULATED">
          <p>Correlation between the radar’s water-like plus flooded-vegetation area and modelled river flow (GloFAS) on the {v.rivers.n_dates} pass dates:</p>
          <ul className="mt-2 space-y-1">
            {v.rivers.points.map((r) => (
              <li key={r.name}>
                <b className="text-text">{r.name}</b>: r = <b className="text-cyan">{r.pearson_vs_water_plus_veg?.toFixed(2) ?? "–"}</b>
                <span className="text-[12px]"> (flooded vegetation alone r = {r.pearson_vs_flooded_veg?.toFixed(2) ?? "–"})</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[12px]">
            <Tag kind="UNCONFIRMED" /> Only {v.rivers.n_dates} dates, and both series rise with the season, so this shows consistency, not proof.
            The Mekong peaks weeks before the lake does, so a same-day comparison understates the link.
          </p>
        </Block>

        <Block title="Was wind hiding open water?" tag="OBSERVED">
          <p>
            ERA5 wind at the pass times was light: {Math.min(...winds).toFixed(1)}–{Math.max(...winds).toFixed(1)} m/s at the area centre.
            {low.length > 0 && <> On {low.map((d) => d.date).join(" and ")} the radar found less of the permanent lake ({low.map((d) => pc(d.water_found_in_permanent)).join(", ")}).</>}
          </p>
          <p className="mt-2 text-[12px]">
            <Tag kind="UNCONFIRMED" /> Wind at one point does not explain those dips (r = {v.wind.pearson_wind_vs_water_found?.toFixed(2) ?? "–"}).
            Local gusts or rain cells over the lake, which roughen the water, remain possible.
          </p>
          <MiniBars rows={v.per_date.map((d) => ({ label: d.date.slice(5), value: d.wind_ms == null ? null : d.wind_ms / 10, text: d.wind_ms == null ? "–" : `${d.wind_ms} m/s` }))} color="bg-blue" />
        </Block>
      </div>
      <p className="mt-4 font-mono text-[11px] text-muted">
        Reproduce: {v.script} · generated {v.generated_utc} · {v.jrc.dataset} ({v.jrc.tile}) · {v.rivers.dataset} · ERA5 via Open-Meteo
      </p>
    </div>
  );
}

function Block({ title, tag, children }: { title: string; tag: "OBSERVED" | "CALCULATED" | "INTERPRETED" | "UNCONFIRMED"; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-panel-2/40 p-4 text-[13px] text-muted">
      <div className="mb-2 flex items-center gap-2 text-text"><Tag kind={tag} /><span className="font-semibold">{title}</span></div>
      {children}
    </div>
  );
}

function MiniBars({ rows, color }: { rows: { label: string; value: number | null; text?: string }[]; color: string }) {
  return (
    <div className="mt-3 space-y-0.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 font-mono text-[10px]">
          <span className="w-10 shrink-0">{r.label}</span>
          <div className="h-1.5 flex-1 rounded bg-line/60"><div className={`h-1.5 rounded ${color}`} style={{ width: `${Math.max(0, Math.min(1, r.value ?? 0)) * 100}%` }} /></div>
          <span className="w-14 shrink-0 text-right">{r.text ?? (r.value == null ? "–" : `${Math.round(r.value * 100)}%`)}</span>
        </div>
      ))}
    </div>
  );
}
