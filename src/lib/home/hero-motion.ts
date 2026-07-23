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

// Product transforms per scroll stage
export const productTransforms = {
  primary: {
    introduction: { x: 0, y: 0, scale: 1, rotation: 0 },
    identify: { x: -7, y: -3, scale: 1.08, rotation: -1 },
    connect: { x: -15, y: -8, scale: 0.96, rotation: 0 },
    resolve: { x: -15, y: -8, scale: 0.96, rotation: 0 },
  },
  secondary: {
    introduction: { x: 0, y: 0, scale: 1, opacity: 1 },
    identify: { x: 10, y: -5, scale: 0.92, opacity: 0.72 },
    connect: { x: 20, y: -10, scale: 0.87, opacity: 1 },
    resolve: { x: 20, y: -10, scale: 0.87, opacity: 1 },
  },
  tertiary: {
    introduction: { x: 0, y: 0, scale: 1, opacity: 1 },
    identify: { x: 0, y: 7, scale: 0.9, opacity: 0.66 },
    connect: { x: 1, y: 22, scale: 1.04, opacity: 1 },
    resolve: { x: 1, y: 22, scale: 1.04, opacity: 1 },
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
