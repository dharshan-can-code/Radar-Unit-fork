"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Globe2, Radar, Waves } from "lucide-react";
import Fingerprint, { Tag } from "@/components/Fingerprint";
import Timeline from "@/components/Timeline";
import { Methods, ScienceExplainer } from "@/components/Science";
import type { Mode, Selection } from "@/components/Explorer";
import {
  AreaStatus, Bounds, Channel, GridIndex, Inventory, Manifest, Stacks, fingerprint, interpret, loadGrid, loadInventory,
  loadManifest, loadStacks, loadStatus, timeSeries,
} from "@/lib/data";
import DataStatus from "@/components/DataStatus";
import ChangeByInterval from "@/components/ChangeByInterval";
import LiveSearch, { LiveResult } from "@/components/LiveSearch";
import type { InventoryArea } from "@/lib/data";

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

  useEffect(() => {
    loadInventory().then(setInv).catch(() => setInv(null));
    loadStatus().then((s) => setStatus(s?.[AREA] ?? null)).catch(() => setStatus(null));
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

  // A live analysis result replaces the case-study data in every section.
  function showLive(r: LiveResult) {
    setSource("live"); setLive(r); setSel({ kind: "area" }); setGrid(null); setM(r.manifest);
    setPairIdx(Math.max(0, r.manifest.pairs.length - 1));
    loadGrid(r.manifest).then((g) => setGrid(new GridIndex(r.manifest, g))).catch(() => setGrid(null));
    document.getElementById("explorer")?.scrollIntoView({ behavior: "smooth" });
  }
  function backToCase() { setSource("case"); setLive(null); setM(undefined); setGrid(null); setCaseReload((n) => n + 1); }
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
    if (sel.kind === "box") return { rect: grid.rectOf(sel.bounds), bounds: sel.bounds,
      label: `box ${sel.bounds.w.toFixed(3)}…${sel.bounds.e.toFixed(3)}°E, ${sel.bounds.s.toFixed(3)}…${sel.bounds.n.toFixed(3)}°N` };
    const cell = grid.cellOf(sel.lng, sel.lat);
    if (!cell) return { rect: null, bounds: null, label: "outside processed area" };
    const r = { r0: Math.max(0, cell[0] - 1), r1: Math.min(grid.ny - 1, cell[0] + 1), c0: Math.max(0, cell[1] - 1), c1: Math.min(grid.nx - 1, cell[1] + 1) };
    const d = (1.5 * m.grid.res_m) / 111320;
    const dl = d / Math.cos((sel.lat * Math.PI) / 180);
    return { rect: r, bounds: { w: sel.lng - dl, e: sel.lng + dl, s: sel.lat - d, n: sel.lat + d },
      label: `point ${sel.lat.toFixed(4)}°N ${sel.lng.toFixed(4)}°E (3×3 cells, ${3 * m.grid.res_m} m)` };
  }, [grid, m, sel, source]);

  const analysis = useMemo(() => {
    if (!grid || !m || !pair || !rect) return null;
    const bi = m.observations.findIndex((o) => o.date === pair.before);
    const ai = m.observations.findIndex((o) => o.date === pair.after);
    const fp = fingerprint(grid, rect, bi, ai);
    return { fp, ...interpret(fp, m.screening), series: timeSeries(grid, rect) };
  }, [grid, m, pair, rect]);

  return (
    <main className="mx-auto max-w-[1400px] px-4 pb-24 sm:px-6">
      {m?.is_demonstration && (
        <div className="sticky top-0 z-50 -mx-4 flex items-center gap-2 border-b border-amber/40 bg-[#2a1d05] px-4 py-2 text-[13px] text-amber sm:-mx-6 sm:px-6">
          <AlertTriangle size={16} className="shrink-0" />
          <span><b>DEMONSTRATION DATA.</b> Map layers and fingerprint numbers are synthetic test values, not NISAR measurements. The observation timeline uses real ASF acquisition metadata. Run the pipeline on downloaded GCOV files to replace them.</span>
        </div>
      )}

      {/* hero */}
      <header className="pt-10 pb-8">
        <div className="flex items-center gap-2 font-mono text-xs tracking-widest text-cyan"><Radar size={14} />RADAR UNIT · NASA SPACE APPS 2026 · NISAR L-BAND</div>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">DELTA PULSE <span className="text-muted">— Hidden Water</span></h1>
        <p className="mt-3 max-w-3xl text-lg text-text/80">Revealing the water we cannot easily see. NISAR&apos;s radar sees wetlands through cloud, every 12 days. Start with our Tonle Sap case study, or search any place on Earth for live NISAR data. We show what changed, what it might mean, and how sure we can be.</p>
        <div className="mt-5 flex flex-wrap gap-2 text-[12px]">
          {(["OBSERVED", "CALCULATED", "INTERPRETED", "UNCONFIRMED"] as const).map((k) => (
            <span key={k} className="flex items-center gap-1.5"><Tag kind={k} /><span className="text-muted">{{
              OBSERVED: "measured by NISAR", CALCULATED: "math on measurements", INTERPRETED: "possible explanation", UNCONFIRMED: "needs more evidence",
            }[k]}</span></span>
          ))}
        </div>
        {source === "case" && status && <DataStatus status={status} stacks={stacks} stackId={stackId} setStackId={setStackId} manifest={m ?? null} />}
        <div className="mt-4"><LiveSearch onResult={showLive} active={source === "live"} /></div>
      </header>

      {/* explorer */}
      <Section id="explorer" kicker="01" title="Hidden Water Explorer"
        sub="Swipe between two NISAR observations, switch to the measured change, or view candidate signatures. Click the map or draw a region to inspect it.">
        {m === undefined && <div className="h-[62vh] animate-pulse rounded-xl border border-line bg-panel" />}
        {m === null && <NoData />}
        {m && (
          <>
            <SourceBar m={m} source={source} live={live} onBack={backToCase} />
            <PairPicker m={m} pairIdx={pairIdx} setPairIdx={setPairIdx} />
            <Explorer manifest={m} inventory={inventoryForMap} pairIdx={pairIdx} channel={channel} mode={mode}
              setChannel={setChannel} setMode={setMode} selection={sel} onSelect={setSel} selectionBounds={bounds} />
          </>
        )}
      </Section>

      {/* fingerprint */}
      <Section id="fingerprint" kicker="02" title="Radar Change Fingerprint"
        sub="What the satellite measured in your region, what changed between the two dates, what could explain it, and what remains uncertain.">
        {m && analysis && pair ? (
          <Fingerprint m={m} fp={analysis.fp} verdict={analysis.verdict} statements={analysis.statements}
            series={analysis.series} regionLabel={label} selectedDates={[pair.before, pair.after]} />
        ) : m && !rect ? <p className="text-muted">Selected location is outside the processed area.</p> : <p className="text-muted">Loading…</p>}
      </Section>

      {/* timeline */}
      <Section id="timeline" kicker="03" title="Observation Timeline"
        sub="Every NISAR GCOV acquisition over the study areas, as listed in the ASF archive. Compare the two candidate sites.">
        {source === "case" && (inv ? <Timeline inventory={inv} manifest={m ?? null} pairIdx={pairIdx} setPairIdx={setPairIdx} /> : <p className="text-muted">Inventory not found — run scripts/refresh.py.</p>)}
        {m && m.pairs.length > 0 && <ChangeByInterval m={m} pairIdx={pairIdx} setPairIdx={setPairIdx} />}
      </Section>

      <Section id="science" kicker="04" title="How radar sees wetlands" sub="The physics behind every number above.">
        <ScienceExplainer />
      </Section>

      <Section id="methods" kicker="05" title="Methods, data and limitations" sub="Everything needed to reproduce or challenge the analysis.">
        <Methods m={m ?? null} />
      </Section>

      <footer className="mt-16 border-t border-line pt-6 text-[12px] text-muted">
        Data: NASA-ISRO NISAR L2 GCOV via NASA ASF DAAC. Basemaps: Esri World Dark Gray Base and World Imagery (© Esri and data providers, © OpenStreetMap contributors).
        DELTA PULSE is an open-source student project by RADAR UNIT and is not an official NASA product.
      </footer>
    </main>
  );
}

function Section({ id, kicker, title, sub, children }: { id: string; kicker: string; title: string; sub: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-12 scroll-mt-14">
      <div className="mb-4 flex items-baseline gap-3">
        <span className="font-mono text-xs text-cyan">{kicker}</span>
        <div><h2 className="text-2xl font-semibold tracking-tight">{title}</h2><p className="mt-1 max-w-3xl text-sm text-muted">{sub}</p></div>
      </div>
      {children}
    </section>
  );
}

function SourceBar({ m, source, live, onBack }: { m: Manifest; source: "case" | "live"; live: LiveResult | null; onBack: () => void }) {
  const o = m.observations;
  const pr = m.processing;
  return (
    <div className={`mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border px-3 py-2 text-[12px] ${source === "live" ? "border-cyan/40 bg-cyan/5" : "border-line bg-panel"}`}>
      <span className="flex items-center gap-1.5 font-semibold text-text">
        {source === "live" ? <Globe2 size={14} className="text-cyan" /> : <Radar size={14} className="text-cyan" />}
        {source === "live" ? `Live: ${m.name}` : `Case study: ${m.name}`}
      </span>
      <span className="text-muted">
        {o.length} NISAR acquisitions {o[0]?.date} → {o[o.length - 1]?.date} · track {o[0]?.track}{o[0]?.direction?.[0]} · {o[0]?.maturity} {o[0]?.crid} · {m.display.res_m} m cells
      </span>
      {source === "live" && live && (
        <span className="text-muted">
          archive checked {live.checkedUtc.slice(0, 16).replace("T", " ")} UTC · read {pr.bytes_fetched ? `${Math.round(pr.bytes_fetched / 1e6)} MB` : ""} in {pr.elapsed_s ?? "?"} s
        </span>
      )}
      {source === "live" && (
        <button onClick={onBack} className="ml-auto flex items-center gap-1 text-cyan hover:text-text"><ArrowLeft size={13} />Tonle Sap case study</button>
      )}
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
