// src/theme/colors.ts
//
// Warm-bone palette for the pet-parent mobile app.
//
// Every token is declared once as a `[light, dark]` pair: light is the
// marketing "warm bone" language (deep warm off-white surfaces, blue for
// interaction, pink for companion moments); dark is the espresso theme. Raw hex
// lives in this file only - every component reads colours through
// `useTheme().theme.colors`, never a raw import, so swapping these values
// restyles the whole app. Declaring both values side by side keeps the two
// themes structurally identical and easy to keep in sync.

type ColorPair = readonly [light: string, dark: string];

const palette = {
  // --- Interactive accents (blue = interaction, pink = companion) ---
  blue: ['#257BED', '#257BED'],
  blueText: ['#257BED', '#8FB6F5'],
  blueSoft: ['#E6F2FF', 'rgba(143, 182, 245, 0.16)'],
  navActive: ['#1657C9', '#8FB6F5'],
  navActiveBg: ['rgba(37, 123, 237, 0.11)', 'rgba(143, 182, 245, 0.13)'],
  pink: ['#FF90D4', '#FF90D4'],
  pinkGlow: ['rgba(244, 121, 190, 0.12)', 'rgba(244, 121, 190, 0.22)'],
  cyan: ['#5CE1E6', '#5CE1E6'],
  cyanText: ['#38CCD8', '#5CE1E6'],

  // --- Status ---
  success: ['#008F5D', '#2BBD86'],
  successSurface: ['rgba(0, 143, 93, 0.12)', 'rgba(74, 205, 155, 0.16)'],
  warning: ['#FF9800', '#FF9800'],
  warningSurface: ['rgba(255, 152, 0, 0.12)', 'rgba(255, 152, 0, 0.18)'],
  danger: ['#EA3729', '#EA3729'],
  dangerSurface: ['#FDEBEA', 'rgba(234, 55, 41, 0.16)'],
  error: ['#EA3729', '#EA3729'],
  errorSurface: ['#FDEBEA', 'rgba(234, 55, 41, 0.16)'],
  info: ['#257BED', '#8FB6F5'],
  infoSurface: ['rgba(37, 123, 237, 0.12)', 'rgba(37, 123, 237, 0.18)'],

  // --- Surfaces ---
  page: ['#EFE8DC', '#201C18'],
  band: ['#E8E0D2', '#2A2216'],
  inset: ['#EAE2D5', '#302820'],
  screen: ['#F7F3EC', '#2F271E'],
  screen2: ['#F1EBE1', '#221D17'],
  surface: ['#F7F3EC', '#2F271E'],
  fieldBg: ['#FAFAFA', '#241F18'],
  hairline: ['#E5DCCF', '#40362B'],
  hairlineHover: ['#D6D1CD', '#4A4033'],
  divider: ['#D6D1CD', '#3A3128'],

  // --- Ink (text) ---
  ink: ['#1D1C1B', '#F4EFE6'],
  inkBody: ['#302F2E', '#E6DDD0'],
  inkSoft: ['#423F3C', '#CABFB0'],
  inkMuted: ['#5C5956', '#A89E90'],
  inkFaint: ['#8F8984', '#9D9285'],
  inkFaint2: ['#A9A39E', '#8B8173'],

  // --- Primary CTA (dark fill on light, warm-white on espresso) ---
  cta: ['#302F2E', '#F2ECE1'],
  ctaHover: ['#1D1C1B', '#FBF8F1'],
  ctaText: ['#FFFFFF', '#201C18'],
  spot: ['#1D1C1B', '#17140F'],

  // --- Avatar tints ---
  avatarAmberBg: ['#FEF3E9', 'rgba(233, 170, 120, 0.17)'],
  avatarAmberInk: ['#AF5E19', '#ECB488'],
  avatarVioletBg: ['#F5F3FF', 'rgba(167, 139, 250, 0.20)'],
  avatarVioletInk: ['#5B21B6', '#CBB2F4'],
  avatarGreenBg: ['#E6F4EF', 'rgba(74, 205, 155, 0.17)'],
  avatarGreenInk: ['#006642', '#74D0A2'],

  // --- Warm glass (floating tab bar / headers) ---
  glassPill: ['rgba(239, 232, 220, 0.93)', 'rgba(34, 29, 23, 0.92)'],
  glassPillBorder: ['rgba(29, 28, 27, 0.09)', 'rgba(255, 255, 255, 0.09)'],

  // --- Fixed / overlays ---
  white: ['#FFFFFF', '#FFFFFF'],
  black: ['#000000', '#000000'],
  transparent: ['transparent', 'transparent'],
  whiteOverlay70: ['rgba(255, 255, 255, 0.7)', 'rgba(255, 255, 255, 0.7)'],
  overlay: ['rgba(29, 28, 27, 0.42)', 'rgba(0, 0, 0, 0.55)'],
  overlayLight: ['rgba(255, 255, 255, 0.9)', 'rgba(255, 255, 255, 0.9)'],
  modalOverlay: ['rgba(29, 28, 27, 0.42)', 'rgba(0, 0, 0, 0.55)'],
  cardOverlay: ['rgba(247, 243, 236, 0.95)', 'rgba(47, 39, 30, 0.95)'],
  neutralShadow: ['rgba(29, 28, 27, 0.10)', 'rgba(0, 0, 0, 0.34)'],

  // --- Legacy aliases (kept for existing consumers; mapped to warm-bone) ---
  primary: ['#257BED', '#257BED'],
  primaryDark: ['#1657C9', '#8FB6F5'],
  primaryLight: ['#8FB6F5', '#8FB6F5'],
  primaryGlass: ['rgba(37, 123, 237, 0.92)', 'rgba(37, 123, 237, 0.92)'],
  primaryTint: ['rgba(37, 123, 237, 0.20)', 'rgba(37, 123, 237, 0.20)'],
  primaryTintStrong: ['rgba(37, 123, 237, 0.80)', 'rgba(37, 123, 237, 0.80)'],
  primarySurface: ['rgba(37, 123, 237, 0.08)', 'rgba(143, 182, 245, 0.16)'],
  secondary: ['#302F2E', '#F2ECE1'],
  secondaryLight: ['#F2ECE1', '#302F2E'],
  accent: ['#FF90D4', '#FF90D4'],
  accentLight: ['#FFD9F1', 'rgba(255, 144, 212, 0.24)'],
  gray800: ['#423F3C', '#CABFB0'],
  background: ['#F7F3EC', '#2F271E'],
  backgroundSecondary: ['#F1EBE1', '#221D17'],
  backgroundDark: ['#2F271E', '#201C18'],
  backgroundDarkSecondary: ['#221D17', '#17140F'],
  lightBlueBackground: ['#E6F2FF', 'rgba(143, 182, 245, 0.16)'],
  text: ['#302F2E', '#E6DDD0'],
  textSecondary: ['#5C5956', '#A89E90'],
  textTertiary: ['#257BED', '#8FB6F5'],
  onPrimary: ['#FFFFFF', '#201C18'],
  textDark: ['#F4EFE6', '#F4EFE6'],
  textDarkSecondary: ['#E6DDD0', '#E6DDD0'],
  border: ['#E5DCCF', '#40362B'],
  borderDark: ['#40362B', '#4A4033'],
  borderMuted: ['rgba(229, 220, 207, 0.9)', 'rgba(64, 54, 43, 0.9)'],
  borderSeparator: ['#D6D1CD', '#3A3128'],
  placeholder: ['#8F8984', '#9D9285'],
  cardBackground: ['#F7F3EC', '#2F271E'],
  inputBackground: ['#FAFAFA', '#241F18'],
} satisfies Record<string, ColorPair>;

type PaletteKey = keyof typeof palette;

/** Structural contract shared by both themes. */
export type ColorTokens = Record<PaletteKey, string>;

const project = (index: 0 | 1): ColorTokens => {
  const entries = Object.entries(palette) as [PaletteKey, ColorPair][];
  return Object.fromEntries(
    entries.map(([key, pair]) => [key, pair[index]]),
  ) as ColorTokens;
};

/** Light theme - warm bone. */
export const colors: ColorTokens = project(0);

/** Dark theme - espresso. Blue and pink fills stay exact. */
export const colorsDark: ColorTokens = project(1);
