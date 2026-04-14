/**
 * Border radius tokens — shared across web and mobile.
 * Web values are in rem; mobile uses px equivalents.
 */

export const radius = {
  none: '0rem',
  xs: '0.25rem', // 4px
  sm: '0.5rem', // 8px
  md: '0.75rem', // 12px
  lg: '1rem', // 16px  — primary card/button radius
  xl: '1.5rem', // 24px  — rounded-2xl (Tailwind default used in app)
  '2xl': '2rem', // 32px
  full: '9999px', // pill / circle
} as const;

/**
 * Semantic radius roles mapping design intent to scale values.
 */
export const radiusRole = {
  button: radius.xl, // rounded-2xl — matches current button primitives
  card: radius.xl, // rounded-2xl — matches current card primitives
  input: radius.xl, // rounded-2xl — matches current input primitives
  modal: radius.xl, // rounded-2xl
  badge: radius.full, // pill shape
  avatar: radius.full, // circle
  chip: radius.full, // pill chip
  tooltip: radius.lg, // 16px
  dropdown: radius.lg, // 16px
} as const;

export type RadiusToken = typeof radius;
