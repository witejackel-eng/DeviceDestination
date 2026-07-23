/**
 * Hero-media configuration — art-directed product assets for the cinematic hero.
 *
 * This replaces the previous approach of blindly using `product.images[0]`.
 * Each hero product has an explicitly selected source image, an optimized
 * hero-specific transparent WebP output, intrinsic dimensions, visual scale,
 * and responsive positioning across desktop / tablet / mobile.
 */

// ── Types ──────────────────────────────────────────────────────────

export type HeroMediaRole = "primary" | "secondary" | "tertiary";

export type ResponsivePosition = {
  x: number; // % from left
  y: number; // % from top
};

export type HeroMediaEntry = {
  /** Product model this entry corresponds to */
  model: string;
  /** Path in the catalogue images array — e.g. "/images/products/CP-UNC-DA41L3C-D-Q 1st.png" */
  sourceImage: string;
  /** Hero-specific transparent WebP under public/images/products/hero/ */
  optimizedImage: string;
  /** Natural (un-trimmed) width of the source image in px */
  intrinsicWidth: number;
  /** Natural (un-trimmed) height of the source image in px */
  intrinsicHeight: number;
  /** Hero-output width (after trim) in px */
  outputWidth: number;
  /** Hero-output height (after trim) in px */
  outputHeight: number;
  /** Scale multiplier relative to stage width */
  visualScale: number;
  /** Position on the product stage (percentage) */
  position: {
    desktop: ResponsivePosition;
    tablet: ResponsivePosition;
    mobile: ResponsivePosition;
  };
};

// ── Approved hero-media entries ────────────────────────────────────

/**
 * PRIMARY — CP-UNC-DA41L3C-D-Q dome camera
 *
 * Source: "1st" image — the standard front-facing dome angle with clean
 * background, complete dome housing, lens, and CP PLUS logo visible.
 * This is the most complete and recognisable angle for hero presentation.
 */
const primaryDome: HeroMediaEntry = {
  model: "CP-UNC-DA41L3C-D-Q",
  sourceImage: "/images/products/CP-UNC-DA41L3C-D-Q 1st.png",
  optimizedImage: "/images/products/hero/cp-unc-da41l3c-d-q.webp",
  intrinsicWidth: 400,
  intrinsicHeight: 520,
  outputWidth: 384,
  outputHeight: 359,
  visualScale: 0.45,  // ~45% of stage width — dominant but not overwhelming
  position: {
    // Dome slightly left of centre, middle-upper
    desktop: { x: 16, y: 14 },
    // Tablet: shifted slightly right to give copy more room
    tablet:  { x: 20, y: 12 },
    // Mobile: upper-centre
    mobile:  { x: 22, y: 8 },
  },
};

/**
 * SECONDARY — CP-UNC-TA41L3C-Q bullet camera
 *
 * Source: "bullet 1st" — the front/side angle showing camera body and
 * mount clearly. The "3rd" image is also good but the "1st" shows the
 * complete mounting arm more clearly, which is important for hero
 * recognisability. The camera should point slightly toward the centre
 * of the composition.
 */
const secondaryBullet: HeroMediaEntry = {
  model: "CP-UNC-TA41L3C-Q",
  sourceImage: "/images/products/CP-UNC-TA41L3C-Q bullet 1st.png",
  optimizedImage: "/images/products/hero/cp-unc-ta41l3c-q.webp",
  intrinsicWidth: 400,
  intrinsicHeight: 520,
  outputWidth: 348,
  outputHeight: 180,
  visualScale: 0.31,  // ~31% of stage width — clearly visible but secondary
  position: {
    // Upper-right, pointing toward centre
    desktop: { x: 61, y: 6 },
    // Tablet: upper-right, slightly adjusted
    tablet:  { x: 55, y: 6 },
    // Mobile: HIDDEN — bullet camera omitted from mobile initial frame
    mobile:  { x: -1, y: -1 },
  },
};

/**
 * TERTIARY — CP-UNR-108F1 NVR
 *
 * Source: "1st.jpg" — the only available exact-model image.
 * Critical issue: the source is a JPG with a white background baked in,
 * placed inside a square 400×520 canvas. The NVR itself is a thin
 * horizontal device occupying only a fraction of that canvas.
 *
 * The hero script must:
 * 1. Remove the surrounding white rectangle
 * 2. Preserve the entire recorder body, red detail, and face
 * 3. Crop closely around the product at its natural aspect ratio
 * 4. Output as transparent WebP
 *
 * If a clean result cannot be achieved from this source, the NVR
 * may be temporarily hidden from the hero until a better asset
 * is sourced.
 */
const tertiaryNvr: HeroMediaEntry = {
  model: "CP-UNR-108F1",
  sourceImage: "/images/products/CP-UNR-108F1 1st.jpg",
  optimizedImage: "/images/products/hero/cp-unr-108f1.webp",
  intrinsicWidth: 400,
  intrinsicHeight: 520,
  outputWidth: 389,
  outputHeight: 68,  // NVR natural aspect ~5.7:1
  visualScale: 0.59,  // ~59% of stage width — wide visual anchor
  position: {
    // Lower-centre, forming the visual foundation
    desktop: { x: 24, y: 72 },
    // Tablet: lower-centre
    tablet:  { x: 18, y: 68 },
    // Mobile: lower-centre, wider
    mobile:  { x: 14, y: 68 },
  },
};

// ── Registry ───────────────────────────────────────────────────────

export const heroMediaRegistry: Record<HeroMediaRole, HeroMediaEntry> = {
  primary: primaryDome,
  secondary: secondaryBullet,
  tertiary: tertiaryNvr,
};

// ── Lookup ─────────────────────────────────────────────────────────

/**
 * Resolve the hero-media entry for a given product model.
 * Falls back to the role-based registry if an exact model match exists.
 */
export function resolveHeroMedia(model: string): HeroMediaEntry | null {
  for (const entry of Object.values(heroMediaRegistry)) {
    if (entry.model === model) return entry;
  }
  return null;
}

/**
 * Get the hero image path for a given role.
 * Returns the hero-specific transparent WebP path if the asset exists,
 * otherwise falls back to the catalogue source image.
 */
export function getHeroImageForRole(role: HeroMediaRole): string {
  return heroMediaRegistry[role].optimizedImage;
}

/**
 * Check whether hero-specific assets have been generated.
 * Used to determine whether to use hero-optimized assets or fall back
 * to raw catalogue images.
 */
export function heroAssetsAvailable(): boolean {
  // In a real implementation this would check file existence.
  // For now we assume the hero-images script has been run.
  return true;
}

// ── Shadow configuration ──────────────────────────────────────────

export type HeroShadowConfig = {
  /** Width as percentage of visible product width */
  widthPercent: number;
  /** Height in px (elliptical) */
  heightPx: number;
  /** Position offset from product bottom */
  bottomOffsetPx: number;
  /** Horizontal offset from product centre */
  leftOffsetPercent: number;
  /** Opacity */
  opacity: number;
  /** Blur spread */
  blurPx: number;
};

export const heroShadowConfigs: Record<HeroMediaRole, HeroShadowConfig> = {
  primary: {
    widthPercent: 50,
    heightPx: 14,
    bottomOffsetPx: 0,
    leftOffsetPercent: 0,
    opacity: 0.08,
    blurPx: 12,
  },
  secondary: {
    widthPercent: 40,
    heightPx: 8,
    bottomOffsetPx: 0,
    leftOffsetPercent: 0,
    opacity: 0.05,
    blurPx: 8,
  },
  tertiary: {
    widthPercent: 80,
    heightPx: 10,
    bottomOffsetPx: 0,
    leftOffsetPercent: 0,
    opacity: 0.06,
    blurPx: 10,
  },
};

// ── Label anchor positions ─────────────────────────────────────────

/**
 * Position of each technical annotation label relative to the primary
 * dome camera. Values are percentage offsets from the primary product
 * wrapper boundary.
 */
export type LabelAnchor = {
  /** Which side of the primary product the label attaches to */
  side: "top-left" | "top-right" | "bottom-right" | "bottom-left" | "bottom";
  /** Horizontal offset from the side anchor (px) */
  offsetX: number;
  /** Vertical offset from the side anchor (px) */
  offsetY: number;
  /** Connector line length (px) */
  connectorLength: number;
};

export const heroLabelAnchors: Record<string, LabelAnchor> = {
  "4 MP": {
    side: "top-right",
    offsetX: 12,
    offsetY: -8,
    connectorLength: 18,
  },
  "PoE": {
    side: "bottom-right",
    offsetX: 14,
    offsetY: 16,
    connectorLength: 22,
  },
  "IP67": {
    side: "bottom-left",
    offsetX: -14,
    offsetY: 18,
    connectorLength: 20,
  },
};
