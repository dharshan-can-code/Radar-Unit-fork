// Client for the DELTA PULSE backend (backend/app.py). See BACKEND.md.
import { API, Manifest } from "@/lib/data";

export interface Place { name: string; lat: number; lon: number; type?: string; bbox?: number[] | null }
export interface Granule {
  scene: string; date: string; start_time: string; track: number; frame: number; direction: string;
  collection: string; maturity: string; crid: string; pols: string[]; bandwidth: string;
  frame_coverage?: string; processing_date?: string;
}
export interface LiveStack {
  id: string; track: number; direction: string; frame: number; bandwidth: string; crid: string;
  maturity: string; usable: boolean; caveat?: string | null; granules: Granule[]; dates: string[]; n_dates: number;
  dual_pol_dates: string[]; latest: string | null; footprint: GeoJSON.Geometry | null;
}
export interface Acquisitions {
  lat: number; lon: number; checked_utc: string; source: string; n_granules: number;
  stacks: LiveStack[]; recommended_stack: string | null; note: string | null;
}
export interface Job {
  job_id: string; status: "queued" | "running" | "done" | "error"; progress?: number; message?: string;
  result?: string; cached?: boolean; elapsed_s?: number;
}

export const REPO_URL = "https://github.com/haricharanparna/Radar-Unit";
export const PUBLIC_DEMO_NOTE =
  "Analysing a new place runs in the full DELTA PULSE app, which reads NASA's radar files through our own server. " +
  "This public demo still searches NASA's archive live, and every map, chart and story here is real NASA data.";

/** True on the public static deployment (e.g. delta-pulse-nisar.vercel.app), where no backend runs.
 *  Set NEXT_PUBLIC_API to a hosted backend to turn live analysis on there. */
export function isPublicDemo(): boolean {
  if (process.env.NEXT_PUBLIC_API) return false;
  if (typeof window === "undefined") return false;
  return !/^(localhost|127\.0\.0\.1|\[::1\]|.+\.localhost)$/.test(window.location.hostname);
}

export class OfflineError extends Error {
  constructor() { super(PUBLIC_DEMO_NOTE); this.name = "OfflineError"; }
}
/** Calls that only the backend can answer (analysis, saved results) fail fast on the public demo
 *  (no doomed requests to localhost). Searching does not need it: see viaBackend below. */
function backendOnly() { if (isPublicDemo()) throw new OfflineError(); }

/** User-facing text for an error. A TypeError from fetch means the request never got an answer. */
export function errorText(x: unknown): string {
  if (x instanceof OfflineError) return x.message;
  if (x instanceof TypeError) return "A data service could not be reached. Check the internet connection and try again.";
  return x instanceof Error ? x.message : String(x);
}

async function j<T>(r: Response): Promise<T> {
  if (!r.ok) {
    let msg = `${r.status}`;
    try { msg = (await r.json()).detail ?? msg; } catch { /* not json */ }
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return r.json();
}

// ---- is the backend there? ---------------------------------------------------------
// Searching (places, the archive, the newest acquisitions) and the weather context all come from
// public, CORS-enabled services, so they work with or without the backend: the backend is asked
// first because it caches, and the browser asks the service itself when the backend is not running.
// Only reading the radar files (analysis) truly needs the backend.
export interface Health { ok: boolean; earthdata_token: boolean; note: string | null }
const HEALTH_TTL_MS = 20_000;
let healthCache: { at: number; p: Promise<Health | null> } | null = null;

const isLocalHost = (h: string) => /^(localhost|127\.0\.0\.1|\[::1\])$/.test(h) || h.endsWith(".localhost");
/** A hosted copy of the site with no backend configured must not go looking for one on the visitor's
 *  own computer (browsers ask the visitor for permission to do that). */
function backendPossible(): boolean {
  if (typeof window === "undefined") return false;
  try { return !isLocalHost(new URL(API).hostname) || isLocalHost(window.location.hostname); } catch { return false; }
}

/** The backend's health, or null when it is not reachable. Remembered briefly, because a refused
 *  connection can take seconds to fail and every fallback below would otherwise wait for it. */
export function backendHealth(force = false): Promise<Health | null> {
  if (!backendPossible()) return Promise.resolve(null);
  if (force || !healthCache || Date.now() - healthCache.at > HEALTH_TTL_MS) {
    const p = fetch(`${API}/api/health`, { signal: AbortSignal.timeout(5000) })
      .then((r) => (r.ok ? (r.json() as Promise<Health>) : null)).catch(() => null);
    healthCache = { at: Date.now(), p };
  }
  return healthCache.p;
}

export const ANALYSIS_OFFLINE = "Analysing a new place needs the DELTA PULSE server, which reads NASA's radar files with an Earthdata login. " +
  "It is not running for this copy of the app. Searching still works, and so do the saved examples.";

async function viaBackend<T>(path: string, direct: () => Promise<T>): Promise<T> {
  if (await backendHealth()) {
    try { return await j<T>(await fetch(`${API}${path}`)); } catch { /* the backend could not answer: ask the service itself */ }
  }
  return direct();
}

// ---- place search ------------------------------------------------------------------

/** "12.5, 104.2", "12.5 104.2", "12.5°N 104.2°E", "3.13 S, 59.98 W" -> coordinates without calling the geocoder. */
export function parseCoords(q: string): Place | null {
  const m = q.trim().match(/^([+-]?\d+(?:\.\d+)?)\s*°?\s*([NS])?\s*[,;\s]\s*([+-]?\d+(?:\.\d+)?)\s*°?\s*([EW])?$/i);
  if (!m) return null;
  let lat = +m[1], lon = +m[3];
  if (m[2]?.toUpperCase() === "S") lat = -Math.abs(lat);
  if (m[4]?.toUpperCase() === "W") lon = -Math.abs(lon);
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { name: `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`, lat, lon, type: "coordinates" };
}

const placeCache = new Map<string, Place[]>();
/** OpenStreetMap Nominatim, asked by the browser (same request as backend/geocode.py). */
async function nominatim(q: string): Promise<Place[]> {
  const params = new URLSearchParams({ q, format: "jsonv2", limit: "6", "accept-language": "en" });
  const r = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
  if (!r.ok) throw new Error(`The place search service is busy (${r.status}). Try again in a moment, or type coordinates like 12.56, 104.21.`);
  const rows = (await r.json()) as { display_name: string; lat: string; lon: string; type?: string; boundingbox?: string[] }[];
  return rows.map((d) => ({ name: d.display_name, lat: +d.lat, lon: +d.lon, type: d.type, bbox: d.boundingbox?.map(Number) ?? null }));
}

export async function geocode(q: string): Promise<Place[]> {
  const c = parseCoords(q);
  if (c) return [c];
  const text = q.trim().replace(/\s+/g, " ").slice(0, 200);
  const key = text.toLowerCase();
  const hit = placeCache.get(key);
  if (hit) return hit;
  const found = await viaBackend(`/api/geocode?q=${encodeURIComponent(text)}`, () => nominatim(text).then((results) => ({ results })));
  // The geocoder often lists one place twice (as a point and as a boundary): keep the first of each.
  const seen = new Set<string>();
  const out = found.results.filter((p) => {
    const k = `${p.name}|${p.lat.toFixed(2)}|${p.lon.toFixed(2)}`;
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon) || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  placeCache.set(key, out);
  return out;
}

// ---- NISAR archive (ASF) -----------------------------------------------------------
// The browser-side copy of backend/nisar.py: same search, same grouping into compatible stacks.

const ASF_URL = "https://api.daac.asf.alaska.edu/services/search/param";
const ASF_SOURCE = "ASF Search API, dataset NISAR, processingLevel GCOV";
const MATURITY: Record<string, string> = {
  NISAR_L2_GCOV_V1: "VALIDATED", NISAR_L2_GCOV_PROVISIONAL_V1: "PROVISIONAL", NISAR_L2_GCOV_BETA_V1: "BETA", NISAR_UR_L2: "URGENT_RESPONSE",
};
const USABLE = new Set(["PROVISIONAL", "VALIDATED", "URGENT_RESPONSE"]);
const RANK: Record<string, number> = { VALIDATED: 3, PROVISIONAL: 2, URGENT_RESPONSE: 1 };
const CAVEATS: Record<string, string> = {
  URGENT_RESPONSE: "Urgent-response product (NISAR_UR_L2): published fastest for events, not a validated science release. Compare only with other urgent-response acquisitions.",
  PROVISIONAL: "Provisional release: calibrated, partially validated.",
};
type Footprinted = Granule & { footprint: GeoJSON.Geometry };
interface AsfProps {
  sceneName: string; startTime: string; pathNumber: number; frameNumber: number; flightDirection: string;
  collectionName?: string; crid?: string; mainBandPolarization?: string[]; rangeBandwidth?: string[];
  frameCoverage?: string; processingDate?: string;
}

async function asfSearch(params: Record<string, string | number>): Promise<Footprinted[]> {
  const q = new URLSearchParams({ dataset: "NISAR", processingLevel: "GCOV", output: "geojson",
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
  const r = await fetch(`${ASF_URL}?${q}`);
  if (!r.ok) throw new Error(`NASA's ASF archive did not answer the search (${r.status}). Try again in a moment.`);
  const js = (await r.json()) as { features?: { geometry: GeoJSON.Geometry; properties: AsfProps }[] };
  return (js.features ?? []).filter((f) => f.geometry && f.properties?.sceneName && f.properties.startTime).map(({ geometry, properties: p }) => ({
    scene: p.sceneName, date: p.startTime.slice(0, 10), start_time: p.startTime, track: p.pathNumber, frame: p.frameNumber,
    direction: p.flightDirection, collection: p.collectionName ?? "", maturity: MATURITY[p.collectionName ?? ""] ?? "OTHER",
    crid: p.crid ?? "", pols: p.mainBandPolarization ?? [], bandwidth: (p.rangeBandwidth ?? []).join("+"),
    frame_coverage: p.frameCoverage, processing_date: p.processingDate, footprint: geometry,
  }));
}

/** Compatible = same track, pass, frame, bandwidth mode, processing release and product line. */
export function groupStacks(granules: Footprinted[]): LiveStack[] {
  const groups = new Map<string, Footprinted[]>();
  for (const g of [...granules].sort((a, b) => a.start_time.localeCompare(b.start_time))) {
    const base = `t${g.track}${(g.direction || "?")[0]}_f${g.frame}_${g.bandwidth.replace(/\+/g, "-")}_${g.crid}`;
    const key = g.maturity === "PROVISIONAL" || g.maturity === "VALIDATED" ? base : `${base}_${g.maturity.toLowerCase()}`;
    groups.set(key, [...(groups.get(key) ?? []), g]);
  }
  const stacks: LiveStack[] = [...groups].map(([id, all]) => {
    const byDate = new Map(all.map((g) => [g.date, g])); // one per date (the later product wins)
    const gs = [...byDate.values()].sort((a, b) => a.start_time.localeCompare(b.start_time));
    const last = gs[gs.length - 1];
    return {
      id, track: last.track, direction: last.direction, frame: last.frame, bandwidth: last.bandwidth, crid: last.crid,
      maturity: last.maturity, usable: USABLE.has(last.maturity), caveat: CAVEATS[last.maturity] ?? null,
      granules: gs.map((g) => { const { footprint, ...rest } = g; void footprint; return rest; }),
      dates: gs.map((g) => g.date), n_dates: gs.length,
      dual_pol_dates: gs.filter((g) => g.pols.includes("HV")).map((g) => g.date), latest: last.date, footprint: last.footprint,
    };
  });
  // Usable with a pair first, then newest data, then the more mature release, then the longer record.
  const n = (b: boolean) => (b ? 1 : 0);
  return stacks.sort((a, b) => n(b.usable) - n(a.usable) || n(b.n_dates >= 2) - n(a.n_dates >= 2)
    || (b.latest ?? "").localeCompare(a.latest ?? "") || (RANK[b.maturity] ?? 0) - (RANK[a.maturity] ?? 0) || b.n_dates - a.n_dates);
}

const NO_COVERAGE = "NISAR has no GCOV products over this point in the archive yet.";
async function acquisitionsDirect(lat: number, lon: number): Promise<Acquisitions> {
  const found = await asfSearch({ intersectsWith: `POINT(${lon} ${lat})`, maxResults: 2000 });
  const unique = [...new Map(found.map((g) => [`${g.scene}|${g.collection}`, g])).values()];
  const stacks = groupStacks(unique);
  return { lat, lon, checked_utc: new Date().toISOString(), source: ASF_SOURCE, n_granules: unique.length, stacks,
    recommended_stack: stacks.find((s) => s.usable && s.n_dates >= 2)?.id ?? null, note: stacks.length ? null : NO_COVERAGE };
}

export async function acquisitions(lat: number, lon: number, fresh = false): Promise<Acquisitions> {
  return viaBackend(`/api/acquisitions?lat=${lat}&lon=${lon}${fresh ? "&fresh=true" : ""}`, () => acquisitionsDirect(lat, lon));
}

export type Detail = "quick" | "standard";
export async function startAnalysis(body: { lat: number; lon: number; scenes: string[]; size_km: number; place?: string; detail?: Detail }): Promise<Job> {
  backendOnly();
  if (!(await backendHealth(true))) throw new Error(ANALYSIS_OFFLINE);
  return j(await fetch(`${API}/api/analyze`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
}

export async function job(id: string): Promise<Job> {
  backendOnly();
  return j(await fetch(`${API}/api/jobs/${id}`));
}

export async function loadResult(path: string): Promise<Manifest> {
  backendOnly();
  return j(await fetch(`${API}${path}`, { cache: "no-store" }));
}

export interface LatestGranule extends Granule { centroid: [number, number]; footprint: GeoJSON.Geometry }
export interface Latest {
  checked_utc: string; days: number; source: string; granules: LatestGranule[];
  /** acquisitions (one per satellite pass over a frame) */ n: number;
  /** products listed by ASF: an acquisition can be published as an urgent-response and a science product */ n_products: number;
  /** true when the archive holds more products in the period than were fetched */ truncated: boolean;
}
type RawLatest = Pick<Latest, "checked_utc" | "days" | "source"> & { granules: LatestGranule[]; truncated?: boolean };

const ring = (g: GeoJSON.Geometry): number[][] | null =>
  g.type === "Polygon" ? g.coordinates[0] : g.type === "MultiPolygon" ? g.coordinates[0]?.[0] ?? null : null;

/** A footprint that crosses the 180° meridian is listed with longitudes on both sides of it, which
 *  draws as a band around the whole globe. Shift it onto one side (longitudes above 180 are fine on the map). */
function unwrapFootprint(g: GeoJSON.Geometry): { footprint: GeoJSON.Geometry; crosses: boolean } {
  const r = ring(g);
  if (!r?.length) return { footprint: g, crosses: false };
  const lons = r.map((p) => p[0]);
  if (Math.max(...lons) - Math.min(...lons) <= 180) return { footprint: g, crosses: false };
  const shift = (p: number[]) => [p[0] < 0 ? p[0] + 360 : p[0], ...p.slice(1)];
  const footprint: GeoJSON.Geometry = g.type === "Polygon" ? { ...g, coordinates: g.coordinates.map((x) => x.map(shift)) }
    : g.type === "MultiPolygon" ? { ...g, coordinates: g.coordinates.map((poly) => poly.map((x) => x.map(shift))) } : g;
  return { footprint, crosses: true };
}

function centroidOf(g: GeoJSON.Geometry): [number, number] {
  const r = ring(g);
  if (!r?.length) return [0, 0];
  const pts = r.length > 1 ? r.slice(0, -1) : r; // the ring repeats its first point at the end
  const lon = pts.reduce((a, p) => a + p[0], 0) / pts.length, lat = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  return [+(((lon + 540) % 360) - 180).toFixed(4), +lat.toFixed(4)];
}

/** One row per acquisition: when a pass is published both as an urgent-response and as a science
 *  product, keep the science one. Newest first. */
function tidyLatest(raw: RawLatest, limit: number): Latest {
  const best = new Map<string, LatestGranule>();
  for (const g of raw.granules) {
    if (!g.footprint || !g.start_time) continue;
    const key = `${g.track}|${g.frame}|${g.direction}|${g.start_time}`;
    const cur = best.get(key);
    if (!cur || (RANK[g.maturity] ?? 0) > (RANK[cur.maturity] ?? 0)) best.set(key, g);
  }
  const granules = [...best.values()].map((g) => {
    const { footprint, crosses } = unwrapFootprint(g.footprint);
    return { ...g, footprint, centroid: crosses || !g.centroid ? centroidOf(footprint) : g.centroid };
  }).sort((a, b) => b.start_time.localeCompare(a.start_time));
  return { checked_utc: raw.checked_utc, days: raw.days, source: raw.source, granules, n: granules.length,
    n_products: raw.granules.length, truncated: raw.truncated ?? raw.granules.length >= limit };
}

/** The newest NISAR GCOV acquisitions anywhere on Earth, by acquisition time. */
export async function latest(days = 3): Promise<Latest> {
  const limit = 2000; // a week is about 500 products; the feed says so if a period ever holds more
  const raw = await viaBackend<RawLatest>(`/api/latest?days=${days}&limit=${limit}`, async () => {
    const start = new Date(Date.now() - days * 864e5).toISOString().slice(0, 19) + "Z";
    const found = await asfSearch({ start, maxResults: limit });
    return { checked_utc: new Date().toISOString(), days, source: `${ASF_SOURCE}, newest first`,
      granules: found.map((g) => ({ ...g, centroid: centroidOf(g.footprint) })) };
  });
  return tidyLatest(raw, limit);
}

export interface Rainfall {
  source: string; dataset: string; units: string; latest_available: string | null; license: string;
  daily: { date: string; precip_mm: number | null; cloud_pct?: number | null }[];
  hourly_cloud?: { time: string; cloud_pct: number }[];
}
// Weather and river context comes from Open-Meteo (free, no key, CORS-enabled). The backend proxies
// and caches it; when the backend is not running (e.g. a static deployment) the browser asks
// Open-Meteo directly, with the same transforms as backend/weather.py.
const r3 = (x: number) => Math.round(x * 1000) / 1000;
async function openMeteo(url: string, params: Record<string, string | number>) {
  const q = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  const r = await fetch(`${url}?${q}`);
  if (!r.ok) throw new Error(`weather service unavailable (${r.status})`);
  return r.json();
}

export async function rainfall(lat: number, lon: number, start: string, end: string): Promise<Rainfall> {
  return viaBackend(`/api/weather?lat=${lat}&lon=${lon}&start=${start}&end=${end}`, async () => {
    const js = await openMeteo("https://archive-api.open-meteo.com/v1/archive", {
      latitude: r3(lat), longitude: r3(lon), start_date: start, end_date: end,
      daily: "precipitation_sum,cloud_cover_mean", hourly: "cloud_cover", timezone: "UTC" });
    const d = js.daily ?? { time: [], precipitation_sum: [] };
    const daily = (d.time as string[]).map((t, i) => ({ date: t, precip_mm: d.precipitation_sum?.[i] ?? null, cloud_pct: d.cloud_cover_mean?.[i] ?? null }));
    const h = js.hourly ?? {};
    const hourly = ((h.time ?? []) as string[]).map((t, i) => ({ time: t, cloud_pct: h.cloud_cover?.[i] }))
      .filter((x): x is { time: string; cloud_pct: number } => x.cloud_pct != null);
    const avail = daily.filter((x) => x.precip_mm != null).map((x) => x.date);
    return { source: "Open-Meteo historical weather API", license: "CC BY 4.0", units: "mm/day",
      dataset: "ERA5 / ERA5T reanalysis (ECMWF): daily precipitation and cloud cover; the most recent days are preliminary",
      latest_available: avail.length ? avail[avail.length - 1] : null, daily, hourly_cloud: hourly };
  });
}

export interface GalleryItem {
  id: string; name: string; center: [number, number] | null; generated_utc: string; detail: string;
  size_km: number; n_obs: number; first: string; last: string; maturity: string; result: string;
}
/** Analyses saved on the backend; none when it is not running. */
export async function gallery(): Promise<GalleryItem[]> {
  if (!(await backendHealth())) return [];
  return (await j<{ items: GalleryItem[] }>(await fetch(`${API}/api/gallery`))).items;
}

export interface River {
  cell: [number, number]; source: string; dataset: string; units: string; today: string; license: string;
  has_river: boolean; daily: { date: string; discharge_m3s: number | null; forecast: boolean }[];
}
export async function river(lat: number, lon: number): Promise<River> {
  return viaBackend(`/api/river?lat=${lat}&lon=${lon}`, async () => {
    const js = await openMeteo("https://flood-api.open-meteo.com/v1/flood", {
      latitude: r3(lat), longitude: r3(lon), daily: "river_discharge", past_days: 180, forecast_days: 30 });
    const today = new Date().toISOString().slice(0, 10);
    const d = js.daily ?? {};
    const daily = ((d.time ?? []) as string[]).map((t, i) => ({ date: t, discharge_m3s: d.river_discharge?.[i] ?? null, forecast: t > today }));
    const vals = daily.filter((x) => x.discharge_m3s != null && !x.forecast).map((x) => x.discharge_m3s as number);
    return { cell: [js.latitude, js.longitude], source: "Open-Meteo Flood API", units: "m³/s", today, license: "CC BY 4.0",
      dataset: "GloFAS v4 river discharge (Copernicus EMS), modelled; includes forecast",
      has_river: vals.length > 0 && Math.max(...vals) > 0.5, daily };
  });
}
export interface Now {
  source: string; license: string;
  current: { time: string; temperature_2m: number; precipitation: number; rain: number; cloud_cover: number; weather_code: number; is_day: number };
}
export async function nowWeather(lat: number, lon: number): Promise<Now> {
  return viaBackend(`/api/now?lat=${lat}&lon=${lon}`, async () => {
    const js = await openMeteo("https://api.open-meteo.com/v1/forecast", {
      latitude: r3(lat), longitude: r3(lon), timezone: "UTC",
      current: "temperature_2m,precipitation,rain,cloud_cover,weather_code,is_day" });
    return { source: "Open-Meteo forecast API (current conditions, 15-minute updates)", license: "CC BY 4.0", current: js.current ?? {} };
  });
}

/** NASA GIBS (Worldview) optical imagery for a bbox and date: no key needed. */
export const GIBS_LAYERS: Record<string, string> = {
  "MODIS Terra": "MODIS_Terra_CorrectedReflectance_TrueColor",
  "MODIS Aqua": "MODIS_Aqua_CorrectedReflectance_TrueColor",
  "VIIRS SNPP": "VIIRS_SNPP_CorrectedReflectance_TrueColor",
};
export function gibsSnapshot(bbox: [number, number, number, number], date: string, layer = GIBS_LAYERS["MODIS Terra"], px = 768) {
  const [w, s, e, n] = bbox;
  const ratio = (n - s) / ((e - w) * Math.cos((((n + s) / 2) * Math.PI) / 180));
  const W = px, H = Math.max(64, Math.round(px * ratio));
  return `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=${layer}` +
    `&CRS=EPSG:4326&BBOX=${s},${w},${n},${e}&WIDTH=${W}&HEIGHT=${H}&FORMAT=image/jpeg&TIME=${date}`;
}
export const gibsTiles = (date: string, layer = GIBS_LAYERS["MODIS Terra"]) =>
  [`https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer}/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`];
export const WMO: Record<number, string> = {
  0: "clear sky", 1: "mainly clear", 2: "partly cloudy", 3: "overcast", 45: "fog", 48: "fog", 51: "light drizzle", 53: "drizzle",
  55: "heavy drizzle", 61: "light rain", 63: "rain", 65: "heavy rain", 66: "freezing rain", 67: "freezing rain", 71: "light snow",
  73: "snow", 75: "heavy snow", 80: "rain showers", 81: "rain showers", 82: "violent rain showers", 95: "thunderstorm",
  96: "thunderstorm with hail", 99: "thunderstorm with hail",
};
