import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';

import BilledBadge from './BilledBadge';

/* ------------------------------------------------------------------ *
 * Contrast measurement
 *
 * `--status-completed-bg` is a flat `#f0fdf4` in light but
 * `rgba(74, 205, 155, 0.16)` in dark, so reading the pill's own
 * `backgroundColor` in dark returns the DECLARED translucent value and not the
 * colour anyone sees. The ink lands on that green composited over `--page`.
 * Anything short of compositing the layers reports a ratio for a pairing that
 * is not on screen - confidently, which is the failure this guard exists for.
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
 * walk begins at the element because the pill's tint is part of the ground its
 * own text sits on - a parent-up walk would measure the ink against `--page`.
 */
const groundAt = (start: HTMLElement | null): Rgb => {
  const layers: Rgb[] = [];
  let node = start;
  while (node) {
    const layer = parseRgb(getComputedStyle(node).backgroundColor);
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

/** WCAG contrast of the pill's ink against the ground actually painted behind it. */
const inkContrast = (el: HTMLElement): number => {
  const ink = luminance(parseRgb(getComputedStyle(el).color));
  const ground = luminance(groundAt(el));
  return (Math.max(ink, ground) + 0.05) / (Math.min(ink, ground) + 0.05);
};

/** A services line as it appears once the invoice is finalized: no delete control. */
const LineItem = ({ children }: { children: React.ReactNode }) => (
  <div className="flex w-[420px] items-center justify-between gap-3 rounded-2xl border border-card-border px-4 py-3">
    <span className="text-body-4 text-text-primary">Annual wellness exam</span>
    {children}
  </div>
);

const meta = {
  title: 'Workspace/BilledBadge',
  component: BilledBadge,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The "Billed" pill on a services, packages or prescription line whose invoice has been ' +
          'finalized. It takes no props and has no branches - which is exactly why it needs a ' +
          'story rather than a unit test. Everything that can go wrong with it is a colour, and ' +
          'the three colours it uses (`--color-pill-success-bg`, `-text` and `-border`) are ' +
          'redefined wholesale in the dark block. Nothing else in this repo renders this pill ' +
          'under review.\n\n' +
          'What the pill means matters more than its size: a billed line is read-only and cannot ' +
          'be deleted, so this badge is the only thing standing in for the missing delete control ' +
          'next to it. If it fails to paint - a dropped token computes to `rgba(0, 0, 0, 0)`, ' +
          'which is invisible rather than obviously broken - the row reads as an ordinary ' +
          'unbilled line that has simply lost its bin icon.\n\n' +
          'The stories below measure the ink against the ground it is actually composited on, in ' +
          'both themes, and pin that the tick stays out of the accessible name.',
      },
    },
  },
  tags: ['autodocs'],
  args: {},
} satisfies Meta<typeof BilledBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Light theme',
  play: async ({ canvasElement }) => {
    const badge = within(canvasElement).getByText('Billed');
    const style = getComputedStyle(badge);

    /* An opaque tint in light. Alpha, not the hex: a token that stops resolving makes the
       whole declaration invalid, the property is dropped, and the computed value comes back
       `rgba(0, 0, 0, 0)` - an invisible pill that still carries its label. */
    await expect(parseRgb(style.backgroundColor).a).toBe(1);

    /* The border is a THIRD token, not a darkened fill, and it is what keeps the pill legible
       where a green line sits on a green-tinted row. Losing it collapses the pill into its
       background without changing a single visible word. */
    await expect(parseRgb(style.borderTopColor).a).toBeGreaterThan(0);
    await expect(style.borderTopColor).not.toBe(style.backgroundColor);
    await expect(style.borderTopStyle).toBe('solid');

    // 11px caption text, so it is held to the normal-text AA bar rather than the large one.
    await expect(inkContrast(badge)).toBeGreaterThanOrEqual(4.5);

    /* The tick is `aria-hidden`, so the pill announces "Billed" and nothing else. An icon
       that loses that attribute injects its own title into the accessible name of every
       billed line on the invoice at once. */
    const icon = badge.querySelector('svg');
    if (!icon) throw new Error('The pill lost its checkmark icon.');
    await expect(icon).toHaveAttribute('aria-hidden', 'true');
    await expect((badge.textContent ?? '').trim()).toBe('Billed');
  },
};

export const Dark: Story = {
  name: 'Dark theme',
  globals: { theme: 'dark' },
  play: async ({ canvasElement }) => {
    const badge = within(canvasElement).getByText('Billed');
    const style = getComputedStyle(badge);
    const fill = parseRgb(style.backgroundColor);

    /* Translucent, not opaque - that is the whole signature of the dark token. Alpha 1 here
       would mean the dark block never redefined `--status-completed-bg` and the light mint
       fill is being painted onto the espresso ground; alpha 0 would mean it resolved to
       nothing at all. Both are invisible in a screenshot review of a 60px pill. */
    await expect(fill.a).toBeGreaterThan(0);
    await expect(fill.a).toBeLessThan(1);

    await expect(parseRgb(style.borderTopColor).a).toBeGreaterThan(0);

    /* Measured through the composite: the ink sits on 16%-opacity green over `--page`, not
       on the green the stylesheet names. Reading `backgroundColor` directly would report a
       ratio for a colour that is never painted. */
    await expect(inkContrast(badge)).toBeGreaterThanOrEqual(4.5);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same pill on the espresso ground, where the fill is a 16% wash rather than a flat ' +
          'mint and the ink moves to a light green. Both values live in a separate token block, ' +
          'so this is the only place either of them is exercised.',
      },
    },
  },
};

export const OnALineItem: Story = {
  name: 'On a finalized line item',
  render: () => (
    <LineItem>
      <BilledBadge />
    </LineItem>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const badge = canvas.getByText('Billed');

    /* The pill is `inline-flex` with no shrink guard, so it is worth pinning that it holds
       its own line rather than wrapping "Billed" under its tick when the row runs tight. */
    await expect(badge.getBoundingClientRect().height).toBeLessThan(28);
    await expect(inkContrast(badge)).toBeGreaterThanOrEqual(4.5);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The row as the clinician sees it. The pill occupies the slot the delete control would ' +
          'otherwise sit in - a billed line can be added alongside but never removed - which is ' +
          'why an invisible pill reads as a missing button rather than as a missing badge.',
      },
    },
  },
};
