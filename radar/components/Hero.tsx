"use client";
// First screen: what DELTA PULSE is for, in one sentence, next to real NISAR
// images of Tonle Sap in the dry season and at the flood peak.
import { useEffect, useState } from "react";
import { ArrowDown, CloudRain, Map as MapIcon, Sparkles, Trees } from "lucide-react";

const IMG = "/data/tonle_sap/t83A_f8_P05023/img";
const SCENES = [
  { date: "2026-06-19", label: "19 June", note: "Dry season" },
  { date: "2026-09-11", label: "11 September", note: "Flood peak" },
];

export default function Hero({ onStory, onExplore }: { onStory: () => void; onExplore: () => void }) {
  const [k, setK] = useState(1);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)) return;
    const t = setInterval(() => setK((x) => (x + 1) % SCENES.length), 3500);
    return () => clearInterval(t);
  }, [paused]);

  return (
    <header id="top" className="scroll-mt-14 pt-10 pb-6 sm:pt-16">
      <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <div className="text-[12px] font-medium tracking-[0.18em] text-cyan uppercase">NASA Space Apps 2026 · NISAR radar</div>
          <h1 className="mt-4 text-4xl leading-[1.08] font-semibold tracking-tight sm:text-6xl">
            See the water that <span className="text-cyan">clouds</span> and <span className="text-amber">forests</span> hide.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-text/80">
            When rivers flood into forests, the water spreads under the trees, invisible to cameras. NASA-ISRO&apos;s NISAR satellite
            uses radar that passes through cloud and leaves. <b className="text-text">DELTA PULSE turns that radar into plain answers:</b> where
            water is spreading, how much changed, and how sure we can be.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button onClick={onStory} className="flex items-center gap-2 rounded-lg bg-amber px-5 py-3 text-[15px] font-semibold text-bg hover:bg-amber/90">
              <Sparkles size={17} />Watch the Tonle Sap story
            </button>
            <button onClick={onExplore} className="flex items-center gap-2 rounded-lg border border-line bg-panel px-5 py-3 text-[15px] font-medium text-text hover:border-cyan/60">
              <MapIcon size={17} />Explore the data
            </button>
          </div>
          <div className="mt-8 grid max-w-xl grid-cols-1 gap-3 text-[13px] sm:grid-cols-3">
            <Fact icon={<CloudRain size={16} className="text-blue" />} text="Sees through cloud, rain and darkness" />
            <Fact icon={<Trees size={16} className="text-amber" />} text="Finds water under tree canopy" />
            <Fact icon={<MapIcon size={16} className="text-cyan" />} text="Any place NISAR images, every 12 days" />
          </div>
        </div>

        <figure onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
          className="relative overflow-hidden rounded-2xl border border-line bg-[#03060c] shadow-[0_30px_60px_-30px_rgba(0,0,0,0.9)]">
          <div className="relative aspect-[1092/1112] w-full">
            {SCENES.map((s, i) => (
              <div key={s.date} className="absolute inset-0 transition-opacity duration-700" style={{ opacity: i === k ? 1 : 0 }} aria-hidden={i !== k}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${IMG}/${s.date}_HH.png`} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${IMG}/${s.date}_class.png`} alt={`NISAR radar of Tonle Sap Lake on ${s.label} 2026, ${s.note.toLowerCase()}`}
                  className="absolute inset-0 h-full w-full object-cover" />
              </div>
            ))}
            <div className="absolute top-3 left-3 flex gap-1 rounded-lg bg-bg/80 p-1 backdrop-blur">
              {SCENES.map((s, i) => (
                <button key={s.date} onClick={() => { setK(i); setPaused(true); }} aria-pressed={i === k}
                  className={`rounded-md px-3 py-1.5 text-[12px] font-medium ${i === k ? "bg-text text-bg" : "text-muted hover:text-text"}`}>
                  {s.note} · {s.label}
                </button>
              ))}
            </div>
          </div>
          <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line bg-panel px-4 py-3 text-[12px] text-muted">
            <span className="font-medium text-text">Real NISAR radar · Tonle Sap Lake, Cambodia</span>
            <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-cyan" />open water</span>
            <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-amber" />water under trees</span>
          </figcaption>
        </figure>
      </div>
      <button onClick={() => document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })}
        className="mx-auto mt-10 flex items-center gap-1.5 text-[13px] text-muted hover:text-text">
        How it works <ArrowDown size={14} />
      </button>
    </header>
  );
}

function Fact({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="rounded-xl border border-line bg-panel/60 p-3">
      {icon}
      <div className="mt-2 leading-snug text-text/80">{text}</div>
    </div>
  );
}
