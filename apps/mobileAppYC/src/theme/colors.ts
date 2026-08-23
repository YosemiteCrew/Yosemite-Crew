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
  /**
   * Blue as TEXT. `blue` / `primary` are the FILL - links, focus rings and
   * active nav painted as a surface - and at #257BED they measure only 3.70:1
   * on bone, under the 4.5:1 body-text bar. The espresso value was already
   * fine (7.12:1); it was the light one that had been left equal to the fill.
   *
   * Do not use `blue` or `primary` for text. Use this.
   */
  blueText: ['#1162CE', '#8FB6F5'],
  blueSoft: ['#E6F2FF', 'rgba(143, 182, 245, 0.16)'],
  navActive: ['#1657C9', '#8FB6F5'],
  navActiveBg: ['rgba(37, 123, 237, 0.11)', 'rgba(143, 182, 245, 0.13)'],
  pink: ['#FF90D4', '#FF90D4'],
  // Solid pink for UI components on the light ground. The brand pink measures
  // only 1.86:1 against `screen` (#F7F3EC), well under the 3:1 WCAG 1.4.11 bar
  // for a state indicator, so a light surface needs this deepened rose (3.47:1)
  // while the espresso theme can use the true brand pink (7.13:1) as-is.
  /**
   * Pink for anything that must be READ - text and state indicators.
   *
   * The brand pink measures 1.86:1 on bone, so the "Hello, <name>" greeting on
   * Home was rendering real user-facing copy at 1.74:1 as measured on device.
   *
   * #C30077 is set against the DARKEST light ground this can land on, not
   * against `screen`. Measuring only against `screen` gives 4.68:1 and looks
   * fine, but the Home header sits on its own slightly darker fill and the
   * on-device reading came back 4.37:1 - under the bar. Against `inset` it
   * would have been 4.03:1. So: screen 5.29:1, header 4.94:1, inset 4.55:1.
   *
   * This also covers the 3:1 bar the token was introduced for (the onboarding
   * progress dot). Espresso keeps the true brand pink, already 7.13:1 there.
   *
   * `pink` stays the decorative fill: icons, the ink-annotation ring, washes.
   */
  pinkDeep: ['#C30077', '#FF90D4'],
  pinkGlow: ['rgba(244, 121, 190, 0.12)', 'rgba(244, 121, 190, 0.22)'],
  // rgba forms of `blue` (#257BED = 37,123,237). These exist as tokens because
  // the map cluster pin previously hard-coded rgba(36,122,237,...) - the stale
  // #247AED from the unbuilt design-tokens package - for its halo and shadow.
  // A hex sweep does not match an rgba() literal, so the pin kept rendering
  // two different blues at once after the rest of the drift was cleaned up.
  blueGlow: ['rgba(37, 123, 237, 0.18)', 'rgba(37, 123, 237, 0.26)'],
  blueShadow: ['rgba(37, 123, 237, 0.40)', 'rgba(37, 123, 237, 0.50)'],
  cyan: ['#5CE1E6', '#5CE1E6'],
  cyanText: ['#38CCD8', '#5CE1E6'],

  // --- Status ---
  success: ['#008F5D', '#2BBD86'],
  successSurface: ['rgba(0, 143, 93, 0.12)', 'rgba(74, 205, 155, 0.16)'],
  warning: ['#FF9800', '#FF9800'],
  warningSurface: ['rgba(255, 152, 0, 0.12)', 'rgba(255, 152, 0, 0.18)'],
  /**
   * `danger` is the FILL: destructive button backgrounds and the error border,
   * where white sits on top of it. Do not use it for text - #EA3729 measures
   * 3.74:1 on bone and 3.55:1 on espresso, under the 4.5:1 body-text bar in
   * BOTH themes, so error copy was failing everywhere and not only in dark.
   *
   * Use `dangerText` for error copy. One value cannot serve both roles: making
   * the red light enough to read on espresso drops white-on-red below 3.1:1 on
   * the destructive button, so the roles are split rather than the value moved.
   */
  danger: ['#EA3729', '#EA3729'],
  dangerText: ['#D52315', '#EF6257'],
  dangerSurface: ['#FDEBEA', 'rgba(234, 55, 41, 0.16)'],
  error: ['#EA3729', '#EA3729'],
  errorSurface: ['#FDEBEA', 'rgba(234, 55, 41, 0.16)'],
  info: ['#257BED', '#8FB6F5'],
  infoSurface: ['rgba(37, 123, 237, 0.12)', 'rgba(37, 123, 237, 0.18)'],
  indigo: ['#4F46E5', '#A5B4FC'],
  indigoSurface: ['#E0E7FF', 'rgba(99, 102, 241, 0.18)'],
  violet: ['#7C3AED', '#C4B5FD'],
  violetSurface: ['#EDE9FE', 'rgba(139, 92, 246, 0.18)'],

  // --- Surfaces ---
  page: ['#EFE8DC', '#201C18'],
  band: ['#E8E0D2', '#2A2216'],
  inset: ['#EAE2D5', '#302820'],
  screen: ['#F7F3EC', '#2F271E'],
  screen2: ['#F1EBE1', '#221D17'],
  surface: ['#F7F3EC', '#2F271E'],
  fieldBg: ['#FBF8F2', '#241F18'],
  hairline: ['#E5DCCF', '#40362B'],
  /**
   * The boundary of an interactive control - text fields, selects, anything
   * whose edge is the only thing telling you where the control is.
   *
   * `hairline` measures 1.28:1 against the field fill and 1.23:1 against the
   * page, which is right for a decorative rule and well short of the 3:1 that
   * WCAG 1.4.11 asks of a control boundary. The field fill only differs from
   * the ground by 1.06:1, so the border really is carrying that job alone.
   *
   * Darkening `hairline` itself would drag every divider, card edge and list
   * separator in ~70 files down with it and turn warm bone into hard outline.
   * So it splits by role, the same way danger/dangerText and pink/pinkDeep do:
   * `hairline` stays the soft rule, `controlBorder` delimits controls.
   *
   * Measured: light 3.58:1 on the field fill and 3.43:1 on the page ground;
   * dark 3.84:1 and 3.45:1.
   */
  controlBorder: ['#977F62', '#8A7860'],
  hairlineHover: ['#D6D1CD', '#4A4033'],
  // Border on a selected segment. The hairline is too faint to mark selection
  // on its own (1.06:1 light, 1.23:1 dark against the track), and the card
  // shadow that used to carry it contributes nothing on a dark ground. Tuned
  // to clear the 3:1 WCAG 1.4.11 bar for a UI component boundary in both
  // themes without reading as a heavy outline.
  segmentSelectedBorder: ['#837D76', '#88725B'],
  divider: ['#D6D1CD', '#3A3128'],

  // --- Ink (text) ---
  ink: ['#1D1C1B', '#F4EFE6'],
  inkBody: ['#302F2E', '#E6DDD0'],
  inkSoft: ['#423F3C', '#CABFB0'],
  inkMuted: ['#5C5956', '#A89E90'],
  /**
   * INK RAMP CONTRAST RULE - read before using inkFaint or inkFaint2.
   *
   * Measured against `screen` (#F7F3EC light / #2F271E dark):
   *
   *   token        light            dark
   *   inkMuted     6.29:1  passes   5.57:1  passes
   *   inkFaint     3.12:1  FAILS    4.81:1  passes
   *   inkFaint2    2.26:1  FAILS    3.84:1  FAILS
   *
   * So on the light ground `inkMuted` is the FAINTEST token that may carry body
   * text. `inkFaint` clears the 3:1 bar, so it is fine for icons, borders and
   * large display type (>=18pt, or >=14pt bold) but not for body copy.
   * `inkFaint2` clears neither bar and must not carry text or a UI affordance;
   * it is left for disabled controls, which WCAG 1.4.3 exempts, and for copy
   * sitting over media rather than over a themed ground.
   *
   * Darkening the two faint tokens to pass is NOT the fix. Both would land near
   * #75_6D_67, collapsing a five-step ramp into three - there is not enough
   * luminance range between bone and black to fit five distinct steps that all
   * clear 4.5:1. The ramp is fine; the usage rule is what was missing.
   *
   * Guarded by __tests__/theme/inkRampContrast.test.ts.
   */
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
  // Translucent warm tint laid over a real BlurView so the frosted glass reads
  // warm and keeps ink legible (light / dark). More see-through than glassPill.
  glassSurface: ['rgba(247, 243, 236, 0.55)', 'rgba(41, 35, 28, 0.6)'],
  glassSurfaceStrong: ['rgba(247, 243, 236, 0.72)', 'rgba(41, 35, 28, 0.74)'],

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
  inputBackground: ['#FBF8F2', '#241F18'],
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
