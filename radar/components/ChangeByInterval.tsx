"use client";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Manifest } from "@/lib/data";
import { Tag } from "@/components/Fingerprint";

/** Measured whole-area change for every processed consecutive pair
 *  (values computed by the pipeline and stored in manifest.json). */
export default function ChangeByInterval({ m, pairIdx, setPairIdx }: { m: Manifest; pairIdx: number; setPairIdx: (i: number) => void }) {
  const sig = m.screening.change.significant_db.value;
  type PairStats = { HH_change?: { frac_increase: number | null; frac_decrease: number | null; mean_db: number | null } };
  const data = m.pairs.map((p, i) => {
    const c = (p as unknown as PairStats).HH_change;
    return { i, label: `${p.before.slice(5)}→${p.after.slice(5)}`, days: p.delta_days,
      brighter: c?.frac_increase != null ? +(c.frac_increase * 100).toFixed(1) : null,
      darker: c?.frac_decrease != null ? -(c.frac_decrease * 100).toFixed(1) : null,
      mean: c?.mean_db ?? null };
  });
  return (
    <div className="mt-4 rounded-xl border border-line bg-panel p-5">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-sm font-semibold">Measured HH change per interval (whole study area)</div>
        <div className="flex items-center gap-2 text-[11px] text-muted">
          share of 100 m cells that brightened (amber) or darkened (blue) by ≥{sig} dB · click a bar to open that pair <Tag kind="CALCULATED" />
        </div>
      </div>
      {data.length < 2 && (
        <p className="mb-2 text-[12px] text-muted">Only {data.length} interval processed so far. More bars appear as more acquisitions are retrieved.</p>
      )}
      <div className="h-48">
        <ResponsiveContainer>
          <BarChart data={data} stackOffset="sign" margin={{ top: 4, right: 8, bottom: 0, left: -16 }}
            onClick={(e) => { const i = (e as { activeTooltipIndex?: number }).activeTooltipIndex; if (typeof i === "number") setPairIdx(i); }}>
            <CartesianGrid stroke="#1e2a44" strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: "#8b9ab5", fontSize: 10 }} axisLine={{ stroke: "#1e2a44" }} tickLine={false} />
            <YAxis unit="%" tick={{ fill: "#8b9ab5", fontSize: 10 }} axisLine={false} tickLine={false} />
            <ReferenceLine y={0} stroke="#475569" />
            <Tooltip cursor={{ fill: "#ffffff08" }} contentStyle={{ background: "#0d1424", border: "1px solid #1e2a44", fontSize: 12 }}
              formatter={(v, n) => [`${Math.abs(Number(v))}% of cells`, n === "brighter" ? `brighter ≥${sig} dB` : `darker ≥${sig} dB`]}
              labelFormatter={(l, p) => { const d = p?.[0]?.payload; return d ? `${l} · ${d.days} days · mean ΔHH ${d.mean >= 0 ? "+" : ""}${d.mean?.toFixed(2)} dB` : l; }} />
            <Bar dataKey="brighter" stackId="s" isAnimationActive={false} cursor="pointer">
              {data.map((d) => <Cell key={d.i} fill="#f59e0b" fillOpacity={d.i === pairIdx ? 1 : 0.55} />)}
            </Bar>
            <Bar dataKey="darker" stackId="s" isAnimationActive={false} cursor="pointer">
              {data.map((d) => <Cell key={d.i} fill="#3b82f6" fillOpacity={d.i === pairIdx ? 1 : 0.55} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
