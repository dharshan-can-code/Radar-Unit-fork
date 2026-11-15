"use client";
// Buttons for the worldwide examples (real live analyses saved as static files),
// so the hosted app shows places beyond Tonle Sap even without the backend.
import { useEffect, useState } from "react";
import { Globe2, Loader2 } from "lucide-react";
import type { LiveResult } from "@/components/LiveSearch";
import { ExampleInfo, loadExample, loadExamples } from "@/lib/data";

export default function ExamplePicker({ onResult, accent = "cyan", label = "Try a real example" }: {
  onResult: (r: LiveResult) => void; accent?: "cyan" | "amber"; label?: string;
}) {
  const [items, setItems] = useState<ExampleInfo[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { loadExamples().then(setItems).catch(() => setItems([])); }, []);
  if (!items.length) return null;

  async function open(x: ExampleInfo) {
    setBusy(x.id); setErr(null);
    try {
      const m = await loadExample(x.id);
      if (!m) throw new Error("This example could not be loaded.");
      onResult({ manifest: m, footprint: x.footprint, checkedUtc: null });
    } catch (e) {
      setErr((e as Error).message);
    } finally { setBusy(null); }
  }

  const ring = accent === "amber" ? "hover:border-amber/60 hover:text-amber" : "hover:border-cyan/60 hover:text-cyan";
  return (
    <div className="mt-3">
      <div className="flex items-center gap-1.5 text-[12px] text-muted"><Globe2 size={13} />{label}: real NISAR analyses, saved so they open instantly</div>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {items.map((x) => (
          <button key={x.id} onClick={() => open(x)} disabled={busy !== null}
            className={`rounded-lg border border-line bg-panel px-3 py-2 text-left text-[12px] transition-colors disabled:opacity-50 ${ring}`}>
            <div className="flex items-center gap-1.5 font-semibold text-text">
              {busy === x.id && <Loader2 size={12} className="animate-spin" />}{x.name}
            </div>
            <div className="mt-0.5 text-muted">{x.blurb}</div>
            <div className="mt-1 font-mono text-[10px] text-muted">{x.n_obs} passes · {x.first} → {x.last} · {x.maturity.toLowerCase()}</div>
          </button>
        ))}
      </div>
      {err && <p className="mt-2 text-[12px] text-rose">{err}</p>}
    </div>
  );
}
