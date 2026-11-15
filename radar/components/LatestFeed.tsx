"use client";
import { useEffect, useRef, useState } from "react";
import maplibregl, { GeoJSONSource, Map as MLMap } from "maplibre-gl";
import { CloudOff, Loader2, RefreshCw, Satellite } from "lucide-react";
import { Latest, LatestGranule, Place, errorText, latest } from "@/lib/api";
import { MAT, MAT_LABEL } from "@/components/LiveSearch";
import { COLOR } from "@/lib/theme";

const DAYS = [1, 3, 7];
const ago = (iso: string) => {
  const h = (Date.now() - Date.parse(iso)) / 3.6e6;
  return h < 1 ? `${Math.round(h * 60)} min ago` : h < 48 ? `${Math.round(h)} h ago` : `${Math.round(h / 24)} d ago`;
};

/** Live feed of the newest NISAR GCOV acquisitions anywhere on Earth (from ASF, not simulated). */
export default function LatestFeed({ onPick }: { onPick: (p: Place) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const [days, setDays] = useState(3);
  const [data, setData] = useState<Latest | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const onPickRef = useRef(onPick); onPickRef.current = onPick;
  const [globe, setGlobe] = useState(true);
  const spinning = useRef(true);

  async function load(d = days) {
    setLoading(true); setErr(null);
    try { setData(await latest(d)); } catch (x) { setErr(errorText(x)); } finally { setLoading(false); }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(days); }, [days]);

  useEffect(() => {
    const m = new maplibregl.Map({
      container: el.current!, center: [100, 12], zoom: 1.1, attributionControl: { compact: true },
      style: { version: 8, projection: { type: "globe" }, sources: { base: { type: "raster", tileSize: 256, attribution: "Basemap: Esri",
        tiles: ["https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"] } },
        layers: [{ id: "base", type: "raster", source: "base" }] },
    });
    m.on("load", () => {
      m.addSource("fp", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addLayer({ id: "fp-fill", type: "fill", source: "fp",
        paint: { "fill-color": ["match", ["get", "maturity"], "VALIDATED", COLOR.green, "PROVISIONAL", COLOR.cyan, "URGENT_RESPONSE", COLOR.amber, COLOR.muted],
          "fill-opacity": ["interpolate", ["linear"], ["get", "age_h"], 0, 0.55, 168, 0.12] } });
      m.addLayer({ id: "fp-line", type: "line", source: "fp", paint: { "line-color": COLOR.text, "line-width": 0.4, "line-opacity": 0.5 } });
      m.on("click", "fp-fill", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        onPickRef.current({ name: `${e.lngLat.lat.toFixed(4)}°, ${e.lngLat.lng.toFixed(4)}° (from newest acquisitions)`,
          lat: e.lngLat.lat, lon: e.lngLat.lng, type: "feed" });
      });
      m.on("mouseenter", "fp-fill", () => { m.getCanvas().style.cursor = "pointer"; });
      m.on("mouseleave", "fp-fill", () => { m.getCanvas().style.cursor = ""; });
      map.current = m;
      setData((d) => (d ? { ...d } : d)); // trigger draw if data arrived first
    });
    // slow spin until the user touches the globe
    const stop = () => { spinning.current = false; };
    m.on("mousedown", stop); m.on("touchstart", stop); m.on("wheel", stop);
    let raf = 0;
    const spin = () => {
      if (spinning.current && m.isStyleLoaded() && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        const c = m.getCenter(); m.setCenter([((c.lng + 0.08 + 540) % 360) - 180, c.lat]);
      }
      raf = requestAnimationFrame(spin);
    };
    raf = requestAnimationFrame(spin);
    return () => { cancelAnimationFrame(raf); m.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m || !data || !m.getSource("fp")) return;
    (m.getSource("fp") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: data.granules.map((g) => ({ type: "Feature", geometry: g.footprint,
        properties: { maturity: g.maturity, age_h: (Date.now() - Date.parse(g.start_time)) / 3.6e6 } })),
    });
  }, [data]);

  const pick = (g: LatestGranule) =>
    onPick({ name: `${g.centroid[1].toFixed(4)}°, ${g.centroid[0].toFixed(4)}° (track ${g.track}${g.direction?.[0]}, ${g.date})`,
      lat: g.centroid[1], lon: g.centroid[0], type: "feed" });

  return (
    <div className="rounded-lg border border-line bg-panel p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Satellite size={16} className="text-cyan" />
        <span className="text-sm font-semibold">Newest NISAR acquisitions worldwide</span>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex overflow-hidden rounded-md border border-line text-[12px]">
            {DAYS.map((d) => (
              <button key={d} onClick={() => setDays(d)} className={`px-2.5 py-1 ${days === d ? "bg-cyan/15 text-cyan" : "text-muted hover:text-text"}`}>
                {d === 1 ? "24 h" : `${d} days`}
              </button>
            ))}
          </div>
          <button onClick={() => {
            const m = map.current; if (!m) return;
            const g = !globe; setGlobe(g); m.setProjection({ type: g ? "globe" : "mercator" }); spinning.current = g;
          }} className="rounded-md border border-line px-2.5 py-1 text-[12px] text-muted hover:text-text">{globe ? "Flat map" : "3D globe"}</button>
          <button onClick={() => load()} title="Check the archive again" className="text-cyan hover:text-text">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </button>
        </div>
      </div>
      <p className="mt-1 text-[12px] text-muted">
        Footprints of every L2 GCOV product acquired in the selected period, as listed by ASF right now
        {data && <> (checked {data.checked_utc.slice(11, 16)} UTC · {data.n} products)</>}. Click a footprint or a row to explore it.
      </p>
      <div className="mt-3 grid gap-3 lg:grid-cols-5">
        <div ref={el} className="h-80 overflow-hidden rounded-lg border border-line bg-void lg:col-span-3" />
        <div className="max-h-80 overflow-auto border-t border-line lg:col-span-2 lg:border-t-0 lg:border-l">
          {err && (
            <div className="flex items-start gap-2.5 p-4 text-[13px] leading-relaxed text-muted">
              <CloudOff size={16} className="mt-0.5 shrink-0 text-amber" />
              <span><span className="font-medium text-text">The live feed is not available right now.</span> {err} The saved examples above open without it.</span>
            </div>
          )}
          {!data && !err && <p className="p-3 text-[12px] text-muted">Loading the newest acquisitions…</p>}
          {data && data.granules.length === 0 && <p className="p-3 text-[12px] text-muted">No GCOV products in this period yet.</p>}
          <ul>
            {data?.granules.slice(0, 80).map((g) => (
              <li key={g.scene} className="border-b border-line/60 last:border-0">
                <button onClick={() => pick(g)} className="w-full px-3 py-1.5 text-left text-[12px] hover:bg-panel-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-text">{g.start_time.slice(0, 16).replace("T", " ")}</span>
                    <span className="text-muted">{ago(g.start_time)}</span>
                    <span className={`ml-auto rounded border px-1 font-mono text-[11px] ${MAT[g.maturity] ?? MAT.OTHER}`}>{MAT_LABEL[g.maturity] ?? g.maturity}</span>
                  </div>
                  <div className="font-mono text-muted">{g.centroid[1].toFixed(2)}°, {g.centroid[0].toFixed(2)}° · track {g.track}{g.direction?.[0]} · {g.pols.join("+")}</div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-[12px] text-muted">
        <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-green" />Validated</span>
        <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-cyan" />Provisional</span>
        <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-amber" />Urgent response</span>
        <span>Brighter = more recent. Acquisition time is when the satellite passed; products appear after processing.</span>
      </div>
    </div>
  );
}
