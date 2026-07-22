import {
  BiometricGlyph,
  DomeCameraGlyph,
  NvrGlyph,
  PoeSwitchGlyph,
} from "@/components/illustrations/device-glyphs";

const devices = {
  dome: { Glyph: DomeCameraGlyph, tag: "F1.6 · 4MP" },
  nvr: { Glyph: NvrGlyph, tag: "NVR-8CH" },
  biometric: { Glyph: BiometricGlyph, tag: "AF-SCAN" },
  poe: { Glyph: PoeSwitchGlyph, tag: "PoE 802.3af" },
} as const;

export type HeroDevice = keyof typeof devices;

export function HeroDeviceArt({ device, className }: { device: HeroDevice; className?: string }) {
  const { Glyph, tag } = devices[device];
  return (
    <div className={`relative flex h-full w-full items-center justify-center ${className ?? ""}`}>
      <svg viewBox="0 0 100 100" aria-hidden="true" className="pointer-events-none absolute inset-2 opacity-40">
        <path d="M4,4 L4,14 M4,4 L14,4" stroke="var(--ink)" strokeWidth="1.2" fill="none" />
        <path d="M96,4 L96,14 M96,4 L86,4" stroke="var(--ink)" strokeWidth="1.2" fill="none" />
        <path d="M4,96 L4,86 M4,96 L14,96" stroke="var(--ink)" strokeWidth="1.2" fill="none" />
        <path d="M96,96 L96,86 M96,96 L86,96" stroke="var(--ink)" strokeWidth="1.2" fill="none" />
      </svg>
      <Glyph className="h-2/3 w-2/3" />
      <span className="absolute bottom-2 left-2 max-w-[85%] truncate rounded-full bg-white/92 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.07em] sm:bottom-3 sm:left-3 sm:text-[10px]">
        {tag}
      </span>
    </div>
  );
}
