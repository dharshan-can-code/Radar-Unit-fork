import type { Manifest } from "@/lib/data";

function Scatter({ title, tone, children, caption }: { title: string; tone: "cyan" | "green" | "amber"; children: React.ReactNode; caption: string }) {
  const color = `var(--${tone})`;
  return (
    <figure className="rounded-xl border border-line bg-panel p-4">
      <svg viewBox="0 0 220 140" className="w-full" role="img" aria-label={title}>
        <defs>
          <marker id={`ar-${tone}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0L10 5L0 10z" fill={color} />
          </marker>
        </defs>
        {children}
      </svg>
      <figcaption className="mt-2">
        <div className="text-sm font-semibold" style={{ color }}>{title}</div>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">{caption}</p>
      </figcaption>
    </figure>
  );
}

export function ScienceExplainer() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {[
          ["SAR is active radar", "NISAR transmits its own microwave pulses and records the echo, so it measures day and night and through cloud. A synthetic aperture — combining echoes along the orbit — gives fine resolution from a small antenna."],
          ["L-band: 24 cm waves", "NISAR's L-band wavelength is long enough to pass partly through leaves and small branches and interact with trunks and the ground below. Shorter C-band (≈5.6 cm, e.g. Sentinel-1) interacts more with the top of the canopy."],
          ["HH and HV", "HH: sent and received horizontally — strong for smooth-surface and trunk-ground (double bounce) reflections. HV: sent horizontal, received vertical — produced mainly by random volume scattering in vegetation."],
        ].map(([t, d]) => (
          <div key={t} className="rounded-xl border border-line bg-panel p-5">
            <div className="text-sm font-semibold text-accent">{t}</div>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">{d}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Scatter title="Open water → very dark" tone="cyan" caption="Calm water acts like a mirror: the pulse reflects away from the satellite, so very little returns. Wind or waves can roughen water and brighten it.">
          <rect x="0" y="105" width="220" height="35" fill="var(--ill-water)" />
          <line x1="40" y1="10" x2="110" y2="105" stroke="var(--cyan)" strokeWidth="2" markerEnd="url(#ar-cyan)" />
          <line x1="110" y1="105" x2="180" y2="10" stroke="var(--cyan)" strokeWidth="2" strokeDasharray="4 3" markerEnd="url(#ar-cyan)" />
          <text x="30" y="10" fill="var(--muted)" fontSize="9">NISAR</text>
          <text x="140" y="30" fill="var(--muted)" fontSize="9">reflected away</text>
        </Scatter>
        <Scatter title="Dry forest → volume scattering" tone="green" caption="Leaves and branches scatter the wave in many directions. Some returns, including a relatively strong HV (cross-polarised) part.">
          <rect x="0" y="118" width="220" height="22" fill="var(--ill-soil)" />
          {[50, 95, 140, 185].map((x) => (
            <g key={x}><rect x={x - 3} y="70" width="6" height="48" fill="var(--ill-trunk)" /><circle cx={x} cy="62" r="22" fill="var(--ill-leaf)" opacity="0.85" /></g>
          ))}
          <line x1="20" y1="8" x2="90" y2="58" stroke="var(--green)" strokeWidth="2" markerEnd="url(#ar-green)" />
          {[[-30, -18], [-10, -30], [15, -25], [28, -8]].map(([dx, dy], i) => (
            <line key={i} x1="92" y1="60" x2={92 + dx} y2={60 + dy} stroke="var(--green)" strokeWidth="1.3" markerEnd="url(#ar-green)" />
          ))}
        </Scatter>
        <Scatter title="Flooded forest → double bounce" tone="amber" caption="Water under the trees reflects the pulse into the trunks, which send it straight back — a corner reflector. HH becomes very bright while HV changes less. Buildings do the same.">
          <rect x="0" y="112" width="220" height="28" fill="var(--ill-water)" />
          {[60, 120, 180].map((x) => (
            <g key={x}><rect x={x - 3} y="62" width="6" height="50" fill="var(--ill-trunk)" /><circle cx={x} cy="54" r="20" fill="var(--ill-leaf)" opacity="0.55" /></g>
          ))}
          <line x1="20" y1="10" x2="96" y2="111" stroke="var(--amber)" strokeWidth="2" markerEnd="url(#ar-amber)" />
          <line x1="96" y1="111" x2="116" y2="92" stroke="var(--amber)" strokeWidth="2" />
          <line x1="116" y1="92" x2="40" y2="-8" stroke="var(--amber)" strokeWidth="2" strokeDasharray="4 3" markerEnd="url(#ar-amber)" />
        </Scatter>
      </div>

      <div className="rounded-xl border border-rose/30 bg-rose/5 p-5">
        <div className="text-sm font-semibold text-rose">Why radar alone cannot prove flooding</div>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          Backscatter responds to surface roughness, geometry and moisture together. Bright double-bounce returns come from flooded
          trees <em>and</em> from buildings; dark returns come from calm water <em>and</em> from very smooth soil or radar shadow; rain-wet
          leaves, crop growth and harvest all change the signal too. DELTA PULSE therefore reports what was measured and which
          explanations are consistent with it, and lists the independent evidence that would be needed to confirm inundation.
        </p>
      </div>
    </div>
  );
}

export function Methods({ m }: { m: Manifest | null }) {
  const s = m?.screening;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-line bg-panel p-5">
        <div className="text-sm font-semibold">Processing chain</div>
        {m ? (
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-[13px] text-muted">
            {m.processing.steps.map((s) => <li key={s}>{s}</li>)}
          </ol>
        ) : <p className="mt-2 text-sm text-muted">No processed data loaded.</p>}
        <p className="mt-3 font-mono text-[11px] text-muted">Reproduce: {m?.processing.script} · generated {m?.generated_utc}</p>
        <div className="mt-4 text-sm font-semibold">Observations in this analysis</div>
        <div className="mt-2 max-h-56 overflow-auto rounded border border-line">
          <table className="w-full text-left font-mono text-[11px]">
            <thead className="sticky top-0 bg-panel-2 text-muted"><tr><th className="p-1.5">date</th><th>channels</th><th>maturity</th><th>release</th><th>valid</th><th>retrieved</th></tr></thead>
            <tbody>
              {m?.observations.map((o) => (
                <tr key={o.id} className="border-t border-line/60" title={o.scene}>
                  <td className="p-1.5">{o.date}</td><td>{o.channels.join("+")}</td><td>{o.maturity}</td><td>{o.crid}</td><td>{(o.valid_fraction * 100).toFixed(0)}%</td><td>{o.downloaded_utc?.slice(0, 10) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="rounded-xl border border-line bg-panel p-5">
        <div className="flex items-baseline justify-between">
          <div className="text-sm font-semibold">Screening thresholds</div>
          {s && <span className="rounded border border-rose/40 bg-rose/10 px-1.5 py-0.5 font-mono text-[11px] text-rose">{s.status}</span>}
        </div>
        {s && (
          <>
            <p className="mt-2 text-[13px] text-muted">{s.note}</p>
            <table className="mt-3 w-full text-left text-[12px]">
              <tbody>
                {[
                  ["Open water: HH below", s.open_water.hh_max_db],
                  ["Open water: HV below", s.open_water.hv_max_db],
                  ["Double bounce: HH above", s.double_bounce.hh_min_db],
                  ["Double bounce: HH−HV above", s.double_bounce.hh_minus_hv_min_db],
                  ["Significant change", s.change.significant_db],
                ].map(([k, t]) => {
                  const th = t as { value: number; why: string };
                  return (
                    <tr key={k as string} className="border-t border-line/60 align-top">
                      <td className="py-2 pr-2 text-text">{k as string}</td>
                      <td className="py-2 pr-2 font-mono text-amber">{th.value} dB</td>
                      <td className="py-2 text-muted">{th.why}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
        <div className="mt-4 text-sm font-semibold">Known limitations</div>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-muted">
          <li>NISAR products before 21 Oct 2026 are PROVISIONAL (calibrated, partially validated); they are not mixed with VALIDATED data here.</li>
          <li>About five months of data: seasonal, not multi-year. No trend or dam-impact claims are possible yet.</li>
          <li>Speckle: values are averaged in linear power over {m ? `${m.display.res_m} m (layers) and ${m.grid.res_m} m (fingerprint)` : "100 m (layers) and 200 m (fingerprint)"} cells.</li>
          <li>Map overlays are UTM rasters warped to web-map corners; small (&lt; 1 cell) positional distortion is possible at the edges.</li>
          <li>The independent checks (Landsat water history, a river-flow model, wind records) cover the Tonle Sap case study only, and none of them is a ground measurement. Nothing is labelled as confirmed flooding.</li>
        </ul>
      </div>
    </div>
  );
}
