export const fonts = {
  CLASH_DISPLAY_BOLD: 'ClashDisplay-Bold',
  CLASH_DISPLAY_EXTRA_LIGHT: 'ClashDisplay-Extralight',
  CLASH_DISPLAY_LIGHT: 'ClashDisplay-Light',
  CLASH_DISPLAY_MEDIUM: 'ClashDisplay-Medium',
  CLASH_DISPLAY_REGULAR: 'ClashDisplay-Regular',
  CLASH_DISPLAY_SEMIBOLD: 'ClashDisplay-Semibold',
  CLASH_DISPLAY_VARIABLE: 'ClashDisplay-Variable',
  CLASH_GRO_MEDIUM: 'ClashGrotesk-Medium',
  SATOSHI_BLACK: 'Satoshi-Black',
  SATOSHI_BOLD: 'Satoshi-Bold',
  SATOSHI_LIGHT: 'Satoshi-Light',
  SATOSHI_MEDIUM: 'Satoshi-Medium',
  SATOSHI_REGULAR: 'Satoshi-Regular',
  SF_PRO_TEXT_SEMIBOLD: 'SFProText-semibold',
  SF_PRO_TEXT_REGULAR: 'SFProText-regular',
} as const;

export const fontSizes = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
  '5xl': 48,
  '6xl': 60,
} as const;

export const fontWeights = {
  light: '300' as const,
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  black: '900' as const,
} as const;

export const lineHeights = {
  none: 1,
  tight: 1.25,
  snug: 1.375,
  normal: 1.5,
  relaxed: 1.625,
  loose: 2,
} as const;

export const typography = {
  // Headings
  h1: {
    fontFamily: fonts.CLASH_DISPLAY_BOLD,
    fontSize: fontSizes['4xl'],
    lineHeight: fontSizes['4xl'] * lineHeights.tight,
    fontWeight: fontWeights.bold,
  },
  h2: {
    fontFamily: fonts.CLASH_DISPLAY_BOLD,
    fontSize: fontSizes['3xl'],
    lineHeight: fontSizes['3xl'] * lineHeights.tight,
    fontWeight: fontWeights.bold,
  },
  h3: {
    fontFamily: fonts.CLASH_GRO_MEDIUM, // matches "Clash Grotesk Medium"
    fontSize: 26, // exact from Figma
    lineHeight: 26 * 1.2, // 120% → 31.2px
    fontWeight: fontWeights.medium, // 500
    letterSpacing: -0.26, // matches design
  },
  h4: {
    fontFamily: fonts.CLASH_DISPLAY_SEMIBOLD,
    fontSize: fontSizes.xl,
    lineHeight: fontSizes.xl * lineHeights.snug,
    fontWeight: fontWeights.semibold,
  },
  h5: {
    fontFamily: fonts.CLASH_DISPLAY_MEDIUM,
    fontSize: fontSizes.lg,
    lineHeight: fontSizes.lg * lineHeights.normal,
    fontWeight: fontWeights.medium,
  },
  h6: {
    fontFamily: fonts.CLASH_DISPLAY_MEDIUM,
    fontSize: fontSizes.base,
    lineHeight: fontSizes.base * lineHeights.normal,
    fontWeight: fontWeights.medium,
  },
  titleLarge: {
    fontFamily: fonts.CLASH_GRO_MEDIUM,
    fontSize: fontSizes.xl,
    lineHeight: fontSizes.xl * 1.2,
    fontWeight: fontWeights.medium,
    letterSpacing: -0.2,
  },
  titleMedium: {
    fontFamily: fonts.CLASH_GRO_MEDIUM,
    fontSize: fontSizes.lg,
    lineHeight: fontSizes.lg * 1.2,
    fontWeight: fontWeights.medium,
    letterSpacing: -0.18,
  },
  titleSmall: {
    fontFamily: fonts.CLASH_GRO_MEDIUM,
    fontSize: fontSizes.base,
    lineHeight: fontSizes.base * 1.2,
    fontWeight: fontWeights.medium,
    letterSpacing: -0.16,
  },
  paragraph: {
    fontFamily: fonts.SATOSHI_REGULAR,
    fontSize: fontSizes.base,
    lineHeight: fontSizes.base * 1.2,
    fontWeight: fontWeights.normal,
    letterSpacing: -0.32,
  },
  paragraphBold: {
    fontFamily: fonts.SATOSHI_BOLD,
    fontSize: fontSizes.base,
    lineHeight: fontSizes.base * 1.2,
    fontWeight: fontWeights.bold,
    letterSpacing: -0.32,
  },
  cta: {
    fontFamily: fonts.CLASH_GRO_MEDIUM,
    fontSize: 18,
    lineHeight: 18,
    fontWeight: fontWeights.medium,
    letterSpacing: -0.18,
  },

  // Body text
  bodyLarge: {
    fontFamily: fonts.SATOSHI_REGULAR,
    fontSize: fontSizes.lg,
    lineHeight: fontSizes.lg * lineHeights.relaxed,
    fontWeight: fontWeights.normal,
  },
  body: {
    fontFamily: fonts.SATOSHI_REGULAR,
    fontSize: fontSizes.base,
    lineHeight: fontSizes.base * lineHeights.normal,
    fontWeight: fontWeights.normal,
  },
  bodySmall: {
    fontFamily: fonts.SATOSHI_REGULAR,
    fontSize: fontSizes.sm,
    lineHeight: fontSizes.sm * lineHeights.normal,
    fontWeight: fontWeights.normal,
  },
  bodySmallTight: {
    fontFamily: fonts.SATOSHI_REGULAR,
    fontSize: fontSizes.sm,
    lineHeight: fontSizes.sm * 1.4,
    fontWeight: fontWeights.normal,
  },
  bodyExtraSmall: {
    fontFamily: fonts.SATOSHI_REGULAR,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: fontWeights.normal,
  },

  // Labels
  label: {
    fontFamily: fonts.SATOSHI_MEDIUM,
    fontSize: fontSizes.base,
    lineHeight: fontSizes.base * lineHeights.normal,
    fontWeight: fontWeights.medium,
  },
  labelSmall: {
    fontFamily: fonts.SATOSHI_MEDIUM,
    fontSize: fontSizes.sm,
    lineHeight: fontSizes.sm * lineHeights.normal,
    fontWeight: fontWeights.medium,
  },
  labelXxsBold: {
    fontFamily: fonts.SATOSHI_BOLD,
    fontSize: 12,
    lineHeight: 12 * 1.2,
    fontWeight: fontWeights.bold,
    letterSpacing: 0,
  },
  labelXsBold: {
    fontFamily: fonts.SATOSHI_BOLD,
    fontSize: 13,
    lineHeight: 13 * 1.2,
    fontWeight: fontWeights.bold,
    letterSpacing: 0,
  },

  // Captions
  caption: {
    fontFamily: fonts.SF_PRO_TEXT_REGULAR,
    fontSize: fontSizes.xs,
    lineHeight: fontSizes.xs * lineHeights.normal,
    fontWeight: fontWeights.normal,
  },
  captionBold: {
    fontFamily: fonts.SF_PRO_TEXT_SEMIBOLD,
    fontSize: fontSizes.xs,
    lineHeight: fontSizes.xs * lineHeights.normal,
    fontWeight: fontWeights.semibold,
  },

  // Buttons
  button: {
    fontFamily: fonts.SATOSHI_MEDIUM,
    fontSize: fontSizes.base,
    lineHeight: fontSizes.base * lineHeights.tight,
    fontWeight: fontWeights.medium,
  },
  buttonSmall: {
    fontFamily: fonts.SATOSHI_MEDIUM,
    fontSize: fontSizes.sm,
    lineHeight: fontSizes.sm * lineHeights.none,
    fontWeight: fontWeights.medium,
  },
  screenTitle: {
    fontFamily: fonts.CLASH_GRO_MEDIUM,
    fontSize: 16,
    lineHeight: 16 * 1.2,
    fontWeight: fontWeights.medium,
    letterSpacing: -0.16,
  },
  inputLabel: {
    fontFamily: fonts.SATOSHI_BOLD,
    fontSize: 14,
    lineHeight: 16,
    fontWeight: fontWeights.bold,
    letterSpacing: -0.42,
  },
  input: {
    fontFamily: fonts.SATOSHI_REGULAR,
    fontSize: 16,
    lineHeight: 16 * 1.2,
    fontWeight: fontWeights.normal,
    letterSpacing: -0.32,
  },
  inputFilled: {
    fontFamily: fonts.SATOSHI_MEDIUM,
    fontSize: 16,
    lineHeight: 16,
    fontWeight: fontWeights.medium,
    letterSpacing: -0.48,
  },
  inputError: {
    fontFamily: fonts.SATOSHI_BOLD,
    fontSize: 14,
    lineHeight: 16,
    fontWeight: fontWeights.bold,
    letterSpacing: -0.42,
    color: '#EA3729',
  },
  tabLabelFocused: {
    fontFamily: fonts.SATOSHI_BLACK,
    fontSize: 12,
    lineHeight: 12 * 1.2,
    fontWeight: fontWeights.black,
  },
  tabLabel: {
    fontFamily: fonts.SATOSHI_MEDIUM,
    fontSize: 12,
    lineHeight: 12 * 1.2,
    fontWeight: fontWeights.medium,
  },
  h4Alt: {
    fontFamily: fonts.CLASH_GRO_MEDIUM,
    fontSize: 23,
    lineHeight: 23 * 1.2,
    fontWeight: fontWeights.medium,
    letterSpacing: -0.23,
  },
  // Custom additions to match designs precisely
  h5Clash23: {
    fontFamily: fonts.CLASH_GRO_MEDIUM, // "Clash Grotesk Medium"
    fontSize: 23,
    lineHeight: 23 * 1.2,
    fontWeight: fontWeights.medium,
    letterSpacing: -0.46,
  },
  paragraph18Bold: {
    fontFamily: fonts.SATOSHI_BOLD,
    fontSize: 18,
    lineHeight: 18 * 1.2,
    fontWeight: fontWeights.bold,
    letterSpacing: -0.36,
  },
  subtitleBold14: {
    fontFamily: fonts.SATOSHI_BOLD,
    fontSize: 14,
    lineHeight: 14 * 1.2,
    fontWeight: fontWeights.bold,
  },
  buttonH6Clash19: {
    fontFamily: fonts.CLASH_GRO_MEDIUM,
    fontSize: 19,
    lineHeight: 19 * 1.2,
    fontWeight: fontWeights.medium,
    letterSpacing: -0.38,
  },
} as const;
