"use client";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";
import { Download } from "lucide-react";
import { Fingerprint as FP, Manifest, SeriesPoint, Statement, Verdict, fmtDb, fmtSigned, pct } from "@/lib/data";
import type { Rainfall } from "@/lib/api";
import { CHART } from "@/lib/theme";
import { Tag } from "@/components/ui";

export { Tag, TAG_STYLE } from "@/components/ui";

const VERDICT_STYLE: Record<Verdict, string> = {
  "Possible inundation-related signal": "border-amber/50 text-amber",
  "Radar change detected": "border-blue/50 text-blue",
  "No significant radar change": "border-line-strong text-muted",
  "Insufficient evidence": "border-rose/50 text-rose",
};

interface Props {
  m: Manifest; fp: FP; verdict: Verdict; statements: Statement[]; series: SeriesPoint[];
  regionLabel: string; selectedDates: [string, string]; rain?: Rainfall | null;
}

function downloadCsv(name: string, rows: (string | number | null)[][]) {
  const csv = rows.map((r) => r.map((v) => (v == null ? "" : typeof v === "string" && /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function Fingerprint({ m, fp, verdict, statements, series, regionLabel, selectedDates, rain }: Props) {
  const t0 = series.length ? series[0].t - 15 * 864e5 : 0;
  const t1 = series.length ? series[series.length - 1].t + 3 * 864e5 : 0;
  const rainPts = (rain?.daily ?? []).map((d) => ({ t: Date.parse(d.date), mm: d.precip_mm })).filter((d) => d.t >= t0 && d.t <= t1);
  const exportCsv = () => {
    const rows: (string | number | null)[][] = [
      ["# DELTA PULSE export", m.name, `region: ${regionLabel}`, `generated ${new Date().toISOString()}`],
      ["# NISAR L2 GCOV", `track ${fp.before.track}${fp.before.direction?.[0] ?? ""}`, `frame ${fp.before.frame}`, `${fp.before.maturity} ${fp.before.crid}`],
      ["date", "HH_dB_region_mean", "HV_dB_region_mean", "valid_fraction", "scene", "ERA5_precip_mm_on_date"],
      ...series.map((s) => {
        const o = m.observations.find((x) => x.date === s.date);
        const r = rain?.daily.find((d) => d.date === s.date);
        return [s.date, s.hh != null ? +s.hh.toFixed(3) : null, s.hv != null ? +s.hv.toFixed(3) : null, +s.valid.toFixed(4), o?.scene ?? "", r?.precip_mm ?? null];
      }),
      [],
      ["pair", `${fp.before.date} -> ${fp.after.date}`, `${fp.pair_days} days`],
      ["channel", "before_dB", "after_dB", "delta_mean_dB", "delta_median_dB", "frac_brighter", "frac_darker", "cells"],
      ...fp.channels.filter((c) => c.available).map((c) => [c.channel, +c.before_db.toFixed(3), +c.after_db.toFixed(3), +c.delta_mean_db.toFixed(3),
        +c.delta_median_db.toFixed(3), +c.frac_increase.toFixed(4), +c.frac_decrease.toFixed(4), c.n_cells]),
      [],
      ["verdict", verdict],
      ...statements.map((st) => [st.kind, st.text]),
    ];
    downloadCsv(`delta-pulse_${m.name.replace(/[^a-z0-9]+/gi, "_")}_${fp.before.date}_${fp.after.date}.csv`, rows);
  };
  const sig = m.screening.change.significant_db.value;
  const total = (o: Record<string, number>) => o.water + o.double + o.other || 1;
  return (
    <div className="grid gap-4 lg:grid-cols-12">
      {/* verdict + evidence */}
      <div className="rounded-xl border border-line bg-panel p-5 lg:col-span-5">
        <div className="text-[12px] text-muted">Selected region</div>
        <div className="mt-0.5 text-[13px] leading-snug text-text/90">{regionLabel}</div>
        <div className="mt-4 text-[12px] text-muted">Verdict from the interpretation rules</div>
        <div className={`mt-1 mb-5 inline-block rounded-md border px-3 py-1.5 font-display text-lg font-medium ${VERDICT_STYLE[verdict]}`}>{verdict}</div>
        <ul className="space-y-3.5 border-t border-line pt-4">
          {statements.map((s, i) => (
            <li key={i} className="grid gap-x-3 gap-y-1 text-sm leading-relaxed sm:grid-cols-[6.5rem_minmax(0,1fr)]">
              <div className="pt-px"><Tag kind={s.kind} /></div>
              <span className="text-text/90">{s.text}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* channel cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:col-span-7">
        {fp.channels.map((c) => (
          <div key={c.channel} className="rounded-xl border border-line bg-panel p-5">
            <div className="flex items-baseline justify-between">
              <div className="text-sm font-semibold">{c.channel} backscatter</div>
              <Tag kind={c.available ? "CALCULATED" : "UNCONFIRMED"} />
            </div>
            {c.available ? (
              <>
                <div className="mt-3 grid grid-cols-3 gap-2 font-mono">
                  <Stat label="before" value={fmtDb(c.before_db)} unit="dB" />
                  <Stat label="after" value={fmtDb(c.after_db)} unit="dB" />
                  <Stat label="Δ mean" value={fmtSigned(c.delta_mean_db)} unit="dB"
                    tone={c.delta_mean_db >= sig ? "amber" : c.delta_mean_db <= -sig ? "blue" : undefined} />
                </div>
                <div className="mt-1 font-mono text-[11px] text-muted">
                  per-cell Δ: median {fmtSigned(c.delta_median_db)} · p10 {fmtSigned(c.delta_p10_db)} · p90 {fmtSigned(c.delta_p90_db)} dB
                </div>
                <div className="mt-3 h-28">
                  <ResponsiveContainer>
                    <BarChart data={c.histogram} margin={{ top: 4, right: 0, bottom: 0, left: -28 }}>
                      <XAxis dataKey="bin" tick={CHART.tick} interval={4} tickLine={false} axisLine={CHART.axisLine} />
                      <YAxis tick={CHART.tick} tickLine={false} axisLine={false} />
                      <Tooltip cursor={CHART.cursor} contentStyle={CHART.tooltip} labelStyle={CHART.tooltipLabel} itemStyle={CHART.tooltipItem}
                        formatter={(v) => [v, "cells"]} labelFormatter={(l) => `Δ ≈ ${l} dB`} />
                      <Bar dataKey="count" isAnimationActive={false}>
                        {c.histogram.map((h) => <Cell key={h.bin} fill={h.bin >= sig ? "var(--amber)" : h.bin <= -sig ? "var(--blue)" : "var(--line-strong)"} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-between text-[12px] text-muted">
                  <span className="text-blue">{pct(c.frac_decrease)} darker ≥{sig} dB</span>
                  <span className="text-amber">{pct(c.frac_increase)} brighter ≥{sig} dB</span>
                </div>
              </>
            ) : (
              <p className="mt-3 text-sm text-muted">Not measured in both observations of this pair. NISAR does not acquire every channel on every pass, so nothing is shown here instead of guessing.</p>
            )}
          </div>
        ))}

        {/* screening + quality */}
        <div className="rounded-xl border border-line bg-panel p-5">
          <div className="flex items-baseline justify-between"><div className="text-sm font-semibold">Screening share</div><Tag kind="INTERPRETED" /></div>
          {(["before", "after"] as const).map((k) => {
            const s = fp.screening[k], t = total(s);
            return (
              <div key={k} className="mt-3">
                <div className="mb-1 flex justify-between font-mono text-[11px] text-muted"><span>{k} · {k === "before" ? selectedDates[0] : selectedDates[1]}</span></div>
                <div className="flex h-3 overflow-hidden rounded bg-panel-2">
                  <div style={{ width: `${(s.water / t) * 100}%` }} className="bg-cyan" title="low backscatter" />
                  <div style={{ width: `${(s.double / t) * 100}%` }} className="bg-amber" title="double bounce" />
                </div>
                <div className="mt-1 flex gap-3 text-[12px] text-muted">
                  <span><b className="text-cyan">{pct(s.water / t)}</b> low backscatter</span>
                  <span><b className="text-amber">{pct(s.double / t)}</b> double-bounce signature</span>
                </div>
              </div>
            );
          })}
          <p className="mt-3 text-[12px] text-muted">Uses the uncalibrated rules in Methods at {m.grid.res_m} m. Candidate signatures only.</p>
        </div>

        <div className="rounded-xl border border-line bg-panel p-5">
          <div className="flex items-baseline justify-between"><div className="text-sm font-semibold">Data quality</div><Tag kind="OBSERVED" /></div>
          <dl className="mt-3 space-y-1.5 font-mono text-[12px]">
            <Q k="valid in both" v={`${pct(fp.coverage)} of ${fp.region_cells.toLocaleString()} cells`} />
            <Q k="interval" v={`${fp.pair_days} days${fp.pair_days !== 12 ? " (irregular)" : ""}`} />
            <Q k="maturity" v={`${fp.before.maturity ?? "?"} / ${fp.after.maturity ?? "?"}`} />
            <Q k="release" v={`${fp.before.crid} / ${fp.after.crid}${fp.same_release ? "" : " (differ)"}`} />
            <Q k="track·frame" v={`${fp.before.track ?? "?"}${fp.before.direction?.[0] ?? ""} · ${fp.before.frame ?? "?"}`} />
            <Q k="cell size" v={`${m.grid.res_m} m (from ${m.display.res_m} m layers)`} />
          </dl>
        </div>
      </div>

      {/* time series */}
      <div className="rounded-xl border border-line bg-panel p-5 lg:col-span-12">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">Region backscatter through time <Tag kind="CALCULATED" /></div>
            <p className="mt-1 text-[12px] text-muted">Points are actual acquisitions only; lines are drawn only between them, spacing is to scale.</p>
          </div>
          <div className="flex items-center gap-4 text-[12px] text-muted">
            <span className="flex items-center gap-1.5"><i className="inline-block h-0.5 w-4 bg-cyan" />HH</span>
            <span className="flex items-center gap-1.5"><i className="inline-block h-0.5 w-4 bg-amber" />HV</span>
            <button onClick={exportCsv} className="flex items-center gap-1.5 rounded-md border border-line bg-bg-2 px-2.5 py-1 text-text hover:border-line-strong" title="Download these numbers as CSV">
              <Download size={13} />CSV
            </button>
          </div>
        </div>
        <div className="h-56">
          <ResponsiveContainer>
            <LineChart data={series} margin={{ top: 8, right: 16, bottom: 0, left: -12 }}>
              <CartesianGrid stroke={CHART.grid} strokeDasharray="2 4" />
              <XAxis dataKey="t" type="number" scale="time" domain={rainPts.length ? [t0, t1] : ["dataMin - 259200000", "dataMax + 259200000"]}
                tickFormatter={(t) => new Date(t).toISOString().slice(5, 10)} ticks={series.map((s) => s.t)}
                tick={CHART.tick} axisLine={CHART.axisLine} tickLine={false} />
              <YAxis unit=" dB" tick={CHART.tick} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
              <Tooltip contentStyle={CHART.tooltip} labelStyle={CHART.tooltipLabel} itemStyle={CHART.tooltipItem}
                labelFormatter={(t) => new Date(Number(t)).toISOString().slice(0, 10)}
                formatter={(v, n) => [v == null ? "not acquired" : `${Number(v).toFixed(2)} dB`, String(n).toUpperCase()]} />
              {selectedDates.map((d) => <ReferenceLine key={d} x={Date.parse(d)} stroke="var(--amber)" strokeDasharray="3 3" />)}
              <Line dataKey="hh" stroke="var(--cyan)" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />
              <Line dataKey="hv" stroke="var(--amber)" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {rain && rainPts.length > 0 && (
          <>
            <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 text-[12px] text-muted">
              <span className="text-sm font-semibold text-text">Daily rainfall at this location</span>
              <span>Context only, not a radar measurement · {rain.dataset} via {rain.source} ({rain.license}) <Tag kind="OBSERVED" /></span>
            </div>
            <div className="h-24">
              <ResponsiveContainer>
                <BarChart data={rainPts} margin={{ top: 4, right: 16, bottom: 0, left: -12 }}>
                  <XAxis dataKey="t" type="number" scale="time" domain={[t0, t1]} hide />
                  <YAxis unit=" mm" tick={CHART.tick} axisLine={false} tickLine={false} width={60} />
                  <Tooltip cursor={CHART.cursor} contentStyle={CHART.tooltip} labelStyle={CHART.tooltipLabel} itemStyle={CHART.tooltipItem}
                    labelFormatter={(t) => new Date(Number(t)).toISOString().slice(0, 10)} formatter={(v) => [`${v ?? "–"} mm`, "rain"]} />
                  {series.map((s) => <ReferenceLine key={s.t} x={s.t} stroke="var(--cyan)" strokeOpacity={0.35} />)}
                  <Bar dataKey="mm" fill="var(--blue)" isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[12px] text-muted">Faint cyan lines mark NISAR acquisition dates. Heavy rain before an acquisition can wet soil and leaves, which also changes backscatter.</p>
          </>
        )}
      </div>
    </div>
  );
}

const Stat = ({ label, value, unit, tone }: { label: string; value: string; unit: string; tone?: "amber" | "blue" }) => (
  <div className="rounded-lg bg-panel-2 px-2 py-2">
    <div className="text-[12px] text-muted">{label}</div>
    <div className={`text-lg ${tone === "amber" ? "text-amber" : tone === "blue" ? "text-blue" : "text-text"}`}>{value}<span className="ml-0.5 text-[11px] text-muted">{unit}</span></div>
  </div>
);
const Q = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between gap-3"><dt className="text-muted">{k}</dt><dd className="text-right text-text">{v}</dd></div>
);
