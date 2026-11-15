// Shared interface primitives. One look for evidence labels, segmented
// controls and the brand mark, so every section reads as the same product.
import type { Evidence } from "@/lib/data";

/* ---------- evidence labels ---------- */

export const TAG_STYLE: Record<Evidence, string> = {
  OBSERVED: "border-cyan/45 text-cyan bg-cyan/10",
  CALCULATED: "border-blue/45 text-blue bg-blue/10",
  INTERPRETED: "border-amber/45 text-amber bg-amber/10",
  UNCONFIRMED: "border-rose/50 text-rose bg-rose/10",
};

export const TAG_MEANING: Record<Evidence, string> = {
  OBSERVED: "Measured directly: by NISAR, or by a named dataset such as ERA5.",
  CALCULATED: "Arithmetic on those measurements, such as averages, areas and changes.",
  INTERPRETED: "A possible explanation of the numbers. Other explanations exist.",
  UNCONFIRMED: "Not proven. More evidence is needed before anyone relies on it.",
};

/** Each label also has its own shape, so the four classes differ without relying on colour. */
function TagGlyph({ kind }: { kind: Evidence }) {
  return (
    <svg viewBox="0 0 8 8" width="7" height="7" aria-hidden="true" className="shrink-0">
      {kind === "OBSERVED" && <circle cx="4" cy="4" r="3.5" fill="currentColor" />}
      {kind === "CALCULATED" && <rect x="0.75" y="0.75" width="6.5" height="6.5" fill="currentColor" />}
      {kind === "INTERPRETED" && <path d="M4 0.6 7.4 4 4 7.4 0.6 4Z" fill="none" stroke="currentColor" strokeWidth="1.2" />}
      {kind === "UNCONFIRMED" && <circle cx="4" cy="4" r="3" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="1.6 1.4" />}
    </svg>
  );
}

export function Tag({ kind }: { kind: Evidence }) {
  return (
    <span title={TAG_MEANING[kind]}
      className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-[3px] align-middle font-mono text-[11px] leading-none font-medium whitespace-nowrap ${TAG_STYLE[kind]}`}>
      <TagGlyph kind={kind} />{kind}
    </span>
  );
}

/* ---------- segmented control ---------- */

export interface SegOption { v: string; label: string; icon?: React.ReactNode; disabled?: boolean; title?: string }

export function Segmented({ value, onChange, options, label, tone = "cyan" }: {
  value: string; onChange: (v: string) => void; options: SegOption[]; label: string; tone?: "cyan" | "amber";
}) {
  const on = tone === "amber" ? "bg-amber/15 text-amber" : "bg-cyan/15 text-cyan";
  return (
    <div role="group" aria-label={label} className="no-scrollbar flex max-w-full shrink-0 overflow-x-auto rounded-md border border-line bg-bg-2">
      {options.map((o) => (
        <button key={o.v} type="button" disabled={o.disabled} aria-pressed={value === o.v} onClick={() => onChange(o.v)}
          title={o.disabled ? "Not available for this pair" : o.title}
          className={`flex items-center gap-1.5 border-l border-line px-2 py-1.5 whitespace-nowrap first:border-l-0 sm:px-3 ${value === o.v ? on : "text-muted hover:bg-panel hover:text-text"} disabled:opacity-35`}>
          {o.icon && <span className="hidden sm:inline-flex">{o.icon}</span>}{o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- brand ---------- */

export function BrandMark({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} aria-hidden="true">
      <circle cx="10" cy="10" r="8.25" fill="none" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.5" />
      <path d="M10 10V1.75A8.25 8.25 0 0 1 18.25 10Z" fill="currentColor" fillOpacity="0.28" />
      <path d="M10 10V1.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="10" cy="10" r="1.6" fill="currentColor" />
    </svg>
  );
}

/* ---------- small layout helpers ---------- */

/** A labelled value in a readout row: label in interface type, value in mono. */
export function Readout({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="mt-0.5 truncate font-mono text-[13px] text-text">{children}</dd>
    </div>
  );
}
