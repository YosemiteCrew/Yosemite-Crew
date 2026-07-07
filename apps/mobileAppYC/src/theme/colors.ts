// src/theme/colors.ts
//
// Warm-bone palette for the pet-parent mobile app.
//
// Light values are the marketing "warm bone" language (deep warm off-white
// surfaces, blue for interaction, pink for companion moments); dark values are
// the espresso theme. Raw hex lives in this file only - every component reads
// colours through `useTheme().theme.colors`, never a raw import, so swapping
// these values restyles the whole app.
//
// `colors` (light) is the canonical key set; `colorsDark` must provide every
// one of those keys (enforced by the `ColorTokens` type) so the two themes stay
// structurally identical and no lookup can ever be `undefined`.

/**
 * Light theme - warm bone.
 */
export const colors = {
  // --- Interactive accents (blue = interaction, pink = companion) ---
  blue: '#257BED',
  blueText: '#257BED',
  blueSoft: '#E6F2FF',
  navActive: '#1657C9',
  navActiveBg: 'rgba(37, 123, 237, 0.11)',
  pink: '#FF90D4',
  pinkGlow: 'rgba(244, 121, 190, 0.12)',
  cyan: '#5CE1E6',
  cyanText: '#38CCD8',

  // --- Status ---
  success: '#008F5D',
  successSurface: 'rgba(0, 143, 93, 0.12)',
  warning: '#FF9800',
  warningSurface: 'rgba(255, 152, 0, 0.12)',
  danger: '#EA3729',
  dangerSurface: '#FDEBEA',
  error: '#EA3729',
  errorSurface: '#FDEBEA',
  info: '#257BED',
  infoSurface: 'rgba(37, 123, 237, 0.12)',

  // --- Surfaces ---
  page: '#EFE8DC',
  band: '#E8E0D2',
  inset: '#EAE2D5',
  screen: '#F7F3EC',
  screen2: '#F1EBE1',
  surface: '#F7F3EC',
  fieldBg: '#FAFAFA',
  hairline: '#E5DCCF',
  hairlineHover: '#D6D1CD',
  divider: '#D6D1CD',

  // --- Ink (text) ---
  ink: '#1D1C1B',
  inkBody: '#302F2E',
  inkSoft: '#423F3C',
  inkMuted: '#5C5956',
  inkFaint: '#8F8984',
  inkFaint2: '#A9A39E',

  // --- Primary CTA (dark fill on light) ---
  cta: '#302F2E',
  ctaHover: '#1D1C1B',
  ctaText: '#FFFFFF',
  spot: '#1D1C1B',

  // --- Avatar tints ---
  avatarAmberBg: '#FEF3E9',
  avatarAmberInk: '#AF5E19',
  avatarVioletBg: '#F5F3FF',
  avatarVioletInk: '#5B21B6',
  avatarGreenBg: '#E6F4EF',
  avatarGreenInk: '#006642',

  // --- Warm glass (floating tab bar / headers) ---
  glassPill: 'rgba(239, 232, 220, 0.93)',
  glassPillBorder: 'rgba(29, 28, 27, 0.09)',

  // --- Fixed / overlays ---
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
  whiteOverlay70: 'rgba(255, 255, 255, 0.7)',
  overlay: 'rgba(29, 28, 27, 0.42)',
  overlayLight: 'rgba(255, 255, 255, 0.9)',
  modalOverlay: 'rgba(29, 28, 27, 0.42)',
  cardOverlay: 'rgba(247, 243, 236, 0.95)',
  neutralShadow: 'rgba(29, 28, 27, 0.10)',

  // --- Legacy aliases (kept for existing consumers; mapped to warm-bone) ---
  primary: '#257BED',
  primaryDark: '#1657C9',
  primaryLight: '#8FB6F5',
  primaryGlass: 'rgba(37, 123, 237, 0.92)',
  primaryTint: 'rgba(37, 123, 237, 0.20)',
  primaryTintStrong: 'rgba(37, 123, 237, 0.80)',
  primarySurface: 'rgba(37, 123, 237, 0.08)',
  secondary: '#302F2E',
  secondaryLight: '#F2ECE1',
  accent: '#FF90D4',
  accentLight: '#FFD9F1',
  gray800: '#423F3C',
  background: '#F7F3EC',
  backgroundSecondary: '#F1EBE1',
  backgroundDark: '#2F271E',
  backgroundDarkSecondary: '#221D17',
  lightBlueBackground: '#E6F2FF',
  text: '#302F2E',
  textSecondary: '#5C5956',
  textTertiary: '#257BED',
  onPrimary: '#FFFFFF',
  textDark: '#F4EFE6',
  textDarkSecondary: '#E6DDD0',
  border: '#E5DCCF',
  borderDark: '#40362B',
  borderMuted: 'rgba(229, 220, 207, 0.9)',
  borderSeparator: '#D6D1CD',
  placeholder: '#8F8984',
  cardBackground: '#F7F3EC',
  inputBackground: '#FAFAFA',
} as const;

/**
 * Structural contract shared by both themes: every light key, valued as a
 * plain colour string.
 */
export type ColorTokens = Record<keyof typeof colors, string>;

/**
 * Dark theme - espresso. Blue and pink fills stay exact; surfaces, ink and CTA
 * invert per the warm-bone dark table.
 */
export const colorsDark: ColorTokens = {
  // --- Interactive accents ---
  blue: '#257BED',
  blueText: '#8FB6F5',
  blueSoft: 'rgba(143, 182, 245, 0.16)',
  navActive: '#8FB6F5',
  navActiveBg: 'rgba(143, 182, 245, 0.13)',
  pink: '#FF90D4',
  pinkGlow: 'rgba(244, 121, 190, 0.22)',
  cyan: '#5CE1E6',
  cyanText: '#5CE1E6',

  // --- Status ---
  success: '#2BBD86',
  successSurface: 'rgba(74, 205, 155, 0.16)',
  warning: '#FF9800',
  warningSurface: 'rgba(255, 152, 0, 0.18)',
  danger: '#EA3729',
  dangerSurface: 'rgba(234, 55, 41, 0.16)',
  error: '#EA3729',
  errorSurface: 'rgba(234, 55, 41, 0.16)',
  info: '#8FB6F5',
  infoSurface: 'rgba(37, 123, 237, 0.18)',

  // --- Surfaces ---
  page: '#201C18',
  band: '#2A2216',
  inset: '#302820',
  screen: '#2F271E',
  screen2: '#221D17',
  surface: '#2F271E',
  fieldBg: '#241F18',
  hairline: '#40362B',
  hairlineHover: '#4A4033',
  divider: '#3A3128',

  // --- Ink ---
  ink: '#F4EFE6',
  inkBody: '#E6DDD0',
  inkSoft: '#CABFB0',
  inkMuted: '#A89E90',
  inkFaint: '#9D9285',
  inkFaint2: '#8B8173',

  // --- CTA (inverts to warm-white on espresso) ---
  cta: '#F2ECE1',
  ctaHover: '#FBF8F1',
  ctaText: '#201C18',
  spot: '#17140F',

  // --- Avatar tints ---
  avatarAmberBg: 'rgba(233, 170, 120, 0.17)',
  avatarAmberInk: '#ECB488',
  avatarVioletBg: 'rgba(167, 139, 250, 0.20)',
  avatarVioletInk: '#CBB2F4',
  avatarGreenBg: 'rgba(74, 205, 155, 0.17)',
  avatarGreenInk: '#74D0A2',

  // --- Warm glass ---
  glassPill: 'rgba(34, 29, 23, 0.92)',
  glassPillBorder: 'rgba(255, 255, 255, 0.09)',

  // --- Fixed / overlays ---
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
  whiteOverlay70: 'rgba(255, 255, 255, 0.7)',
  overlay: 'rgba(0, 0, 0, 0.55)',
  overlayLight: 'rgba(255, 255, 255, 0.9)',
  modalOverlay: 'rgba(0, 0, 0, 0.55)',
  cardOverlay: 'rgba(47, 39, 30, 0.95)',
  neutralShadow: 'rgba(0, 0, 0, 0.34)',

  // --- Legacy aliases ---
  primary: '#257BED',
  primaryDark: '#8FB6F5',
  primaryLight: '#8FB6F5',
  primaryGlass: 'rgba(37, 123, 237, 0.92)',
  primaryTint: 'rgba(37, 123, 237, 0.20)',
  primaryTintStrong: 'rgba(37, 123, 237, 0.80)',
  primarySurface: 'rgba(143, 182, 245, 0.16)',
  secondary: '#F2ECE1',
  secondaryLight: '#302F2E',
  accent: '#FF90D4',
  accentLight: 'rgba(255, 144, 212, 0.24)',
  gray800: '#CABFB0',
  background: '#2F271E',
  backgroundSecondary: '#221D17',
  backgroundDark: '#201C18',
  backgroundDarkSecondary: '#17140F',
  lightBlueBackground: 'rgba(143, 182, 245, 0.16)',
  text: '#E6DDD0',
  textSecondary: '#A89E90',
  textTertiary: '#8FB6F5',
  onPrimary: '#201C18',
  textDark: '#F4EFE6',
  textDarkSecondary: '#E6DDD0',
  border: '#40362B',
  borderDark: '#4A4033',
  borderMuted: 'rgba(64, 54, 43, 0.9)',
  borderSeparator: '#3A3128',
  placeholder: '#9D9285',
  cardBackground: '#2F271E',
  inputBackground: '#241F18',
};
