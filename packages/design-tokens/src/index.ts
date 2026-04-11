/**
 * @yosemite-crew/design-tokens
 *
 * Shared semantic design token package for Yosemite Crew.
 * Consumed by:
 *   - Web (apps/frontend) — via the web output or CSS vars
 *   - Mobile (apps/mobileAppYC) — via the mobile output
 *   - Docs (apps/dev-docs) — for token documentation
 *
 * Usage:
 *   import { color, spacing, radius } from '@yosemite-crew/design-tokens'
 *   import { webCssVars } from '@yosemite-crew/design-tokens/web'
 *   import { mobileTheme } from '@yosemite-crew/design-tokens/mobile'
 */

export { color } from './color';
export type { ColorToken } from './color';

export { spacing, spacingRole } from './spacing';
export type { SpacingToken } from './spacing';

export { fontSize, fontWeight, lineHeight, letterSpacing, typographyRole } from './typography';
export type { TypographyRole, FontWeightToken, FontSizeToken } from './typography';

export { radius, radiusRole } from './radius';
export type { RadiusToken } from './radius';

export { shadow, shadowRole } from './shadow';
export type { ShadowToken } from './shadow';

export { duration, easing, motionRole } from './motion';
export type { DurationToken, EasingToken } from './motion';

export { zIndex } from './zindex';
export type { ZIndexToken } from './zindex';
