"use client";
// Three steps from radar pulse to answer, and what the four evidence labels mean.
import { Radar, ScanSearch, Waves } from "lucide-react";
import { Tag } from "@/components/Fingerprint";

const STEPS = [
  { icon: <Radar size={22} />, color: "text-cyan", title: "1. NISAR sends radar pulses",
    text: "Every 12 days the satellite beams 24 cm radio waves at the ground and records the echo. Unlike a camera, it works through cloud, rain and darkness." },
  { icon: <Waves size={22} />, color: "text-amber", title: "2. Water changes the echo",
    text: "Calm open water reflects the pulse away like a mirror, so it looks dark. Water under trees bounces it off the water and back up the trunks, so it looks very bright." },
  { icon: <ScanSearch size={22} />, color: "text-green", title: "3. We measure and check",
    text: "DELTA PULSE compares passes, finds where the echo changed, explains what could cause it, and tests the result against independent data." },
];

const LABELS: { kind: "OBSERVED" | "CALCULATED" | "INTERPRETED" | "UNCONFIRMED"; text: string }[] = [
  { kind: "OBSERVED", text: "What the satellite actually measured." },
  { kind: "CALCULATED", text: "Arithmetic on those measurements, such as areas or changes." },
  { kind: "INTERPRETED", text: "Our best explanation of what the numbers mean." },
  { kind: "UNCONFIRMED", text: "What we cannot prove yet, and the evidence still needed." },
];

export default function HowItWorks() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {STEPS.map((s) => (
          <div key={s.title} className="rounded-2xl border border-line bg-panel p-6">
            <div className={s.color}>{s.icon}</div>
            <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-text/75">{s.text}</p>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-line bg-panel/60 p-6">
        <h3 className="text-base font-semibold">How to read our labels</h3>
        <p className="mt-1 text-[14px] text-muted">Every sentence in the app carries one of these, so you always know how certain it is.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {LABELS.map((l) => (
            <div key={l.kind} className="flex flex-col gap-2">
              <span><Tag kind={l.kind} /></span>
              <span className="text-[14px] leading-snug text-text/80">{l.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
