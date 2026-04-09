/**
 * Shadow / elevation tokens — shared across web and mobile.
 * Web values are CSS box-shadow strings.
 * Mobile values are React Native shadow objects (in the mobile output).
 */

export const shadow = {
  none: '0 0 0 0 rgba(0,0,0,0)',
  xs: '0 1px 2px 0 rgba(0,0,0,0.05)',
  sm: '0 1px 3px 0 rgba(0,0,0,0.1)',
  base: '0 1px 6px 0 rgba(0,0,0,0.1)',
  md: '0 4px 6px 0 rgba(0,0,0,0.15)',
  floatingMd: '0 0 12px 0 rgba(0,0,0,0.18)',
  lg: '0 10px 15px 0 rgba(0,0,0,0.15)',
  xl: '0 20px 25px 0 rgba(0,0,0,0.25)',
} as const;

/**
 * Semantic elevation roles mapping design intent to shadow scale values.
 */
export const shadowRole = {
  card: shadow.sm,
  cardHover: shadow.md,
  modal: shadow.floatingMd,
  dropdown: shadow.md,
  toast: shadow.lg,
  tooltip: shadow.sm,
  button: shadow.none,
  header: shadow.sm,
  sidebar: shadow.xs,
} as const;

export type ShadowToken = typeof shadow;
