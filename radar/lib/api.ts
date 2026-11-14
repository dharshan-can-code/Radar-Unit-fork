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

async function j<T>(r: Response): Promise<T> {
  if (!r.ok) {
    let msg = `${r.status}`;
    try { msg = (await r.json()).detail ?? msg; } catch { /* not json */ }
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return r.json();
}

export async function health(): Promise<{ ok: boolean; earthdata_token: boolean; note: string | null }> {
  return j(await fetch(`${API}/api/health`));
}

/** "12.5, 104.2" or "12.5 104.2" -> coordinates without calling the geocoder. */
export function parseCoords(q: string): Place | null {
  const m = q.trim().match(/^(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = +m[1], lon = +m[2];
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { name: `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`, lat, lon, type: "coordinates" };
}

export async function geocode(q: string): Promise<Place[]> {
  const c = parseCoords(q);
  if (c) return [c];
  return (await j<{ results: Place[] }>(await fetch(`${API}/api/geocode?q=${encodeURIComponent(q)}`))).results;
}

export async function acquisitions(lat: number, lon: number, fresh = false): Promise<Acquisitions> {
  return j(await fetch(`${API}/api/acquisitions?lat=${lat}&lon=${lon}${fresh ? "&fresh=true" : ""}`));
}

export type Detail = "quick" | "standard";
export async function startAnalysis(body: { lat: number; lon: number; scenes: string[]; size_km: number; place?: string; detail?: Detail }): Promise<Job> {
  return j(await fetch(`${API}/api/analyze`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
}

export async function job(id: string): Promise<Job> {
  return j(await fetch(`${API}/api/jobs/${id}`));
}

export async function loadResult(path: string): Promise<Manifest> {
  return j(await fetch(`${API}${path}`, { cache: "no-store" }));
}

export interface LatestGranule extends Granule { centroid: [number, number]; footprint: GeoJSON.Geometry }
export interface Latest { checked_utc: string; days: number; n: number; source: string; granules: LatestGranule[] }
export async function latest(days = 3): Promise<Latest> {
  return j(await fetch(`${API}/api/latest?days=${days}`));
}

export interface Rainfall {
  source: string; dataset: string; units: string; latest_available: string | null; license: string;
  daily: { date: string; precip_mm: number | null; cloud_pct?: number | null }[];
  hourly_cloud?: { time: string; cloud_pct: number }[];
}
export async function rainfall(lat: number, lon: number, start: string, end: string): Promise<Rainfall> {
  return j(await fetch(`${API}/api/weather?lat=${lat}&lon=${lon}&start=${start}&end=${end}`));
}

export interface GalleryItem {
  id: string; name: string; center: [number, number] | null; generated_utc: string; detail: string;
  size_km: number; n_obs: number; first: string; last: string; maturity: string; result: string;
}
export async function gallery(): Promise<GalleryItem[]> {
  return (await j<{ items: GalleryItem[] }>(await fetch(`${API}/api/gallery`))).items;
}

export interface River {
  cell: [number, number]; source: string; dataset: string; units: string; today: string; license: string;
  has_river: boolean; daily: { date: string; discharge_m3s: number | null; forecast: boolean }[];
}
export async function river(lat: number, lon: number): Promise<River> {
  return j(await fetch(`${API}/api/river?lat=${lat}&lon=${lon}`));
}
export interface Now {
  source: string; license: string;
  current: { time: string; temperature_2m: number; precipitation: number; rain: number; cloud_cover: number; weather_code: number; is_day: number };
}
export async function nowWeather(lat: number, lon: number): Promise<Now> {
  return j(await fetch(`${API}/api/now?lat=${lat}&lon=${lon}`));
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
