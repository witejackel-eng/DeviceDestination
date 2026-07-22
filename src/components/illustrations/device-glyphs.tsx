type GlyphProps = {
  className?: string;
  accent?: boolean;
};

const STROKE = "var(--ink)";

export function DomeCameraGlyph({ className, accent = true }: GlyphProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="Dome camera">
      <rect x="18" y="8" width="28" height="7" rx="2.5" fill="var(--technical)" stroke={STROKE} strokeWidth="2" />
      <path
        d="M14,15 a18,16 0 0 0 36,0 Z"
        fill={accent ? "var(--blush)" : "var(--canvas-alt)"}
        stroke={STROKE}
        strokeWidth="2"
      />
      <circle cx="32" cy="13" r="7.5" fill="var(--canvas)" stroke={STROKE} strokeWidth="2" />
      <circle cx="32" cy="13" r="3.4" fill={accent ? "var(--tangerine)" : STROKE} />
      <path d="M20,32 L11,46 M44,32 L53,46" stroke={STROKE} strokeWidth="2" strokeDasharray="1 5" strokeLinecap="round" />
    </svg>
  );
}

export function BulletCameraGlyph({ className, accent = true }: GlyphProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="Bullet camera">
      <rect x="10" y="24" width="10" height="14" rx="3" fill="var(--technical)" stroke={STROKE} strokeWidth="2" />
      <rect x="18" y="22" width="30" height="18" rx="6" fill={accent ? "var(--blush)" : "var(--canvas-alt)"} stroke={STROKE} strokeWidth="2" />
      <circle cx="48" cy="31" r="9" fill="var(--canvas)" stroke={STROKE} strokeWidth="2" />
      <circle cx="48" cy="31" r="4" fill={accent ? "var(--tangerine)" : STROKE} />
      <path d="M13,38 L13,50 M9,50 L17,50" stroke={STROKE} strokeWidth="2" strokeLinecap="round" />
      <path d="M52,20 L58,14 M52,42 L58,48" stroke={STROKE} strokeWidth="1.6" strokeDasharray="1 4" strokeLinecap="round" />
    </svg>
  );
}

export function NvrGlyph({ className, accent = true }: GlyphProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="NVR storage">
      <rect x="8" y="18" width="48" height="30" rx="4" fill="var(--technical)" stroke={STROKE} strokeWidth="2" />
      <rect x="13" y="24" width="20" height="5" rx="1.5" fill="var(--canvas)" stroke={STROKE} strokeWidth="1.4" />
      <rect x="13" y="32" width="20" height="5" rx="1.5" fill="var(--canvas)" stroke={STROKE} strokeWidth="1.4" />
      <rect x="13" y="40" width="20" height="4" rx="1.5" fill="var(--canvas)" stroke={STROKE} strokeWidth="1.4" />
      <circle cx="47" cy="26" r="2.4" fill={accent ? "var(--tangerine)" : STROKE} />
      <rect x="40" y="36" width="5" height="6" fill="none" stroke={STROKE} strokeWidth="1.4" />
      <rect x="47" y="36" width="5" height="6" fill="none" stroke={STROKE} strokeWidth="1.4" />
    </svg>
  );
}

export function BiometricGlyph({ className, accent = true }: GlyphProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="Biometric device">
      <rect x="16" y="10" width="32" height="44" rx="7" fill="var(--technical)" stroke={STROKE} strokeWidth="2" />
      <rect x="22" y="17" width="20" height="20" rx="3" fill="var(--canvas)" stroke={STROKE} strokeWidth="1.6" />
      <path
        d="M32,20 a6,6 0 0 1 6,6 M32,20 a6,6 0 0 0 -6,6 M28,30 a4,4 0 0 1 8,0"
        fill="none"
        stroke={accent ? "var(--tangerine)" : STROKE}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="32" cy="45" r="3" fill={accent ? "var(--blush)" : "var(--canvas)"} stroke={STROKE} strokeWidth="1.6" />
    </svg>
  );
}

export function PoeSwitchGlyph({ className, accent = true }: GlyphProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="PoE switch">
      <rect x="8" y="22" width="48" height="20" rx="4" fill="var(--technical)" stroke={STROKE} strokeWidth="2" />
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <rect
          key={index}
          x={12 + index * 7}
          y="28"
          width="5"
          height="8"
          fill={accent && index === 2 ? "var(--tangerine)" : "var(--canvas)"}
          stroke={STROKE}
          strokeWidth="1.3"
        />
      ))}
      <path d="M22,42 L22,50 M22,50 L14,50 M22,50 L30,50" stroke={STROKE} strokeWidth="1.6" strokeDasharray="1 4" strokeLinecap="round" />
    </svg>
  );
}
