// Data contract between the Python pipeline (scripts/processing/process_stack.py)
// and the web app. Everything shown in the app comes from these files.
import proj4 from "proj4";

export type Channel = "HH" | "HV";

export interface Threshold { value: number; why: string }
export interface Screening {
  status: string;
  note: string;
  open_water: { hh_max_db: Threshold; hv_max_db: Threshold };
  double_bounce: { hh_min_db: Threshold; hh_minus_hv_min_db: Threshold };
  change: { significant_db: Threshold };
  min_valid_fraction: Threshold;
}

export interface Observation {
  id: string; date: string; start_time: string; scene: string; crid: string | null;
  channels: Channel[]; maturity?: string; track?: number; frame?: number; direction?: string;
  collection?: string; valid_fraction: number;
  first_listed_utc?: string | null; downloaded_utc?: string | null; read_utc?: string | null;
  screening_counts: { low_backscatter: number; double_bounce: number; valid_cells: number };
  cell_area_km2: number;
}

export interface Pair {
  id: string; before: string; after: string; delta_days: number; nominal_repeat: boolean;
  channels: Channel[];
}

export interface Manifest {
  area: string; stack: string; name: string; bbox: [number, number, number, number];
  center?: [number, number]; size_km?: number;
  is_demonstration: boolean; demonstration_note: string | null; generated_utc: string;
  epsg: number;
  display: { res_m: number; nx: number; ny: number; corners: [number, number][] };
  grid: { file: string; scale: number; nodata: number; shape: [number, number, number, number];
    res_m: number; x0: number; y1: number };
  stretch_db: Record<Channel, [number, number]>;
  change_range_db: number;
  screening: Screening;
  observations: Observation[];
  pairs: Pair[];
  processing: { steps: string[]; script: string; elapsed_s?: number; bytes_fetched?: number; range_requests?: number };
}

export interface Granule {
  date: string; start_time: string; track: number; frame: number; direction: string;
  maturity: string; crid: string; freqA_pols: string; range_bandwidth: string;
  frame_coverage: string; aoi_overlap_frac: number; scene_name: string; primary_stack: boolean;
}
export interface InventoryArea {
  name: string; bbox: [number, number, number, number];
  primary: { track: number; frame: number; range_bandwidth: string };
  primary_footprint: GeoJSON.Geometry | null; granules: Granule[];
}
export interface Inventory { generated_utc: string; source: string; areas: Record<string, InventoryArea> }

const BASE = "/data";

export async function loadInventory(): Promise<Inventory | null> {
  const r = await fetch(`${BASE}/inventory.json`);
  return r.ok ? r.json() : null;
}
export interface StackInfo {
  id: string; crid: string; maturity: string; track: number; direction: string; frame: number;
  dates_available: string[]; dates_downloaded: string[]; processed: boolean;
  n_obs?: number; first?: string; last?: string; latest_pair?: string | null; reason?: string;
}
export interface Stacks { area: string; default: string | null; stacks: StackInfo[] }
export interface AreaStatus {
  area: string; name: string; checked_utc: string; source: string;
  latest_listed_acquisition: string | null; new_since_previous_check: number | null;
  tracked: { track: number; frame: number; range_bandwidth: string };
  tracked_available: number; tracked_downloaded: number;
  tracked_not_downloaded: { date: string; maturity: string; crid: string }[];
  stacks: StackInfo[]; default_stack: string | null;
}

export async function loadStacks(area: string): Promise<Stacks | null> {
  const r = await fetch(`${BASE}/${area}/stacks.json`, { cache: "no-store" });
  return r.ok ? r.json() : null;
}
export async function loadStatus(): Promise<Record<string, AreaStatus> | null> {
  const r = await fetch(`${BASE}/status.json`, { cache: "no-store" });
  return r.ok ? r.json() : null;
}
export async function loadManifest(area: string, stack: string): Promise<Manifest | null> {
  const r = await fetch(`${BASE}/${area}/${stack}/manifest.json`, { cache: "no-store" });
  return r.ok ? r.json() : null;
}
/** Independent checks written by scripts/validation/validate_area.py (case study only). */
export interface ValidationDate {
  date: string; water_found_in_permanent: number | null; water_flagged_on_never_water_land: number | null;
  flooded_veg_on_never_water_land: number | null; flooded_veg_in_sometimes_water: number | null;
  water_km2: number; flooded_veg_km2: number; wind_ms: number | null; windy: boolean;
}
export interface RiverCheck {
  name: string; why: string; glofas_cell: [number, number]; discharge_m3s: (number | null)[];
  pearson_vs_water: number | null; pearson_vs_flooded_veg: number | null; pearson_vs_water_plus_veg: number | null;
  spearman_vs_water_plus_veg: number | null;
}
export interface Validation {
  area: string; stack: string; generated_utc: string; script: string; note: string; grid_res_m: number;
  jrc: { dataset: string; tile: string; url: string; license: string; classes: Record<string, string>;
    cells: Record<string, number>;
    threshold_sweep: { note: string; current_hh_max_db: number; rows: { hh_max_db: number; water_found_in_permanent: number; water_flagged_on_never_water_land: number }[] } };
  featured: { name: string; bounds: Bounds; pair: string; flooded_veg_share: number[]; why: string } | null;
  flooded_veg_by_distance: { note: string; first: string; peak: string; dates: string[];
    rows: { band: string; never_wet_cells: number; flooded_veg_share_never_wet: (number | null)[]; new_flooded_veg_km2: number }[] };
  wind: { dataset: string; windy_threshold_ms: number; pearson_wind_vs_water_found: number | null };
  rivers: { dataset: string; n_dates: number; points: RiverCheck[] };
  per_date: ValidationDate[];
}
export async function loadValidation(area: string): Promise<Validation | null> {
  const r = await fetch(`${BASE}/${area}/validation.json`, { cache: "no-store" });
  return r.ok ? r.json() : null;
}

export const API = process.env.NEXT_PUBLIC_API ?? "http://localhost:8000";
/** Batch results live under /data/<area>/<stack>; live results are served by the backend. */
export const dataBase = (m: Manifest) =>
  m.area === "live" ? `${API}/api/results/${m.stack}` : `${BASE}/${m.area}/${m.stack}`;
export async function loadGrid(m: Manifest): Promise<Int16Array> {
  const r = await fetch(`${dataBase(m)}/${m.grid.file}?v=${encodeURIComponent(m.generated_utc)}`);
  if (!r.ok) throw new Error(`grid not found (${r.status})`);
  return new Int16Array(await r.arrayBuffer());
}
export const imgUrl = (m: Manifest, name: string) =>
  `${dataBase(m)}/img/${name}.png?v=${encodeURIComponent(m.generated_utc)}`;

// ---- geometry -------------------------------------------------------------

function utmDef(epsg: number) {
  const zone = epsg % 100;
  const south = Math.floor(epsg / 100) === 327;
  return `+proj=utm +zone=${zone}${south ? " +south" : ""} +datum=WGS84 +units=m +no_defs`;
}

export class GridIndex {
  readonly nObs: number; readonly ny: number; readonly nx: number;
  private fwd: (p: [number, number]) => [number, number];
  constructor(public m: Manifest, public data: Int16Array) {
    [this.nObs, , this.ny, this.nx] = m.grid.shape;
    const p = proj4("EPSG:4326", utmDef(m.epsg));
    this.fwd = (ll) => p.forward(ll) as [number, number];
  }
  cellOf(lon: number, lat: number): [number, number] | null {
    const [x, y] = this.fwd([lon, lat]);
    const c = Math.floor((x - this.m.grid.x0) / this.m.grid.res_m);
    const r = Math.floor((this.m.grid.y1 - y) / this.m.grid.res_m);
    return r >= 0 && r < this.ny && c >= 0 && c < this.nx ? [r, c] : null;
  }
  /** value in dB (or valid fraction for ch=2), NaN if nodata */
  get(o: number, ch: 0 | 1 | 2, r: number, c: number): number {
    const v = this.data[((o * 3 + ch) * this.ny + r) * this.nx + c];
    if (v === this.m.grid.nodata) return NaN;
    return ch === 2 ? v / 10000 : v * this.m.grid.scale;
  }
  /** cell index rectangle covering a lon/lat box */
  rectOf(b: Bounds): CellRect | null {
    const corners = [[b.w, b.n], [b.e, b.n], [b.e, b.s], [b.w, b.s]].map(([lo, la]) => {
      const [x, y] = this.fwd([lo, la]);
      return [(this.m.grid.y1 - y) / this.m.grid.res_m, (x - this.m.grid.x0) / this.m.grid.res_m];
    });
    const r0 = Math.max(0, Math.floor(Math.min(...corners.map((k) => k[0]))));
    const r1 = Math.min(this.ny - 1, Math.floor(Math.max(...corners.map((k) => k[0]))));
    const c0 = Math.max(0, Math.floor(Math.min(...corners.map((k) => k[1]))));
    const c1 = Math.min(this.nx - 1, Math.floor(Math.max(...corners.map((k) => k[1]))));
    return r1 >= r0 && c1 >= c0 ? { r0, r1, c0, c1 } : null;
  }
}

export interface Bounds { w: number; s: number; e: number; n: number }
export interface CellRect { r0: number; r1: number; c0: number; c1: number }

// ---- statistics (all averaging in linear power) ----------------------------

const lin = (db: number) => Math.pow(10, db / 10);
const dbOf = (p: number) => 10 * Math.log10(p);

function quantile(sorted: number[], q: number) {
  if (!sorted.length) return NaN;
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

export interface ChannelStats {
  channel: Channel;
  available: boolean;
  before_db: number; after_db: number;        // region mean, power-averaged
  delta_mean_db: number;                       // after_db - before_db
  delta_median_db: number; delta_p10_db: number; delta_p90_db: number;
  frac_increase: number; frac_decrease: number; // per-cell |delta| >= significant
  histogram: { bin: number; count: number }[];
  n_cells: number;
}

export interface Fingerprint {
  before: Observation; after: Observation; pair_days: number;
  region_cells: number; valid_both: number; coverage: number;
  channels: ChannelStats[];
  ratio_before_db: number; ratio_after_db: number; // HH - HV
  screening: { before: Record<string, number>; after: Record<string, number> };
  same_release: boolean;
}

export function classify(hh: number, hv: number, s: Screening): "water" | "double" | "other" | "nodata" {
  if (!Number.isFinite(hh)) return "nodata";
  const waterHV = !Number.isFinite(hv) || hv < s.open_water.hv_max_db.value;
  if (hh < s.open_water.hh_max_db.value && waterHV) return "water";
  if (Number.isFinite(hv) && hh > s.double_bounce.hh_min_db.value &&
      hh - hv > s.double_bounce.hh_minus_hv_min_db.value) return "double";
  return "other";
}

export function fingerprint(g: GridIndex, rect: CellRect, bi: number, ai: number): Fingerprint {
  const m = g.m, s = m.screening, sig = s.change.significant_db.value;
  const before = m.observations[bi], after = m.observations[ai];
  let region = 0, validBoth = 0;
  const acc = { HH: { pb: 0, pa: 0, d: [] as number[] }, HV: { pb: 0, pa: 0, d: [] as number[] } };
  const sc = { before: { water: 0, double: 0, other: 0 }, after: { water: 0, double: 0, other: 0 } };
  for (let r = rect.r0; r <= rect.r1; r++) for (let c = rect.c0; c <= rect.c1; c++) {
    region++;
    const hb = g.get(bi, 0, r, c), ha = g.get(ai, 0, r, c);
    const vb = g.get(bi, 1, r, c), va = g.get(ai, 1, r, c);
    const kb = classify(hb, vb, s), ka = classify(ha, va, s);
    if (kb !== "nodata") sc.before[kb]++;
    if (ka !== "nodata") sc.after[ka]++;
    if (Number.isFinite(hb) && Number.isFinite(ha)) {
      validBoth++;
      acc.HH.pb += lin(hb); acc.HH.pa += lin(ha); acc.HH.d.push(ha - hb);
      if (Number.isFinite(vb) && Number.isFinite(va)) {
        acc.HV.pb += lin(vb); acc.HV.pa += lin(va); acc.HV.d.push(va - vb);
      }
    }
  }
  const channels: ChannelStats[] = (["HH", "HV"] as Channel[]).map((ch) => {
    const a = acc[ch], n = a.d.length;
    const available = before.channels.includes(ch) && after.channels.includes(ch) && n > 0;
    const sorted = [...a.d].sort((x, y) => x - y);
    const hist: { bin: number; count: number }[] = [];
    for (let b = -10; b <= 10; b++) hist.push({ bin: b, count: 0 });
    for (const d of a.d) { const b = Math.max(-10, Math.min(10, Math.round(d))); hist[b + 10].count++; }
    return {
      channel: ch, available,
      before_db: n ? dbOf(a.pb / n) : NaN, after_db: n ? dbOf(a.pa / n) : NaN,
      delta_mean_db: n ? dbOf(a.pa / n) - dbOf(a.pb / n) : NaN,
      delta_median_db: quantile(sorted, 0.5), delta_p10_db: quantile(sorted, 0.1), delta_p90_db: quantile(sorted, 0.9),
      frac_increase: n ? a.d.filter((d) => d >= sig).length / n : NaN,
      frac_decrease: n ? a.d.filter((d) => d <= -sig).length / n : NaN,
      histogram: hist, n_cells: n,
    };
  });
  const [hh, hv] = channels;
  return {
    before, after,
    pair_days: (Date.parse(after.date) - Date.parse(before.date)) / 86400000,
    region_cells: region, valid_both: validBoth, coverage: region ? validBoth / region : 0,
    channels,
    ratio_before_db: hv.available ? hh.before_db - hv.before_db : NaN,
    ratio_after_db: hv.available ? hh.after_db - hv.after_db : NaN,
    screening: sc,
    same_release: before.crid === after.crid,
  };
}

export interface SeriesPoint { t: number; date: string; hh: number | null; hv: number | null; valid: number }

export function timeSeries(g: GridIndex, rect: CellRect): SeriesPoint[] {
  return g.m.observations.map((o, i) => {
    let ph = 0, nh = 0, pv = 0, nv = 0, n = 0, valid = 0;
    for (let r = rect.r0; r <= rect.r1; r++) for (let c = rect.c0; c <= rect.c1; c++) {
      n++;
      const h = g.get(i, 0, r, c), v = g.get(i, 1, r, c);
      if (Number.isFinite(h)) { ph += lin(h); nh++; valid++; }
      if (Number.isFinite(v)) { pv += lin(v); nv++; }
    }
    return { t: Date.parse(o.date), date: o.date, hh: nh ? dbOf(ph / nh) : null,
      hv: nv && o.channels.includes("HV") ? dbOf(pv / nv) : null, valid: n ? valid / n : 0 };
  });
}

// ---- interpretation ----------------------------------------------------------

export type Evidence = "OBSERVED" | "CALCULATED" | "INTERPRETED" | "UNCONFIRMED";
export interface Statement { kind: Evidence; text: string }
export type Verdict = "Possible inundation-related signal" | "Radar change detected" | "No significant radar change" | "Insufficient evidence";

export function interpret(fp: Fingerprint, s: Screening): { verdict: Verdict; statements: Statement[] } {
  const sig = s.change.significant_db.value;
  const [hh, hv] = fp.channels;
  const st: Statement[] = [];
  const f = (x: number) => (x >= 0 ? "+" : "") + x.toFixed(1);
  const what = fp.before.maturity === "SYNTHETIC" ? "Two SYNTHETIC demonstration observations (not NISAR data)" : "Two NISAR GCOV observations";
  st.push({ kind: "OBSERVED", text: `${what} ${fp.pair_days} days apart (${fp.before.date} → ${fp.after.date}), same track and frame. Channels in both: ${fp.channels.filter((c) => c.available).map((c) => c.channel).join(", ") || "none"}.` });
  if (!fp.same_release) st.push({ kind: "OBSERVED", text: "The two observations come from different processing releases; part of any change may be calibration, not the surface." });
  if (fp.coverage < 0.5 || hh.n_cells < 4) {
    st.push({ kind: "UNCONFIRMED", text: `Only ${(fp.coverage * 100).toFixed(0)}% of the selected cells are valid in both observations — too little to interpret.` });
    return { verdict: "Insufficient evidence", statements: st };
  }
  st.push({ kind: "CALCULATED", text: `HH changed by ${f(hh.delta_mean_db)} dB (region mean, power-averaged); ${(hh.frac_increase * 100).toFixed(0)}% of cells brightened and ${(hh.frac_decrease * 100).toFixed(0)}% darkened by at least ${sig} dB.` });
  if (hv.available) st.push({ kind: "CALCULATED", text: `HV changed by ${f(hv.delta_mean_db)} dB. HH−HV difference: ${fp.ratio_before_db.toFixed(1)} → ${fp.ratio_after_db.toFixed(1)} dB.` });

  // Share of valid cells with the double-bounce (flooded-vegetation-like) signature, before and after.
  const share = (x: Record<string, number>) => { const t = (x.water ?? 0) + (x.double ?? 0) + (x.other ?? 0); return t ? (x.double ?? 0) / t : NaN; };
  const dblBefore = share(fp.screening.before), dblAfter = share(fp.screening.after);
  if (hv.available && Number.isFinite(dblBefore)) {
    st.push({ kind: "CALCULATED", text: `Cells with the double-bounce signature (flooded-vegetation-like): ${(dblBefore * 100).toFixed(0)}% → ${(dblAfter * 100).toFixed(0)}% of valid cells.` });
  }

  let verdict: Verdict = "No significant radar change";
  const ratioUp = hv.available && fp.ratio_after_db - fp.ratio_before_db >= sig;
  // A large jump in the share of double-bounce cells together with a rising HH−HV difference is the same
  // mechanism as `ratioUp`, seen per cell instead of in the region mean (which mixes in unaffected cells).
  const SHARE_JUMP = 0.2;
  const dblJump = hv.available && dblAfter - dblBefore >= SHARE_JUMP && fp.ratio_after_db > fp.ratio_before_db && hh.delta_mean_db > 0;
  if (hh.delta_mean_db >= sig && ratioUp) {
    verdict = "Possible inundation-related signal";
    st.push({ kind: "INTERPRETED", text: "HH brightened much more than HV. This pattern is consistent with double-bounce scattering, which occurs when water rises beneath trunks and stems. Other explanations: buildings, wet or flattened vegetation, or a change in vegetation structure." });
  } else if (hh.delta_mean_db <= -sig && (!hv.available || hv.delta_mean_db <= -sig) && hh.after_db < s.open_water.hh_max_db.value) {
    verdict = "Possible inundation-related signal";
    st.push({ kind: "INTERPRETED", text: "Both channels darkened to very low values. This is consistent with a surface becoming smooth open water (mirror-like reflection away from the satellite). Other explanations: very smooth bare soil, or calm conditions over water that was already there. Wind-roughened water can hide this signal." });
  } else if (dblJump) {
    verdict = "Possible inundation-related signal";
    st.push({ kind: "INTERPRETED", text: `The double-bounce signature spread from ${(dblBefore * 100).toFixed(0)}% to ${(dblAfter * 100).toFixed(0)}% of the region while HH brightened more than HV. This is consistent with water rising beneath trees or shrubs, even though the region average changed by less than ${sig} dB. Other explanations: buildings, wet or flattened vegetation, or crop growth.` });
  } else if (hv.available && hv.delta_mean_db >= sig && !ratioUp) {
    verdict = "Radar change detected";
    st.push({ kind: "INTERPRETED", text: "HV increased, indicating more volume scattering — often vegetation growth (e.g. crops) or wetter canopy. Not by itself an indicator of flooding." });
  } else if (Math.abs(hh.delta_mean_db) >= sig || hh.frac_increase + hh.frac_decrease > 0.3) {
    verdict = "Radar change detected";
    st.push({ kind: "INTERPRETED", text: "The radar response changed, but the pattern does not match a single clear scattering mechanism. Mixed land cover inside the region is likely; try a smaller region." });
  } else {
    st.push({ kind: "INTERPRETED", text: `No region-wide change beyond the ±${sig} dB screening level.` });
  }
  st.push({ kind: "UNCONFIRMED", text: "Flooding is not confirmed. Needed: water level at the acquisition times (e.g. lake gauge), a cloud-free optical image within a few days, land-cover data to exclude built-up areas, and ideally field observations." });
  if (s.status === "UNCALIBRATED") st.push({ kind: "UNCONFIRMED", text: "Screening thresholds are uncalibrated starting values (see Methods)." });
  return { verdict, statements: st };
}

export const fmtDb = (x: number, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : "—");
export const fmtSigned = (x: number, d = 1) => (Number.isFinite(x) ? (x >= 0 ? "+" : "") + x.toFixed(d) : "—");
export const pct = (x: number) => (Number.isFinite(x) ? `${(x * 100).toFixed(0)}%` : "—");
