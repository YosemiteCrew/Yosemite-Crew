/**
 * Web platform output — maps semantic tokens to CSS custom property names
 * and Tailwind-compatible token keys.
 * Import this in globals.css or a generated CSS file.
 * Do NOT import this from React Native code.
 */

import { color } from './color';
import { spacing } from './spacing';
import { radius } from './radius';
import { shadow } from './shadow';
import { duration, easing } from './motion';
import { zIndex } from './zindex';
import { fontSize, fontWeight, lineHeight } from './typography';

/**
 * CSS custom properties to inject under @theme in globals.css.
 * These map semantic intent to the actual CSS variable names.
 *
 * Usage: iterate over webCssVars to generate a CSS block, or
 * reference directly in Tailwind's @theme.
 */
export const webCssVars = {
  // Font family (platform-specific — Satoshi is web-only)
  '--font-satoshi': "'Satoshi', sans-serif",

  // Color — text
  '--color-text-primary': color.text.primary,
  '--color-text-secondary': color.text.secondary,
  '--color-text-tertiary': color.text.tertiary,
  '--color-text-extra': color.text.extra,
  '--color-text-brand': color.text.brand,
  '--color-text-error': color.text.error,
  '--color-text-on-dark': color.text.onDark,
  '--color-text-cta': color.text.cta,

  // Color — surface
  '--color-surface-card': color.surface.card,
  '--color-surface-page': color.surface.page,
  '--color-surface-subtle': color.surface.subtle,
  '--color-surface-hover': color.surface.hover,
  '--color-surface-warning': color.surface.warning,
  '--color-surface-brand-light': color.surface.brandLight,
  '--color-surface-input-bg': color.surface.inputBg,

  // Color — border
  '--color-border-default': color.border.default,
  '--color-border-muted': color.border.muted,
  '--color-border-card': color.border.card,
  '--color-border-card-selected': color.border.cardSelected,
  '--color-border-error': color.border.error,
  '--color-border-active': color.border.active,

  // Color — action
  '--color-action-primary-bg': color.action.primary.bg,
  '--color-action-primary-text': color.action.primary.text,
  '--color-action-primary-hover': color.action.primary.hover,
  '--color-action-brand-bg': color.action.brand.bg,
  '--color-action-brand-text': color.action.brand.text,
  '--color-action-danger-bg': color.action.danger.bg,
  '--color-action-danger-text': color.action.danger.text,

  // Color — status
  '--color-status-success-text': color.status.success.text,
  '--color-status-success-bg': color.status.success.bg,
  '--color-status-warning-text': color.status.warning.text,
  '--color-status-warning-bg': color.status.warning.bg,
  '--color-status-danger-text': color.status.danger.text,
  '--color-status-danger-bg': color.status.danger.bg,
  '--color-status-info-text': color.status.info.text,
  '--color-status-info-bg': color.status.info.bg,

  // Color — input
  '--color-input-placeholder-default': color.input.placeholderDefault,
  '--color-input-placeholder-active': color.input.placeholderActive,
  '--color-input-border-default': color.input.borderDefault,
  '--color-input-border-error': color.input.borderError,
  '--color-input-border-active': color.input.borderActive,
  '--color-input-bg': color.input.bg,

  // Color — overlay
  '--color-overlay-modal': color.overlay.modal,
  '--color-overlay-light': color.overlay.light,
  '--color-overlay-card': color.overlay.card,

  // Spacing
  '--spacing-0': spacing['0'],
  '--spacing-1': spacing['1'],
  '--spacing-2': spacing['2'],
  '--spacing-3': spacing['3'],
  '--spacing-4': spacing['4'],
  '--spacing-5': spacing['5'],
  '--spacing-6': spacing['6'],
  '--spacing-8': spacing['8'],
  '--spacing-10': spacing['10'],
  '--spacing-12': spacing['12'],
  '--spacing-16': spacing['16'],
  '--spacing-20': spacing['20'],
  '--spacing-24': spacing['24'],

  // Radius
  '--radius-none': radius.none,
  '--radius-xs': radius.xs,
  '--radius-sm': radius.sm,
  '--radius-md': radius.md,
  '--radius-lg': radius.lg,
  '--radius-xl': radius.xl,
  '--radius-full': radius.full,

  // Shadow / elevation
  '--shadow-none': shadow.none,
  '--shadow-xs': shadow.xs,
  '--shadow-sm': shadow.sm,
  '--shadow-base': shadow.base,
  '--shadow-md': shadow.md,
  '--shadow-floating-md': shadow.floatingMd,
  '--shadow-lg': shadow.lg,
  '--shadow-xl': shadow.xl,

  // Motion
  '--duration-fast': `${duration.fast}ms`,
  '--duration-normal': `${duration.normal}ms`,
  '--duration-slow': `${duration.slow}ms`,
  '--easing-ease-in-out': easing.easeInOut,
  '--easing-ease-out': easing.easeOut,
  '--easing-ease-in': easing.easeIn,
  '--easing-spring': easing.spring,

  // Z-index
  '--z-dropdown': String(zIndex.dropdown),
  '--z-overlay': String(zIndex.overlay),
  '--z-modal': String(zIndex.modal),
  '--z-toast': String(zIndex.toast),
  '--z-tooltip': String(zIndex.tooltip),

  // Typography sizes
  '--font-size-xs': fontSize.xs,
  '--font-size-sm': fontSize.sm,
  '--font-size-base': fontSize.base,
  '--font-size-lg': fontSize.lg,
  '--font-size-xl': fontSize.xl,
  '--font-size-2xl': fontSize['2xl'],
  '--font-size-3xl': fontSize['3xl'],
  '--font-size-4xl': fontSize['4xl'],
  '--font-size-5xl': fontSize['5xl'],

  // Font weights
  '--font-weight-light': String(fontWeight.light),
  '--font-weight-normal': String(fontWeight.normal),
  '--font-weight-medium': String(fontWeight.medium),
  '--font-weight-semibold': String(fontWeight.semibold),
  '--font-weight-bold': String(fontWeight.bold),
  '--font-weight-black': String(fontWeight.black),

  // Line heights
  '--line-height-tight': String(lineHeight.tight),
  '--line-height-snug': String(lineHeight.snug),
  '--line-height-normal': String(lineHeight.normal),
  '--line-height-relaxed': String(lineHeight.relaxed),
  '--line-height-loose': String(lineHeight.loose),
} as const;

/**
 * Generates a CSS string of all token custom properties for use in @theme or :root.
 * Can be used in build scripts or Storybook decorators.
 */
export function generateCssTokenBlock(selector = ':root'): string {
  const vars = Object.entries(webCssVars)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join('\n');
  return `${selector} {\n${vars}\n}`;
}

export {
  color,
  spacing,
  radius,
  shadow,
  duration,
  easing,
  zIndex,
  fontSize,
  fontWeight,
  lineHeight,
};
