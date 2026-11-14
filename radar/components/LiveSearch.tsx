"use client";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, MapPin, Play, RefreshCw, Search, Satellite } from "lucide-react";
import type { Manifest } from "@/lib/data";
import {
  Acquisitions, Job, LiveStack, Place, acquisitions, geocode, health, job as getJob, loadResult, startAnalysis,
} from "@/lib/api";

const MAT: Record<string, string> = {
  VALIDATED: "border-green/50 text-green bg-green/10",
  PROVISIONAL: "border-cyan/50 text-cyan bg-cyan/10",
  BETA: "border-line text-muted",
  OTHER: "border-rose/40 text-rose bg-rose/5",
};
const SIZES = [10, 20, 40];
const fmtUtc = (iso: string) => `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;

export interface LiveResult { manifest: Manifest; footprint: GeoJSON.Geometry | null; checkedUtc: string }

export default function LiveSearch({ onResult, active }: { onResult: (r: LiveResult) => void; active: boolean }) {
  const [backend, setBackend] = useState<{ ok: boolean; token: boolean } | null>(null);
  const [q, setQ] = useState("");
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const [acq, setAcq] = useState<Acquisitions | null>(null);
  const [stackId, setStackId] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [size, setSize] = useState(20);
  const [busy, setBusy] = useState<"geocode" | "search" | null>(null);
  const [jobState, setJobState] = useState<Job | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const poll = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [started, setStarted] = useState<number | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    health().then((h) => setBackend({ ok: true, token: h.earthdata_token })).catch(() => setBackend({ ok: false, token: false }));
    return () => { if (poll.current) clearTimeout(poll.current); };
  }, []);

  const stack = acq?.stacks.find((s) => s.id === stackId) ?? null;

  function chooseStack(s: LiveStack) {
    setStackId(s.id);
    setPicked(s.usable ? s.granules.slice(-2).map((g) => g.scene) : []); // latest compatible pair
  }

  async function doGeocode(e?: React.FormEvent) {
    e?.preventDefault();
    if (q.trim().length < 2) return;
    setErr(null); setBusy("geocode"); setPlaces(null);
    try {
      const r = await geocode(q);
      setPlaces(r);
      if (r.length === 1) await pickPlace(r[0]);
      else if (!r.length) setErr("No place found. Try another name, or type coordinates like 12.56, 104.21.");
    } catch (x) { setErr(`Place search failed: ${(x as Error).message}`); }
    finally { setBusy((b) => (b === "geocode" ? null : b)); }
  }

  async function pickPlace(p: Place, fresh = false) {
    setPlace(p); setPlaces(null); setAcq(null); setStackId(null); setPicked([]); setJobState(null); setErr(null);
    setBusy("search");
    try {
      const a = await acquisitions(p.lat, p.lon, fresh);
      setAcq(a);
      const rec = a.stacks.find((s) => s.id === a.recommended_stack) ?? a.stacks.find((s) => s.usable);
      if (rec) chooseStack(rec);
    } catch (x) { setErr(`Archive search failed: ${(x as Error).message}`); }
    finally { setBusy(null); }
  }

  function toggleDate(scene: string) {
    setPicked((p) => (p.includes(scene) ? p.filter((s) => s !== scene) : p.length >= 12 ? p : [...p, scene]));
  }

  async function analyze() {
    if (!place || !stack || picked.length < 2) return;
    setErr(null); setStarted(Date.now()); setNow(Date.now());
    try {
      let j = await startAnalysis({ lat: place.lat, lon: place.lon, scenes: picked, size_km: size, place: place.name.split(",").slice(0, 2).join(",") });
      setJobState(j);
      const tick = async () => {
        if (j.status === "done" && j.result) {
          const m = await loadResult(j.result);
          onResult({ manifest: m, footprint: stack.footprint, checkedUtc: acq!.checked_utc });
          setJobState({ ...j, message: j.cached ? "Loaded saved result" : "Done" });
          return;
        }
        if (j.status === "error") { setErr(j.message ?? "Analysis failed"); return; }
        poll.current = setTimeout(async () => {
          try { j = await getJob(j.job_id); setJobState(j); tick(); }
          catch (x) { setErr(`Lost contact with the backend: ${(x as Error).message}`); }
        }, 2000);
      };
      tick();
    } catch (x) { setErr((x as Error).message); }
  }

  const running = jobState && (jobState.status === "queued" || jobState.status === "running");
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);

  return (
    <div className={`rounded-xl border bg-panel p-4 ${active ? "border-cyan/50" : "border-line"}`}>
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Satellite size={16} className="text-cyan" /> Explore anywhere with live NISAR data
      </div>
      <p className="mt-1 text-[12px] text-muted">
        Type a place or coordinates. DELTA PULSE searches NASA&apos;s ASF archive right now, then reads only the window
        you choose from the real NISAR files.
      </p>

      {backend && !backend.ok && (
        <div className="mt-3 flex gap-2 rounded-md border border-rose/40 bg-rose/5 p-2 text-[12px] text-rose">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          Backend not reachable. In the radar folder run <code className="text-text">npm.cmd run api</code>, then reload.
        </div>
      )}
      {backend?.ok && !backend.token && (
        <div className="mt-3 rounded-md border border-amber/40 bg-amber/5 p-2 text-[12px] text-amber">
          Search works, but analysis needs an Earthdata token on the server (.earthdata_token).
        </div>
      )}

      <form onSubmit={doGeocode} className="mt-3 flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Manaus, Sundarbans, Jakarta, or 12.56, 104.21"
            aria-label="Place name or coordinates"
            className="w-full rounded-md border border-line bg-bg py-2 pr-3 pl-9 text-sm text-text placeholder:text-muted/60 focus:border-cyan focus:outline-none" />
        </div>
        <button type="submit" disabled={!backend?.ok || busy !== null || q.trim().length < 2}
          className="flex items-center gap-1.5 rounded-md bg-cyan px-4 text-sm font-medium text-bg disabled:opacity-40">
          {busy === "geocode" ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}Search
        </button>
      </form>

      {places && places.length > 1 && (
        <ul className="mt-2 max-h-48 overflow-auto rounded-md border border-line">
          {places.map((p) => (
            <li key={`${p.lat},${p.lon}`}>
              <button onClick={() => pickPlace(p)} className="flex w-full items-start gap-2 px-3 py-2 text-left text-[13px] hover:bg-panel-2">
                <MapPin size={13} className="mt-0.5 shrink-0 text-cyan" />
                <span><span className="text-text">{p.name}</span><span className="ml-2 font-mono text-[11px] text-muted">{p.lat.toFixed(3)}, {p.lon.toFixed(3)}</span></span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {busy === "search" && (
        <div className="mt-3 flex items-center gap-2 text-[13px] text-muted"><Loader2 size={14} className="animate-spin" />Searching the NISAR archive…</div>
      )}

      {acq && place && (
        <div className="mt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-[12px]">
            <div className="text-text"><MapPin size={12} className="mr-1 inline text-cyan" />{place.name.split(",").slice(0, 3).join(",")}</div>
            <div className="flex items-center gap-2 text-muted">
              {acq.n_granules} GCOV granules · archive checked {fmtUtc(acq.checked_utc)}
              <button onClick={() => pickPlace(place, true)} title="Search the archive again" className="text-cyan hover:text-text"><RefreshCw size={12} /></button>
            </div>
          </div>
          {acq.note && <p className="mt-2 text-[13px] text-muted">{acq.note}</p>}

          <div className="mt-2 grid gap-1.5">
            {acq.stacks.map((s) => (
              <button key={s.id} onClick={() => chooseStack(s)} disabled={!s.usable}
                title={s.usable ? undefined : "Pre-calibration or non-standard products are listed but not analysed"}
                className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border px-3 py-2 text-left text-[12px] ${s.id === stackId ? "border-cyan bg-cyan/10" : "border-line hover:border-cyan/40"} disabled:cursor-not-allowed disabled:opacity-45`}>
                <span className="font-mono text-text">Track {s.track}{s.direction?.[0]} · frame {s.frame} · {s.bandwidth} MHz</span>
                <span className={`rounded border px-1.5 font-mono text-[10px] ${MAT[s.maturity] ?? MAT.OTHER}`}>{s.maturity} {s.crid}</span>
                <span className="text-muted">{s.n_dates} date{s.n_dates === 1 ? "" : "s"} · {s.dates[0]} → {s.latest}</span>
                <span className="text-muted">{s.dual_pol_dates.length === s.n_dates ? "HH+HV" : `HV on ${s.dual_pol_dates.length}/${s.n_dates}`}</span>
                {s.id === acq.recommended_stack && <span className="ml-auto text-[10px] text-cyan">latest compatible pair</span>}
                {s.usable && s.n_dates < 2 && <span className="ml-auto text-[10px] text-muted">needs a 2nd date to compare</span>}
              </button>
            ))}
          </div>

          {stack && stack.usable && (
            <div className="mt-3">
              <div className="mb-1.5 text-[12px] text-muted">
                Acquisitions to compare ({picked.length} selected · 2–12 · consecutive selected dates are paired):
              </div>
              <div className="flex flex-wrap gap-1.5">
                {stack.granules.map((g) => {
                  const on = picked.includes(g.scene);
                  return (
                    <button key={g.scene} onClick={() => toggleDate(g.scene)} title={`${g.scene}\n${g.pols.join("+")}`}
                      className={`rounded border px-2 py-1 font-mono text-[11px] ${on ? "border-cyan bg-cyan/15 text-cyan" : "border-line text-muted hover:text-text"}`}>
                      {g.date}{!g.pols.includes("HV") && <span className="ml-1 text-amber">HH</span>}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <div className="flex overflow-hidden rounded-md border border-line text-[12px]">
                  {SIZES.map((k) => (
                    <button key={k} onClick={() => setSize(k)}
                      className={`px-3 py-1.5 ${size === k ? "bg-cyan/15 text-cyan" : "text-muted hover:text-text"}`}>{k} km</button>
                  ))}
                </div>
                <button onClick={analyze} disabled={picked.length < 2 || !!running || !backend?.token}
                  className="flex items-center gap-1.5 rounded-md bg-cyan px-4 py-1.5 text-sm font-medium text-bg disabled:opacity-40">
                  {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                  Analyse {picked.length} acquisition{picked.length === 1 ? "" : "s"}
                </button>
                <span className="text-[11px] text-muted">≈ {Math.max(1, Math.round((picked.length * 30) / 60))} min · reads ~{size >= 40 ? 90 : 45} MB per date</span>
              </div>
            </div>
          )}
        </div>
      )}

      {jobState && (
        <div className="mt-3">
          <div className="h-1.5 overflow-hidden rounded bg-panel-2">
            <div className="h-full bg-cyan transition-all" style={{ width: `${Math.round((jobState.status === "done" ? 1 : jobState.progress ?? 0) * 100)}%` }} />
          </div>
          <div className="mt-1 flex justify-between text-[12px] text-muted">
            <span>{jobState.status === "error" ? "" : jobState.message}</span>
            {running && started && <span className="font-mono">{Math.max(0, Math.round((now - started) / 1000))} s</span>}
          </div>
        </div>
      )}
      {err && (
        <div className="mt-3 flex gap-2 rounded-md border border-rose/40 bg-rose/5 p-2 text-[12px] text-rose">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />{err}
        </div>
      )}
    </div>
  );
}
