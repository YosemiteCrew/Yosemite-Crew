import {TextStyle} from 'react-native';

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
  xxs: 10,
  xs: 12,
  '13': 13,
  sm: 14,
  '15': 15,
  base: 16,
  '17': 17,
  lg: 18,
  '19': 19,
  xl: 20,
  '23': 23,
  '2xl': 24,
  '26': 26,
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

const createTextStyle = (
  size: number,
  lineHeight: number,
  family: string,
  weight: TextStyle['fontWeight'],
  letterSpacing = 0,
): TextStyle => ({
  fontFamily: family,
  fontSize: size,
  lineHeight,
  fontWeight: weight,
  letterSpacing,
});

const h1Size = fontSizes['4xl']; // 36
const h2Size = fontSizes['3xl']; // 30
const h3Size = fontSizes['26']; // 26
const h4Size = fontSizes.xl; // 20
const h5Size = fontSizes.lg; // 18
const h6Size = fontSizes.base; // 16

const bodySize = fontSizes.base; // 16
const bodySmallSize = fontSizes.sm; // 14
const bodyXsSize = fontSizes.xs; // 12

const bodyLineHeight = Math.round(bodySize * 1.5); // 24
const bodySmallLineHeight = Math.round(bodySmallSize * 1.45); // 20
const bodyXsLineHeight = Math.round(bodyXsSize * 1.5); // 18

const h1: TextStyle = createTextStyle(
  h1Size,
  Math.round(h1Size * 1.2),
  fonts.CLASH_DISPLAY_BOLD,
  fontWeights.bold,
  -0.4,
);
const h2: TextStyle = createTextStyle(
  h2Size,
  Math.round(h2Size * 1.25),
  fonts.CLASH_DISPLAY_SEMIBOLD,
  fontWeights.semibold,
  -0.32,
);
const h3: TextStyle = createTextStyle(
  h3Size,
  Math.round(h3Size * 1.25),
  fonts.CLASH_GRO_MEDIUM,
  fontWeights.medium,
  -0.28,
);
const h4: TextStyle = createTextStyle(
  h4Size,
  Math.round(h4Size * 1.3),
  fonts.CLASH_GRO_MEDIUM,
  fontWeights.medium,
  -0.2,
);
const h5: TextStyle = createTextStyle(
  h5Size,
  Math.round(h5Size * 1.33),
  fonts.CLASH_GRO_MEDIUM,
  fontWeights.medium,
  -0.18,
);
const h6: TextStyle = createTextStyle(
  h6Size,
  Math.round(h6Size * 1.38),
  fonts.CLASH_GRO_MEDIUM,
  fontWeights.medium,
  -0.14,
);

const body: TextStyle = createTextStyle(
  bodySize,
  bodyLineHeight,
  fonts.SATOSHI_REGULAR,
  fontWeights.normal,
  -0.16,
);
const bodyMedium: TextStyle = {
  ...body,
  fontFamily: fonts.SATOSHI_MEDIUM,
  fontWeight: fontWeights.medium,
};
const bodyBold: TextStyle = {
  ...body,
  fontFamily: fonts.SATOSHI_BOLD,
  fontWeight: fontWeights.bold,
};

const bodySmall: TextStyle = createTextStyle(
  bodySmallSize,
  bodySmallLineHeight,
  fonts.SATOSHI_REGULAR,
  fontWeights.normal,
  -0.12,
);
const bodySmallMedium: TextStyle = {
  ...bodySmall,
  fontFamily: fonts.SATOSHI_MEDIUM,
  fontWeight: fontWeights.medium,
};
const bodySmallBold: TextStyle = {
  ...bodySmall,
  fontFamily: fonts.SATOSHI_BOLD,
  fontWeight: fontWeights.bold,
};

const bodyXs: TextStyle = createTextStyle(
  bodyXsSize,
  bodyXsLineHeight,
  fonts.SATOSHI_REGULAR,
  fontWeights.normal,
  -0.08,
);
const bodyXsBold: TextStyle = {
  ...bodyXs,
  fontFamily: fonts.SATOSHI_BOLD,
  fontWeight: fontWeights.bold,
};

const caption: TextStyle = {
  ...bodyXs,
  fontFamily: fonts.SF_PRO_TEXT_REGULAR,
};
const captionBold: TextStyle = {
  ...bodyXs,
  fontFamily: fonts.SF_PRO_TEXT_SEMIBOLD,
  fontWeight: fontWeights.semibold,
};

export const typography = {
  // Core headings
  heading: h3,
  h1,
  h2,
  h3,
  h4,
  h4Alt: h4,
  h5,
  h5Clash23: h3,
  h6,
  h6Clash: h6,
  headlineMedium: {...h2, letterSpacing: -0.2},

  // Titles
  title: h3,
  titleLarge: h4,
  titleMedium: h5,
  titleSmall: h6,
  screenTitle: {...h6, letterSpacing: -0.12},
  businessSectionTitle20: h4,

  // Paragraph / body
  paragraph: body,
  paragraphBold: bodyBold,
  paragraph18Bold: bodyMedium,
  clashBody13: {
    fontFamily: fonts.CLASH_GRO_MEDIUM,
    fontSize: fontSizes['13'],
    lineHeight: Math.round(fontSizes['13'] * 1.4),
    fontWeight: fontWeights.medium,
    letterSpacing: -0.1,
  },
  body,
  bodyMedium,
  bodyLarge: {
    ...bodyMedium,
    fontSize: fontSizes.lg,
    lineHeight: Math.round(fontSizes.lg * 1.4),
  },
  bodySmall,
  bodySmallTight: {...bodySmall, lineHeight: Math.round(bodySmall.fontSize! * 1.3)},
  bodyExtraSmall: bodyXs,
  body12: bodyXs,
  body13: {
    ...bodySmall,
    fontSize: fontSizes['13'],
    lineHeight: Math.round(fontSizes['13'] * 1.4),
  },
  body14: {
    ...bodySmall,
    fontSize: fontSizes.sm,
    lineHeight: Math.round(fontSizes.sm * 1.4),
  },
  bodyBold,

  // Labels
  label: bodyMedium,
  labelMdBold: {...bodyMedium, fontWeight: fontWeights.bold},
  labelSmall: bodySmallMedium,
  labelSmallBold: bodySmallBold,
  labelSmBold: bodySmallBold,
  labelXs: {...bodyXs, fontFamily: fonts.SATOSHI_MEDIUM, fontWeight: fontWeights.medium},
  labelXxsBold: bodyXsBold,

  // Captions
  caption,
  captionBold,
  captionBoldSatoshi: bodySmallBold,

  // Buttons & CTA
  button: bodyMedium,
  buttonSmall: bodySmallMedium,
  buttonLarge: {
    ...bodyMedium,
    fontSize: fontSizes.lg,
    lineHeight: Math.round(fontSizes.lg * 1.25),
  },
  buttonH6Clash19: {
    fontFamily: fonts.CLASH_GRO_MEDIUM,
    fontSize: fontSizes['19'],
    lineHeight: Math.round(fontSizes['19'] * 1.3),
    fontWeight: fontWeights.medium,
    letterSpacing: -0.2,
  },
  cta: bodyMedium,

  // Inputs
  input: body,
  inputFilled: bodyMedium,
  inputLabel: bodySmallBold,
  inputError: bodySmallBold,

  // Navigation / tabs
  tabLabel: {
    fontFamily: fonts.SATOSHI_REGULAR,
    fontSize: fontSizes['13'],
    lineHeight: Math.round(fontSizes['13'] * 1.2), // 15.6px (120%)
    fontWeight: fontWeights.normal,
    letterSpacing: 0,
  },
  tabLabelFocused: bodySmallBold,

  // Subtitles / helper text
  subtitleBold12: bodyXsBold,
  subtitleBold14: bodySmallBold,
  subtitleRegular14: bodySmall,
  pillSubtitleBold15: {
    fontFamily: fonts.SATOSHI_BOLD,
    fontSize: fontSizes['15'],
    lineHeight: Math.round(fontSizes['15'] * 1.4),
    fontWeight: fontWeights.bold,
    letterSpacing: -0.2,
  },

  // Section headings
  sectionHeading: {
    fontFamily: fonts.SATOSHI_BOLD,
    fontSize: fontSizes['17'],
    lineHeight: 22,
    fontWeight: fontWeights.bold,
    letterSpacing: 0,
  },

  // Mobile specific styles
  mobileBodyEmphasis: {
    fontFamily: fonts.SATOSHI_MEDIUM,
    fontSize: fontSizes['17'],
    lineHeight: 22,
    fontWeight: fontWeights.medium,
    letterSpacing: 0,
  },
  mobileFootnote: {
    fontFamily: fonts.SATOSHI_REGULAR,
    fontSize: fontSizes['13'],
    lineHeight: 20,
    fontWeight: fontWeights.normal,
    letterSpacing: 0,
  },

  // Font family helpers for legacy usage
  SATOSHI_BOLD: fonts.SATOSHI_BOLD,
  SATOSHI_REGULAR: fonts.SATOSHI_REGULAR,
} as const;
