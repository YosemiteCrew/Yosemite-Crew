/**
 * Motion / animation tokens — shared across web and mobile.
 * Duration values are in milliseconds.
 * Easing values are CSS cubic-bezier strings for web;
 * mobile consumers should map these to equivalent Animated/Reanimated curves.
 */

export const duration = {
  instant: 0,
  fast: 150,
  normal: 300,
  slow: 500,
  slower: 700,
} as const;

export const easing = {
  linear: 'linear',
  easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
  easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const;

/**
 * Semantic motion roles mapping design intent to duration + easing pairs.
 */
export const motionRole = {
  buttonHover: {
    duration: duration.normal,
    easing: easing.easeInOut,
  },
  modalOpen: {
    duration: duration.normal,
    easing: easing.easeOut,
  },
  modalClose: {
    duration: duration.fast,
    easing: easing.easeIn,
  },
  toastEnter: {
    duration: duration.normal,
    easing: easing.spring,
  },
  toastExit: {
    duration: duration.fast,
    easing: easing.easeIn,
  },
  accordionExpand: {
    duration: duration.normal,
    easing: easing.easeInOut,
  },
  tabTransition: {
    duration: duration.fast,
    easing: easing.easeInOut,
  },
} as const;

export type DurationToken = typeof duration;
export type EasingToken = typeof easing;
