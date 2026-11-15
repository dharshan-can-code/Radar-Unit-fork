"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, ChevronDown, Download, Globe2, Link2, MapPin, Radar, Search, Waves } from "lucide-react";
import { MapGuide, PlainVerdict, plainAnswer } from "@/components/Plain";
import Findings from "@/components/Findings";
import Fingerprint from "@/components/Fingerprint";
import ValidationPanel from "@/components/Validation";
import LiveSearch, { LiveResult } from "@/components/LiveSearch";
import { Sensitivity } from "@/components/Impact";
import { Channel, Manifest, dataBase } from "@/lib/data";
import { PageHeader, Section } from "@/components/site/Section";
import { type SiteState, useSite } from "@/components/site/SiteState";
import { PLACE_SECTIONS } from "@/components/site/nav";

const Explorer = dynamic(() => import("@/components/Explorer"), { ssr: false,
  loading: () => <div className="skeleton h-[70svh] min-h-[420px] rounded-none" /> });

// The globe pulls in MapLibre too; load it with the map, not with the first screen.
const LatestFeed = dynamic(() => import("@/components/LatestFeed"), { ssr: false,
  loading: () => <div className="skeleton h-[26rem]" /> });

const shortDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const placeName = (m: Manifest) => m.name.replace(/\s*\(.*\)$/, "");

/** Explore a place, top to bottom in the order a visitor needs it: choose the place, read the short
 *  answer, see it on the map, check the evidence for an area, and see how far to trust it. */
export default function ExplorePage() {
  const s = useSite();
  const { m, pair, sel, featured, analysis, source, validation, setPlacesOpen } = s;

  // A link to the chooser (/explore#places, or the older #live and #globe) opens it.
  useEffect(() => {
    if (!PLACE_SECTIONS.includes(window.location.hash.slice(1))) return;
    setPlacesOpen(true);
    const t = setTimeout(() => document.getElementById("places")?.scrollIntoView({ block: "start" }), 150);
    return () => clearTimeout(t);
  }, [setPlacesOpen]);

  return (
    <>
      <PageHeader title="Explore a place"
        lead="Pick any place on Earth and see what NASA's radar found there: a short answer first, then the map, then the evidence behind it." />

      <PlaceChooser s={s} />

      <Section id="answer" first title={m ? `What the radar saw at ${placeName(m)}` : "What the radar saw"}
        lead={source === "case"
          ? "Tonle Sap is Southeast Asia's largest lake. Every monsoon it floods the forest around it. These three results sum up the season."
          : "Three results that sum up this place, worked out from the same radar passes shown on the map below."}>
        <Findings m={m ?? null} grid={s.grid} rain={s.rain} validation={validation} linkTo={(id) => s.href("/explore", id)} />
      </Section>

      <Section id="explorer" title="See it on the map"
        lead="These are the real radar images, one per satellite pass. Choose a view, then click a spot or draw a box to ask about that area.">
        {m === undefined && <div className="skeleton h-[70svh] min-h-[420px]" />}
        {m === null && <NoData />}
        {m && (
          <div className="overflow-hidden rounded-lg border border-line bg-panel">
            <SourceBar m={m} source={source} live={s.live} pairId={pair?.id ?? null} channel={s.channel} />
            <PairPicker m={m} pairIdx={s.pairIdx} setPairIdx={s.setPairIdx} />
            <Explorer manifest={m} inventory={s.inventoryForMap} pairIdx={s.pairIdx} channel={s.channel} mode={s.mode}
              setChannel={s.setChannel} setMode={s.setMode} selection={sel} onSelect={s.setSel} selectionBounds={s.bounds}
              onPickLocation={(lat, lon) => s.pickPlace({ name: `${lat.toFixed(4)}°, ${lon.toFixed(4)}° (picked on map)`, lat, lon, type: "map" })} />
            <MapGuide mode={s.mode} picked={sel.kind} answer={analysis && pair ? plainAnswer(analysis.fp, analysis.verdict) : null} />
          </div>
        )}
      </Section>

      <Section id="fingerprint" title="The evidence for the area you picked"
        lead={featured && sel.kind === "box" && sel.bounds === featured.bounds
          ? "We start you on a 10 × 10 km patch of flooded forest north-west of the lake, where the change is clearest. Pick any other area on the map to compare."
          : "The answer in plain words first, then every number behind it with its exact radar term, each labelled by how certain it is."}>
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

    </>
  );
}

/** The place on screen, and the way to change it. The chooser (saved examples, search, the newest
 *  acquisitions) unfolds here, above the results it changes, and folds away once a place is open. */
function PlaceChooser({ s }: { s: SiteState }) {
  const { m, source, placesOpen: open, setPlacesOpen } = s;
  const o = m?.observations ?? [];
  const kind = source === "case" ? "Our case study" : m?.area === "examples" ? "Saved example" : "Your place";
  return (
    <section id="places" aria-label="Choose a place" className="mt-8 scroll-mt-16">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4 rounded-lg border border-line bg-panel px-4 py-4 sm:px-6 sm:py-5">
        <div className="min-w-0 flex-1 basis-64">
          {m === undefined ? <div className="skeleton h-12 max-w-md" /> : (
            <>
              <h2 className="flex items-start gap-2.5 text-[1.35rem] leading-tight font-medium sm:text-[1.6rem]">
                <MapPin size={20} className="mt-1 shrink-0 text-accent" />{m ? placeName(m) : "No place is loaded yet"}
              </h2>
              <p className="mt-1.5 pl-[1.9rem] text-[14px] text-muted">
                {m && o.length
                  ? <>{kind}. {o.length} radar passes, {shortDate(o[0].date)} to {shortDate(o[o.length - 1].date)} {o[o.length - 1].date.slice(0, 4)}.</>
                  : "Choose a place to see what the radar found there."}
              </p>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {source === "live" && (
            <button onClick={s.backToCase} className="flex items-center gap-1.5 text-[14px] text-accent hover:text-accent-strong">
              <ArrowLeft size={15} />Back to Tonle Sap
            </button>
          )}
          <button onClick={() => setPlacesOpen(!open)} aria-expanded={open} aria-controls="place-chooser"
            className={`flex items-center gap-2 rounded-md px-4 py-2.5 text-[14px] font-semibold ${open ? "border border-line-strong text-text hover:border-accent/60" : "bg-accent text-on-accent hover:bg-accent-strong"}`}>
            <Search size={15} />{open ? "Close" : "Choose another place"}
            <ChevronDown size={15} className={`transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>
      {/* The search keeps its state while folded away; the globe is only built when it can be seen. */}
      <div id="place-chooser" hidden={!open} className="mt-3 space-y-3">
        <div id="live" className="scroll-mt-16"><LiveSearch onResult={s.showLive} active={source === "live"} externalPlace={s.externalPlace} /></div>
        {open && <div id="globe" className="scroll-mt-16"><LatestFeed onPick={s.pickPlace} /></div>}
      </div>
    </section>
  );
}

function SourceBar({ m, source, live, pairId, channel }: { m: Manifest; source: "case" | "live"; live: LiveResult | null;
  pairId: string | null; channel: Channel }) {
  const o = m.observations;
  const pr = m.processing;
  const [copied, setCopied] = useState(false);
  const copyLink = () => {
    navigator.clipboard?.writeText(window.location.href).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };
  const act = "flex items-center gap-1.5 text-accent hover:text-accent-strong";
  return (
    <div className={`flex flex-wrap items-center gap-x-5 gap-y-1.5 border-b border-line px-3 py-2.5 text-[12px] sm:px-4 ${source === "live" ? "bg-accent/5" : ""}`}>
      <span className="flex items-center gap-1.5 text-[13px] font-semibold text-text">
        {source === "live" ? <Globe2 size={14} className="text-accent" /> : <Radar size={14} className="text-accent" />}
        {source === "live" ? `${m.area === "examples" ? "Example" : "Live"}: ${m.name}` : `Case study: ${m.name}`}
      </span>
      <span className="font-mono text-[12px] text-muted" title="The satellite's orbit track, how far NASA has validated this data release, and the size of one map cell">
        NISAR L2 GCOV · {o[0]?.date} → {o[o.length - 1]?.date} · track {o[0]?.track}{o[0]?.direction?.[0]} · {o[0]?.maturity?.toLowerCase()} release {o[0]?.crid} · {m.display.res_m} m cells
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
      </span>
    </div>
  );
}

function PairPicker({ m, pairIdx, setPairIdx }: { m: Manifest; pairIdx: number; setPairIdx: (i: number) => void }) {
  const irregular = m.pairs.some((p) => p.delta_days !== 12);
  return (
    <div className="flex items-center gap-3 border-b border-line px-3 py-2 sm:px-4">
      <span className="flex shrink-0 items-center gap-1.5 text-[13px] text-text"><Waves size={14} className="text-accent" />Compare two passes</span>
      <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {m.pairs.map((p, i) => (
          <button key={p.id} onClick={() => setPairIdx(i)} aria-pressed={i === pairIdx}
            title={`${p.before} → ${p.after} · ${p.delta_days} days apart`}
            className={`shrink-0 rounded-md border px-2 py-1 font-mono text-[11px] ${i === pairIdx ? "border-accent bg-accent/15 text-accent" : "border-line bg-bg-2 text-muted hover:border-line-strong hover:text-text"}`}>
            {shortDate(p.before)} → {shortDate(p.after)}{p.delta_days !== 12 && <span className="ml-1 text-rose">{p.delta_days}d</span>}
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
      <p className="mt-2">Run <code className="text-accent">scripts/refresh.py</code> with an Earthdata token to retrieve and process NISAR GCOV acquisitions. See README.md.</p>
    </div>
  );
}
