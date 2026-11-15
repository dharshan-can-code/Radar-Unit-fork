"use client";
// Three steps from radar pulse to answer, and what the four evidence labels mean.
import { Radar, ScanSearch, Waves } from "lucide-react";
import { Tag } from "@/components/ui";

const STEPS = [
  { icon: <Radar size={22} />, color: "text-accent", title: "NISAR sends radar pulses",
    text: "Every 12 days the satellite beams 24 cm radio waves at the ground and records the echo. Unlike a camera, it works through cloud, rain and darkness." },
  { icon: <Waves size={22} />, color: "text-amber", title: "Water changes the echo",
    text: "Calm open water reflects the pulse away like a mirror, so it looks dark. Water under trees bounces it off the water and back up the trunks, so it looks very bright." },
  { icon: <ScanSearch size={22} />, color: "text-green", title: "We measure and check",
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
    <div className="space-y-12">
      <ol className="grid gap-x-10 gap-y-8 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="border-t border-line-strong pt-5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[13px] text-muted">Step {i + 1} of {STEPS.length}</span>
              <span className={s.color}>{s.icon}</span>
            </div>
            <h3 className="mt-4 text-xl font-medium">{s.title}</h3>
            <p className="mt-2 max-w-[42ch] text-[15px] leading-relaxed text-text/75">{s.text}</p>
          </li>
        ))}
      </ol>
      <div className="overflow-hidden rounded-lg border border-line">
        <div className="bg-panel px-5 py-4 sm:px-6">
          <h3 className="text-lg font-medium">How to read our labels</h3>
          <p className="mt-1 text-[14px] text-muted">Every sentence in the app carries one of these, so you always know how certain it is.</p>
        </div>
        <dl className="grid gap-px border-t border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {LABELS.map((l) => (
            <div key={l.kind} className="bg-bg-2 px-5 py-4 sm:px-6">
              <dt><Tag kind={l.kind} /></dt>
              <dd className="mt-2.5 text-[14px] leading-snug text-text/80">{l.text}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
