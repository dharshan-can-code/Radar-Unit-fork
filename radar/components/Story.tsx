"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown, Cloud, CloudRain, Droplets, Loader2, Map as MapIcon, MapPin, Pause, Play, Search, Share2, ShieldCheck, Sparkles, Trees,
} from "lucide-react";
import type { GridIndex, Manifest } from "@/lib/data";
import { imgUrl } from "@/lib/data";
import { Rainfall, acquisitions, errorText, geocode, job as getJob, loadResult, startAnalysis } from "@/lib/api";
import { StoryFacts, buildStory, fmtDate, fmtKm2 } from "@/lib/story";
import { Tag } from "@/components/Fingerprint";
import { MAT, MAT_LABEL, LiveResult } from "@/components/LiveSearch";
import { storySound } from "@/lib/sound";
import { Music, Volume2, VolumeX } from "lucide-react";

/* ---------- small animation helpers ---------- */

function useInView<T extends HTMLElement>(threshold = 0.25) {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setSeen(true); }, { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, seen] as const;
}

function CountUp({ to, active, decimals = 0, ms = 1400 }: { to: number; active: boolean; decimals?: number; ms?: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!active) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setV(to); return; }
    let raf = 0; const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      setV(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, active, ms]);
  return <>{v.toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}</>;
}

function Chapter({ id, n, kicker, title, children, onEnter }: { id: string; n: number; kicker: string; title: string;
  children: (seen: boolean) => React.ReactNode; onEnter?: () => void }) {
  const [ref, seen] = useInView<HTMLElement>(0.2);
  const enterRef = useRef(onEnter); enterRef.current = onEnter;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) enterRef.current?.(); }, { threshold: 0.55 });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return (
    <section id={id} ref={ref} className={`story-chapter flex min-h-[85vh] flex-col justify-center py-16 ${seen ? "is-in" : ""}`}>
      <div className="reveal font-mono text-xs tracking-widest text-amber">CHAPTER {n} · {kicker}</div>
      <h2 className="reveal reveal-d1 mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
      <div className="reveal reveal-d2 mt-6">{children(seen)}</div>
    </section>
  );
}

function Flipbook({ m, layer = "HH", interval = 1100, big = false }: { m: Manifest; layer?: "HH" | "class"; interval?: number; big?: boolean }) {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  const obs = m.observations;
  useEffect(() => {
    if (!playing || obs.length < 2) return;
    const t = setInterval(() => { setI((k) => (k + 1) % obs.length); if (storySound.enabled && big) storySound.blip(); }, interval);
    return () => clearInterval(t);
  }, [playing, obs.length, interval, big]);
  const ratio = m.display.ny / m.display.nx;
  const cur = obs.length ? i % obs.length : 0; // never index past the end (e.g. after switching places)
  return (
    <figure className={`relative mx-auto w-full ${big ? "max-w-2xl" : "max-w-md"}`}>
      <div className="relative overflow-hidden rounded-xl border border-line bg-[#05080f]" style={{ paddingTop: `${ratio * 100}%` }}>
        {obs.map((o, k) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={o.date} src={imgUrl(m, `${o.date}_${layer === "class" ? "class" : "HH"}`)} alt={`NISAR ${layer} radar image, ${o.date}`}
            className="absolute inset-0 h-full w-full object-contain transition-opacity duration-500" style={{ opacity: k === cur ? 1 : 0, imageRendering: "pixelated" }} />
        ))}
        <div className="absolute top-3 left-3 rounded bg-bg/80 px-2 py-1 font-mono text-sm text-text">{obs[cur] ? fmtDate(obs[cur].date) : ""}</div>
        <button onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause" : "Play"}
          className="absolute top-3 right-3 rounded-full bg-bg/80 p-1.5 text-cyan">{playing ? <Pause size={14} /> : <Play size={14} />}</button>
      </div>
      <div className="mt-2 flex gap-1" role="tablist" aria-label="Acquisition dates">
        {obs.map((o, k) => (
          <button key={o.date} onClick={() => { setI(k); setPlaying(false); }} title={o.date} aria-label={o.date}
            className={`h-1.5 flex-1 rounded-full transition-colors ${k === cur ? "bg-cyan" : "bg-line hover:bg-muted"}`} />
        ))}
      </div>
      <figcaption className="mt-1 text-center text-[12px] text-muted">
        {layer === "class" ? "Cyan: water-like (calm, dark). Amber: flooded-vegetation-like (very bright)." : "Real NISAR radar. Dark = smooth surfaces such as calm water; bright = trees, towns, flooded forest."}
      </figcaption>
    </figure>
  );
}

/* ---------- builder: place -> real NISAR analysis ---------- */

type BuildStep = { text: string; done: boolean };

function Builder({ onResult, compact }: { onResult: (r: LiveResult) => void; compact?: boolean }) {
  const [q, setQ] = useState("");
  const [nDates, setNDates] = useState(4);
  const [steps, setSteps] = useState<BuildStep[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const say = (text: string) => setSteps((s) => [...s.map((x) => ({ ...x, done: true })), { text, done: false }]);

  async function build(e?: React.FormEvent) {
    e?.preventDefault();
    if (q.trim().length < 2 || busy) return;
    setBusy(true); setErr(null); setSteps([]);
    try {
      say(`Finding “${q.trim()}” on the map…`);
      const places = await geocode(q);
      if (!places.length) throw new Error("We couldn't find that place. Try a city, region or coordinates.");
      const p = places[0];
      say(`Found ${p.name.split(",").slice(0, 3).join(",")}. Asking NASA's archive what NISAR has seen there…`);
      const a = await acquisitions(p.lat, p.lon);
      // For a story, prefer the newest stack that has enough passes to show a trend
      // (the archive's "latest pair" stack may only have two dates).
      const rank = { VALIDATED: 3, PROVISIONAL: 2, URGENT_RESPONSE: 1 } as Record<string, number>;
      const usable = a.stacks.filter((s) => s.usable && s.n_dates >= 2);
      const stack = [...usable].sort((x, y) =>
        (Math.min(y.n_dates, nDates) - Math.min(x.n_dates, nDates)) || ((y.latest ?? "") > (x.latest ?? "") ? 1 : (y.latest ?? "") < (x.latest ?? "") ? -1 : 0)
        || ((rank[y.maturity] ?? 0) - (rank[x.maturity] ?? 0)))[0];
      if (!stack) throw new Error(a.note ?? "NISAR has no comparable images here yet. Try a place on land or a coast.");
      const dual = stack.granules.filter((g) => g.pols.includes("HV"));
      const pick = (dual.length >= 2 ? dual : stack.granules).slice(-nDates);
      say(`${a.n_granules} NISAR images cover this place. Reading the ${pick.length} newest comparable ones (${pick[0].date} → ${pick[pick.length - 1].date}, ${MAT_LABEL[stack.maturity] ?? stack.maturity.toLowerCase()})…`);
      let j = await startAnalysis({ lat: p.lat, lon: p.lon, scenes: pick.map((g) => g.scene), size_km: 20, detail: "standard",
        place: p.name.split(",").slice(0, 2).join(",") });
      while (j.status === "queued" || j.status === "running") {
        await new Promise((r) => setTimeout(r, 1500));
        j = await getJob(j.job_id);
      }
      if (j.status === "error" || !j.result) throw new Error(j.message ?? "The analysis failed.");
      say("Radar read. Writing your story…");
      const m = await loadResult(j.result);
      onResult({ manifest: m, footprint: stack.footprint, checkedUtc: a.checked_utc });
      setSteps((s) => s.map((x) => ({ ...x, done: true })));
    } catch (x) {
      setErr(errorText(x));
    } finally { setBusy(false); }
  }

  return (
    <div className={`rounded-2xl border border-amber/40 bg-gradient-to-br from-amber/10 to-transparent ${compact ? "p-4" : "p-6"}`}>
      <div className="flex items-center gap-2 text-sm font-semibold text-amber"><Sparkles size={16} />Build the story of any place</div>
      <p className="mt-1 text-[13px] text-muted">Type a place. DELTA PULSE reads the newest real NISAR radar images of it and writes its story, about 20–40 seconds.</p>
      <form onSubmit={build} className="mt-3 flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <MapPin size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Place for your story" placeholder="e.g. Jakarta, Sundarbans, Manaus, your hometown"
            className="w-full rounded-md border border-line bg-bg py-2 pr-3 pl-9 text-sm focus:border-amber focus:outline-none" />
        </div>
        <select value={nDates} onChange={(e) => setNDates(+e.target.value)} aria-label="Number of satellite passes"
          className="rounded-md border border-line bg-bg px-2 text-[13px] text-text">
          {[3, 4, 6].map((n) => <option key={n} value={n}>{n} passes</option>)}
        </select>
        <button disabled={busy || q.trim().length < 2} className="flex items-center gap-1.5 rounded-md bg-amber px-4 py-2 text-sm font-medium text-bg disabled:opacity-40">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}Tell its story
        </button>
      </form>
      {steps.length > 0 && (
        <ol className="mt-3 space-y-1 text-[13px]" aria-live="polite">
          {steps.map((s, k) => (
            <li key={k} className={`story-line flex items-start gap-2 ${s.done ? "text-muted" : "text-text"}`}>
              {s.done ? <span className="text-green">✓</span> : <Loader2 size={13} className="mt-0.5 animate-spin text-amber" />}{s.text}
            </li>
          ))}
        </ol>
      )}
      {err && <p className="mt-3 text-[13px] text-rose">{err}</p>}
    </div>
  );
}

/* ---------- the story ---------- */

const CHAPTERS = ["s-cover", "s-sky", "s-radar", "s-water", "s-change", "s-sure", "s-next"];

export default function Story({ m, grid, rain, onResult, onOpenMap, shareUrl }: {
  m: Manifest | null; grid: GridIndex | null; rain: Rainfall | null;
  onResult: (r: LiveResult) => void; onOpenMap: () => void; shareUrl: string | null;
}) {
  const f: StoryFacts | null = useMemo(() => (m && m.observations.length >= 2 ? buildStory(m, rain, grid) : null), [m, rain, grid]);
  const [auto, setAuto] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sound, setSound] = useState(false);
  useEffect(() => () => storySound.stop(), []);
  const toggleSound = () => {
    if (sound) { storySound.stop(); setSound(false); return; }
    storySound.start(); setSound(true);
    if (f) storySound.speak(`The water we cannot see, in ${f.place}. Between ${fmtDate(f.first)} and ${fmtDate(f.last)}, NISAR passed over ${f.n} times, seeing through cloud, rain and darkness.`);
  };
  const rainLevel = f?.rainTotal != null ? Math.min(1, f.rainTotal / Math.max(300, f.spanDays * 8)) : 0;
  // Approximate local solar time of the pass (UTC + longitude/15). NISAR's orbit crosses at dawn/dusk,
  // so many passes happen in darkness, when no camera could see the ground anyway.
  const passLocal = (() => {
    if (!f?.passes.length) return null;
    const t = new Date(f.passes[0].start_time);
    if (Number.isNaN(t.getTime())) return null;
    const h = (((t.getUTCHours() + t.getUTCMinutes() / 60 + f.center[0] / 15) % 24) + 24) % 24;
    return { label: `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.floor((h % 1) * 60)).padStart(2, "0")}`, dark: h < 6.5 || h >= 18.5 };
  })();
  const narrate = (id: string) => {
    if (!sound || !f) return;
    const r = (x: number) => Math.round(x).toLocaleString();
    if (id === "sky") {
      storySound.rain(rainLevel);
      storySound.speak(f.cloudyPasses != null
        ? `Chapter one. Above the clouds. At the exact hour the satellite flew over, clouds covered more than half the sky on ${f.cloudyPasses} of ${f.cloudKnown} passes.${f.rainTotal != null ? ` About ${r(f.rainTotal)} millimetres of rain fell.` : ""} A camera would have seen clouds. Radar saw the ground.`
        : "Chapter one. Above the clouds. Radar does not need a clear sky.");
    } else if (id === "radar") {
      storySound.rain(rainLevel * 0.4);
      storySound.speak(`Chapter two. What the radar saw. These are the real radar images, one for each pass. Calm water shows up black. Water hidden under trees can shine very bright.`);
    } else if (id === "water") {
      storySound.rain(rainLevel * 0.3);
      const ms = storySound.playSeries(f.passes.map((p) => p.water_km2), 420, f.passes.map((p) => p.flooded_veg_km2));
      storySound.speak(f.waterPeak.water_km2 < 1
        ? "Chapter three. The hidden water. Almost no open water showed up here."
        : `Chapter three. The hidden water. You just heard it. Each note was one pass, and higher means more water. Water-like ground went from ${r(f.waterFirst)} to ${r(f.waterLast)} square kilometres.`, ms);
    } else if (id === "change" && f.biggest) {
      storySound.speak(`Chapter four. The moment it changed. Between ${fmtDate(f.biggest.before)} and ${fmtDate(f.biggest.after)}, the radar changed more than at any other time.`);
    } else if (id === "sure") {
      storySound.rain(0);
      storySound.speak(`Chapter five. How sure are we? ${f.verdict ? `The verdict: ${f.verdict}.` : ""} Every claim is labelled. We show what we measured, and what would still need checking on the ground.`);
    }
  };

  useEffect(() => {
    if (!auto) return;
    let k = 0;
    const next = () => {
      const el = document.getElementById(CHAPTERS[k]);
      if (!el) { setAuto(false); return; }
      el.scrollIntoView({ behavior: "smooth" });
      k += 1;
    };
    next();
    const t = setInterval(() => { if (k >= CHAPTERS.length) { clearInterval(t); setAuto(false); } else next(); }, 6500);
    return () => clearInterval(t);
  }, [auto]);

  if (!m || !f) {
    return (
      <div className="py-16">
        <h1 className="text-4xl font-semibold tracking-tight">Your Story</h1>
        <p className="mt-2 max-w-2xl text-lg text-text/80">Every place has water we cannot see: under clouds, under trees, under the night. Pick a place and NISAR&apos;s radar will tell its story.</p>
        <div className="mt-6"><Builder onResult={onResult} /></div>
      </div>
    );
  }

  const changePct = f.waterFirst > 0 ? ((f.waterLast - f.waterFirst) / f.waterFirst) * 100 : null;
  const maxArea = Math.max(...f.passes.map((p) => p.water_km2 + p.flooded_veg_km2), 1);
  const share = () => { if (shareUrl) navigator.clipboard?.writeText(shareUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); };

  return (
    <div className="story">
      {/* progress rail */}
      <div className="pointer-events-none fixed top-1/2 right-3 z-50 hidden -translate-y-1/2 flex-col gap-2 lg:flex">
        {CHAPTERS.map((c) => <a key={c} href={`#${c}`} className="pointer-events-auto h-2 w-2 rounded-full bg-line hover:bg-amber" aria-label={`Go to ${c}`} />)}
      </div>

      <button onClick={toggleSound} aria-label={sound ? "Turn sound off" : "Turn sound on"} title="Narration, data sound and rain"
        className={`fixed right-4 bottom-4 z-50 flex items-center gap-1.5 rounded-full border px-3 py-2 text-[12px] shadow-lg backdrop-blur ${sound ? "border-cyan bg-cyan/20 text-cyan" : "border-line bg-bg/80 text-muted"}`}>
        {sound ? <Volume2 size={14} /> : <VolumeX size={14} />}{sound ? "Sound on" : "Sound off"}
      </button>

      {/* COVER */}
      <section id="s-cover" className="story-chapter is-in relative flex min-h-[92vh] flex-col justify-center py-12">
        <div className="grid items-center gap-8 lg:grid-cols-2">
          <div>
            <div className="reveal font-mono text-xs tracking-widest text-amber">A STORY WRITTEN BY RADAR · {f.satellite.toUpperCase()}</div>
            <h1 className="reveal reveal-d1 mt-3 text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
              The water we cannot see<span className="block text-cyan">in {f.place}</span>
            </h1>
            <p className="reveal reveal-d2 mt-4 text-lg text-text/80">
              Between <b>{fmtDate(f.first)}</b> and <b>{fmtDate(f.last)}</b>, NISAR passed over this place <b>{f.n} times</b>, sending its own
              radar pulses down through cloud, rain and darkness. This is what it found.
            </p>
            <div className="reveal reveal-d3 mt-6 flex flex-wrap gap-2">
              <button onClick={() => setAuto((a) => !a)} className="flex items-center gap-1.5 rounded-md bg-amber px-4 py-2 text-sm font-medium text-bg">
                {auto ? <Pause size={14} /> : <Play size={14} />}{auto ? "Pause story" : "Play the story"}
              </button>
              <button onClick={toggleSound} aria-pressed={sound}
                className={`flex items-center gap-1.5 rounded-md border px-4 py-2 text-sm ${sound ? "border-cyan bg-cyan/15 text-cyan" : "border-line text-text hover:border-cyan/50"}`}>
                {sound ? <Volume2 size={14} /> : <VolumeX size={14} />}{sound ? "Sound on" : "Turn sound on"}
              </button>
              <a href="#s-sky" className="flex items-center gap-1.5 rounded-md border border-line px-4 py-2 text-sm text-text hover:border-amber/50"><ArrowDown size={14} />Scroll to read</a>
            </div>
            <div className="reveal reveal-d3 mt-6 flex flex-wrap gap-2 text-[11px]">
              <span className={`rounded border px-2 py-0.5 font-mono ${MAT[f.maturity] ?? MAT.OTHER}`}>{MAT_LABEL[f.maturity] ?? f.maturity} {f.crid}</span>
              <span className="rounded border border-line px-2 py-0.5 font-mono text-muted">track {f.track} · {f.resM} m cells · ~{fmtKm2(f.windowKm2)} km² studied</span>
            </div>
          </div>
          <div className="reveal reveal-d2"><Flipbook key={`${m.stack}-a`} m={m} big /></div>
        </div>
      </section>

      {/* 1. SKY */}
      <Chapter id="s-sky" n={1} kicker="ABOVE THE CLOUDS" title={passLocal?.dark ? "A camera would have seen clouds, or nothing at all." : "A camera would have seen clouds."} onEnter={() => narrate("sky")}>
        {(seen) => (
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="space-y-4 text-lg text-text/85">
              {f.cloudyPasses != null ? (
                <p>
                  At the exact hour NISAR flew over, clouds covered more than half the sky on{" "}
                  <b className="text-amber"><CountUp to={f.cloudyPasses} active={seen} /> of {f.cloudKnown}</b> passes
                  (average <b><CountUp to={f.meanCloud ?? 0} active={seen} />%</b> cloud cover). Optical satellites like those behind most map apps
                  see only the top of those clouds.
                </p>
              ) : <p>Cloud records for these dates are not available yet, but radar does not need a clear sky either way.</p>}
              {passLocal?.dark && (
                <p>
                  NISAR also flew over at about <b>{passLocal.label}</b> local solar time, in darkness. A camera would have seen nothing at all.
                  Radar brings its own light.
                </p>
              )}
              {f.rainTotal != null && (
                <p>
                  Over the same period about <b className="text-blue"><CountUp to={f.rainTotal} active={seen} /> mm</b> of rain fell here
                  {f.rainiest && <> (heaviest: <b>{f.rainiest.mm.toFixed(0)} mm</b> on {fmtDate(f.rainiest.date)})</>}.
                </p>
              )}
              <p className="text-base text-muted">NISAR&apos;s 24 cm L-band waves pass through cloud and rain, and even partly through leaves. That&apos;s how we can see water that is hidden from above.</p>
              <div className="flex flex-wrap gap-2 text-[11px]"><Tag kind="OBSERVED" /><span className="text-muted">Cloud and rain: ERA5 reanalysis via Open-Meteo, at this location.</span></div>
            </div>
            <div className="rounded-xl border border-line bg-panel p-4">
              <div className="mb-2 text-[12px] text-muted">Sky at each NISAR pass</div>
              <div className="space-y-2">
                {f.passes.map((p, k) => (
                  <div key={p.date} className="flex items-center gap-3 text-[12px]">
                    <span className="w-24 shrink-0 font-mono text-muted">{p.date}</span>
                    <div className="h-4 flex-1 overflow-hidden rounded bg-panel-2">
                      <div className="grow-bar h-full rounded bg-gradient-to-r from-slate-400 to-slate-200"
                        style={{ width: seen && p.cloud_pct != null ? `${p.cloud_pct}%` : "0%", transitionDelay: `${k * 90}ms` }} />
                    </div>
                    <span className="flex w-16 shrink-0 items-center gap-1 text-text">{p.cloud_pct != null ? <><Cloud size={12} className="text-muted" />{Math.round(p.cloud_pct)}%</> : "–"}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Chapter>

      {/* 2. RADAR */}
      <Chapter id="s-radar" n={2} kicker="WHAT THE RADAR SAW" title={`${f.n} looks at ${f.place}, through everything.`} onEnter={() => narrate("radar")}>
        {() => (
          <div className="grid items-center gap-8 lg:grid-cols-2">
            <Flipbook key={`${m.stack}-b`} m={m} big />
            <div className="space-y-4 text-lg text-text/85">
              <p>These are the real radar images, one every pass. Watch for <b>dark areas growing or shrinking</b>: calm water reflects the radar away like a mirror, so it shows up black.</p>
              <p>Very <b>bright</b> patches near water can mean something hidden: water standing under trees bounces the radar straight back, like light off the corner of a mirror.</p>
              <div className="flex flex-wrap gap-2 text-[11px]"><Tag kind="OBSERVED" /><span className="text-muted">NISAR L2 GCOV, HH polarisation, {f.resM} m cells, read live from NASA&apos;s ASF archive.</span></div>
            </div>
          </div>
        )}
      </Chapter>

      {/* 3. HIDDEN WATER */}
      <Chapter id="s-water" n={3} kicker="THE HIDDEN WATER" title="How much water-like ground did the radar find?" onEnter={() => narrate("water")}>
        {(seen) => (
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="space-y-4 text-lg text-text/85">
              {f.waterPeak.water_km2 < 1 ? (
                <p>
                  Almost no open, calm water showed up here: under <b className="text-cyan">1 km²</b> on every pass. Rivers narrower
                  than a few radar cells, or water roughened by wind, can escape this simple test.
                </p>
              ) : (
                <p>
                  On the first pass, <b className="text-cyan"><CountUp to={f.waterFirst} active={seen} decimals={f.waterFirst < 10 ? 1 : 0} /> km²</b> looked
                  like open water. On the last, <b className="text-cyan"><CountUp to={f.waterLast} active={seen} decimals={f.waterLast < 10 ? 1 : 0} /> km²</b>
                  {changePct != null && Math.abs(changePct) >= 1 && <> ({changePct > 0 ? "+" : ""}{changePct.toFixed(0)}%)</>}.
                  {f.n > 2 && <> The most was on <b>{fmtDate(f.waterPeak.date)}</b>.</>}
                </p>
              )}
              {f.vegPeak.flooded_veg_km2 >= 1 && (
                <p>
                  A second, hidden signature (ground that bounces the radar straight back, like a corner reflector) peaked on{" "}
                  <b>{fmtDate(f.vegPeak.date)}</b> at about{" "}
                  <b className="text-amber"><CountUp to={f.vegPeak.flooded_veg_km2} active={seen} decimals={f.vegPeak.flooded_veg_km2 < 10 ? 1 : 0} /> km²</b>.
                  Outside towns this usually means <b className="text-amber">water standing under trees or crops</b>, invisible from above.
                  Inside towns, buildings do the same, so check the map before reading it as water.
                </p>
              )}
              <button onClick={() => { if (!sound) { storySound.start(); setSound(true); } setTimeout(() => storySound.playSeries(f.passes.map((p) => p.water_km2), 420, f.passes.map((p) => p.flooded_veg_km2)), 60); }}
                className="flex items-center gap-1.5 rounded-md border border-cyan/40 px-3 py-1.5 text-[13px] text-cyan hover:bg-cyan/10">
                <Music size={14} />Hear the water: one note per pass, higher = more water
              </button>
              {f.partialPasses.length > 0 && (
                <p className="rounded-lg border border-line bg-panel p-3 text-[14px] text-text/80">
                  On {f.partialPasses.length} of {f.n} passes the satellite&apos;s imaging strip covered only part of this area
                  ({f.partialPasses.map((p) => `${fmtDate(p.date)}: ${Math.round(p.coverage * 100)}%`).join("; ")}). To compare fairly, these
                  numbers count only the {f.commonKm2 != null ? `${fmtKm2(f.commonKm2)} km² of ` : ""}ground seen on every pass.
                </p>
              )}
              <div className="flex flex-wrap gap-2 text-[11px]"><Tag kind="CALCULATED" /><Tag kind="INTERPRETED" />
                <span className="text-muted">Compared over ground seen on every pass{f.commonKm2 != null ? ` (${fmtKm2(f.commonKm2)} km²)` : ""}. Screening thresholds are uncalibrated; they show the pattern and its timing, not surveyed flood extents.</span></div>
            </div>
            <div className="rounded-xl border border-line bg-panel p-4">
              <div className="mb-2 flex gap-4 text-[11px] text-muted">
                <span className="flex items-center gap-1"><Droplets size={12} className="text-cyan" />water-like</span>
                <span className="flex items-center gap-1"><Trees size={12} className="text-amber" />hidden under vegetation?</span>
              </div>
              <div className="space-y-2">
                {f.passes.map((p, k) => (
                  <div key={p.date} className="flex items-center gap-3 text-[12px]">
                    <span className="w-24 shrink-0 font-mono text-muted">{p.date}</span>
                    <div className="flex h-5 flex-1 overflow-hidden rounded bg-panel-2">
                      <div className="grow-bar h-full bg-cyan" style={{ width: seen ? `${(p.water_km2 / maxArea) * 100}%` : "0%", transitionDelay: `${k * 110}ms` }} />
                      <div className="grow-bar h-full bg-amber" style={{ width: seen ? `${(p.flooded_veg_km2 / maxArea) * 100}%` : "0%", transitionDelay: `${k * 110 + 60}ms` }} />
                    </div>
                    <span className="w-20 shrink-0 text-right font-mono text-text">{fmtKm2(p.water_km2 + p.flooded_veg_km2)} km²</span>
                  </div>
                ))}
              </div>
              <div className="mt-4"><Flipbook key={`${m.stack}-c`} m={m} layer="class" interval={1300} /></div>
            </div>
          </div>
        )}
      </Chapter>

      {/* 4. BIGGEST CHANGE */}
      {f.biggest && (
        <Chapter id="s-change" n={4} kicker="THE MOMENT IT CHANGED" title={`${fmtDate(f.biggest.before)} → ${fmtDate(f.biggest.after)}`} onEnter={() => narrate("change")}>
          {(seen) => {
            const big = f.biggest!;
            const c = (big as unknown as { HH_change?: { frac_increase: number; frac_decrease: number; mean_db: number } }).HH_change;
            const after = f.passes.find((p) => p.date === big.after);
            return (
              <div className="grid items-center gap-8 lg:grid-cols-2">
                <figure className="mx-auto w-full max-w-xl">
                  <div className="relative overflow-hidden rounded-xl border border-line bg-[#05080f]" style={{ paddingTop: `${(m.display.ny / m.display.nx) * 100}%` }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imgUrl(m, `${big.before}_HH`)} alt="Radar before" className="absolute inset-0 h-full w-full object-contain opacity-40" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imgUrl(m, `d_${big.id}_HH`)} alt="Measured radar change" className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-[1500ms] ${seen ? "opacity-100" : "opacity-0"}`} />
                  </div>
                  <figcaption className="mt-1 text-center text-[12px] text-muted"><span className="text-amber">Amber</span> = got brighter · <span className="text-blue">blue</span> = got darker ({big.delta_days} days apart)</figcaption>
                </figure>
                <div className="space-y-4 text-lg text-text/85">
                  <p>
                    In just <b>{big.delta_days} days</b>, <b className="text-amber"><CountUp to={(c?.frac_increase ?? 0) * 100} active={seen} decimals={1} />%</b> of the
                    ground got clearly brighter and <b className="text-blue"><CountUp to={(c?.frac_decrease ?? 0) * 100} active={seen} decimals={1} />%</b> got clearly darker.
                    That was the biggest change between any two passes.
                  </p>
                  {after?.rain7_mm != null && (
                    <p className="flex items-start gap-2"><CloudRain size={18} className="mt-1 shrink-0 text-blue" />
                      <span>In the 7 days before {fmtDate(big.after)}, about <b>{after.rain7_mm.toFixed(0)} mm</b> of rain fell. Rain wets soil and leaves, which can change the radar too.</span></p>
                  )}
                  <div className="flex flex-wrap gap-2 text-[11px]"><Tag kind="CALCULATED" /><span className="text-muted">Share of {f.resM} m cells changing by ≥3 dB (twice as bright, or half).</span></div>
                </div>
              </div>
            );
          }}
        </Chapter>
      )}

      {/* 5. HOW SURE */}
      <Chapter id="s-sure" n={5} onEnter={() => narrate("sure")} kicker="HOW SURE ARE WE?" title={f.verdict ? `Verdict: ${f.verdict.toLowerCase()}.` : "What we can, and cannot, say."}>
        {() => (
          <div className="grid gap-8 lg:grid-cols-2">
            <ul className="space-y-3">
              {(f.statements.length ? f.statements : [{ kind: "UNCONFIRMED" as const, text: "Loading the detailed evidence…" }]).map((s, k) => (
                <li key={k} className="story-line flex gap-3 text-[15px] leading-relaxed" style={{ animationDelay: `${k * 120}ms` }}>
                  <span className="w-28 shrink-0 pt-0.5"><Tag kind={s.kind} /></span><span className="text-text/85">{s.text}</span>
                </li>
              ))}
            </ul>
            <div className="rounded-xl border border-line bg-panel p-5 text-[15px] text-text/85">
              <div className="flex items-center gap-2 font-semibold text-text"><ShieldCheck size={16} className="text-green" />Why you can trust this story</div>
              <ul className="mt-3 list-disc space-y-1.5 pl-5">
                <li>Every image is a real NISAR acquisition from NASA&apos;s archive, dated to the second.</li>
                <li>All {f.n} passes come from the same orbit track and processing release, so they are fairly comparable.</li>
                <li>Pixels flagged as unreliable by NASA&apos;s own quality masks were removed.</li>
                <li>The story never claims a flood. It shows the evidence and what would confirm it: a water-level gauge, a clear photo, or a visit.</li>
              </ul>
            </div>
          </div>
        )}
      </Chapter>

      {/* 6. NEXT */}
      <section id="s-next" className="flex min-h-[60vh] flex-col justify-center py-16">
        <div className="font-mono text-xs tracking-widest text-amber">YOUR TURN</div>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">Every place has water we cannot see.</h2>
        <p className="mt-3 max-w-2xl text-lg text-text/80">Explore {f.place} in detail on the map, share this story, or tell the story of another place.</p>
        <div className="mt-6 flex flex-wrap gap-2">
          <button onClick={onOpenMap} className="flex items-center gap-1.5 rounded-md bg-cyan px-4 py-2 text-sm font-medium text-bg"><MapIcon size={14} />Explore on the map</button>
          {shareUrl && <button onClick={share} className="flex items-center gap-1.5 rounded-md border border-line px-4 py-2 text-sm hover:border-cyan/50"><Share2 size={14} />{copied ? "Link copied" : "Share this story"}</button>}
        </div>
        <div className="mt-8 max-w-3xl"><Builder onResult={onResult} compact /></div>
      </section>
    </div>
  );
}
