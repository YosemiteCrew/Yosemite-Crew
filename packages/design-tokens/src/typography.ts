/**
 * Semantic typography tokens — shared across web and mobile.
 * Font size values are in rem for web; mobile maps these to px equivalents.
 * Font families are platform-specific and defined in platform outputs.
 */

// ---------------------------------------------------------------------------
// Font size scale (rem for web, multiply by 16 for mobile px)
// ---------------------------------------------------------------------------

export const fontSize = {
  xxs: '0.625rem', // 10px
  xs: '0.75rem', // 12px
  sm: '0.875rem', // 14px
  base: '1rem', // 16px
  lg: '1.125rem', // 18px
  xl: '1.25rem', // 20px
  '2xl': '1.375rem', // 22px
  '3xl': '1.5rem', // 24px
  '4xl': '2.5rem', // 40px
  '5xl': '3rem', // 48px
} as const;

// ---------------------------------------------------------------------------
// Font weight scale
// ---------------------------------------------------------------------------

export const fontWeight = {
  light: 300,
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  black: 900,
} as const;

// ---------------------------------------------------------------------------
// Line height scale (unitless multipliers)
// ---------------------------------------------------------------------------

export const lineHeight = {
  none: 1,
  tight: 1.2,
  snug: 1.25,
  normal: 1.375,
  relaxed: 1.5,
  loose: 1.625,
} as const;

// ---------------------------------------------------------------------------
// Letter spacing scale (em)
// ---------------------------------------------------------------------------

export const letterSpacing = {
  tightest: '-0.06em',
  tighter: '-0.05em',
  tight: '-0.035em',
  snug: '-0.0275em',
  normal: '0em',
  wide: '0.025em',
} as const;

// ---------------------------------------------------------------------------
// Semantic typography roles
// Each role describes intent; platform implementations map these to actual CSS
// or React Native TextStyle values.
// ---------------------------------------------------------------------------

export const typographyRole = {
  'display-1': {
    fontSize: fontSize['5xl'], // 48px
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.tight,
    letterSpacing: letterSpacing.tightest,
  },
  'display-2': {
    fontSize: fontSize['4xl'], // 40px
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.tight,
    letterSpacing: letterSpacing.tighter,
  },
  'heading-1': {
    fontSize: '1.75rem', // 28px
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.snug,
    letterSpacing: '-0.035em',
  },
  'heading-2': {
    fontSize: fontSize['2xl'], // 22px
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.normal,
    letterSpacing: '-0.0275em',
  },
  'heading-3': {
    fontSize: fontSize.xl, // 20px
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.relaxed,
    letterSpacing: letterSpacing.normal,
  },
  'body-1': {
    fontSize: fontSize['3xl'], // 24px
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.loose,
    letterSpacing: '-0.03em',
  },
  'body-2': {
    fontSize: fontSize.xl, // 20px
    fontWeight: fontWeight.normal,
    lineHeight: lineHeight.loose,
    letterSpacing: '-0.025em',
  },
  'body-3': {
    fontSize: fontSize.lg, // 18px
    fontWeight: fontWeight.normal,
    lineHeight: lineHeight.loose,
    letterSpacing: '-0.0225em',
  },
  'body-3-emphasis': {
    fontSize: fontSize.lg, // 18px
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.loose,
    letterSpacing: letterSpacing.normal,
  },
  'body-4': {
    fontSize: fontSize.base, // 16px
    fontWeight: fontWeight.normal,
    lineHeight: lineHeight.relaxed,
    letterSpacing: letterSpacing.normal,
  },
  'body-4-emphasis': {
    fontSize: fontSize.base, // 16px
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.relaxed,
    letterSpacing: '-0.02em',
  },
  'label-1': {
    fontSize: fontSize.base, // 16px
    fontWeight: fontWeight.medium,
    lineHeight: 1,
    letterSpacing: '-0.02em',
  },
  'caption-1': {
    fontSize: fontSize.sm, // 14px
    fontWeight: fontWeight.normal,
    lineHeight: lineHeight.normal,
    letterSpacing: '-0.0175em',
  },
  'caption-2': {
    fontSize: fontSize.xs, // 12px
    fontWeight: fontWeight.normal,
    lineHeight: 1.5,
    letterSpacing: '-0.015em',
  },
} as const;

export type TypographyRole = keyof typeof typographyRole;
export type FontWeightToken = typeof fontWeight;
export type FontSizeToken = typeof fontSize;
