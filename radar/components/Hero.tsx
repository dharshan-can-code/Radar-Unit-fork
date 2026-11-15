"use client";
// First screen: what DELTA PULSE is for, next to real NISAR imagery of the
// place that is loaded. The two passes shown are chosen from the data: the one
// with the least and the one with the most of the "water under vegetation"
// screening signature (manifest.observations[].screening_counts).
import { useEffect, useMemo, useState } from "react";
import Orbits from "@/components/Orbits";
import Link from "next/link";
import { ArrowDown, ArrowRight, Sparkles } from "lucide-react";
import type { Manifest } from "@/lib/data";
import { IMG_CORS, imgUrl } from "@/lib/data";
import { fmtDate } from "@/lib/story";
import { Readout } from "@/components/ui";

export default function Hero({ m, storyHref, exploreHref }: { m: Manifest | null | undefined; storyHref: string; exploreHref: string }) {
  const scenes = useMemo(() => {
    if (!m || m.observations.length < 2) return null;
    const obs = m.observations;
    const lo = obs.reduce((a, b) => (b.screening_counts.double_bounce < a.screening_counts.double_bounce ? b : a));
    const hi = obs.reduce((a, b) => (b.screening_counts.double_bounce > a.screening_counts.double_bounce ? b : a));
    if (lo.date === hi.date) return [{ o: obs[0], note: "First pass" }, { o: obs[obs.length - 1], note: "Latest pass" }];
    return [{ o: lo, note: "Least hidden water" }, { o: hi, note: "Most hidden water" }];
  }, [m]);

  const [k, setK] = useState(1);
  const [paused, setPaused] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  useEffect(() => {
    if (!scenes || paused || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setK((x) => 1 - x), 5200);
    return () => clearInterval(t);
  }, [paused, scenes]);
  useEffect(() => {
    setSweeping(true);
    const t = setTimeout(() => setSweeping(false), 1500);
    return () => clearTimeout(t);
  }, [k]);

  const place = m ? m.name.replace(/\s*\(.*\)$/, "") : "";
  const o0 = m?.observations[0], oN = m?.observations[m.observations.length - 1];
  const ratio = m ? `${m.display.nx} / ${m.display.ny}` : "1 / 1";

  return (
    <header id="top" className="atmosphere relative overflow-hidden [&>:not(svg)]:relative -mx-4 scroll-mt-14 px-4 pt-10 pb-10 sm:-mx-6 sm:px-6 sm:pt-14 lg:pb-14">
      <Orbits />
      <div className="grid gap-x-12 gap-y-9 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)] lg:gap-y-10">
        <div className="min-w-0 lg:self-end">
          <h1 className="text-[2.6rem] leading-[1.02] font-medium sm:text-6xl 2xl:text-[4.5rem]">
            Revealing the water we cannot see.
          </h1>
          <p className="mt-6 max-w-[34rem] text-[17px] leading-relaxed text-text/80">
            When rivers flood into forests, the water spreads under the trees, invisible to cameras. NASA-ISRO&apos;s NISAR radar
            passes through cloud and leaves, and DELTA PULSE turns it into plain answers: where water is spreading, how much
            changed, and how sure we can be.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href={exploreHref} className="flex items-center gap-2 rounded-md bg-accent px-5 py-3 text-[15px] font-semibold text-on-accent hover:bg-accent-strong">
              Explore the data<ArrowRight size={17} />
            </Link>
            <Link href={storyHref} className="flex items-center gap-2 rounded-md border border-line-strong px-5 py-3 text-[15px] font-medium text-text hover:border-amber hover:text-amber">
              <Sparkles size={16} />Watch the story
            </Link>
            <button onClick={() => document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })}
              className="flex items-center gap-1.5 px-1 py-3 text-[14px] text-muted hover:text-text">
              How the radar sees it<ArrowDown size={14} />
            </button>
          </div>

        </div>

        <figure onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
          className="relative mx-auto w-full max-w-[640px] min-w-0 self-center border border-line bg-void lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mx-0 lg:ml-auto">
          {/* corner ticks, like a sensor viewport */}
          {["-top-px -left-px border-t border-l", "-top-px -right-px border-t border-r", "-bottom-px -left-px border-b border-l", "-right-px -bottom-px border-r border-b"].map((c) => (
            <span key={c} aria-hidden className={`pointer-events-none absolute z-20 h-3 w-3 border-accent ${c}`} />
          ))}
          <div className="relative w-full overflow-hidden" style={{ aspectRatio: ratio }}>
            {m && scenes ? (
              <>
                {scenes.map((s, i) => (
                  <div key={s.o.date} aria-hidden={i !== k} className={i === 1 ? "hero-wipe absolute inset-0" : "absolute inset-0"}
                    style={i === 1 ? { clipPath: `inset(0 0 0 ${k === 1 ? 0 : 100}%)` } : undefined}>
                    <div className="absolute inset-0 bg-void" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img crossOrigin={IMG_CORS} src={imgUrl(m, `${s.o.date}_HH`)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-55" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img crossOrigin={IMG_CORS} src={imgUrl(m, `${s.o.date}_class`)} alt={`NISAR radar screening of ${place} on ${fmtDate(s.o.date)}`}
                      className="absolute inset-0 h-full w-full object-cover" />
                  </div>
                ))}
                <div aria-hidden className="hero-scan pointer-events-none absolute inset-0 z-10"
                  style={{ transform: `translateX(${k === 1 ? 0 : 100}%)`, opacity: sweeping ? 1 : 0 }}>
                  <div className="absolute inset-y-0 left-0 w-0.5 bg-accent" />
                </div>
                <div className="absolute top-3 left-3 z-20 flex border border-line bg-bg/85 p-0.5 backdrop-blur-sm">
                  {scenes.map((s, i) => (
                    <button key={s.o.date} onClick={() => { setK(i); setPaused(true); }} aria-pressed={i === k}
                      className={`rounded-sm px-2.5 py-1.5 text-left text-[12px] leading-tight ${i === k ? "bg-text text-bg" : "text-muted hover:text-text"}`}>
                      <span className="block font-medium">{s.note}</span>
                      <span className="block font-mono text-[11px] opacity-80">{fmtDate(s.o.date)}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : m === undefined ? <div className="skeleton absolute inset-0 rounded-none" /> : (
              <div className="absolute inset-0 flex items-center justify-center p-8 text-center text-sm text-muted">No processed radar imagery is available yet.</div>
            )}
          </div>
          <figcaption className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-line bg-bg-2 px-4 py-3 text-[12px] text-muted">
            <span className="font-medium text-text">Real NISAR radar{place ? `, ${place}` : ""}</span>
            <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 bg-map-water" />looks like open water</span>
            <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 bg-map-veg" />looks like water under trees</span>
          </figcaption>
        </figure>

        <div className="min-w-0 lg:col-start-1 lg:row-start-2 lg:self-start">
          {m && o0 && oN ? (
            <dl className="grid max-w-[34rem] grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-5 sm:grid-cols-4">
              <Readout label="Radar passes">{m.observations.length}</Readout>
              <Readout label="First">{fmtDate(o0.date)}</Readout>
              <Readout label="Latest">{fmtDate(oN.date)}</Readout>
              <Readout label="Map cell">{m.display.res_m} m</Readout>
            </dl>
          ) : m === undefined ? <div className="skeleton h-14 max-w-[34rem]" /> : null}
        </div>
      </div>
    </header>
  );
}
