/**
 * Mobile platform output — maps semantic tokens to React Native compatible values.
 * All lengths are in px numbers (React Native does not use rem).
 * Do NOT import this from Next.js or web code.
 */

import { color } from './color';
import { fontWeight, lineHeight } from './typography';
import { spacing } from './spacing';
import { radius } from './radius';
import { shadow } from './shadow';
import { zIndex } from './zindex';
import { duration } from './motion';

/**
 * Converts rem string to px number for React Native.
 * Base font size is 16px.
 */
function remToPx(rem: string): number {
  return parseFloat(rem) * 16;
}

/**
 * Spacing scale in px for React Native.
 */
export const mobileSpacing = {
  '0': 0,
  '1': 4,
  '1.25': 5,
  '2': 8,
  '2.5': 10,
  '3': 12,
  '3.5': 14,
  '4': 16,
  '4.5': 18,
  '5': 20,
  '6': 24,
  '7': 28,
  '8': 32,
  '9': 36,
  '10': 40,
  '11': 44,
  '12': 48,
  '14': 56,
  '16': 64,
  '18': 72,
  '20': 80,
  '24': 96,
  '28': 112,
  '32': 128,
  '36': 144,
  '40': 160,
  '48': 192,
  '64': 256,
  '80': 320,
  '96': 384,
} as const satisfies Record<string, number>;

/**
 * Font size scale in px for React Native.
 */
export const mobileFontSize = {
  xxs: 10,
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 22,
  '3xl': 24,
  '4xl': 40,
  '5xl': 48,
} as const;

/**
 * Radius scale in px for React Native.
 */
export const mobileRadius = {
  none: remToPx(radius.none),
  xs: remToPx(radius.xs),
  sm: remToPx(radius.sm),
  md: remToPx(radius.md),
  lg: remToPx(radius.lg),
  xl: remToPx(radius.xl),
  '2xl': remToPx(radius['2xl']),
  full: 9999,
} as const;

/**
 * Shadow objects for React Native (iOS + Android).
 * Parses the web shadow strings into structured RN shadow props.
 */
export const mobileShadow = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  xs: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  base: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  md: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  floatingMd: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  lg: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 8,
  },
  xl: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 25,
    elevation: 12,
  },
} as const;

/**
 * Complete mobile theme object — a single object that can be passed to a
 * ThemeProvider or destructured directly in mobile components.
 *
 * This is the canonical semantic mapping for the mobile app.
 * It replaces raw hex values in mobile components with token-backed values.
 */
export const mobileTheme = {
  color: {
    // Text
    textPrimary: color.text.primary,
    textSecondary: color.text.secondary,
    textTertiary: color.text.tertiary,
    textExtra: color.text.extra,
    textBrand: color.text.brand,
    textError: color.text.error,
    textOnDark: color.text.onDark,

    // Surfaces
    surfaceCard: color.surface.card,
    surfacePage: color.surface.page,
    surfaceSubtle: color.surface.subtle,
    surfaceHover: color.surface.hover,
    surfaceInputBg: color.surface.inputBg,
    lightBlueBackground: color.surface.brandLight,

    // Borders
    borderDefault: color.border.default,
    borderMuted: color.border.muted,
    borderCard: color.border.card,
    borderError: color.border.error,
    borderActive: color.border.active,

    // Actions
    actionPrimaryBg: color.action.primary.bg,
    actionPrimaryText: color.action.primary.text,
    actionBrandBg: color.action.brand.bg,
    actionBrandText: color.action.brand.text,
    actionDangerBg: color.action.danger.bg,
    actionDangerText: color.action.danger.text,

    // Status
    success: color.status.success.text,
    successSurface: color.status.success.surface,
    warning: color.status.warning.text,
    warningSurface: color.status.warning.surface,
    error: color.status.danger.text,
    errorSurface: color.status.danger.bg,
    info: color.status.info.text,
    infoSurface: color.status.info.surface,

    // Overlay
    modalOverlay: color.overlay.modal,
    overlayLight: color.overlay.light,

    // Raw palette access for platform-specific needs
    white: color.palette.neutral0,
    black: color.palette.neutral950,
    primary: color.palette.brand950,
    secondary: color.palette.neutral900,
  },

  spacing: mobileSpacing,
  fontSize: mobileFontSize,
  radius: mobileRadius,
  shadow: mobileShadow,
  zIndex,
  duration,

  fontWeight: {
    light: '300' as const,
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    black: '900' as const,
  },

  lineHeight,
} as const;

export type MobileTheme = typeof mobileTheme;

// Re-export semantic tokens for mobile consumers
export { color, fontWeight, lineHeight, zIndex, duration };

// Keep shadow string reference accessible if needed
export { shadow as shadowCss };
