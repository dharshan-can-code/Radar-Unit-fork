"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Cloud, CloudRain, Droplets, Satellite, Thermometer, Waves } from "lucide-react";
import type { Manifest } from "@/lib/data";
import { imgUrl } from "@/lib/data";
import { GIBS_LAYERS, Now, River, Rainfall, WMO, gibsSnapshot, nowWeather, river } from "@/lib/api";
import { Tag } from "@/components/Fingerprint";


function cloudAtPass(rain: Rainfall | null, iso: string): number | null {
  if (!rain?.hourly_cloud?.length) return null;
  const t = Date.parse(iso);
  let best: { d: number; v: number } | null = null;
  for (const h of rain.hourly_cloud) {
    const d = Math.abs(Date.parse(`${h.time}:00Z`) - t);
    if (d <= 45 * 6e4 && (!best || d < best.d)) best = { d, v: h.cloud_pct };
  }
  return best?.v ?? null;
}

/** Same day, same place: what NASA's optical satellites saw vs what NISAR's radar saw. */
function CameraVsRadar({ m, rain }: { m: Manifest; rain: Rainfall | null }) {
  const passes = m.observations;
  const cloudiest = useMemo(() => {
    let best = passes[passes.length - 1].date, v = -1;
    for (const o of passes) { const c = cloudAtPass(rain, o.start_time); if (c != null && c > v) { v = c; best = o.date; } }
    return best;
  }, [passes, rain]);
  const [date, setDate] = useState(cloudiest);
  useEffect(() => setDate(cloudiest), [cloudiest]);
  const [layer, setLayer] = useState("MODIS Terra");
  // Try the chosen satellite first, then the others, if an image is missing or empty for that date.
  const order = useMemo(() => [layer, ...Object.keys(GIBS_LAYERS).filter((k) => k !== layer)], [layer]);
  const [tryIdx, setTryIdx] = useState(0);
  const [noOptical, setNoOptical] = useState(false);
  useEffect(() => { setTryIdx(0); setNoOptical(false); }, [date, layer]);
  const shown = order[Math.min(tryIdx, order.length - 1)];
  const next = () => { if (tryIdx + 1 < order.length) setTryIdx(tryIdx + 1); else setNoOptical(true); };
  const checkEmpty = (img: HTMLImageElement) => {
    try {
      const c = document.createElement("canvas"); c.width = 32; c.height = 32;
      const ctx = c.getContext("2d")!; ctx.drawImage(img, 0, 0, 32, 32);
      const d = ctx.getImageData(0, 0, 32, 32).data;
      let sum = 0; for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i + 1] + d[i + 2];
      if (sum / (32 * 32 * 3) < 6) next(); // essentially black = no data that day
    } catch { /* cannot inspect pixels: keep the image */ }
  };
  const [split, setSplit] = useState(50);
  const wrap = useRef<HTMLDivElement>(null);
  const obs = passes.find((o) => o.date === date) ?? passes[passes.length - 1];
  const cloud = cloudAtPass(rain, obs.start_time);
  const ratio = m.display.ny / m.display.nx;

  const drag = (e: React.PointerEvent) => {
    const r = wrap.current!.getBoundingClientRect();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const mv = (ev: PointerEvent) => setSplit(Math.min(100, Math.max(0, ((ev.clientX - r.left) / r.width) * 100)));
    const up = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
  };

  return (
    <div className="rounded-xl border border-line bg-panel p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Satellite size={16} className="text-cyan" />
        <span className="text-sm font-semibold">Same day: what a camera saw vs what radar saw</span>
        <select value={layer} onChange={(e) => setLayer(e.target.value)} aria-label="Optical satellite"
          className="ml-auto rounded-md border border-line bg-bg px-2 py-1 text-[12px]">
          {Object.keys(GIBS_LAYERS).map((k) => <option key={k}>{k}</option>)}
        </select>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {passes.map((o) => {
          const c = cloudAtPass(rain, o.start_time);
          return (
            <button key={o.date} onClick={() => setDate(o.date)}
              className={`rounded border px-2 py-0.5 font-mono text-[11px] ${o.date === date ? "border-cyan bg-cyan/15 text-cyan" : "border-line text-muted hover:text-text"}`}>
              {o.date.slice(5)}{c != null && <span className="ml-1 opacity-70">☁{Math.round(c)}%</span>}
            </button>
          );
        })}
      </div>
      <div ref={wrap} className="relative mt-3 overflow-hidden rounded-lg border border-line bg-[#05080f] select-none" style={{ paddingTop: `${Math.min(ratio, 1.2) * 100}%` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {!noOptical && <img key={`${date}-${shown}`} crossOrigin="anonymous" src={gibsSnapshot(m.bbox, date, GIBS_LAYERS[shown])} alt={`${shown} true colour, ${date}`}
          onLoad={(e) => checkEmpty(e.currentTarget)} onError={next} className="absolute inset-0 h-full w-full object-fill" />}
        {noOptical && <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-[13px] text-muted">
          No NASA daytime camera image covers this place on {fmt(date)} (gap between orbits). Radar doesn&apos;t have this problem.</div>}
        <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${split}%)` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imgUrl(m, `${date}_HH`)} alt={`NISAR radar, ${date}`} className="absolute inset-0 h-full w-full object-fill" />
        </div>
        <div className="absolute top-2 left-2 rounded bg-bg/80 px-2 py-0.5 font-mono text-[11px]">NASA {shown} · camera{shown !== layer && " (fallback)"}</div>
        <div className="absolute top-2 right-2 rounded bg-bg/80 px-2 py-0.5 font-mono text-[11px] text-cyan">NISAR · radar</div>
        <div className="absolute top-0 bottom-0 w-0.5 bg-cyan" style={{ left: `${split}%` }}>
          <button onPointerDown={drag} aria-label="Drag to compare camera and radar"
            className="absolute top-1/2 -left-4 h-8 w-8 -translate-y-1/2 cursor-ew-resize rounded-full border-2 border-cyan bg-bg text-cyan">⇔</button>
        </div>
      </div>
      <p className="mt-2 text-[13px] text-text/80">
        {fmt(date)}{cloud != null && <>: clouds covered <b>{Math.round(cloud)}%</b> of the sky when NISAR passed</>}. The camera image is NASA&apos;s daily
        {" "}{shown} true-colour view from NASA GIBS / Worldview. It was taken at a different hour, which is why it can look different again.
      </p>
      <div className="mt-1 flex flex-wrap gap-2 text-[11px]"><Tag kind="OBSERVED" /><span className="text-muted">Both are real NASA images. Positions match to within a few hundred metres.</span></div>
    </div>
  );
}

const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Live conditions for the place on screen: weather now, river flow (with forecast), and the camera-vs-radar view. */
export default function WaterNow({ m, rain }: { m: Manifest | null; rain: Rainfall | null }) {
  const [now, setNow] = useState<Now | null>(null);
  const [riv, setRiv] = useState<River | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const center = m ? (m.center ?? [(m.bbox[0] + m.bbox[2]) / 2, (m.bbox[1] + m.bbox[3]) / 2]) : null;

  useEffect(() => {
    if (!center) return;
    let cancel = false;
    setErr(null); setNow(null); setRiv(null);
    nowWeather(center[1], center[0]).then((x) => { if (!cancel) setNow(x); }).catch((e) => { if (!cancel) setErr(e.message); });
    river(center[1], center[0]).then((x) => { if (!cancel) setRiv(x); }).catch(() => { if (!cancel) setRiv(null); });
    const t = setInterval(() => nowWeather(center[1], center[0]).then((x) => { if (!cancel) setNow(x); }).catch(() => {}), 10 * 60 * 1000);
    return () => { cancel = true; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m?.stack, m?.area]);

  if (!m) return null;
  const c = now?.current;
  const data = (riv?.daily ?? []).map((d) => ({ t: Date.parse(d.date), past: d.forecast ? null : d.discharge_m3s, fc: d.forecast ? d.discharge_m3s : null, date: d.date }));
  // join the two series at today so the forecast continues the line
  const lastPast = [...data].reverse().find((d) => d.past != null);
  if (lastPast) { const k = data.indexOf(lastPast); if (data[k + 1]) data[k] = { ...lastPast, fc: lastPast.past }; }
  const peak = data.reduce((a, b) => ((b.past ?? b.fc ?? 0) > (a.past ?? a.fc ?? 0) ? b : a), data[0] ?? { past: 0, fc: 0, date: "", t: 0 });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-line bg-panel p-5 md:col-span-1">
          <div className="flex items-center justify-between text-sm font-semibold">Right now <span className="flex items-center gap-1 text-[11px] font-normal text-green"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green" />live</span></div>
          <div className="mt-1 truncate text-[12px] text-muted">{m.name}</div>
          {c ? (
            <div className="mt-3 space-y-2 text-[14px]">
              <div className="text-lg text-text">{WMO[c.weather_code] ?? `code ${c.weather_code}`}</div>
              <div className="flex items-center gap-2"><Thermometer size={14} className="text-amber" />{c.temperature_2m} °C</div>
              <div className="flex items-center gap-2"><Cloud size={14} className="text-muted" />{c.cloud_cover}% cloud</div>
              <div className="flex items-center gap-2"><CloudRain size={14} className="text-blue" />{c.precipitation} mm in the last 15 min</div>
              <div className="text-[11px] text-muted">as of {c.time.replace("T", " ")} UTC · updates every 15 min</div>
              {c.cloud_cover >= 50 && <div className="rounded border border-amber/40 bg-amber/5 p-2 text-[12px] text-amber">A camera satellite overhead now would mostly see cloud. Radar wouldn&apos;t.</div>}
            </div>
          ) : <div className="mt-3 text-[13px] text-muted">{err ?? "Loading current conditions…"}</div>}
        </div>

        <div className="rounded-xl border border-line bg-panel p-5 md:col-span-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold"><Waves size={16} className="text-cyan" />River flow: past 6 months and 30-day forecast</div>
            <span className="flex items-center gap-2 text-[11px] text-muted"><Tag kind="CALCULATED" />{riv?.dataset ?? "GloFAS"}</span>
          </div>
          {riv && riv.has_river ? (
            <>
              <div className="mt-2 h-52">
                <ResponsiveContainer>
                  <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="gPast" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22d3ee" stopOpacity={0.5} /><stop offset="100%" stopColor="#22d3ee" stopOpacity={0.02} /></linearGradient>
                      <linearGradient id="gFc" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f59e0b" stopOpacity={0.4} /><stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} /></linearGradient>
                    </defs>
                    <CartesianGrid stroke="#1e2a44" strokeDasharray="2 4" />
                    <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={(t) => new Date(t).toISOString().slice(5, 10)}
                      tick={{ fill: "#8b9ab5", fontSize: 10 }} axisLine={{ stroke: "#1e2a44" }} tickLine={false} />
                    <YAxis tick={{ fill: "#8b9ab5", fontSize: 10 }} axisLine={false} tickLine={false} width={78} unit=" m³/s" tickFormatter={(v) => Math.round(Number(v)).toLocaleString()} />
                    <Tooltip contentStyle={{ background: "#0d1424", border: "1px solid #1e2a44", fontSize: 12 }}
                      labelFormatter={(t) => new Date(Number(t)).toISOString().slice(0, 10)}
                      formatter={(v, n) => [v == null ? "–" : `${Math.round(Number(v)).toLocaleString()} m³/s`, n === "fc" ? "forecast" : "modelled flow"]} />
                    {m.observations.map((o) => <ReferenceLine key={o.date} x={Date.parse(o.date)} stroke="#22d3ee" strokeOpacity={0.35} />)}
                    <ReferenceLine x={Date.parse(riv.today)} stroke="#f59e0b" strokeDasharray="4 3" label={{ value: "today", fill: "#f59e0b", fontSize: 10, position: "top" }} />
                    <Area dataKey="past" stroke="#22d3ee" fill="url(#gPast)" strokeWidth={2} isAnimationActive connectNulls={false} />
                    <Area dataKey="fc" stroke="#f59e0b" strokeDasharray="5 3" fill="url(#gFc)" strokeWidth={2} isAnimationActive connectNulls={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-1 text-[12px] text-muted">
                Faint lines mark NISAR passes. Peak in this period: <b className="text-text">{Math.round((peak.past ?? peak.fc ?? 0)).toLocaleString()} m³/s</b> ({peak.date}).
                Modelled by GloFAS for the river cell nearest to {riv.cell[0]?.toFixed(2)}°, {riv.cell[1]?.toFixed(2)}°. A model, not a gauge, so use it as context.
              </p>
            </>
          ) : <p className="mt-3 text-[13px] text-muted">{riv ? "No significant river near this point in the GloFAS river network." : "Loading river flow…"}</p>}
        </div>
      </div>
      <CameraVsRadar key={m.stack} m={m} rain={rain} />
      <p className="flex items-center gap-1.5 text-[11px] text-muted"><Droplets size={12} />Sources: Open-Meteo (current conditions; GloFAS v4 river discharge by Copernicus EMS), NASA GIBS / Worldview, NASA-ISRO NISAR. All live, CC BY or public domain.</p>
    </div>
  );
}
