/**
 * WCAG 2.1 contrast measured against the RENDERED element, for use from
 * Storybook play functions (which run in a real browser, unlike jsdom).
 *
 * Why this exists as a probe rather than an assertion on class names: the
 * failure it guards against is a literal ink colour on a themed fill. A test
 * that asserts `className` contains some token passes forever, because the
 * class is still there when the colour underneath it is wrong. Only the
 * composited pixel values can fail.
 *
 * Alpha is composited down the ancestor chain rather than assumed opaque: the
 * bug that motivated this shipped as `rgba(255,255,255,0.75)`, and reading that
 * as opaque white reports 4.09:1 where the real value is 2.98:1.
 */

type Rgb = { r: number; g: number; b: number; a: number };

const parseColor = (value: string): Rgb | null => {
  const match = /rgba?\(([^)]+)\)/.exec(value);
  if (!match) return null;
  const parts = match[1].split(',').map((part) => Number.parseFloat(part));
  if (parts.length < 3 || parts.some((part) => Number.isNaN(part))) return null;
  return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
};

const relativeLuminance = ({ r, g, b }: Rgb): number => {
  const channel = (raw: number) => {
    const v = raw / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

/**
 * `src` painted over `dst`, source-over.
 *
 * The resulting alpha is `as + ab(1 - as)`, NOT 1. Hardcoding it to 1 makes the
 * `a >= 0.999` guard in `effectiveBackground` true after a single blend, which
 * ends the ancestor walk at the second translucent layer and reports it as the
 * backdrop - so two stacked translucent backgrounds resolve against the wrong
 * colour. Colour channels are un-premultiplied by `ao` for the same reason: with
 * a translucent `dst`, weighting by `(1 - as)` alone over-counts the backdrop.
 */
export const compositeOver = (src: Rgb, dst: Rgb): Rgb => {
  const a = src.a + dst.a * (1 - src.a);
  if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
  const channel = (s: number, d: number) => (s * src.a + d * dst.a * (1 - src.a)) / a;
  return { r: channel(src.r, dst.r), g: channel(src.g, dst.g), b: channel(src.b, dst.b), a };
};

const WHITE: Rgb = { r: 255, g: 255, b: 255, a: 1 };

/**
 * The colour actually behind `el`: the first opaque background found walking up,
 * with any translucent layers above it composited in on the way.
 */
const effectiveBackground = (el: Element): Rgb => {
  let node: Element | null = el;
  let accumulated: Rgb | null = null;
  while (node) {
    const colour = parseColor(globalThis.getComputedStyle(node).backgroundColor);
    if (colour && colour.a > 0) {
      accumulated = accumulated ? compositeOver(accumulated, colour) : colour;
      if (accumulated.a >= 0.999) return accumulated;
    }
    node = node.parentElement;
  }
  return accumulated ? compositeOver(accumulated, WHITE) : WHITE;
};

export type ContrastReading = {
  ratio: number;
  /** 3 for WCAG-large text, otherwise 4.5. */
  required: number;
  passes: boolean;
  foreground: string;
  background: string;
  fontSize: number;
  fontWeight: string;
};

/**
 * WCAG large text is >= 24px, or >= 18.66px when bold. 14px/700 does NOT
 * qualify - getting that boundary wrong is what lets a 4.09:1 label read as
 * passing.
 */
export const measureContrast = (el: Element): ContrastReading => {
  const style = globalThis.getComputedStyle(el);
  const background = effectiveBackground(el);
  const rawForeground = parseColor(style.color) ?? { ...WHITE };
  const foreground = rawForeground.a < 1 ? compositeOver(rawForeground, background) : rawForeground;

  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  const ratio = (lighter + 0.05) / (darker + 0.05);

  const fontSize = Number.parseFloat(style.fontSize);
  const isBold = Number.parseInt(style.fontWeight, 10) >= 700;
  const isLarge = fontSize >= 24 || (fontSize >= 18.66 && isBold);
  const required = isLarge ? 3 : 4.5;

  return {
    ratio: Math.round(ratio * 100) / 100,
    required,
    passes: ratio >= required,
    foreground: style.color,
    background: `rgb(${Math.round(background.r)}, ${Math.round(background.g)}, ${Math.round(background.b)})`,
    fontSize,
    fontWeight: style.fontWeight,
  };
};

/** A one-line description for an assertion message that has to explain itself. */
export const describeContrast = (label: string, reading: ContrastReading): string =>
  `${label}: ${reading.ratio}:1 (needs ${reading.required}:1) - ${reading.foreground} on ${reading.background} at ${reading.fontSize}px/${reading.fontWeight}`;
