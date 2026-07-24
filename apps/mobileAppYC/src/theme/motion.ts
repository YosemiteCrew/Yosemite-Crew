// src/theme/motion.ts
//
// Motion tokens for the warm-bone redesign. Durations are in milliseconds so
// they drop straight into Animated / Reanimated timing configs; easing curves
// are cubic-bezier control-point tuples matching the design-system motion set.
//
// Consumers must honour reduced-motion: when the OS "reduce motion" setting is
// on, skip non-essential animation (encircle, video autoplay) and fall back to
// `durations.instant`.

export const durations = {
  instant: 0,
  fast: 150,
  normal: 300,
  slow: 500,
  slower: 700,
} as const;

/** Cubic-bezier control points: [x1, y1, x2, y2]. */
export const easings = {
  linear: [0, 0, 1, 1],
  easeIn: [0.4, 0, 1, 1],
  easeOut: [0, 0, 0.2, 1],
  easeInOut: [0.4, 0, 0.2, 1],
  spring: [0.34, 1.56, 0.64, 1],
  /** Hand-drawn ink annotation (onboarding em-word encircle). */
  ink: [0.6, 0.04, 0.28, 1],
} as const;

/** Spring config for the floating tab-bar sliding pill (kept from the current app). */
export const springs = {
  tabPill: {damping: 22, stiffness: 220},
} as const;

/** Named, semantic motions used across the redesign. */
export const motion = {
  /** 300 ms cross-fade on background / border / colour when the theme flips. */
  themeFlip: {duration: durations.normal, easing: easings.easeInOut},
  buttonPress: {duration: durations.fast, easing: easings.easeInOut},
  sheetOpen: {duration: durations.normal, easing: easings.easeOut},
  sheetClose: {duration: durations.fast, easing: easings.easeIn},
  toastEnter: {duration: durations.normal, easing: easings.spring},
  toastExit: {duration: durations.fast, easing: easings.easeIn},
  accordion: {duration: durations.normal, easing: easings.easeInOut},
  tabSwitch: {duration: durations.fast, easing: easings.easeInOut},
  /** Onboarding em-word encircle stroke. */
  encircle: {duration: 1550, delay: 800, easing: easings.ink, strokeWidth: 2.4},
} as const;

export type Motion = typeof motion;
