"use client";
import { useEffect, useRef, useState } from "react";
import maplibregl, { Map as MLMap, GeoJSONSource, StyleSpecification } from "maplibre-gl";
import { BoxSelect, ChevronDown, ChevronsLeftRight, Crosshair, Loader2, MousePointer2, Layers, Mountain, SplitSquareHorizontal } from "lucide-react";
import { gibsTiles } from "@/lib/api";
import type { Bounds, Channel, InventoryArea, Manifest } from "@/lib/data";
import { imgUrl } from "@/lib/data";
import { COLOR } from "@/lib/theme";
import { Segmented } from "@/components/ui";

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
  // NASA GIBS daily true-colour imagery (date set later); hidden until chosen
  map.addSource("nasa", { type: "raster", tiles: gibsTiles(m.observations[m.observations.length - 1].date), tileSize: 256, maxzoom: 9,
    attribution: "Same-day optical: NASA GIBS / Worldview (MODIS Terra)" });
  map.addLayer({ id: "nasa", type: "raster", source: "nasa", layout: { visibility: "none" } });
  // terrain (AWS Open Data Terrain Tiles, terrarium encoding) for the 3D view
  map.addSource("dem", { type: "raster-dem", tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
    encoding: "terrarium", tileSize: 256, maxzoom: 14, attribution: "Terrain: AWS Terrain Tiles (Mapzen, USGS, SRTM and others)" });
  map.addSource("aoi", { type: "geojson", data: boxPoly({ w, s, e, n }) });
  map.addLayer({ id: "aoi", type: "line", source: "aoi", paint: { "line-color": COLOR.cyan, "line-width": 1.2, "line-dasharray": [3, 2] } });
  if (inv?.primary_footprint) {
    map.addSource("foot", { type: "geojson", data: { type: "Feature", properties: {}, geometry: inv.primary_footprint } });
    map.addLayer({ id: "foot", type: "line", source: "foot", paint: { "line-color": COLOR.muted, "line-width": 1, "line-opacity": 0.6 } });
  }
  map.addSource("sel", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  map.addLayer({ id: "sel-fill", type: "fill", source: "sel", paint: { "fill-color": COLOR.amber, "fill-opacity": 0.1 } });
  map.addLayer({ id: "sel-line", type: "line", source: "sel", paint: { "line-color": COLOR.amber, "line-width": 2 } });
}

interface Props {
  manifest: Manifest; inventory?: InventoryArea;
  pairIdx: number; channel: Channel; mode: Mode;
  setChannel: (c: Channel) => void; setMode: (m: Mode) => void;
  selection: Selection; onSelect: (s: Selection) => void; selectionBounds: Bounds | null;
  /** Called when the user clicks the map in "pick a place" mode (starts a live search there). */
  onPickLocation?: (lat: number, lon: number) => void;
}

export default function Explorer(p: Props) {
  const { manifest: m, pairIdx, channel, mode } = p;
  const wrap = useRef<HTMLDivElement>(null);
  const aEl = useRef<HTMLDivElement>(null), bEl = useRef<HTMLDivElement>(null);
  const maps = useRef<{ a?: MLMap; b?: MLMap; ready: number }>({ ready: 0 });
  const [ready, setReady] = useState(false);
  const [swipe, setSwipe] = useState(50);
  const [draw, setDraw] = useState(false);
  const [base, setBase] = useState<keyof typeof BASEMAPS | "nasa">("dark");
  const [threeD, setThreeD] = useState(false);
  const [picking, setPicking] = useState(false);
  const [opacity, setOpacity] = useState(0.92);
  const drawRef = useRef(draw); drawRef.current = draw;
  const pickRef = useRef(picking); pickRef.current = picking;
  const onPickRef = useRef(p.onPickLocation); onPickRef.current = p.onPickLocation;
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

    // click = point selection; drag in draw mode = box selection (mouse or one finger)
    let start: maplibregl.LngLat | null = null;
    const boxTo = (ll: maplibregl.LngLat) => ({ w: Math.min(start!.lng, ll.lng), e: Math.max(start!.lng, ll.lng),
      s: Math.min(start!.lat, ll.lat), n: Math.max(start!.lat, ll.lat) });
    const begin = (ev: maplibregl.MapMouseEvent | maplibregl.MapTouchEvent) => {
      if (!drawRef.current) return;
      ev.preventDefault(); a.dragPan.disable(); start = ev.lngLat;
    };
    const drag = (ev: maplibregl.MapMouseEvent | maplibregl.MapTouchEvent) => {
      if (!start) return;
      const bb = boxTo(ev.lngLat);
      for (const mp of [a, b]) (mp.getSource("sel") as GeoJSONSource | undefined)?.setData(boxPoly(bb));
    };
    const end = (ev: maplibregl.MapMouseEvent | maplibregl.MapTouchEvent) => {
      if (!start) return;
      const bb = boxTo(ev.lngLat);
      start = null; a.dragPan.enable(); setDraw(false);
      if (bb.e - bb.w > 0.002 && bb.n - bb.s > 0.002) onSelectRef.current({ kind: "box", bounds: bb });
    };
    a.on("mousedown", begin); a.on("mousemove", drag); a.on("mouseup", end);
    a.on("touchstart", begin); a.on("touchmove", drag); a.on("touchend", end);
    a.on("click", (ev) => {
      if (pickRef.current) { setPicking(false); onPickRef.current?.(ev.lngLat.lat, ev.lngLat.lng); return; }
      if (!drawRef.current) onSelectRef.current({ kind: "point", lng: ev.lngLat.lng, lat: ev.lngLat.lat });
    });
    return () => { maps.current.ready = 0; setReady(false); a.remove(); b.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.area, m.stack, m.generated_utc]);

  // basemap switch
  useEffect(() => {
    if (!ready || maps.current.ready < 2) return; // wait for the CURRENT map instances to load
    const date = m.pairs[pairIdx]?.after ?? m.observations[m.observations.length - 1].date;
    // only swap tiles when they actually change (setTiles aborts in-flight requests)
    const baseTiles = BASEMAPS[base === "nasa" ? "dark" : base].tiles;
    const nasaTiles = gibsTiles(date);
    for (const mp of [maps.current.a!, maps.current.b!]) {
      const src = mp.getSource("base") as maplibregl.RasterTileSource;
      if (JSON.stringify(src.tiles) !== JSON.stringify(baseTiles)) src.setTiles(baseTiles);
      const nasa = mp.getSource("nasa") as maplibregl.RasterTileSource | undefined;
      if (nasa) {
        if (base === "nasa" && JSON.stringify(nasa.tiles) !== JSON.stringify(nasaTiles)) nasa.setTiles(nasaTiles);
        mp.setLayoutProperty("nasa", "visibility", base === "nasa" ? "visible" : "none");
      }
    }
  }, [base, ready, pairIdx, m]);

  // 3D terrain: drape the radar over real elevation and tilt the view
  useEffect(() => {
    if (!ready || maps.current.ready < 2) return;
    for (const mp of [maps.current.a!, maps.current.b!]) mp.setTerrain(threeD ? { source: "dem", exaggeration: 1.8 } : null);
    maps.current.a!.easeTo({ pitch: threeD ? 62 : 0, bearing: threeD ? -20 : 0, duration: 900 });
  }, [threeD, ready]);

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
    setRadar(maps.current.a!, imgUrl(m, left), c, mode === "change" ? 0.35 * opacity : opacity);
    setRadar(maps.current.b!, imgUrl(m, right), c, mode === "change" ? 1 : opacity);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, pairIdx, channel, mode, m]);

  // opacity changes only repaint, no reload
  useEffect(() => {
    if (!ready || maps.current.ready < 2) return;
    maps.current.a!.setPaintProperty("radar", "raster-opacity", mode === "change" ? 0.35 * opacity : opacity);
    maps.current.b!.setPaintProperty("radar", "raster-opacity", mode === "change" ? Math.max(opacity, 0.5) : opacity);
  }, [opacity, ready, mode]);

  // selection outline
  useEffect(() => {
    if (!ready || maps.current.ready < 2) return; // wait for the CURRENT map instances to load
    const data: GeoJSON.Feature | GeoJSON.FeatureCollection = p.selectionBounds ? boxPoly(p.selectionBounds)
      : { type: "FeatureCollection", features: [] };
    for (const mp of [maps.current.a!, maps.current.b!]) (mp.getSource("sel") as GeoJSONSource).setData(data);
  }, [ready, p.selectionBounds]);

  useEffect(() => {
    if (aEl.current) aEl.current.style.cursor = draw || picking ? "crosshair" : "";
    maps.current.a?.getCanvas().style.setProperty("cursor", draw || picking ? "crosshair" : "pointer");
  }, [draw, picking]);

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

  const onHandleKey = (e: React.KeyboardEvent) => {
    const d = e.key === "ArrowLeft" ? -2 : e.key === "ArrowRight" ? 2 : 0;
    if (!d) return;
    e.preventDefault();
    setSwipe((v) => Math.min(98, Math.max(2, v + d)));
  };
  const tool = "flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 whitespace-nowrap";
  const idle = "border-line bg-bg-2 text-text hover:border-line-strong";

  return (
    <div className="flex flex-col">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2 text-[12px] sm:px-4 sm:text-[13px]">
        <Segmented label="Map view" value={mode} onChange={(v) => p.setMode(v as Mode)} options={[
          { v: "compare", label: "Before / After", icon: <SplitSquareHorizontal size={14} /> },
          { v: "change", label: "Measured change", icon: <Layers size={14} /> },
          { v: "screening", label: "Screening", icon: <BoxSelect size={14} /> },
        ]} />
        {mode !== "screening" && (
          <Segmented label="Radar channel" value={channel} onChange={(v) => p.setChannel(v as Channel)} options={[
            { v: "HH", label: "HH", title: "Sent and received horizontally" }, { v: "HV", label: "HV", disabled: !hvOk, title: "Sent horizontally, received vertically" },
          ]} />
        )}
        <div className="no-scrollbar -mx-3 flex min-w-0 basis-[calc(100%+1.5rem)] items-center gap-2 overflow-x-auto px-3 sm:mx-0 sm:basis-full sm:flex-wrap sm:overflow-visible sm:px-0">
          {p.onPickLocation && (
            <button onClick={() => { setPicking((v) => !v); setDraw(false); }} aria-pressed={picking}
              className={`${tool} ${picking ? "border-cyan bg-cyan/15 text-cyan" : idle}`}>
              <Crosshair size={14} />{picking ? "Click anywhere on the map…" : "Analyse a new place here"}
            </button>
          )}
          <button onClick={() => { setDraw((d) => !d); setPicking(false); }} aria-pressed={draw}
            className={`${tool} ${draw ? "border-amber bg-amber/15 text-amber" : idle}`}>
            {draw ? <BoxSelect size={14} /> : <MousePointer2 size={14} />}{draw ? "Drag a box on the map…" : "Draw region"}
          </button>
          <button onClick={() => p.onSelect({ kind: "area" })} disabled={p.selection.kind === "area"}
            className={`${tool} ${idle} disabled:opacity-40`}>Whole area</button>
          <span aria-hidden className="mx-1 hidden h-5 w-px bg-line sm:block" />
          <select value={base} onChange={(e) => setBase(e.target.value as typeof base)} aria-label="Basemap"
            className="shrink-0 rounded-md border border-line bg-bg-2 px-2 py-1.5 text-text hover:border-line-strong sm:max-w-full sm:shrink">
            <option value="dark">Basemap: dark</option>
            <option value="optical">Basemap: optical (Esri, undated)</option>
            <option value="nasa">Basemap: NASA same day ({(m.pairs[pairIdx]?.after ?? "").slice(5)})</option>
          </select>
          <button onClick={() => setThreeD((v) => !v)} aria-pressed={threeD}
            className={`${tool} ${threeD ? "border-cyan bg-cyan/15 text-cyan" : idle}`}>
            <Mountain size={14} />{threeD ? "3D on" : "3D terrain"}
          </button>
          <label className="flex shrink-0 items-center gap-2 px-1 py-1.5 text-muted" title="Radar layer opacity">
            Opacity
            <input type="range" min={0.1} max={1} step={0.05} value={opacity} onChange={(e) => setOpacity(+e.target.value)}
              className="w-20" aria-label="Radar layer opacity" />
            <span className="w-8 font-mono text-[11px] text-text">{Math.round(opacity * 100)}%</span>
          </label>
        </div>
      </div>

      {/* maps */}
      <div ref={wrap} className="relative h-[70svh] min-h-[420px] overflow-hidden bg-void sm:h-[68vh]">
        {/* maplibre sets position:relative on its container, so each map lives inside an absolute wrapper */}
        <div className="absolute inset-0"><div ref={aEl} className="h-full w-full" /></div>
        <div className="pointer-events-none absolute inset-0" style={{ clipPath: `inset(0 0 0 ${clip}%)` }}>
          <div ref={bEl} className="h-full w-full" />
        </div>
        {!ready && (
          <div className="absolute inset-0 z-20 flex items-center justify-center gap-2 bg-void text-[13px] text-muted" role="status">
            <Loader2 size={15} className="animate-spin text-cyan" />Loading the map and radar layers…
          </div>
        )}
        {mode !== "change" && pair && (
          <>
            <div className="pointer-events-none absolute top-3 left-3 z-10 border border-line bg-bg/85 px-2 py-1 font-mono text-[11px] text-text"><span className="text-muted">Before </span>{pair.before}</div>
            <div className="pointer-events-none absolute top-3 right-14 z-10 border border-line bg-bg/85 px-2 py-1 font-mono text-[11px] text-text"><span className="text-muted">After </span>{pair.after}</div>
            <div className="absolute top-0 bottom-0 z-10 w-px bg-cyan" style={{ left: `${swipe}%` }}>
              <button aria-label="Drag to compare before and after" role="slider" aria-orientation="horizontal"
                aria-valuemin={2} aria-valuemax={98} aria-valuenow={Math.round(swipe)}
                onPointerDown={onHandle} onKeyDown={onHandleKey}
                className="absolute top-1/2 -left-[18px] flex h-9 w-9 -translate-y-1/2 cursor-ew-resize touch-none items-center justify-center rounded-full border border-cyan bg-bg text-cyan shadow-[0_2px_12px_rgba(0,0,0,0.6)]">
                <ChevronsLeftRight size={16} />
              </button>
            </div>
          </>
        )}
        {mode === "change" && pair && (
          <div className="pointer-events-none absolute top-3 left-3 z-10 border border-line bg-bg/85 px-2 py-1 font-mono text-[11px] text-text">
            Δ{channel} = {pair.after} − {pair.before} <span className="text-muted">({pair.delta_days} days)</span></div>
        )}
        <Legend m={m} mode={mode} channel={channel} />
      </div>
    </div>
  );
}

function Legend({ m, mode, channel }: { m: Manifest; mode: Mode; channel: Channel }) {
  const [lo, hi] = m.stretch_db[channel];
  // Open by default where there is room; on phones it starts folded so the map stays visible.
  const [open, setOpen] = useState(true);
  useEffect(() => { if (window.matchMedia("(max-width: 639px)").matches) setOpen(false); }, []);
  const title = mode === "screening" ? "Screening (interpreted, uncalibrated)"
    : mode === "change" ? `Right: measured Δ${channel} (dB). Left: before` : `Measured ${channel} backscatter γ⁰ (dB)`;
  return (
    <div className="absolute bottom-8 left-3 z-10 w-60 border border-line bg-bg/90 text-xs backdrop-blur-sm sm:w-64">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left font-semibold text-text">
        <span>{open ? title : "Legend"}</span>
        <ChevronDown size={14} className={`shrink-0 text-muted transition-transform duration-200 ${open ? "" : "rotate-180"}`} />
      </button>
      {open && (
        <div className="px-3 pb-3">
          {mode === "screening" ? (
            <>
              <Row color="var(--map-water)" text="Very low HH/HV — consistent with open water" />
              <Row color="var(--map-veg)" text="Bright HH, large HH−HV — consistent with double bounce (flooded vegetation or buildings)" />
              <div className="mt-1.5 text-muted">Not confirmed flooding. See Methods.</div>
            </>
          ) : mode === "change" ? (
            <>
              <div className="h-2.5" style={{ background: "linear-gradient(90deg, var(--map-darker), transparent 50%, var(--map-veg))" }} />
              <div className="mt-1 flex justify-between font-mono text-muted"><span>−{m.change_range_db}</span><span>0</span><span>+{m.change_range_db}</span></div>
              <div className="mt-1 text-muted">Blue = darker, amber = brighter radar return.</div>
            </>
          ) : (
            <>
              <div className="h-2.5 border border-line" style={{ background: "linear-gradient(90deg, black, white)" }} />
              <div className="mt-1 flex justify-between font-mono text-muted"><span>{lo}</span><span>{hi}</span></div>
            </>
          )}
          <div className="mt-2 flex items-center gap-2 text-muted">
            <span className="inline-block h-0 w-5 border-t border-dashed border-cyan" />Study area
            <span className="ml-2 inline-block h-0 w-5 border-t border-muted" />NISAR frame
          </div>
        </div>
      )}
    </div>
  );
}

const Row = ({ color, text }: { color: string; text: string }) => (
  <div className="mb-1 flex items-start gap-2"><span className="mt-0.5 h-3 w-3 shrink-0" style={{ background: color }} /><span className="text-muted">{text}</span></div>
);
