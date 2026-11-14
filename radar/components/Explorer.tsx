"use client";
import { useEffect, useRef, useState } from "react";
import maplibregl, { Map as MLMap, GeoJSONSource, StyleSpecification } from "maplibre-gl";
import { BoxSelect, MousePointer2, Layers, SplitSquareHorizontal, Satellite, Map as MapIcon } from "lucide-react";
import type { Bounds, Channel, InventoryArea, Manifest } from "@/lib/data";
import { imgUrl } from "@/lib/data";

export type Mode = "compare" | "change" | "screening";
export type Selection = { kind: "point"; lng: number; lat: number } | { kind: "box"; bounds: Bounds } | { kind: "area" };

const BASEMAPS = {
  dark: { tiles: ["https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"],
    attribution: "Basemap: Esri, HERE, Garmin, © OpenStreetMap contributors" },
  optical: { tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
    attribution: "Optical context: Esri World Imagery (acquisition dates vary; not time-matched)" },
};

function style(base: keyof typeof BASEMAPS): StyleSpecification {
  return {
    version: 8,
    sources: { base: { type: "raster", tiles: BASEMAPS[base].tiles, tileSize: 256, attribution: BASEMAPS[base].attribution } },
    layers: [{ id: "base", type: "raster", source: "base" }],
  };
}

const boxPoly = (b: Bounds): GeoJSON.Feature => ({ type: "Feature", properties: {},
  geometry: { type: "Polygon", coordinates: [[[b.w, b.s], [b.e, b.s], [b.e, b.n], [b.w, b.n], [b.w, b.s]]] } });

type Quad = [[number, number], [number, number], [number, number], [number, number]];

/** Replace the radar overlay. Re-adding the source is more robust than
 *  ImageSource.updateImage, which aborts when calls overlap. */
function setRadar(map: MLMap, url: string, coords: Quad, opacity: number) {
  if (map.getLayer("radar")) map.removeLayer("radar");
  if (map.getSource("radar")) map.removeSource("radar");
  map.addSource("radar", { type: "image", url, coordinates: coords });
  map.addLayer({ id: "radar", type: "raster", source: "radar",
    paint: { "raster-opacity": opacity, "raster-resampling": "nearest", "raster-fade-duration": 0 } }, "aoi");
}

function addOverlays(map: MLMap, m: Manifest, inv: InventoryArea | undefined) {
  const [w, s, e, n] = m.bbox;
  map.addSource("aoi", { type: "geojson", data: boxPoly({ w, s, e, n }) });
  map.addLayer({ id: "aoi", type: "line", source: "aoi", paint: { "line-color": "#22d3ee", "line-width": 1.2, "line-dasharray": [3, 2] } });
  if (inv?.primary_footprint) {
    map.addSource("foot", { type: "geojson", data: { type: "Feature", properties: {}, geometry: inv.primary_footprint } });
    map.addLayer({ id: "foot", type: "line", source: "foot", paint: { "line-color": "#8b9ab5", "line-width": 1, "line-opacity": 0.6 } });
  }
  map.addSource("sel", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  map.addLayer({ id: "sel-fill", type: "fill", source: "sel", paint: { "fill-color": "#f59e0b", "fill-opacity": 0.08 } });
  map.addLayer({ id: "sel-line", type: "line", source: "sel", paint: { "line-color": "#f59e0b", "line-width": 2 } });
}

interface Props {
  manifest: Manifest; inventory?: InventoryArea;
  pairIdx: number; channel: Channel; mode: Mode;
  setChannel: (c: Channel) => void; setMode: (m: Mode) => void;
  selection: Selection; onSelect: (s: Selection) => void; selectionBounds: Bounds | null;
}

export default function Explorer(p: Props) {
  const { manifest: m, pairIdx, channel, mode } = p;
  const wrap = useRef<HTMLDivElement>(null);
  const aEl = useRef<HTMLDivElement>(null), bEl = useRef<HTMLDivElement>(null);
  const maps = useRef<{ a?: MLMap; b?: MLMap; ready: number }>({ ready: 0 });
  const [ready, setReady] = useState(false);
  const [swipe, setSwipe] = useState(50);
  const [draw, setDraw] = useState(false);
  const [base, setBase] = useState<keyof typeof BASEMAPS>("dark");
  const drawRef = useRef(draw); drawRef.current = draw;
  const onSelectRef = useRef(p.onSelect); onSelectRef.current = p.onSelect;

  // create maps once
  useEffect(() => {
    const [w, s, e, n] = m.bbox;
    const opts = { style: style("dark"), bounds: [[w, s], [e, n]] as [[number, number], [number, number]],
      fitBoundsOptions: { padding: 24 }, attributionControl: { compact: true } as const };
    const a = new maplibregl.Map({ container: aEl.current!, ...opts });
    const b = new maplibregl.Map({ container: bEl.current!, ...opts, interactive: false, attributionControl: false });
    a.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    a.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");
    const sync = () => b.jumpTo({ center: a.getCenter(), zoom: a.getZoom(), bearing: a.getBearing(), pitch: a.getPitch() });
    a.on("move", sync);
    maps.current = { a, b, ready: 0 };
    setReady(false);
    if (process.env.NODE_ENV === "development") (window as unknown as { __dp: unknown }).__dp = { a, b };
    const onLoad = (mp: MLMap) => () => {
      addOverlays(mp, m, p.inventory);
      if (++maps.current.ready === 2) setReady(true);
    };
    a.on("load", onLoad(a)); b.on("load", onLoad(b));

    // click = point selection; drag in draw mode = box selection
    let start: maplibregl.LngLat | null = null;
    a.on("mousedown", (ev) => {
      if (!drawRef.current) return;
      ev.preventDefault(); a.dragPan.disable(); start = ev.lngLat;
    });
    a.on("mousemove", (ev) => {
      if (!start) return;
      const bb = { w: Math.min(start.lng, ev.lngLat.lng), e: Math.max(start.lng, ev.lngLat.lng),
        s: Math.min(start.lat, ev.lngLat.lat), n: Math.max(start.lat, ev.lngLat.lat) };
      for (const mp of [a, b]) (mp.getSource("sel") as GeoJSONSource | undefined)?.setData(boxPoly(bb));
    });
    a.on("mouseup", (ev) => {
      if (!start) return;
      const bb = { w: Math.min(start.lng, ev.lngLat.lng), e: Math.max(start.lng, ev.lngLat.lng),
        s: Math.min(start.lat, ev.lngLat.lat), n: Math.max(start.lat, ev.lngLat.lat) };
      start = null; a.dragPan.enable(); setDraw(false);
      if (bb.e - bb.w > 0.002 && bb.n - bb.s > 0.002) onSelectRef.current({ kind: "box", bounds: bb });
    });
    a.on("click", (ev) => { if (!drawRef.current) onSelectRef.current({ kind: "point", lng: ev.lngLat.lng, lat: ev.lngLat.lat }); });
    return () => { maps.current.ready = 0; setReady(false); a.remove(); b.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.area, m.stack, m.generated_utc]);

  // basemap switch
  useEffect(() => {
    if (!ready || maps.current.ready < 2) return; // wait for the CURRENT map instances to load
    for (const mp of [maps.current.a!, maps.current.b!]) {
      const src = mp.getSource("base") as maplibregl.RasterTileSource;
      src.setTiles(BASEMAPS[base].tiles);
    }
  }, [base, ready]);

  // update radar images
  useEffect(() => {
    if (!ready || maps.current.ready < 2) return; // wait for the CURRENT map instances to load
    const pair = m.pairs[pairIdx];
    if (!pair) return;
    const c = m.display.corners as Quad;
    const ch = pair.channels.includes(channel) ? channel : "HH";
    let left: string, right: string;
    if (mode === "compare") { left = `${pair.before}_${ch}`; right = `${pair.after}_${ch}`; }
    else if (mode === "screening") { left = `${pair.before}_class`; right = `${pair.after}_class`; }
    else { left = `${pair.before}_${ch}`; right = `d_${pair.id}_${ch}`; }
    setRadar(maps.current.a!, imgUrl(m, left), c, mode === "change" ? 0.35 : 0.92);
    setRadar(maps.current.b!, imgUrl(m, right), c, mode === "change" ? 1 : 0.92);
  }, [ready, pairIdx, channel, mode, m]);

  // selection outline
  useEffect(() => {
    if (!ready || maps.current.ready < 2) return; // wait for the CURRENT map instances to load
    const data: GeoJSON.Feature | GeoJSON.FeatureCollection = p.selectionBounds ? boxPoly(p.selectionBounds)
      : { type: "FeatureCollection", features: [] };
    for (const mp of [maps.current.a!, maps.current.b!]) (mp.getSource("sel") as GeoJSONSource).setData(data);
  }, [ready, p.selectionBounds]);

  useEffect(() => {
    if (aEl.current) aEl.current.style.cursor = draw ? "crosshair" : "";
    maps.current.a?.getCanvas().style.setProperty("cursor", draw ? "crosshair" : "pointer");
  }, [draw]);

  const clip = mode === "change" ? 0 : swipe;
  const pair = m.pairs[pairIdx];
  const hvOk = pair?.channels.includes("HV");

  const onHandle = (e: React.PointerEvent) => {
    const el = wrap.current!; const r = el.getBoundingClientRect();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => setSwipe(Math.min(98, Math.max(2, ((ev.clientX - r.left) / r.width) * 100)));
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
        <Seg value={mode} onChange={(v) => p.setMode(v as Mode)} options={[
          { v: "compare", label: "Before / After", icon: <SplitSquareHorizontal size={14} /> },
          { v: "change", label: "Measured change", icon: <Layers size={14} /> },
          { v: "screening", label: "Screening", icon: <BoxSelect size={14} /> },
        ]} />
        {mode !== "screening" && (
          <Seg value={channel} onChange={(v) => p.setChannel(v as Channel)} options={[
            { v: "HH", label: "HH" }, { v: "HV", label: "HV", disabled: !hvOk },
          ]} />
        )}
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <button onClick={() => setDraw((d) => !d)}
            className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 ${draw ? "border-amber bg-amber/15 text-amber" : "border-line bg-panel text-text hover:border-cyan/50"}`}>
            {draw ? <BoxSelect size={14} /> : <MousePointer2 size={14} />}{draw ? "Drag a box on the map…" : "Draw region"}
          </button>
          <button onClick={() => p.onSelect({ kind: "area" })}
            className="rounded-md border border-line bg-panel px-3 py-1.5 hover:border-cyan/50">Whole area</button>
          <button onClick={() => setBase((b) => (b === "dark" ? "optical" : "dark"))} title="Toggle basemap"
            className="flex items-center gap-1.5 rounded-md border border-line bg-panel px-3 py-1.5 hover:border-cyan/50">
            {base === "dark" ? <Satellite size={14} /> : <MapIcon size={14} />}{base === "dark" ? "Optical context" : "Dark basemap"}
          </button>
        </div>
      </div>

      {/* maps */}
      <div ref={wrap} className="relative h-[62vh] min-h-[420px] overflow-hidden rounded-xl border border-line bg-panel">
        {/* maplibre sets position:relative on its container, so each map lives inside an absolute wrapper */}
        <div className="absolute inset-0"><div ref={aEl} className="h-full w-full" /></div>
        <div className="pointer-events-none absolute inset-0" style={{ clipPath: `inset(0 0 0 ${clip}%)` }}>
          <div ref={bEl} className="h-full w-full" />
        </div>
        {mode !== "change" && pair && (
          <>
            <div className="pointer-events-none absolute top-3 left-3 rounded bg-bg/80 px-2 py-1 font-mono text-[10px] text-muted sm:text-xs"><span className="hidden sm:inline">BEFORE · </span>{pair.before}</div>
            <div className="pointer-events-none absolute top-3 right-14 rounded bg-bg/80 px-2 py-1 font-mono text-[10px] text-muted sm:text-xs"><span className="hidden sm:inline">AFTER · </span>{pair.after}</div>
            <div className="absolute top-0 bottom-0 z-10 w-0.5 bg-cyan/80" style={{ left: `${swipe}%` }}>
              <button aria-label="Drag to compare" onPointerDown={onHandle}
                className="absolute top-1/2 -left-4 h-8 w-8 -translate-y-1/2 cursor-ew-resize rounded-full border-2 border-cyan bg-bg text-cyan">⇔</button>
            </div>
          </>
        )}
        {mode === "change" && pair && (
          <div className="pointer-events-none absolute top-3 left-3 rounded bg-bg/80 px-2 py-1 font-mono text-xs text-muted">
            Δ{channel} = {pair.after} − {pair.before} · {pair.delta_days} days</div>
        )}
        <Legend m={m} mode={mode} channel={channel} />
      </div>
    </div>
  );
}

function Seg({ value, onChange, options }: { value: string; onChange: (v: string) => void;
  options: { v: string; label: string; icon?: React.ReactNode; disabled?: boolean }[] }) {
  return (
    <div className="flex overflow-hidden rounded-md border border-line bg-panel">
      {options.map((o) => (
        <button key={o.v} disabled={o.disabled} onClick={() => onChange(o.v)}
          title={o.disabled ? "Not available for this pair" : undefined}
          className={`flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1.5 sm:px-3 ${value === o.v ? "bg-cyan/15 text-cyan" : "text-muted hover:text-text"} disabled:cursor-not-allowed disabled:opacity-35`}>
          {o.icon}{o.label}
        </button>
      ))}
    </div>
  );
}

function Legend({ m, mode, channel }: { m: Manifest; mode: Mode; channel: Channel }) {
  const [lo, hi] = m.stretch_db[channel];
  return (
    <div className="absolute bottom-8 left-3 z-10 w-56 rounded-lg sm:w-64 border border-line bg-bg/90 p-3 text-xs backdrop-blur">
      {mode === "screening" ? (
        <>
          <div className="mb-1.5 font-semibold text-text">Screening (interpreted, uncalibrated)</div>
          <Row color="#22d3ee" text="Very low HH/HV — consistent with open water" />
          <Row color="#f59e0b" text="Bright HH, large HH−HV — consistent with double bounce (flooded vegetation or buildings)" />
          <div className="mt-1.5 text-muted">Not confirmed flooding. See Methods.</div>
        </>
      ) : (
        <>
          <div className="mb-1.5 font-semibold text-text">
            {mode === "change" ? <>Right: measured Δ{channel} (dB) · Left: before</> : <>Measured {channel} backscatter γ⁰ (dB)</>}
          </div>
          {mode === "change" ? (
            <>
              <div className="h-2.5 rounded" style={{ background: "linear-gradient(90deg,#288cff,#14141400 50%,#f59e0b)" }} />
              <div className="mt-1 flex justify-between font-mono text-muted"><span>−{m.change_range_db}</span><span>0</span><span>+{m.change_range_db}</span></div>
              <div className="mt-1 text-muted">Blue = darker, amber = brighter radar return.</div>
            </>
          ) : (
            <>
              <div className="h-2.5 rounded" style={{ background: "linear-gradient(90deg,#000,#fff)" }} />
              <div className="mt-1 flex justify-between font-mono text-muted"><span>{lo}</span><span>{hi}</span></div>
            </>
          )}
        </>
      )}
      <div className="mt-2 flex items-center gap-2 text-muted">
        <span className="inline-block h-0 w-5 border-t border-dashed border-cyan" />Study area
        <span className="ml-2 inline-block h-0 w-5 border-t border-muted" />NISAR frame
      </div>
    </div>
  );
}

const Row = ({ color, text }: { color: string; text: string }) => (
  <div className="mb-1 flex items-start gap-2"><span className="mt-0.5 h-3 w-3 shrink-0 rounded-sm" style={{ background: color }} /><span className="text-muted">{text}</span></div>
);
