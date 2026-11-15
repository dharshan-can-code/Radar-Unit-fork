"use client";
// Everything the pages share: the case study or live result on screen, the chosen pair of
// passes, the selected area and the analysis of it. It lives in the (site) layout, so moving
// between pages keeps it (no reload, no lost selection).
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Mode, Selection } from "@/components/Explorer";
import type { LiveResult } from "@/components/LiveSearch";
import {
  AreaStatus, Bounds, Channel, GridIndex, Inventory, InventoryArea, Manifest, Stacks, Validation, fingerprint, interpret,
  loadExample, loadGrid, loadInventory, loadManifest, loadStacks, loadStatus, loadValidation, resultQuery, timeSeries,
} from "@/lib/data";
import { Place, Rainfall, loadResult, rainfall } from "@/lib/api";
import { STORY } from "@/components/site/nav";

export const AREA = "tonle_sap";

function useSiteState() {
  const router = useRouter();
  const pathname = usePathname();
  const [inv, setInv] = useState<Inventory | null>(null);
  const [m, setM] = useState<Manifest | null | undefined>(undefined);
  const [rawGrid, setGrid] = useState<GridIndex | null>(null);
  // A grid is only valid with the manifest it was read for. While the place on screen is
  // switching (a shared link opening over the case study, say) the two can be out of step
  // for a moment, so nothing downstream ever sees a mismatched pair.
  const grid = rawGrid && rawGrid.m === m ? rawGrid : null;
  const loadSeq = useRef(0);
  const [pairIdx, setPairIdx] = useState(0);
  const [channel, setChannel] = useState<Channel>("HH");
  const [mode, setMode] = useState<Mode>("compare");
  const [sel, setSel] = useState<Selection>({ kind: "area" });
  const [stacks, setStacks] = useState<Stacks | null>(null);
  const [stackId, setStackId] = useState<string | null>(null);
  const [status, setStatus] = useState<AreaStatus | null>(null);
  const [source, setSource] = useState<"case" | "live">("case");
  const [live, setLive] = useState<LiveResult | null>(null);
  const [caseReload, setCaseReload] = useState(0);
  const [externalPlace, setExternalPlace] = useState<(Place & { nonce: number }) | null>(null);
  const [rain, setRain] = useState<Rainfall | null>(null);
  const [help, setHelp] = useState(false);
  const [validation, setValidation] = useState<Validation | null>(null);
  const [featuredFor, setFeaturedFor] = useState<string | null>(null);
  const [deepTab, setDeepTab] = useState("now");
  // The place chooser on the Explore page (examples, search, newest acquisitions) is folded away
  // while a result is on screen, so choosing a place sits above the result instead of far below it.
  const [placesOpen, setPlacesOpen] = useState(false);

  // Shareable links: ?result=<id> reopens a saved live analysis, ?example=<id> a ready-made one.
  // Old links used /?view=story; they now open /story.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("view") === "story") {
      params.delete("view");
      const rest = params.toString();
      router.replace(`${STORY}${rest ? `?${rest}` : ""}`);
    }
    const id = params.get("result");
    const ex = params.get("example");
    if (ex) {
      loadExample(ex).then((mm) => { if (mm) showLive({ manifest: mm, footprint: null, checkedUtc: null }, true, true); })
        .catch(() => { /* unknown example: stay on case study */ });
    }
    if (id && /^[a-f0-9]{8,32}$/.test(id)) {
      loadResult(`/api/results/${id}/manifest.json`).then((mm) => showLive({ manifest: mm, footprint: null, checkedUtc: null }, true, true))
        .catch(() => { /* backend offline or unknown id: stay on case study */ });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rainfall context (ERA5 via Open-Meteo) for whatever is shown.
  useEffect(() => {
    if (!m || !m.observations.length) { setRain(null); return; }
    const [lon, lat] = m.center ?? [(m.bbox[0] + m.bbox[2]) / 2, (m.bbox[1] + m.bbox[3]) / 2];
    const first = new Date(Date.parse(m.observations[0].date) - 15 * 864e5).toISOString().slice(0, 10);
    const last = new Date(Math.min(Date.now(), Date.parse(m.observations[m.observations.length - 1].date) + 3 * 864e5)).toISOString().slice(0, 10);
    let cancelled = false;
    setRain(null); // never show the previous place's weather beside this one while the new record loads
    rainfall(lat, lon, first, last).then((r) => { if (!cancelled) setRain(r); }).catch(() => { if (!cancelled) setRain(null); });
    return () => { cancelled = true; };
  }, [m]);

  useEffect(() => {
    loadInventory().then(setInv).catch(() => setInv(null));
    loadStatus().then((s) => setStatus(s?.[AREA] ?? null)).catch(() => setStatus(null));
    loadValidation(AREA).then(setValidation).catch(() => setValidation(null));
    loadStacks(AREA).then((s) => {
      setStacks(s);
      if (s?.default) setStackId(s.default); else setM(null);
    }).catch(() => setM(null));
  }, []);

  // Load the selected stack; latest compatible pair is selected by default.
  useEffect(() => {
    if (!stackId || source !== "case") return;
    // If a live result or example takes over while this is still loading, drop the late answer.
    let cancelled = false;
    setGrid(null);
    setSel({ kind: "area" });
    loadManifest(AREA, stackId).then(async (mm) => {
      if (cancelled) return;
      setM(mm);
      if (mm) {
        setPairIdx(Math.max(0, mm.pairs.length - 1));
        const g = await loadGrid(mm);
        if (!cancelled) setGrid(new GridIndex(mm, g));
      }
    }).catch(() => { if (!cancelled) setM(null); });
    return () => { cancelled = true; };
  }, [stackId, source, caseReload]);

  // Case study opens on the featured flooded-forest example (picked by scripts/validation/validate_area.py).
  const featured = validation?.featured && m && m.stack === validation.stack ? validation.featured : null;
  useEffect(() => {
    if (source !== "case" || !m || !featured) return;
    const key = `${m.stack}:${caseReload}`;
    if (featuredFor === key) return;
    const i = m.pairs.findIndex((p) => p.id === featured.pair);
    if (i >= 0) setPairIdx(i);
    setSel({ kind: "box", bounds: featured.bounds });
    setFeaturedFor(key);
  }, [source, m, featured, caseReload, featuredFor]);

  /** The query that keeps a live result on screen when moving between pages ("" for the case study). */
  const query = source === "live" && m ? `?${resultQuery(m)}` : "";
  /** A link to a page (and optionally a section on it) that keeps the current result. */
  const href = (path: string, hash?: string) => `${path}${query}${hash ? `#${hash}` : ""}`;

  // A live analysis result replaces the case-study data on every page. keepUrl: it was opened from
  // the URL, which already says so (and may be mid-redirect from an old /?view=story link).
  function showLive(r: LiveResult, noScroll = false, keepUrl = false) {
    setSource("live"); setLive(r); setSel({ kind: "area" }); setGrid(null); setM(r.manifest);
    const qs = `?${resultQuery(r.manifest)}`;
    const path = window.location.pathname;
    if (!noScroll && path !== STORY) {
      // A new result opens on its short answer, directly under the place chooser it was picked in.
      setPlacesOpen(false);
      if (path === "/explore") {
        window.history.replaceState(null, "", `/explore${qs}`);
        setTimeout(() => document.getElementById("answer")?.scrollIntoView({ behavior: "smooth" }), 80);
      } else router.push(`/explore${qs}#answer`);
    } else if (!keepUrl) {
      window.history.replaceState(null, "", `${path}${qs}${window.location.hash}`);
    }
    if (path === STORY) window.scrollTo({ top: 0 });
    // Live results open on the newest pair; saved examples on the pair with the most change (as in Your Story).
    const changed = (p: Manifest["pairs"][number]) => {
      const c = (p as unknown as { HH_change?: { frac_increase: number | null; frac_decrease: number | null } }).HH_change;
      return (c?.frac_increase ?? 0) + (c?.frac_decrease ?? 0);
    };
    const ps = r.manifest.pairs;
    setPairIdx(r.manifest.area === "examples" && ps.length
      ? ps.reduce((best, p, i) => (changed(p) > changed(ps[best]) ? i : best), 0)
      : Math.max(0, ps.length - 1));
    const seq = ++loadSeq.current;
    loadGrid(r.manifest).then((g) => { if (loadSeq.current === seq) setGrid(new GridIndex(r.manifest, g)); })
      .catch(() => { if (loadSeq.current === seq) setGrid(null); });
  }

  function backToCase() {
    loadSeq.current++;
    setSource("case"); setLive(null); setM(undefined); setGrid(null); setCaseReload((n) => n + 1);
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.hash}`);
  }

  /** A place picked on the map or the globe goes into the search box on the Explore page. */
  function pickPlace(p: Place) {
    setExternalPlace({ ...p, nonce: Date.now() });
    setPlacesOpen(true);
    if (pathname === "/explore") setTimeout(() => document.getElementById("places")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    else router.push(href("/explore", "places"));
  }

  const inventoryForMap: InventoryArea | undefined = source === "live"
    ? ({ primary_footprint: live?.footprint ?? null } as InventoryArea)
    : m ? inv?.areas[m.area] : undefined;

  const pair = m?.pairs[pairIdx];
  const { rect, bounds, label } = useMemo(() => {
    if (!grid || !m) return { rect: null, bounds: null as Bounds | null, label: "" };
    if (sel.kind === "area") {
      const [w, s, e, n] = m.bbox;
      return { rect: grid.rectOf({ w, s, e, n }), bounds: null, label: source === "live" ? `whole ${m.size_km ?? ""} km window` : "whole study area" };
    }
    if (sel.kind === "box") {
      const isFeatured = source === "case" && featured && sel.bounds === featured.bounds;
      return { rect: grid.rectOf(sel.bounds), bounds: sel.bounds,
        label: isFeatured ? `${featured.name}: 10 × 10 km box on the flooded-forest belt (draw your own region, or press “Whole area” on the map)`
          : `box ${sel.bounds.w.toFixed(3)}…${sel.bounds.e.toFixed(3)}°E, ${sel.bounds.s.toFixed(3)}…${sel.bounds.n.toFixed(3)}°N` };
    }
    const cell = grid.cellOf(sel.lng, sel.lat);
    if (!cell) return { rect: null, bounds: null, label: "outside processed area" };
    const r = { r0: Math.max(0, cell[0] - 1), r1: Math.min(grid.ny - 1, cell[0] + 1), c0: Math.max(0, cell[1] - 1), c1: Math.min(grid.nx - 1, cell[1] + 1) };
    const d = (1.5 * m.grid.res_m) / 111320;
    const dl = d / Math.cos((sel.lat * Math.PI) / 180);
    return { rect: r, bounds: { w: sel.lng - dl, e: sel.lng + dl, s: sel.lat - d, n: sel.lat + d },
      label: `point ${sel.lat.toFixed(4)}°N ${sel.lng.toFixed(4)}°E (3×3 cells, ${3 * m.grid.res_m} m)` };
  }, [grid, m, sel, source, featured]);

  const analysis = useMemo(() => {
    if (!grid || !m || !pair || !rect) return null;
    const bi = m.observations.findIndex((o) => o.date === pair.before);
    const ai = m.observations.findIndex((o) => o.date === pair.after);
    const fp = fingerprint(grid, rect, bi, ai);
    return { fp, ...interpret(fp, m.screening), series: timeSeries(grid, rect) };
  }, [grid, m, pair, rect]);

  return {
    inv, m, grid, pairIdx, setPairIdx, pair, channel, setChannel, mode, setMode, sel, setSel, stacks, stackId, setStackId,
    status, source, live, externalPlace, rain, help, setHelp, validation, featured, deepTab, setDeepTab, placesOpen, setPlacesOpen,
    query, href, showLive, backToCase, pickPlace, inventoryForMap, rect, bounds, label, analysis,
  };
}

export type SiteState = ReturnType<typeof useSiteState>;
const Ctx = createContext<SiteState | null>(null);

export function SiteProvider({ children }: { children: React.ReactNode }) {
  const s = useSiteState();
  return <Ctx.Provider value={s}>{children}</Ctx.Provider>;
}

export function useSite(): SiteState {
  const s = useContext(Ctx);
  if (!s) throw new Error("useSite must be used inside <SiteProvider>");
  return s;
}
