// Entrance timing (milliseconds)
export const entrance = {
  stageBg: { delay: 0, duration: 180 },
  texture: { delay: 100, duration: 300 },
  eyebrow: { delay: 120, duration: 400, translateY: 8 },
  heading: { delay: 200, duration: 520, translateY: 24 },
  primaryProduct: { delay: 260, duration: 520, translateX: 12, translateY: 7, scale: 0.88, rotation: 4 },
  secondaryProduct: { delay: 420, duration: 500, translateX: 35, scale: 0.9, rotation: -3 },
  tertiaryProduct: { delay: 540, duration: 540, translateX: 50, scale: 0.94 },
  copy: { delay: 700, duration: 550, translateY: 10 },
} as const;

// Scroll narrative stages
export const scrollStages = {
  introduction: { start: 0.00, end: 0.22 },
  identify: { start: 0.22, end: 0.48 },
  connect: { start: 0.48, end: 0.76 },
  resolve: { start: 0.76, end: 1.00 },
} as const;

// Spring configs
export const heroSprings = {
  entrance: { stiffness: 280, damping: 28, mass: 0.8 },
  scroll: { stiffness: 200, damping: 30, mass: 0.9 },
  pointer: { stiffness: 400, damping: 40, mass: 0.5 },
} as const;

// ── Product transforms per scroll stage ──
// Retuned to preserve visual hierarchy and respect limits:
// - Dome: dominant, never scaled beyond 1.05
// - Bullet: recognisable, never reduced below 0.88
// - NVR: visual anchor, opacity never below 0.85
// Products move from one deliberate composition to another.
export const productTransforms = {
  primary: {
    // Dome camera — dominant, slight left of centre
    introduction: { x: 0, y: 0, scale: 1, rotation: 0 },
    identify: { x: -6, y: -4, scale: 1.04, rotation: -0.5 }, // Slight scale up to emphasise, never >1.05
    connect: { x: -12, y: -6, scale: 0.97, rotation: 0 },    // Pulls slightly toward NVR
    resolve: { x: -12, y: -6, scale: 0.97, rotation: 0 },
  },
  secondary: {
    // Bullet camera — secondary, upper-right, points toward centre
    introduction: { x: 0, y: 0, scale: 1, opacity: 1 },
    identify: { x: 8, y: -4, scale: 0.94, opacity: 0.82 },  // Slight pull away during identify
    connect: { x: 14, y: -8, scale: 0.90, opacity: 1 },     // Comes forward during connect, never <0.88
    resolve: { x: 14, y: -8, scale: 0.90, opacity: 1 },
  },
  tertiary: {
    // NVR — lower visual anchor, wide and grounded
    introduction: { x: 0, y: 0, scale: 1, opacity: 1 },
    identify: { x: 0, y: 6, scale: 0.92, opacity: 0.88 },   // Slight settle, opacity never <0.85
    connect: { x: 0, y: 18, scale: 1.02, opacity: 1 },       // Lifts slightly, emphasised during connect
    resolve: { x: 0, y: 18, scale: 1.02, opacity: 1 },
  },
} as const;

// Pointer interaction limits
export const pointerLimits = {
  backgroundLight: 5,
  primary: 6,
  secondary: 8,
  tertiary: 4,
  labels: 3,
  maxRotation: 0.5,
} as const;
