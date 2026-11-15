"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import { ArrowLeft, Check, Download, Globe2, Link2, Radar, Waves } from "lucide-react";
import { MapGuide, PlainVerdict } from "@/components/Plain";
import Fingerprint from "@/components/Fingerprint";
import ValidationPanel from "@/components/Validation";
import LiveSearch, { LiveResult } from "@/components/LiveSearch";
import { Sensitivity } from "@/components/Impact";
import { Channel, Manifest, dataBase } from "@/lib/data";
import { PageHeader, Section } from "@/components/site/Section";
import { useSite } from "@/components/site/SiteState";

const Explorer = dynamic(() => import("@/components/Explorer"), { ssr: false,
  loading: () => <div className="skeleton h-[70svh] min-h-[420px] rounded-none" /> });

// The globe pulls in MapLibre too; load it with the map, not with the first screen.
const LatestFeed = dynamic(() => import("@/components/LatestFeed"), { ssr: false,
  loading: () => <div className="skeleton h-[26rem]" /> });

/** Explore the data: the map, the evidence for the area picked on it, the checks, and other places. */
export default function ExplorePage() {
  const s = useSite();
  const { m, pair, sel, featured, analysis, source, validation } = s;
  return (
    <>
      <PageHeader title="Explore the data"
        lead="Real NISAR radar images, the evidence for any area you pick on them, the independent checks behind the results, and the same analysis for any other place on Earth." />

      <Section id="explorer" first title="See it for yourself"
        lead="Real radar images from each satellite pass. Choose a view, then click or draw on the map to examine any area.">
        {m === undefined && <div className="skeleton h-[70svh] min-h-[420px]" />}
        {m === null && <NoData />}
        {m && (
          <div className="overflow-hidden rounded-lg border border-line bg-panel">
            <SourceBar m={m} source={source} live={s.live} onBack={s.backToCase} pairId={pair?.id ?? null} channel={s.channel} />
            <PairPicker m={m} pairIdx={s.pairIdx} setPairIdx={s.setPairIdx} />
            <Explorer manifest={m} inventory={s.inventoryForMap} pairIdx={s.pairIdx} channel={s.channel} mode={s.mode}
              setChannel={s.setChannel} setMode={s.setMode} selection={sel} onSelect={s.setSel} selectionBounds={s.bounds}
              onPickLocation={(lat, lon) => s.pickPlace({ name: `${lat.toFixed(4)}°, ${lon.toFixed(4)}° (picked on map)`, lat, lon, type: "map" })} />
            <MapGuide mode={s.mode} />
          </div>
        )}
      </Section>

      <Section id="fingerprint" title="The radar's evidence for the area you picked"
        lead={featured && sel.kind === "box" && sel.bounds === featured.bounds
          ? "We start you on a 10 × 10 km patch of flooded forest north-west of the lake, where the change is clearest. Pick any other area on the map to compare."
          : "A plain summary first, then every number behind it, each labelled by how certain it is."}>
        {m && analysis && pair ? (
          <>
            <PlainVerdict fp={analysis.fp} verdict={analysis.verdict} />
            <Fingerprint m={m} fp={analysis.fp} verdict={analysis.verdict} statements={analysis.statements}
              series={analysis.series} regionLabel={s.label} selectedDates={[pair.before, pair.after]} rain={s.rain} />
          </>
        ) : m && !s.rect ? <p className="text-muted">The selected spot is outside the radar image. Pick a spot inside it.</p> : <div className="skeleton h-72" />}
      </Section>

      <Section id="checks" title="We tested the radar against data it never saw"
        lead={source === "case"
          ? "A clever map is worthless if it is wrong. So we compared our results with decades of Landsat water maps, river-flow models and weather records, and moved our thresholds to see if the story changes."
          : "Independent checks are available for the Tonle Sap case study. For this place, the sensitivity test below shows whether the result depends on our threshold."}>
        {source === "case" && validation && m?.stack === validation.stack && <div className="mb-4"><ValidationPanel v={validation} /></div>}
        <Sensitivity m={m ?? null} grid={s.grid} />
      </Section>

      <Section id="places" title="It works anywhere NISAR looks"
        lead="Open a ready-made example from three continents, search any place on Earth, or pick one of the newest radar images from the globe.">
        <div id="live" className="scroll-mt-16"><LiveSearch onResult={s.showLive} active={source === "live"} externalPlace={s.externalPlace} /></div>
        <div id="globe" className="mt-4 scroll-mt-16"><LatestFeed onPick={s.pickPlace} /></div>
      </Section>
    </>
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
  const act = "flex items-center gap-1.5 text-cyan hover:text-text";
  return (
    <div className={`flex flex-wrap items-center gap-x-5 gap-y-1.5 border-b border-line px-3 py-2.5 text-[12px] sm:px-4 ${source === "live" ? "bg-cyan/5" : ""}`}>
      <span className="flex items-center gap-1.5 text-[13px] font-semibold text-text">
        {source === "live" ? <Globe2 size={14} className="text-cyan" /> : <Radar size={14} className="text-cyan" />}
        {source === "live" ? `${m.area === "examples" ? "Example" : "Live"}: ${m.name}` : `Case study: ${m.name}`}
      </span>
      <span className="font-mono text-[12px] text-muted">
        {o.length} NISAR acquisitions {o[0]?.date} → {o[o.length - 1]?.date} · track {o[0]?.track}{o[0]?.direction?.[0]} · {o[0]?.maturity} {o[0]?.crid} · {m.display.res_m} m cells
      </span>
      {source === "live" && live && (
        <span className="font-mono text-[12px] text-muted">
          {live.checkedUtc ? `archive checked ${live.checkedUtc.slice(0, 16).replace("T", " ")} UTC · ` : `computed ${m.generated_utc.slice(0, 16).replace("T", " ")} UTC · `}
          read {pr.bytes_fetched ? `${Math.round(pr.bytes_fetched / 1e6)} MB` : ""} in {pr.elapsed_s ?? "?"} s
        </span>
      )}
      <span className="flex flex-wrap items-center gap-x-4 gap-y-1 sm:ml-auto">
        {pairId && (
          <a href={`${dataBase(m)}/img/d_${pairId}_${channel}.png`} download className={act} title="Download the change map image">
            <Download size={13} />Change map
          </a>
        )}
        <a href={`${dataBase(m)}/manifest.json`} target="_blank" rel="noreferrer" className={act} title="All numbers and provenance as JSON">
          <Download size={13} />Data (JSON)
        </a>
        {source === "live" && (
          <button onClick={copyLink} className={act} title="Copy a link that reopens this result">
            {copied ? <Check size={13} /> : <Link2 size={13} />}{copied ? "Copied" : "Share link"}
          </button>
        )}
        {source === "live" && (
          <button onClick={onBack} className={act}><ArrowLeft size={13} />Tonle Sap case study</button>
        )}
      </span>
    </div>
  );
}

function PairPicker({ m, pairIdx, setPairIdx }: { m: Manifest; pairIdx: number; setPairIdx: (i: number) => void }) {
  const irregular = m.pairs.some((p) => p.delta_days !== 12);
  return (
    <div className="flex items-center gap-3 border-b border-line px-3 py-2 sm:px-4">
      <span className="flex shrink-0 items-center gap-1.5 text-[12px] text-muted"><Waves size={14} />Compare</span>
      <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {m.pairs.map((p, i) => (
          <button key={p.id} onClick={() => setPairIdx(i)} aria-pressed={i === pairIdx}
            title={`${p.before} → ${p.after} · ${p.delta_days} days apart`}
            className={`shrink-0 rounded-md border px-2 py-1 font-mono text-[11px] ${i === pairIdx ? "border-cyan bg-cyan/15 text-cyan" : "border-line bg-bg-2 text-muted hover:border-line-strong hover:text-text"}`}>
            {p.before.slice(5)} → {p.after.slice(5)}{p.delta_days !== 12 && <span className="ml-1 text-rose">{p.delta_days}d</span>}
          </button>
        ))}
      </div>
      {irregular && <span className="hidden shrink-0 text-[12px] text-muted 2xl:inline" title="A documented gap in NISAR's acquisition schedule; nothing is interpolated across it.">red = longer than the 12-day repeat</span>}
    </div>
  );
}

function NoData() {
  return (
    <div className="rounded-lg border border-line bg-panel p-8 text-sm text-muted">
      <div className="font-medium text-text">No processed radar data yet.</div>
      <p className="mt-2">Run <code className="text-cyan">scripts/refresh.py</code> with an Earthdata token to retrieve and process NISAR GCOV acquisitions. See README.md.</p>
    </div>
  );
}
