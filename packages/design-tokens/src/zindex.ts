/**
 * Z-index / layering tokens — shared semantic layer contract.
 * Web uses these directly as CSS z-index values.
 * Mobile uses zIndex in StyleSheet or Animated.
 */

export const zIndex = {
  base: 0,
  raised: 10,
  dropdown: 100,
  sticky: 200,
  overlay: 300,
  modal: 400,
  toast: 500,
  tooltip: 600,
  max: 9999,
} as const;

export type ZIndexToken = typeof zIndex;
