import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';

import { RxBadge } from './RxBadge';

/* ------------------------------------------------------------------ *
 * Contrast measurement
 *
 * The badge's fill is `--color-primary-100`, which is a flat `#e6f2ff` in light
 * but `rgba(143, 182, 245, 0.16)` in dark. Reading the badge's own
 * `backgroundColor` in dark therefore returns the DECLARED translucent value,
 * not the colour behind the glyph - the reader sees that periwinkle composited
 * over `--page`. A ratio taken without compositing describes a pairing that is
 * not on screen, and it reports it confidently.
 * ------------------------------------------------------------------ */

type Rgb = { r: number; g: number; b: number; a: number };

const OPAQUE_WHITE: Rgb = { r: 255, g: 255, b: 255, a: 1 };

/**
 * Throws rather than guessing on anything that is not `rgb()`/`rgba()`. Chrome
 * serializes `oklch()` straight back as `oklch()`, and misparsing one would turn
 * every ratio below into a number that means nothing while still passing.
 */
const parseRgb = (value: string): Rgb => {
  if (!value.startsWith('rgb')) {
    throw new Error(`Expected an rgb()/rgba() computed colour, got "${value}"`);
  }
  const [r = 0, g = 0, b = 0, a = 1] = (value.match(/[\d.]+/g) ?? []).map(Number);
  return { r, g, b, a };
};

/** `top` painted over `bottom`, in sRGB, the way the compositor does it. */
const over = (top: Rgb, bottom: Rgb): Rgb => ({
  r: top.r * top.a + bottom.r * (1 - top.a),
  g: top.g * top.a + bottom.g * (1 - top.a),
  b: top.b * top.a + bottom.b * (1 - top.a),
  a: 1,
});

/**
 * The opaque colour painted at `start`, including `start`'s own background. The
 * walk begins at the element rather than at its parent because the glyph sits on
 * the badge's own tint - starting a level up would measure it against `--page`.
 */
const groundAt = (start: Element | null): Rgb => {
  const layers: Rgb[] = [];
  let node: Element | null = start;
  while (node) {
    const layer = parseRgb(globalThis.getComputedStyle(node).backgroundColor);
    if (layer.a > 0) layers.push(layer);
    if (layer.a === 1) break;
    node = node.parentElement;
  }
  // layers[0] is nearest the element, so composite from the bottom of the stack up.
  return layers.reduceRight((under, layer) => over(layer, under), OPAQUE_WHITE);
};

const toLinear = (value: number): number => {
  const srgb = value / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
};

const luminance = ({ r, g, b }: Rgb): number =>
  0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

/** WCAG ratio of `ink` against the ground actually painted behind it. */
const contrast = (ink: string, ground: Rgb): number => {
  const inkLuminance = luminance(parseRgb(ink));
  const groundLuminance = luminance(ground);
  return (
    (Math.max(inkLuminance, groundLuminance) + 0.05) /
    (Math.min(inkLuminance, groundLuminance) + 0.05)
  );
};

/** `--color-text-brand` in light. Named so the dark story can prove it did NOT get this. */
const LIGHT_BRAND_INK = 'rgb(22, 87, 201)';

const badgeIn = (canvasElement: HTMLElement) =>
  within(canvasElement).getByRole('img', { name: 'Prescription' });

/** The prescription row this badge lives on: a name, then the badge. */
const MedicineRow = ({ width, children }: { width: number; children: React.ReactNode }) => (
  <div className="flex items-center gap-2" style={{ width }}>
    <span className="shrink-0 text-[14px] font-medium">Trimethoprim-sulfadiazine 480mg</span>
    {children}
  </div>
);

const meta = {
  title: 'Appointments/RxBadge',
  component: RxBadge,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The Rx roundel that marks a prescription line in the workspace prescription editor. ' +
          'It takes no props, so everything it guarantees it guarantees from its own markup - ' +
          'and all of it is invisible to a type-checker.\n\n' +
          'The accessibility contract is the half nobody would notice breaking. The badge is a ' +
          '`role="img"` named "Prescription" and the `<svg>` inside it is `aria-hidden`, so the ' +
          'row announces exactly one thing rather than an unnamed graphic. There is no visible ' +
          'text anywhere in the component, so if that name is ever dropped the badge does not ' +
          'degrade - it disappears from the accessibility tree entirely while looking perfect.\n\n' +
          'The colour half is a theme problem. The ring and the glyph are the same token ' +
          '(`--color-text-brand`), but the glyph takes it through an SVG `fill` presentation ' +
          'attribute rather than a class: `fill="var(--color-text-brand)"` falls back to the ' +
          'initial value - black - if the token ever stops resolving, which reads as a styling ' +
          'choice rather than a bug. And the `--color-primary-100` fill under it is a flat pale ' +
          'blue in light but a 16% tint in dark, so the glyph is measured against the composited ' +
          'ground rather than the declared one.',
      },
    },
  },
  tags: ['autodocs'],
  args: {},
} satisfies Meta<typeof RxBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Default',
  play: async ({ canvasElement }) => {
    const badge = badgeIn(canvasElement);
    const svg = badge.querySelector('svg') as SVGSVGElement;
    const glyph = badge.querySelector('path') as SVGPathElement;

    /* One name, not two. The glyph is decoration inside an element that is already
       named "Prescription"; losing `aria-hidden` puts an unnamed graphic into the
       accessible name and no sighted review would ever catch it. */
    await expect(svg).toHaveAttribute('aria-hidden', 'true');

    const box = badge.getBoundingClientRect();
    const style = globalThis.getComputedStyle(badge);
    // size-6. It sits beside a 14px medicine name, so a drift to size-5 or size-7
    // shows up as a roundel that no longer lines up with the row beside it.
    await expect(box.width).toBe(24);
    await expect(box.height).toBe(24);
    // rounded-full, not a rounded square. Anything below half the box is a squircle.
    await expect(parseFloat(style.borderRadius)).toBeGreaterThanOrEqual(box.width / 2);

    const fill = globalThis.getComputedStyle(glyph).fill;
    /* Ring and glyph are one token, expressed two different ways - a `border-text-brand`
       class and an SVG `fill` attribute. Only one of the two would survive a token
       rename, and a mismatched pair (blue ring, black glyph) still looks deliberate. */
    await expect(fill).toBe(style.borderTopColor);
    await expect(parseRgb(style.borderTopColor).a).toBeGreaterThan(0);

    /* The token behind both is a TEXT ink (`--color-accent-deep`, picked at ~6.6:1),
       so the bar here is the text bar rather than the 3:1 graphics one. A glyph that
       has fallen back to black or to a fill ramp step drops well under it. */
    await expect(contrast(fill, groundAt(glyph))).toBeGreaterThanOrEqual(4.5);
  },
  parameters: {
    docs: {
      description: {
        story: 'How the prescription editor renders it: bare, on the light bone ground.',
      },
    },
  },
};

export const Dark: Story = {
  name: 'Dark theme',
  globals: { theme: 'dark' },
  play: async ({ canvasElement }) => {
    const badge = badgeIn(canvasElement);
    const glyph = badge.querySelector('path') as SVGPathElement;
    const fill = globalThis.getComputedStyle(glyph).fill;

    /* This is the case a naive colour check gets wrong: the badge's own
       `backgroundColor` reads `rgba(143, 182, 245, 0.16)` while the reader sees that
       periwinkle over the espresso page. Compositing first is the only way the ratio
       below refers to anything real. */
    await expect(parseRgb(globalThis.getComputedStyle(badge).backgroundColor).a).toBeLessThan(1);
    await expect(groundAt(glyph).a).toBe(1);
    await expect(contrast(fill, groundAt(glyph))).toBeGreaterThanOrEqual(4.5);

    /* The glyph has to track the theme. `--color-text-brand` has a real dark value;
       a literal hex, or an unresolved var falling back to black, pins it to the light
       ink and the roundel goes near-invisible on the 16% tint. */
    await expect(fill).not.toBe(LIGHT_BRAND_INK);
    await expect(fill).toBe(globalThis.getComputedStyle(badge).borderTopColor);

    // Geometry is theme-blind and must stay so.
    await expect(badge.getBoundingClientRect().width).toBe(24);
  },
  parameters: {
    docs: {
      description: {
        story:
          'On the espresso ground, where the fill is a translucent periwinkle rather than a ' +
          'flat pale blue. The glyph is measured against the composited result.',
      },
    },
  },
};

export const InATightRow: Story = {
  name: 'Squeezed beside a long medicine name',
  render: () => (
    <div className="flex flex-col gap-4">
      <MedicineRow width={420}>
        <RxBadge />
      </MedicineRow>
      <MedicineRow width={180}>
        <RxBadge />
      </MedicineRow>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const [roomy, tight] = within(canvasElement).getAllByRole('img', { name: 'Prescription' });

    for (const badge of [roomy, tight]) {
      const box = badge.getBoundingClientRect();
      /* `shrink-0` is the whole assertion. The badge is a flex item in a row it does
         not control, and its min-content width is the 14px `<svg>` inside it - so
         without shrink-0 an over-long medicine name squeezes it from 24 wide to 14
         while the height stays 24, and the roundel silently becomes an ellipse. */
      await expect(box.width).toBe(24);
      await expect(box.height).toBe(box.width);
    }
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same badge in a roomy prescription row and in one too narrow for its contents. ' +
          'The row overflows rather than the roundel distorting.',
      },
    },
  },
};
