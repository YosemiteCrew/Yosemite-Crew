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
 * - Light maps to the warm-bone palette (`colors`); dark maps to the espresso
 *   palette (`colorsDark`). The two objects always share the same keys.
 *
 * Token naming convention mirrors @yosemite-crew/design-tokens/src/color.ts
 * so that web and mobile engineers read the same semantic vocabulary.
 */

import {colors, colorsDark} from './colors';

/**
 * Semantic color mapping for the **light** (default) theme - warm bone.
 * Keys match the shared token contract from design-tokens/src/color.ts.
 */
export const semanticColorsLight = {
  // --- Text ---
  'text.primary': colors.ink,
  'text.secondary': colors.inkMuted,
  'text.tertiary': colors.blueText,
  'text.brand': colors.blue,
  'text.error': colors.danger,
  'text.onDark': colors.white,

  // --- Surface / Background ---
  'surface.card': colors.cardBackground,
  'surface.page': colors.background,
  'surface.subtle': colors.screen2,
  'surface.hover': colors.screen2,
  'surface.inputBg': colors.fieldBg,
  'surface.brandLight': colors.blueSoft,

  // --- Border ---
  'border.default': colors.hairline,
  'border.muted': colors.borderMuted,
  'border.card': colors.hairline,
  'border.error': colors.danger,
  'border.active': colors.blue,

  // --- Action / Interactive ---
  'action.primary.bg': colors.cta,
  'action.primary.text': colors.ctaText,
  'action.brand.bg': colors.blue,
  'action.brand.text': colors.white,
  'action.danger.bg': colors.danger,
  'action.danger.text': colors.white,

  // --- Status ---
  'status.success': colors.success,
  'status.successSurface': colors.successSurface,
  'status.warning': colors.warning,
  'status.warningSurface': colors.warningSurface,
  'status.error': colors.danger,
  'status.errorSurface': colors.dangerSurface,
  'status.info': colors.info,
  'status.infoSurface': colors.infoSurface,

  // --- Input ---
  'input.bg': colors.fieldBg,
  'input.borderDefault': colors.hairline,
  'input.borderError': colors.danger,
  'input.borderActive': colors.blue,
  'input.placeholder': colors.placeholder,

  // --- Overlay ---
  'overlay.modal': colors.modalOverlay,
  'overlay.light': colors.overlayLight,
  'overlay.card': colors.cardOverlay,
} as const;

/**
 * Semantic color mapping for the **dark** (espresso) theme.
 * Same keys as light, resolved against the espresso palette.
 */
export const semanticColorsDark = {
  // --- Text ---
  'text.primary': colorsDark.ink,
  'text.secondary': colorsDark.inkMuted,
  'text.tertiary': colorsDark.blueText,
  'text.brand': colorsDark.blueText,
  'text.error': colorsDark.danger,
  'text.onDark': colorsDark.ink,

  // --- Surface ---
  'surface.card': colorsDark.cardBackground,
  'surface.page': colorsDark.background,
  'surface.subtle': colorsDark.screen2,
  'surface.hover': colorsDark.screen2,
  'surface.inputBg': colorsDark.fieldBg,
  'surface.brandLight': colorsDark.blueSoft,

  // --- Border ---
  'border.default': colorsDark.hairline,
  'border.muted': colorsDark.borderMuted,
  'border.card': colorsDark.hairline,
  'border.error': colorsDark.danger,
  'border.active': colorsDark.blue,

  // --- Action ---
  'action.primary.bg': colorsDark.cta,
  'action.primary.text': colorsDark.ctaText,
  'action.brand.bg': colorsDark.blue,
  'action.brand.text': colorsDark.white,
  'action.danger.bg': colorsDark.danger,
  'action.danger.text': colorsDark.white,

  // --- Status ---
  'status.success': colorsDark.success,
  'status.successSurface': colorsDark.successSurface,
  'status.warning': colorsDark.warning,
  'status.warningSurface': colorsDark.warningSurface,
  'status.error': colorsDark.danger,
  'status.errorSurface': colorsDark.dangerSurface,
  'status.info': colorsDark.info,
  'status.infoSurface': colorsDark.infoSurface,

  // --- Input ---
  'input.bg': colorsDark.fieldBg,
  'input.borderDefault': colorsDark.hairline,
  'input.borderError': colorsDark.danger,
  'input.borderActive': colorsDark.blue,
  'input.placeholder': colorsDark.placeholder,

  // --- Overlay ---
  'overlay.modal': colorsDark.modalOverlay,
  'overlay.light': colorsDark.overlayLight,
  'overlay.card': colorsDark.cardOverlay,
} as const;

export type SemanticColorTokens = typeof semanticColorsLight;
