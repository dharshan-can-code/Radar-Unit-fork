// Turns a processed NISAR result (+ weather context) into the facts used by
// the "Your Story" view. Everything here is computed from real data; when a
// fact cannot be computed, it is null and the story omits that sentence.
import type { Rainfall } from "@/lib/api";
import { GridIndex, Manifest, Observation, Pair, Statement, Verdict, classify, fingerprint, interpret } from "@/lib/data";

export interface StoryPass {
  date: string; start_time: string; cloud_pct: number | null; rain7_mm: number | null;
  water_km2: number; flooded_veg_km2: number; valid_km2: number; channels: string[];
}

export interface StoryFacts {
  place: string; center: [number, number]; satellite: string;
  first: string; last: string; n: number; spanDays: number; maturity: string; crid: string | null;
  track: string; resM: number; windowKm2: number;
  passes: StoryPass[];
  cloudyPasses: number | null; cloudKnown: number; meanCloud: number | null;
  rainTotal: number | null; rainiest: { date: string; mm: number } | null;
  waterFirst: number; waterLast: number; waterPeak: StoryPass; vegPeak: StoryPass;
  biggest: Pair | null; biggestScore: number;
  /** Areas are compared only over ground seen on EVERY pass (fair comparison). */
  commonKm2: number | null; partialPasses: { date: string; coverage: number }[];
  verdict: Verdict | null; statements: Statement[];
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

function cloudAt(rain: Rainfall | null | undefined, startIso: string): number | null {
  if (!rain) return null;
  const t = Date.parse(startIso);
  if (rain.hourly_cloud?.length) {
    let best: { d: number; v: number } | null = null;
    for (const h of rain.hourly_cloud) {
      const d = Math.abs(Date.parse(`${h.time}:00Z`) - t);
      if (d <= 45 * 60 * 1000 && (!best || d < best.d)) best = { d, v: h.cloud_pct };
    }
    if (best) return best.v;
  }
  const day = rain.daily.find((x) => x.date === startIso.slice(0, 10));
  return day?.cloud_pct ?? null;
}

function rainBefore(rain: Rainfall | null | undefined, date: string, days = 7): number | null {
  if (!rain) return null;
  const end = Date.parse(date), start = end - (days - 1) * 864e5;
  const xs = rain.daily.filter((d) => { const t = Date.parse(d.date); return t >= start && t <= end && d.precip_mm != null; });
  return xs.length ? sum(xs.map((d) => d.precip_mm as number)) : null;
}

/** Water-like / vegetation-flood-like area per pass, counted only on cells valid in ALL passes. */
function commonAreas(m: Manifest, grid: GridIndex) {
  const n = m.observations.length, cell = (m.grid.res_m / 1000) ** 2;
  const water = new Array(n).fill(0), veg = new Array(n).fill(0);
  let common = 0;
  for (let r = 0; r < grid.ny; r++) for (let c = 0; c < grid.nx; c++) {
    let ok = true;
    for (let o = 0; o < n && ok; o++) if (!Number.isFinite(grid.get(o, 0, r, c))) ok = false;
    if (!ok) continue;
    common++;
    for (let o = 0; o < n; o++) {
      const k = classify(grid.get(o, 0, r, c), grid.get(o, 1, r, c), m.screening);
      if (k === "water") water[o] += cell; else if (k === "double") veg[o] += cell;
    }
  }
  return { water, veg, commonKm2: common * cell };
}

export function buildStory(m: Manifest, rain: Rainfall | null | undefined, grid: GridIndex | null): StoryFacts {
  const obs: Observation[] = m.observations;
  const area = (o: Observation) => o.cell_area_km2;
  const ca = grid && grid.nObs === obs.length ? commonAreas(m, grid) : null;
  const passes: StoryPass[] = obs.map((o, k) => ({
    date: o.date, start_time: o.start_time, channels: o.channels,
    cloud_pct: cloudAt(rain, o.start_time),
    rain7_mm: rainBefore(rain, o.date),
    water_km2: ca ? ca.water[k] : o.screening_counts.low_backscatter * area(o),
    flooded_veg_km2: ca ? ca.veg[k] : o.screening_counts.double_bounce * area(o),
    valid_km2: o.screening_counts.valid_cells * area(o),
  }));
  const known = passes.filter((p) => p.cloud_pct != null);
  const rainDays = (rain?.daily ?? []).filter((d) => d.precip_mm != null && d.date >= obs[0].date && d.date <= obs[obs.length - 1].date);
  const rainiest = rainDays.length ? rainDays.reduce((a, b) => ((b.precip_mm ?? 0) > (a.precip_mm ?? 0) ? b : a)) : null;

  // Biggest change = pair with the largest share of cells that changed by >= the significance level.
  let biggest: Pair | null = null, biggestScore = -1;
  for (const p of m.pairs) {
    const c = (p as unknown as { HH_change?: { frac_increase: number | null; frac_decrease: number | null } }).HH_change;
    const s = (c?.frac_increase ?? 0) + (c?.frac_decrease ?? 0);
    if (s > biggestScore) { biggestScore = s; biggest = p; }
  }

  let verdict: Verdict | null = null;
  let statements: Statement[] = [];
  if (grid && biggest) {
    const [w, s, e, n] = m.bbox;
    const rect = grid.rectOf({ w, s, e, n });
    const bi = obs.findIndex((o) => o.date === biggest!.before), ai = obs.findIndex((o) => o.date === biggest!.after);
    if (rect && bi >= 0 && ai >= 0) ({ verdict, statements } = interpret(fingerprint(grid, rect, bi, ai), m.screening));
  }

  const o0 = obs[0];
  return {
    place: m.name.replace(/\s*\(.*\)$/, ""),
    center: m.center ?? [(m.bbox[0] + m.bbox[2]) / 2, (m.bbox[1] + m.bbox[3]) / 2],
    satellite: "NASA-ISRO NISAR, L-band radar",
    first: o0.date, last: obs[obs.length - 1].date, n: obs.length,
    spanDays: Math.round((Date.parse(obs[obs.length - 1].date) - Date.parse(o0.date)) / 864e5),
    maturity: o0.maturity ?? "", crid: o0.crid, track: `${o0.track ?? "?"}${o0.direction?.[0] ?? ""}`,
    resM: m.display.res_m, windowKm2: Math.max(...passes.map((p) => p.valid_km2)),
    passes,
    cloudyPasses: known.length ? known.filter((p) => (p.cloud_pct as number) >= 50).length : null,
    cloudKnown: known.length,
    meanCloud: known.length ? sum(known.map((p) => p.cloud_pct as number)) / known.length : null,
    rainTotal: rainDays.length ? sum(rainDays.map((d) => d.precip_mm as number)) : null,
    rainiest: rainiest && rainiest.precip_mm != null ? { date: rainiest.date, mm: rainiest.precip_mm } : null,
    waterFirst: passes[0].water_km2, waterLast: passes[passes.length - 1].water_km2,
    waterPeak: passes.reduce((a, b) => (b.water_km2 > a.water_km2 ? b : a)),
    vegPeak: passes.reduce((a, b) => (b.flooded_veg_km2 > a.flooded_veg_km2 ? b : a)),
    biggest, biggestScore,
    commonKm2: ca ? ca.commonKm2 : null,
    partialPasses: obs.filter((o) => o.valid_fraction < 0.95).map((o) => ({ date: o.date, coverage: o.valid_fraction })),
    verdict, statements,
  };
}

export const fmtKm2 = (x: number) => (x >= 100 ? Math.round(x).toLocaleString() : x >= 10 ? x.toFixed(0) : x.toFixed(1));
export const fmtDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
