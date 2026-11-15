"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, ScatterChart } from "lucide-react";
import type { GridIndex, Manifest } from "@/lib/data";
import { Tag } from "@/components/Fingerprint";
import { RGB } from "@/lib/theme";

const X0 = -30, X1 = 10, Y0 = -40, Y1 = 0; // HH (x) and HV (y) axes, dB
const W = 360, H = 300, PAD = 34;
const px = (hh: number) => PAD + ((hh - X0) / (X1 - X0)) * (W - PAD - 8);
const py = (hv: number) => H - PAD - ((hv - Y0) / (Y1 - Y0)) * (H - PAD - 8);
const inv = (x: number, y: number) => [X0 + ((x - PAD) / (W - PAD - 8)) * (X1 - X0), Y0 + ((H - PAD - y) / (H - PAD - 8)) * (Y1 - Y0)];

type Th = { wHH: number; wHV: number; dHH: number; dDiff: number };

/** Every real pixel of one acquisition plotted HH vs HV. Drag the threshold lines and
 *  watch the classification map and the areas update. */
export default function ScatterLab({ m, grid }: { m: Manifest | null; grid: GridIndex | null }) {
  const base: Th | null = m ? { wHH: m.screening.open_water.hh_max_db.value, wHV: m.screening.open_water.hv_max_db.value,
    dHH: m.screening.double_bounce.hh_min_db.value, dDiff: m.screening.double_bounce.hh_minus_hv_min_db.value } : null;
  const [th, setTh] = useState<Th | null>(base);
  const [oi, setOi] = useState(0);
  const plot = useRef<HTMLCanvasElement>(null);
  const mapC = useRef<HTMLCanvasElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<keyof Th | null>(null);

  useEffect(() => {
    setTh(base); setOi(m ? m.observations.length - 1 : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m?.stack]);

  // density of real pixels (computed once per acquisition)
  const density = useMemo(() => {
    if (!grid || !m) return null;
    const bins = new Float32Array(W * H);
    for (let r = 0; r < grid.ny; r++) for (let c = 0; c < grid.nx; c++) {
      const hh = grid.get(oi, 0, r, c), hv = grid.get(oi, 1, r, c);
      if (!Number.isFinite(hh) || !Number.isFinite(hv)) continue;
      const x = Math.round(px(hh)), y = Math.round(py(hv));
      if (x >= 0 && x < W && y >= 0 && y < H) bins[y * W + x] += 1;
    }
    return bins;
  }, [grid, m, oi]);

  useEffect(() => {
    const cv = plot.current;
    if (!cv || !density) return;
    const ctx = cv.getContext("2d")!;
    const img = ctx.createImageData(W, H);
    let mx = 0; for (const v of density) mx = Math.max(mx, v);
    for (let i = 0; i < density.length; i++) {
      const v = density[i];
      if (!v) continue;
      const k = Math.log1p(v) / Math.log1p(mx);
      img.data[i * 4] = 40 + 200 * k; img.data[i * 4 + 1] = 120 + 130 * k; img.data[i * 4 + 2] = 255; img.data[i * 4 + 3] = 60 + 195 * k;
    }
    ctx.clearRect(0, 0, W, H);
    ctx.putImageData(img, 0, 0);
  }, [density]);

  // classification map with the CURRENT thresholds
  const stats = useMemo(() => {
    if (!grid || !m || !th) return null;
    let water = 0, dbl = 0, valid = 0;
    const cls = new Uint8Array(grid.nx * grid.ny);
    for (let r = 0; r < grid.ny; r++) for (let c = 0; c < grid.nx; c++) {
      const hh = grid.get(oi, 0, r, c), hv = grid.get(oi, 1, r, c);
      if (!Number.isFinite(hh)) continue;
      valid++;
      let k = 3;
      if (hh < th.wHH && (!Number.isFinite(hv) || hv < th.wHV)) k = 1;
      else if (Number.isFinite(hv) && hh > th.dHH && hh - hv > th.dDiff) k = 2;
      if (k === 1) water++; else if (k === 2) dbl++;
      cls[r * grid.nx + c] = k;
    }
    const cell = (m.grid.res_m / 1000) ** 2;
    return { cls, water: water * cell, dbl: dbl * cell, valid: valid * cell };
  }, [grid, m, th, oi]);

  useEffect(() => {
    const cv = mapC.current;
    if (!cv || !stats || !grid) return;
    cv.width = grid.nx; cv.height = grid.ny;
    const ctx = cv.getContext("2d")!;
    const img = ctx.createImageData(grid.nx, grid.ny);
    for (let i = 0; i < stats.cls.length; i++) {
      const k = stats.cls[i];
      const [r, g, b, a] = k === 1 ? [...RGB.mapWater, 255] : k === 2 ? [...RGB.mapVeg, 255] : k === 3 ? [...RGB.land, 255] : [0, 0, 0, 0];
      img.data[i * 4] = r; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = a;
    }
    ctx.putImageData(img, 0, 0);
  }, [stats, grid]);

  if (!m || !grid || !th || !base) return <p className="text-muted">Load a result to use the Scatter Lab.</p>;

  const onMove = (e: React.PointerEvent) => {
    if (!drag || !svg.current) return;
    const b = svg.current.getBoundingClientRect();
    const [hh, hv] = inv(((e.clientX - b.left) / b.width) * W, ((e.clientY - b.top) / b.height) * H);
    const cl = (v: number, lo: number, hi: number) => Math.round(Math.min(hi, Math.max(lo, v)) * 2) / 2;
    setTh((t) => t && ({ ...t, ...(drag === "wHH" ? { wHH: cl(hh, X0, X1) } : drag === "wHV" ? { wHV: cl(hv, Y0, Y1) }
      : drag === "dHH" ? { dHH: cl(hh, X0, X1) } : { dDiff: cl(hh - hv, 0, 25) }) }));
  };
  const diffLine = (d: number) => `M${px(X0)} ${py(X0 - d)} L${px(X1)} ${py(X1 - d)}`;
  const changed = JSON.stringify(th) !== JSON.stringify(base);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-line bg-panel p-5">
        <div className="flex flex-wrap items-center gap-2">
          <ScatterChart size={16} className="text-cyan" /><span className="text-sm font-semibold">Every pixel, HH vs HV</span>
          <select value={oi} onChange={(e) => setOi(+e.target.value)} aria-label="Acquisition" className="ml-auto rounded-md border border-line bg-bg px-2 py-1 font-mono text-[12px]">
            {m.observations.map((o, k) => <option key={o.date} value={k}>{o.date}</option>)}
          </select>
        </div>
        <div className="relative mt-3 select-none" onPointerMove={onMove} onPointerUp={() => setDrag(null)} onPointerLeave={() => setDrag(null)}>
          <canvas ref={plot} width={W} height={H} className="w-full" />
          <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full">
            <rect x={px(X0)} y={py(th.wHV)} width={px(th.wHH) - px(X0)} height={py(Y0) - py(th.wHV)} fill="var(--cyan)" opacity="0.08" />
            {[-30, -20, -10, 0, 10].map((v) => <text key={v} x={px(v)} y={H - 14} fill="var(--muted)" fontSize="9" textAnchor="middle">{v}</text>)}
            {[-40, -30, -20, -10, 0].map((v) => <text key={v} x={PAD - 6} y={py(v) + 3} fill="var(--muted)" fontSize="9" textAnchor="end">{v}</text>)}
            <text x={W / 2} y={H - 2} fill="var(--muted)" fontSize="10" textAnchor="middle">HH (dB) → brighter</text>
            <text x={10} y={H / 2} fill="var(--muted)" fontSize="10" transform={`rotate(-90 10 ${H / 2})`} textAnchor="middle">HV (dB)</text>
            {/* draggable thresholds */}
            <g className="cursor-ew-resize" onPointerDown={() => setDrag("wHH")}><line x1={px(th.wHH)} x2={px(th.wHH)} y1={py(Y1)} y2={py(Y0)} stroke="var(--cyan)" strokeWidth="2" /><rect x={px(th.wHH) - 6} y={py(Y1)} width="12" height={py(Y0) - py(Y1)} fill="transparent" /></g>
            <g className="cursor-ns-resize" onPointerDown={() => setDrag("wHV")}><line x1={px(X0)} x2={px(X1)} y1={py(th.wHV)} y2={py(th.wHV)} stroke="var(--cyan)" strokeDasharray="4 3" strokeWidth="2" /><rect x={px(X0)} y={py(th.wHV) - 6} width={px(X1) - px(X0)} height="12" fill="transparent" /></g>
            <g className="cursor-ew-resize" onPointerDown={() => setDrag("dHH")}><line x1={px(th.dHH)} x2={px(th.dHH)} y1={py(Y1)} y2={py(Y0)} stroke="var(--amber)" strokeWidth="2" /><rect x={px(th.dHH) - 6} y={py(Y1)} width="12" height={py(Y0) - py(Y1)} fill="transparent" /></g>
            <g className="cursor-move" onPointerDown={() => setDrag("dDiff")}><path d={diffLine(th.dDiff)} stroke="var(--amber)" strokeDasharray="4 3" strokeWidth="2" fill="none" /><path d={diffLine(th.dDiff)} stroke="transparent" strokeWidth="14" fill="none" /></g>
          </svg>
        </div>
        <p className="mt-1 text-[12px] text-muted">Drag the <span className="text-cyan">cyan</span> lines (water: HH and HV both low) and the <span className="text-amber">amber</span> lines (double bounce: HH high, and HH−HV large).</p>
      </div>
      <div className="rounded-xl border border-line bg-panel p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Classification with your thresholds</span>
          <button onClick={() => setTh(base)} disabled={!changed} className="flex items-center gap-1 text-[12px] text-cyan disabled:opacity-30"><RotateCcw size={12} />app values</button>
        </div>
        <canvas ref={mapC} className="mt-3 w-full rounded border border-line" style={{ imageRendering: "pixelated", aspectRatio: `${grid.nx} / ${grid.ny}` }} />
        {stats && (
          <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[12px]">
            <div className="rounded bg-panel-2 p-2"><div className="text-[11px] text-muted">water-like</div><div className="text-lg text-cyan">{Math.round(stats.water).toLocaleString()} km²</div></div>
            <div className="rounded bg-panel-2 p-2"><div className="text-[11px] text-muted">double bounce</div><div className="text-lg text-amber">{Math.round(stats.dbl).toLocaleString()} km²</div></div>
          </div>
        )}
        <p className="mt-2 font-mono text-[11px] text-muted">water HH&lt;{th.wHH} & HV&lt;{th.wHV} · bounce HH&gt;{th.dHH} & HH−HV&gt;{th.dDiff}{changed && <span className="text-amber"> (changed)</span>}</p>
        <div className="mt-2 flex flex-wrap gap-2 text-[12px]"><Tag kind="OBSERVED" /><span className="text-muted">Real NISAR pixels ({m.grid.res_m} m), {m.observations[oi].date}. Your changes are local and do not alter the app&apos;s results.</span></div>
      </div>
    </div>
  );
}
