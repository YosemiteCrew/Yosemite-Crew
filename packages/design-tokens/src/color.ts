/**
 * Semantic color tokens — shared across web and mobile.
 * Values describe intent, not platform details.
 * Raw palette values are internal; only semantic aliases are exported.
 */

// ---------------------------------------------------------------------------
// Raw palette (internal — not exported directly)
// ---------------------------------------------------------------------------

const palette = {
  // Neutral scale
  neutral950: '#1d1c1b',
  neutral900: '#302f2e',
  neutral700: '#595958',
  neutral600: '#747473',
  neutral500: '#a09f9f',
  neutral200: '#bfbfbe',
  neutral100: '#eaeaea',
  neutral0: '#ffffff',

  // Brand (blue)
  brand950: '#247aed',
  brand925: '#3b87ec',
  brand900: '#5394ec',
  brand800: '#6aa1eb',
  brand700: '#82afec',
  brand600: '#99bdec',
  brand500: '#b1caec',
  brand300: '#c9dbec',
  brand100: '#f2f8ff',

  // Success
  success950: '#003c27',
  success900: '#004f33',
  success800: '#006642',
  success700: '#008255',
  success600: '#008f5d',
  success500: '#33a57d',
  success400: '#54b492',
  success300: '#8acbb4',
  success200: '#b0dccd',
  success100: '#e6f4ef',

  // Warning
  warning950: '#67380f',
  warning900: '#874913',
  warning800: '#af5e19',
  warning700: '#e07920',
  warning600: '#f68523',
  warning500: '#f89d4f',
  warning400: '#f9ad6c',
  warning300: '#fbc79a',
  warning200: '#fcd9bb',
  warning100: '#fef3e9',

  // Danger
  danger950: '#621711',
  danger900: '#811e17',
  danger800: '#a6271d',
  danger700: '#d53225',
  danger600: '#ea3729',
  danger500: '#ee5f54',
  danger400: '#f17970',
  danger300: '#f5a39d',
  danger200: '#f8c1bd',
  danger100: '#fdebea',
} as const;

// ---------------------------------------------------------------------------
// Semantic color tokens (exported)
// ---------------------------------------------------------------------------

export const color = {
  // --- Text ---
  text: {
    primary: palette.neutral900,
    secondary: palette.neutral700,
    tertiary: palette.neutral600,
    extra: palette.neutral500,
    brand: palette.brand950,
    error: palette.danger600,
    onDark: palette.neutral0,
    cta: palette.neutral900,
  },

  // --- Surface / Background ---
  surface: {
    card: palette.neutral0,
    page: palette.neutral0,
    subtle: palette.neutral100,
    hover: '#f7f7f7',
    warning: palette.warning100,
    brandLight: palette.brand100,
    inputBg: '#fafafa',
  },

  // --- Border ---
  border: {
    default: palette.neutral100,
    muted: palette.neutral200,
    card: palette.neutral100,
    cardSelected: palette.neutral200,
    error: palette.danger600,
    active: palette.brand950,
  },

  // --- Action / Interactive ---
  action: {
    primary: {
      bg: palette.neutral900,
      text: palette.neutral0,
      hover: palette.neutral950,
    },
    secondary: {
      bg: 'transparent',
      text: palette.neutral900,
      border: palette.neutral900,
      hoverText: palette.brand950,
      hoverBorder: palette.brand950,
    },
    danger: {
      bg: palette.danger600,
      text: palette.neutral0,
    },
    brand: {
      bg: palette.brand950,
      text: palette.neutral0,
      hover: palette.brand925,
    },
    disabled: {
      opacity: 0.6,
    },
  },

  // --- Status ---
  status: {
    success: {
      text: palette.success600,
      bg: palette.success100,
      surface: 'rgba(0, 143, 93, 0.12)',
    },
    warning: {
      text: palette.warning600,
      bg: palette.warning100,
      surface: 'rgba(255, 152, 0, 0.12)',
    },
    danger: {
      text: palette.danger600,
      bg: palette.danger100,
      surface: 'rgba(234, 55, 41, 0.12)',
    },
    info: {
      text: '#2196f3',
      bg: '#e3f2fd',
      surface: 'rgba(33, 150, 243, 0.12)',
    },
  },

  // --- Input ---
  input: {
    placeholderDefault: palette.neutral700,
    placeholderActive: palette.brand950,
    borderDefault: palette.neutral100,
    borderError: palette.danger600,
    borderActive: palette.brand950,
    bg: '#fafafa',
  },

  // --- Overlay ---
  overlay: {
    modal: 'rgba(0, 0, 0, 0.5)',
    light: 'rgba(255, 255, 255, 0.9)',
    card: 'rgba(255, 255, 255, 0.95)',
  },

  // --- Raw palette access (for platform-specific needs) ---
  palette,
} as const;

export type ColorToken = typeof color;
