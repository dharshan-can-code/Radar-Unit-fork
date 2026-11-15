/** The drawn ground behind page headings: contour lines, as on a survey sheet. Every fifth line is an
 *  index contour and is drawn heavier, the way a topographic map marks them. Purely decorative
 *  (aria-hidden, no pointer events). The shapes are computed, so they are the same on every render. */

const TAU = Math.PI * 2;

/** One closed contour around (cx, cy). The same few harmonics bend every ring, so neighbouring
 *  rings stay roughly parallel like real terrain; `k` lets the shape drift a little as it grows. */
function ring(cx: number, cy: number, r: number, k: number, squash: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * TAU;
    const wobble = 1 + 0.16 * Math.sin(2 * a + 0.9 + k * 0.05) + 0.09 * Math.sin(3 * a + 2.2 - k * 0.08) + 0.05 * Math.sin(5 * a + 0.4 + k * 0.11);
    const x = cx + Math.cos(a) * r * wobble;
    const y = cy + Math.sin(a) * r * wobble * squash;
    pts.push(`${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return `${pts.join("")}Z`;
}

// Two rises: a large one off the right edge and a smaller one low on the left.
const RINGS = [
  ...Array.from({ length: 17 }, (_, k) => ({ d: ring(1010, 150, 46 + k * 44, k, 0.62), index: k % 5 === 2 })),
  ...Array.from({ length: 8 }, (_, k) => ({ d: ring(150, 470, 30 + k * 40, k + 3, 0.7), index: k % 5 === 1 })),
];

export default function Contours({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 1200 520" preserveAspectRatio="xMaxYMid slice"
      className={`contours pointer-events-none absolute inset-0 h-full w-full ${className}`}>
      <g fill="none" stroke="var(--contour)" vectorEffect="non-scaling-stroke">
        {RINGS.map((r, i) => (
          <path key={i} d={r.d} strokeWidth={r.index ? 1.4 : 0.7} strokeOpacity={r.index ? 0.55 : 0.34} vectorEffect="non-scaling-stroke" />
        ))}
      </g>
    </svg>
  );
}
