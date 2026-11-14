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
  maturity: string; usable: boolean; granules: Granule[]; dates: string[]; n_dates: number;
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

export async function startAnalysis(body: { lat: number; lon: number; scenes: string[]; size_km: number; place?: string }): Promise<Job> {
  return j(await fetch(`${API}/api/analyze`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
}

export async function job(id: string): Promise<Job> {
  return j(await fetch(`${API}/api/jobs/${id}`));
}

export async function loadResult(path: string): Promise<Manifest> {
  return j(await fetch(`${API}${path}`, { cache: "no-store" }));
}
