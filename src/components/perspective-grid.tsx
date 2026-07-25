/**
 * Original technical backdrop for the hero: a receding floor grid plus a faint
 * vertical lattice, drawn as one static SVG. Pure CSS/SVG — no canvas, no WebGL,
 * no raster asset — so it costs nothing at runtime and scales at any width.
 *
 * A radial mask fades the lines out through the centre so headline and body copy
 * always sit on near-flat canvas, and strengthens them toward the edges to give
 * the section depth.
 */
export function PerspectiveGrid({ className = "" }: { className?: string }) {
  // Floor lines converge on a vanishing point above the horizon; spacing follows
  // a squared progression so the recession reads as perspective rather than a
  // plain grid in a skewed box.
  const horizon = 340;
  const vanishX = 600;
  const verticals = Array.from({ length: 25 }, (_, index) => (index - 12) * 100);
  const depths = Array.from({ length: 12 }, (_, index) => (index + 1) / 12);

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      <svg
        viewBox="0 0 1200 760"
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
        focusable="false"
      >
        <defs>
          <radialGradient id="dd-grid-fade" cx="50%" cy="46%" r="62%">
            <stop offset="0%" stopColor="#000" stopOpacity="0" />
            <stop offset="42%" stopColor="#000" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#000" stopOpacity="1" />
          </radialGradient>
          <mask id="dd-grid-mask">
            <rect width="1200" height="760" fill="url(#dd-grid-fade)" />
          </mask>
        </defs>

        <g mask="url(#dd-grid-mask)" stroke="var(--ink)" strokeOpacity="0.14" fill="none">
          {/* Receding floor: rays to the vanishing point. */}
          {verticals.map((offset) => (
            <line
              key={`ray-${offset}`}
              x1={vanishX + offset}
              y1={horizon}
              x2={vanishX + offset * 7}
              y2={760}
              strokeWidth="1"
            />
          ))}
          {/* Horizontal rungs, tightening toward the horizon. */}
          {depths.map((step) => {
            const y = horizon + (760 - horizon) * step * step;
            return <line key={`rung-${step}`} x1="0" y1={y} x2="1200" y2={y} strokeWidth="1" />;
          })}
          {/* Faint upper lattice so the space above the horizon is not empty. */}
          {Array.from({ length: 13 }, (_, index) => index * 100).map((x) => (
            <line key={`lattice-${x}`} x1={x} y1="0" x2={x} y2={horizon} strokeWidth="1" strokeOpacity="0.5" />
          ))}
          {[80, 160, 240, 320].map((y) => (
            <line key={`lattice-h-${y}`} x1="0" y1={y} x2="1200" y2={y} strokeWidth="1" strokeOpacity="0.5" />
          ))}
        </g>
      </svg>
    </div>
  );
}
