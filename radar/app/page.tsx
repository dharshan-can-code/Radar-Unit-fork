"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Check, Download, Globe2, HelpCircle, Link2, Radar, Waves } from "lucide-react";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import Findings from "@/components/Findings";
import { MapGuide, PlainVerdict } from "@/components/Plain";
import DeepDive, { DEEP_ICONS } from "@/components/DeepDive";
import Fingerprint from "@/components/Fingerprint";
import Timeline from "@/components/Timeline";
import { Methods, ScienceExplainer } from "@/components/Science";
import type { Mode, Selection } from "@/components/Explorer";
import {
  AreaStatus, Bounds, Channel, GridIndex, Inventory, Manifest, Stacks, Validation, fingerprint, interpret, loadGrid, loadInventory,
  loadExample, loadManifest, loadStacks, loadStatus, loadValidation, resultQuery, timeSeries,
} from "@/lib/data";
import ValidationPanel from "@/components/Validation";
import DataStatus from "@/components/DataStatus";
import ChangeByInterval from "@/components/ChangeByInterval";
import LiveSearch, { LiveResult } from "@/components/LiveSearch";
import LatestFeed from "@/components/LatestFeed";
import Help from "@/components/Help";
import { Place, Rainfall, loadResult, rainfall } from "@/lib/api";
import { dataBase } from "@/lib/data";
import type { InventoryArea } from "@/lib/data";
import Navbar from "@/components/Navbar";
import Story from "@/components/Story";
import Impact, { Sensitivity } from "@/components/Impact";
import WaterNow from "@/components/WaterNow";
import RadarLab from "@/components/RadarLab";
import ScatterLab from "@/components/ScatterLab";

const Explorer = dynamic(() => import("@/components/Explorer"), { ssr: false,
  loading: () => <div className="h-[62vh] animate-pulse rounded-xl border border-line bg-panel" /> });

const AREA = "tonle_sap";

export default function Home() {
  const [inv, setInv] = useState<Inventory | null>(null);
  const [m, setM] = useState<Manifest | null | undefined>(undefined);
  const [grid, setGrid] = useState<GridIndex | null>(null);
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
  const [view, setView] = useState<"app" | "story">("app");
  const [validation, setValidation] = useState<Validation | null>(null);
  const [featuredFor, setFeaturedFor] = useState<string | null>(null);

  // Shareable links: ?result=<id> reopens a saved live analysis.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("result");
    const ex = params.get("example");
    if (params.get("view") === "story") setView("story");
    if (ex) {
      const asStory = params.get("view") === "story";
      loadExample(ex).then((mm) => {
        if (!mm) return;
        const r = { manifest: mm, footprint: null, checkedUtc: null };
        if (asStory) storyResult(r); else showLive(r, true);
      }).catch(() => { /* unknown example: stay on case study */ });
    }
    if (id && /^[a-f0-9]{8,32}$/.test(id)) {
      const asStory = params.get("view") === "story";
      loadResult(`/api/results/${id}/manifest.json`).then((mm) => {
        const r = { manifest: mm, footprint: null, checkedUtc: null };
        if (asStory) storyResult(r); else showLive(r, true);
      })
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
    rainfall(lat, lon, first, last).then((r) => { if (!cancelled) setRain(r); }).catch(() => { if (!cancelled) setRain(null); });
    return () => { cancelled = true; };
  }, [m]);

  function pickPlace(p: Place) {
    setExternalPlace({ ...p, nonce: Date.now() });
    document.getElementById("live")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

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
    setGrid(null);
    setSel({ kind: "area" });
    loadManifest(AREA, stackId).then(async (mm) => {
      setM(mm);
      if (mm) {
        setPairIdx(Math.max(0, mm.pairs.length - 1));
        setGrid(new GridIndex(mm, await loadGrid(mm)));
      }
    }).catch(() => setM(null));
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

  // A live analysis result replaces the case-study data in every section.
  function showLive(r: LiveResult, noScroll = false) {
    setSource("live"); setLive(r); setSel({ kind: "area" }); setGrid(null); setM(r.manifest);
    window.history.replaceState(null, "", `?${resultQuery(r.manifest)}${view === "story" ? "&view=story" : ""}`);
    // Live results open on the newest pair; saved examples on the pair with the most change (as in Your Story).
    const changed = (p: Manifest["pairs"][number]) => {
      const c = (p as unknown as { HH_change?: { frac_increase: number | null; frac_decrease: number | null } }).HH_change;
      return (c?.frac_increase ?? 0) + (c?.frac_decrease ?? 0);
    };
    const ps = r.manifest.pairs;
    setPairIdx(r.manifest.area === "examples" && ps.length
      ? ps.reduce((best, p, i) => (changed(p) > changed(ps[best]) ? i : best), 0)
      : Math.max(0, ps.length - 1));
    loadGrid(r.manifest).then((g) => setGrid(new GridIndex(r.manifest, g))).catch(() => setGrid(null));
    if (!noScroll && view === "app") document.getElementById("findings")?.scrollIntoView({ behavior: "smooth" });
    if (view === "story") window.scrollTo({ top: 0 });
  }
  function storyResult(r: LiveResult) { showLive(r, true); window.history.replaceState(null, "", `?${resultQuery(r.manifest)}&view=story`); }
  function openMapFromStory() {
    setView("app");
    if (m && m.area !== AREA) window.history.replaceState(null, "", `?${resultQuery(m)}`);
    setTimeout(() => document.getElementById("explorer")?.scrollIntoView({ behavior: "smooth" }), 80);
  }
  const shareStoryUrl = m && m.area !== AREA && typeof window !== "undefined"
    ? `${window.location.origin}/?${resultQuery(m)}&view=story` : null;
  function backToCase() {
    setSource("case"); setLive(null); setM(undefined); setGrid(null); setCaseReload((n) => n + 1);
    window.history.replaceState(null, "", window.location.pathname);
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

  return (
    <main className="mx-auto max-w-[1400px] px-4 pb-24 sm:px-6">
      <Navbar view={view} setView={(v) => {
        setView(v);
        if (m && m.area !== AREA) window.history.replaceState(null, "", `?${resultQuery(m)}${v === "story" ? "&view=story" : ""}`);
        else window.history.replaceState(null, "", v === "story" ? "?view=story" : window.location.pathname);
      }} />
      {view === "story" ? (
        <Story m={m ?? null} grid={grid} rain={rain} onResult={storyResult} onOpenMap={openMapFromStory} shareUrl={shareStoryUrl} />
      ) : (<>
      {m?.is_demonstration && (
        <div className="sticky top-0 z-50 -mx-4 flex items-center gap-2 border-b border-amber/40 bg-[#2a1d05] px-4 py-2 text-[13px] text-amber sm:-mx-6 sm:px-6">
          <AlertTriangle size={16} className="shrink-0" />
          <span><b>DEMONSTRATION DATA.</b> Map layers and fingerprint numbers are synthetic test values, not NISAR measurements. The observation timeline uses real ASF acquisition metadata. Run the pipeline on downloaded GCOV files to replace them.</span>
        </div>
      )}

      <Hero onStory={() => { setView("story"); window.history.replaceState(null, "", "?view=story"); window.scrollTo({ top: 0 }); }}
        onExplore={() => document.getElementById("findings")?.scrollIntoView({ behavior: "smooth" })} />
      {help && <Help onClose={() => setHelp(false)} />}

      <Section id="how" kicker="How it works" title="From a radar echo to an answer you can trust"
        lead="Three steps, and four labels that tell you how certain each sentence is.">
        <HowItWorks />
      </Section>

      <Section id="findings" kicker={source === "case" ? "What we found" : m?.area === "examples" ? "Example place" : "Your place"}
        title={m ? `What NISAR saw at ${m.name.replace(/\s*\(.*\)$/, "")}` : "What NISAR saw"}
        lead={source === "case"
          ? "Tonle Sap is Southeast Asia's largest lake. Every monsoon it floods the forest around it, and that flood feeds one of the world's biggest inland fisheries. Here is what 10 radar passes from June to October 2026 show."
          : "The headline results for this place, computed from the same real NISAR passes shown on the map below."}
        aside={source === "live" ? <button onClick={backToCase} className="flex items-center gap-1 text-[13px] text-cyan hover:text-text"><ArrowLeft size={14} />Back to Tonle Sap</button> : null}>
        <Findings m={m ?? null} grid={grid} rain={rain} validation={validation} />
      </Section>

      <Section id="explorer" kicker="The map" title="See it for yourself"
        lead="Real radar images from each satellite pass. Choose a view, then click or draw on the map to examine any area.">
        {m === undefined && <div className="skeleton h-[62vh]" />}
        {m === null && <NoData />}
        {m && (
          <>
            <MapGuide mode={mode} setMode={setMode} />
            <SourceBar m={m} source={source} live={live} onBack={backToCase} pairId={pair?.id ?? null} channel={channel} />
            <div className="mb-1 text-[12px] text-muted">Compare two passes (dates in red are 24 days apart because of a gap in NISAR&apos;s schedule):</div>
            <PairPicker m={m} pairIdx={pairIdx} setPairIdx={setPairIdx} />
            <Explorer manifest={m} inventory={inventoryForMap} pairIdx={pairIdx} channel={channel} mode={mode}
              setChannel={setChannel} setMode={setMode} selection={sel} onSelect={setSel} selectionBounds={bounds}
              onPickLocation={(lat, lon) => pickPlace({ name: `${lat.toFixed(4)}°, ${lon.toFixed(4)}° (picked on map)`, lat, lon, type: "map" })} />
          </>
        )}
      </Section>

      <Section id="fingerprint" kicker="What changed here" title="The radar's evidence for the area you picked"
        lead={featured && sel.kind === "box" && sel.bounds === featured.bounds
          ? "We start you on a 10 × 10 km patch of flooded forest north-west of the lake, where the change is clearest. Pick any other area on the map to compare."
          : "A plain summary first, then every number behind it, each labelled by how certain it is."}>
        {m && analysis && pair ? (
          <>
            <PlainVerdict fp={analysis.fp} verdict={analysis.verdict} />
            <Fingerprint m={m} fp={analysis.fp} verdict={analysis.verdict} statements={analysis.statements}
              series={analysis.series} regionLabel={label} selectedDates={[pair.before, pair.after]} rain={rain} />
          </>
        ) : m && !rect ? <p className="text-muted">The selected spot is outside the radar image. Pick a spot inside it.</p> : <div className="skeleton h-72" />}
      </Section>

      <Section id="checks" kicker="Is it real?" title="We tested the radar against data it never saw"
        lead={source === "case"
          ? "A clever map is worthless if it is wrong. So we compared our results with decades of Landsat water maps, river-flow models and weather records, and moved our thresholds to see if the story changes."
          : "Independent checks are available for the Tonle Sap case study. For this place, the sensitivity test below shows whether the result depends on our threshold."}>
        {source === "case" && validation && m?.stack === validation.stack && <div className="mb-4"><ValidationPanel v={validation} /></div>}
        <Sensitivity m={m ?? null} grid={grid} />
      </Section>

      <Section id="places" kicker="Other places" title="It works anywhere NISAR looks"
        lead="Open a ready-made example from three continents, search any place on Earth, or pick one of the newest radar images from the globe.">
        <div id="live" className="scroll-mt-16"><LiveSearch onResult={showLive} active={source === "live"} externalPlace={externalPlace} /></div>
        <div id="globe" className="mt-4 scroll-mt-16"><LatestFeed onPick={pickPlace} /></div>
      </Section>

      <Section id="impact" kicker="Who it helps" title="Why hidden water matters"
        lead="Seasonal floods feed fisheries, farms and drinking water. Knowing where the water really is helps the people who depend on it.">
        <Impact />
      </Section>

      <Section id="deeper" kicker="Go deeper" title="Tools for the curious"
        lead="Live conditions, interactive labs, the full observation record, the physics and the methods. Open whichever interests you.">
        <DeepDive tabs={[
          { id: "now", label: "Water now", icon: DEEP_ICONS.now, blurb: "Live weather, river flow with a 30-day forecast, and NASA's camera view from the same day as each radar pass.",
            render: () => <WaterNow m={m ?? null} rain={rain} /> },
          { id: "scatter", label: "Scatter Lab", icon: DEEP_ICONS.scatter, blurb: "Every radar pixel plotted by its two channels. Drag the thresholds and watch the water map change.",
            render: () => <ScatterLab m={m ?? null} grid={grid} /> },
          { id: "lab", label: "Radar Lab", icon: DEEP_ICONS.lab, blurb: "A teaching model: add water, trees and wind, switch wavelength, and see why NISAR's L-band finds flooding under forest.",
            render: () => <RadarLab screening={m?.screening ?? null} /> },
          { id: "timeline", label: "Every pass", icon: DEEP_ICONS.timeline, blurb: "Every NISAR acquisition over the study areas, and how much changed between each pair of passes.",
            render: () => (<>
              {source === "case" && (inv ? <Timeline inventory={inv} manifest={m ?? null} pairIdx={pairIdx} setPairIdx={setPairIdx} /> : <p className="text-muted">Inventory not found — run scripts/refresh.py.</p>)}
              {m && m.pairs.length > 0 && <ChangeByInterval m={m} pairIdx={pairIdx} setPairIdx={setPairIdx} />}
            </>) },
          { id: "science", label: "The physics", icon: DEEP_ICONS.science, blurb: "How L-band radar sees wetlands, in plain language.",
            render: () => <ScienceExplainer /> },
          { id: "methods", label: "Methods & data", icon: DEEP_ICONS.methods, blurb: "The processing chain, thresholds, data status and limitations: everything needed to reproduce or challenge the analysis.",
            render: () => (<>
              {source === "case" && status && <div className="mb-4"><DataStatus status={status} stacks={stacks} stackId={stackId} setStackId={setStackId} manifest={m ?? null} /></div>}
              <Methods m={m ?? null} />
            </>) },
        ]} />
      </Section>

      </>)}
      <footer className="mt-20 border-t border-line py-8 text-[12px] leading-relaxed text-muted">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="font-semibold tracking-wide text-text">DELTA PULSE · Team RADAR UNIT · NASA Space Apps 2026</span>
          <button onClick={() => setHelp(true)} className="flex items-center gap-1.5 text-cyan hover:text-text"><HelpCircle size={14} />How to use</button>
        </div>
        <p className="mt-2">Data: NASA-ISRO NISAR L2 GCOV via NASA ASF DAAC; JRC Global Surface Water; ERA5 and GloFAS via Open-Meteo; NASA GIBS. Basemaps: Esri (© Esri and data providers, © OpenStreetMap contributors).
          An open-source student project; not an official NASA product.</p>
      </footer>
    </main>
  );
}

function Section({ id, kicker, title, lead, aside, children }: { id: string; kicker: string; title: string; lead: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-20 scroll-mt-16 first-of-type:mt-12">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-3xl">
          <div className="text-[12px] font-medium tracking-[0.18em] text-cyan uppercase">{kicker}</div>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
          <p className="mt-3 text-[16px] leading-relaxed text-text/75">{lead}</p>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

function SourceBar({ m, source, live, onBack, pairId, channel }: { m: Manifest; source: "case" | "live"; live: LiveResult | null;
  onBack: () => void; pairId: string | null; channel: Channel }) {
  const o = m.observations;
  const pr = m.processing;
  const [copied, setCopied] = useState(false);
  const copyLink = () => {
    navigator.clipboard?.writeText(window.location.href).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };
  return (
    <div className={`mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border px-3 py-2 text-[12px] ${source === "live" ? "border-cyan/40 bg-cyan/5" : "border-line bg-panel"}`}>
      <span className="flex items-center gap-1.5 font-semibold text-text">
        {source === "live" ? <Globe2 size={14} className="text-cyan" /> : <Radar size={14} className="text-cyan" />}
        {source === "live" ? `${m.area === "examples" ? "Example" : "Live"}: ${m.name}` : `Case study: ${m.name}`}
      </span>
      <span className="text-muted">
        {o.length} NISAR acquisitions {o[0]?.date} → {o[o.length - 1]?.date} · track {o[0]?.track}{o[0]?.direction?.[0]} · {o[0]?.maturity} {o[0]?.crid} · {m.display.res_m} m cells
      </span>
      {source === "live" && live && (
        <span className="text-muted">
          {live.checkedUtc ? `archive checked ${live.checkedUtc.slice(0, 16).replace("T", " ")} UTC · ` : `computed ${m.generated_utc.slice(0, 16).replace("T", " ")} UTC · `}
          read {pr.bytes_fetched ? `${Math.round(pr.bytes_fetched / 1e6)} MB` : ""} in {pr.elapsed_s ?? "?"} s
        </span>
      )}
      <span className="ml-auto flex flex-wrap items-center gap-3">
        {pairId && (
          <a href={`${dataBase(m)}/img/d_${pairId}_${channel}.png`} download className="flex items-center gap-1 text-cyan hover:text-text" title="Download the change map image">
            <Download size={13} />Change map
          </a>
        )}
        <a href={`${dataBase(m)}/manifest.json`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-cyan hover:text-text" title="All numbers and provenance as JSON">
          <Download size={13} />Data (JSON)
        </a>
        {source === "live" && (
          <button onClick={copyLink} className="flex items-center gap-1 text-cyan hover:text-text" title="Copy a link that reopens this result">
            {copied ? <Check size={13} /> : <Link2 size={13} />}{copied ? "Copied" : "Share link"}
          </button>
        )}
        {source === "live" && (
          <button onClick={onBack} className="flex items-center gap-1 text-cyan hover:text-text"><ArrowLeft size={13} />Tonle Sap case study</button>
        )}
      </span>
    </div>
  );
}

function PairPicker({ m, pairIdx, setPairIdx }: { m: Manifest; pairIdx: number; setPairIdx: (i: number) => void }) {
  return (
    <div className="mb-3 flex items-center gap-1 overflow-x-auto pb-1">
      <Waves size={14} className="mr-1 shrink-0 text-muted" />
      {m.pairs.map((p, i) => (
        <button key={p.id} onClick={() => setPairIdx(i)}
          className={`shrink-0 rounded-md border px-2.5 py-1 font-mono text-[11px] ${i === pairIdx ? "border-cyan bg-cyan/15 text-cyan" : "border-line bg-panel text-muted hover:text-text"}`}>
          {p.before.slice(5)} → {p.after.slice(5)}{p.delta_days !== 12 && <span className="ml-1 text-rose">{p.delta_days}d</span>}
        </button>
      ))}
    </div>
  );
}

function NoData() {
  return (
    <div className="rounded-xl border border-line bg-panel p-8 text-sm text-muted">
      <div className="text-text">No processed radar data yet.</div>
      <p className="mt-2">Run <code className="text-cyan">scripts/refresh.py</code> with an Earthdata token to retrieve and process NISAR GCOV acquisitions. See README.md.</p>
    </div>
  );
}
