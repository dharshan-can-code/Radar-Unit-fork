"use client";
import { Database, RefreshCw, Satellite } from "lucide-react";
import type { AreaStatus, Manifest, Stacks } from "@/lib/data";

const fmt = (iso?: string | null) => (iso ? `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC` : "—");

/** What was checked, retrieved and processed — straight from public/data/status.json
 *  (written by scripts/refresh.py). Nothing here is estimated. */
export default function DataStatus({ status, stacks, stackId, setStackId, manifest }: {
  status: AreaStatus; stacks: Stacks | null; stackId: string | null; setStackId: (s: string) => void;
  manifest: Manifest | null;
}) {
  const processed = stacks?.stacks.filter((s) => s.processed) ?? [];
  const pending = status.tracked_not_downloaded;
  const obs = manifest?.observations ?? [];
  const latestProcessed = obs.length ? obs[obs.length - 1].date : null;
  return (
    <div className="mt-6 grid gap-3 rounded-xl border border-line bg-panel p-4 text-[13px] md:grid-cols-3">
      <div className="flex gap-3">
        <Satellite size={18} className="mt-0.5 shrink-0 text-accent" />
        <div>
          <div className="text-text">Real NISAR L2 GCOV, {status.name}</div>
          <div className="text-muted">
            Showing track {manifest?.observations[0]?.track ?? status.tracked.track}
            {manifest?.observations[0]?.direction?.[0] ?? ""} · frame {status.tracked.frame} ·{" "}
            {obs.length} acquisitions ({obs[0]?.date ?? "—"} → {latestProcessed ?? "—"}) ·{" "}
            {obs[0]?.maturity ?? ""} {obs[0]?.crid ?? ""}
          </div>
          {processed.length > 1 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {processed.map((s) => (
                <button key={s.id} onClick={() => setStackId(s.id)}
                  className={`rounded border px-2 py-0.5 font-mono text-[11px] ${s.id === stackId ? "border-accent bg-accent/15 text-accent" : "border-line text-muted"}`}>
                  {s.maturity} {s.crid} · {s.n_obs} dates
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-3">
        <RefreshCw size={18} className="mt-0.5 shrink-0 text-accent" />
        <div>
          <div className="text-text">ASF archive last checked {fmt(status.checked_utc)}</div>
          <div className="text-muted">
            Latest acquisition listed over the area: {status.latest_listed_acquisition ?? "—"}.{" "}
            {status.new_since_previous_check != null && <>New since previous check: {status.new_since_previous_check}.</>}
          </div>
          <div className="mt-1 text-[12px] text-muted">NISAR revisits every 12 days; products appear in the archive after processing, not in real time.</div>
        </div>
      </div>
      <div className="flex gap-3">
        <Database size={18} className="mt-0.5 shrink-0 text-accent" />
        <div>
          <div className="text-text">
            {status.tracked_downloaded} of {status.tracked_available} tracked acquisitions retrieved ·{" "}
            {status.stacks.reduce((n, s) => n + (s.processed ? s.n_obs ?? 0 : 0), 0)} processed
          </div>
          {pending.length > 0 && (
            <div className="text-muted">
              Available in the archive but not yet retrieved: {pending.map((p) => `${p.date}${p.maturity === "VALIDATED" ? " (VALIDATED)" : ""}`).join(", ")}.
            </div>
          )}
          {status.stacks.filter((s) => !s.processed && s.dates_downloaded.length > 0).map((s) => (
            <div key={s.id} className="text-muted">
              {s.maturity} {s.crid} ({s.dates_downloaded.join(", ")}) retrieved but not processed: {s.reason}.
            </div>
          ))}
          {pending.some((p) => p.maturity === "VALIDATED") && (
            <div className="mt-1 text-[12px] text-muted">VALIDATED products are a separate release and are kept in their own stack, never mixed with PROVISIONAL.</div>
          )}
        </div>
      </div>
    </div>
  );
}
