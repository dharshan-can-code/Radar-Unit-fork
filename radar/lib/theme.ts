// Design tokens for the places CSS variables cannot reach: MapLibre paint
// properties and canvas pixels need literal colours. Values mirror :root in
// app/globals.css; keep the two in step. Charts (SVG) use the CSS variables.

export const COLOR = {
  bg: "#0b1118",
  panel: "#14212c",
  line: "#263641",
  text: "#e9f0f3",
  muted: "#91a4b1",
  cyan: "#35c5c1",
  amber: "#e7b45d",
  green: "#6ac69d",
  rose: "#d77b72",
  blue: "#6fa3dc",
  /** Colours baked into the pipeline's PNG layers (class and change maps). */
  mapWater: "#22d3ee",
  mapVeg: "#f59e0b",
  mapDarker: "#288cff",
} as const;

/** RGB triplets for canvas ImageData. */
export const RGB = {
  mapWater: [34, 211, 238],
  mapVeg: [245, 158, 11],
  land: [38, 54, 65],
} as const;

/** Shared Recharts styling so every chart reads as one system. */
export const CHART = {
  tick: { fill: "var(--muted)", fontSize: 10, fontFamily: "var(--stack-mono)" },
  axisLine: { stroke: "var(--line)" },
  grid: "var(--line)",
  cursor: { fill: "color-mix(in srgb, var(--text) 5%, transparent)" },
  tooltip: {
    background: "var(--bg)", border: "1px solid var(--line-strong)", borderRadius: 4, fontSize: 12,
    color: "var(--text)", boxShadow: "0 8px 24px -12px rgba(0,0,0,0.8)",
  },
  tooltipLabel: { color: "var(--muted)", fontFamily: "var(--stack-mono)", fontSize: 11 },
  tooltipItem: { color: "var(--text)" },
} as const;
