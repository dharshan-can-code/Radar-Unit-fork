/** Understated space motif: thin orbital ellipses, a satellite dot and a few stars.
 *  Purely decorative (aria-hidden, no pointer events); stops moving for reduced-motion users. */
export default function Orbits({ className = "" }: { className?: string }) {
  const stars: [number, number, number][] = [
    [62, 40, 1.1], [118, 22, 0.8], [210, 64, 1.3], [340, 30, 0.9], [452, 88, 1.2], [520, 18, 0.8],
    [596, 120, 1], [400, 200, 0.7], [270, 160, 0.9], [150, 210, 1.1], [560, 260, 0.8], [48, 150, 0.7],
  ];
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 640 420" preserveAspectRatio="xMidYMid slice"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}>
      <g fill="var(--accent-soft)">
        {stars.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} opacity={0.35 + (i % 3) * 0.15} />)}
      </g>
      <g className="orbit-spin" style={{ transformOrigin: "470px 150px" }}>
        <ellipse cx="470" cy="150" rx="250" ry="88" fill="none" stroke="var(--accent-soft)" strokeOpacity="0.28" strokeWidth="1" transform="rotate(-18 470 150)" />
        <circle cx="236" cy="200" r="3" fill="var(--accent)" opacity="0.55" />
      </g>
      <ellipse cx="470" cy="150" rx="330" ry="130" fill="none" stroke="var(--accent-soft)" strokeOpacity="0.16" strokeWidth="1"
        strokeDasharray="2 6" transform="rotate(-18 470 150)" />
      <ellipse cx="470" cy="150" rx="170" ry="54" fill="none" stroke="var(--accent)" strokeOpacity="0.14" strokeWidth="1" transform="rotate(-18 470 150)" />
    </svg>
  );
}
