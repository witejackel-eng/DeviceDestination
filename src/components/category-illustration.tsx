import {
  BiometricGlyph,
  BulletCameraGlyph,
  DomeCameraGlyph,
  NvrGlyph,
  PoeSwitchGlyph,
} from "@/components/illustrations/device-glyphs";

const glyphBySlug: Record<string, typeof DomeCameraGlyph> = {
  "dome-cameras": DomeCameraGlyph,
  "color-dome-cameras": DomeCameraGlyph,
  "bullet-cameras": BulletCameraGlyph,
  "color-bullet-cameras": BulletCameraGlyph,
  "nvr-systems": NvrGlyph,
  "biometric-devices": BiometricGlyph,
  "poe-switches": PoeSwitchGlyph,
};

export function CategoryIllustration({ slug, className }: { slug: string; className?: string }) {
  const Glyph = glyphBySlug[slug] ?? NvrGlyph;
  const accent = slug.startsWith("color-");
  return <Glyph accent={accent} className={className} />;
}
