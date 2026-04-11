/**
 * Mobile semantic token mapping.
 *
 * This file bridges the shared @yosemite-crew/design-tokens semantic contract
 * and the mobile app's platform-specific theme API.
 *
 * Rules:
 * - Do NOT use raw hex values here. All values come from `colors.ts`.
 * - Do NOT import this from web/Next.js code.
 * - Liquid-glass and iOS-specific visual effects remain mobile implementation
 *   concerns and are NOT represented in the shared token contract.
 * - When a shared token maps to a mobile-specific override (e.g., a dark theme
 *   value differs from web), document it with a comment.
 *
 * Token naming convention mirrors @yosemite-crew/design-tokens/src/color.ts
 * so that web and mobile engineers read the same semantic vocabulary.
 */

import {colors} from './colors';

/**
 * Semantic color mapping for the **light** (default) theme.
 * Keys match the shared token contract from design-tokens/src/color.ts.
 */
export const semanticColorsLight = {
  // --- Text ---
  'text.primary': colors.text, // #302F2E
  'text.secondary': colors.textSecondary, // #747473
  'text.tertiary': colors.textTertiary, // #247AED (brand accent for tertiary CTA text)
  'text.brand': colors.primary, // #247AED
  'text.error': colors.error, // #F44336
  'text.onDark': colors.white, // #FFFFFF

  // --- Surface / Background ---
  'surface.card': colors.cardBackground, // #FFFFFF
  'surface.page': colors.background, // #FFFFFF
  'surface.subtle': colors.backgroundSecondary, // #F8F9FA
  'surface.hover': colors.backgroundSecondary,
  'surface.inputBg': colors.inputBackground, // #FAFAFA
  'surface.brandLight': colors.lightBlueBackground, // #E9F2FD

  // --- Border ---
  'border.default': colors.border, // #EAEAEA
  'border.muted': colors.borderMuted, // rgba(234,234,234,0.9)
  'border.card': colors.border,
  'border.error': colors.error,
  'border.active': colors.primary,

  // --- Action / Interactive ---
  'action.primary.bg': colors.secondary, // #302F2E
  'action.primary.text': colors.white,
  'action.brand.bg': colors.primary,
  'action.brand.text': colors.white,
  'action.danger.bg': colors.error,
  'action.danger.text': colors.white,

  // --- Status ---
  'status.success': colors.success,
  'status.successSurface': colors.successSurface,
  'status.warning': colors.warning,
  'status.warningSurface': colors.warningSurface,
  'status.error': colors.error,
  'status.errorSurface': colors.errorSurface,
  'status.info': colors.info,
  'status.infoSurface': colors.infoSurface,

  // --- Input ---
  'input.bg': colors.inputBackground,
  'input.borderDefault': colors.border,
  'input.borderError': colors.error,
  'input.borderActive': colors.primary,
  'input.placeholder': colors.placeholder,

  // --- Overlay ---
  'overlay.modal': colors.modalOverlay,
  'overlay.light': colors.overlayLight,
  'overlay.card': colors.cardOverlay,
} as const;

/**
 * Semantic color mapping for the **dark** theme.
 * Only values that differ from light theme are documented with a reason comment.
 */
export const semanticColorsDark = {
  // --- Text ---
  'text.primary': colors.textDark, // Light text on dark bg
  'text.secondary': colors.textDarkSecondary,
  'text.tertiary': colors.textTertiary, // Brand color stays consistent
  'text.brand': colors.primaryLight, // Lighter shade for dark bg contrast
  'text.error': colors.error,
  'text.onDark': colors.text, // On dark mode "on-dark" flips to dark text

  // --- Surface ---
  'surface.card': colors.gray800, // Dark card surface
  'surface.page': colors.backgroundDark,
  'surface.subtle': colors.backgroundDarkSecondary,
  'surface.hover': colors.backgroundDarkSecondary,
  'surface.inputBg': colors.backgroundDarkSecondary,
  'surface.brandLight': colors.lightBlueBackground,

  // --- Border ---
  'border.default': colors.borderDark,
  'border.muted': colors.borderDark,
  'border.card': colors.borderDark,
  'border.error': colors.error,
  'border.active': colors.primary,

  // --- Action ---
  'action.primary.bg': colors.secondaryLight,
  'action.primary.text': colors.text,
  'action.brand.bg': colors.primary,
  'action.brand.text': colors.white,
  'action.danger.bg': colors.error,
  'action.danger.text': colors.white,

  // --- Status (same as light — status colors are context-invariant) ---
  'status.success': colors.success,
  'status.successSurface': colors.successSurface,
  'status.warning': colors.warning,
  'status.warningSurface': colors.warningSurface,
  'status.error': colors.error,
  'status.errorSurface': colors.errorSurface,
  'status.info': colors.info,
  'status.infoSurface': colors.infoSurface,

  // --- Input ---
  'input.bg': colors.backgroundDarkSecondary,
  'input.borderDefault': colors.borderDark,
  'input.borderError': colors.error,
  'input.borderActive': colors.primary,
  'input.placeholder': colors.placeholder,

  // --- Overlay ---
  'overlay.modal': colors.overlay,
  'overlay.light': colors.overlayLight,
  'overlay.card': colors.overlay,
} as const;

export type SemanticColorTokens = typeof semanticColorsLight;
