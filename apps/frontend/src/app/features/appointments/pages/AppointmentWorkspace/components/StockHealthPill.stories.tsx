import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';

import { StockHealthPill } from './StockHealthPill';

/* ------------------------------------------------------------------ *
 * Colour probes
 *
 * The pill's outer fill is translucent in dark (`rgba(249, 115, 22, 0.15)` /
 * `rgba(74, 205, 155, 0.16)`), so reading `backgroundColor` off the pill returns
 * the DECLARED value rather than the colour a reader sees. The inner count
 * circle is opaque in both themes, but it sits on top of that translucent pill,
 * so the walk has to composite anyway. A ratio taken without compositing
 * describes a pairing that is not on screen - and reports it confidently.
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
 * walk begins at the element because each label sits on its own fill - a
 * parent-up walk would measure the count against the pill instead of against the
 * circle it is actually inside.
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

/** WCAG contrast of an element's own ink against the ground actually painted behind it. */
const inkContrast = (el: HTMLElement): number => {
  const ink = luminance(parseRgb(globalThis.getComputedStyle(el).color));
  const ground = luminance(groundAt(el));
  return (Math.max(ink, ground) + 0.05) / (Math.min(ink, ground) + 0.05);
};

/**
 * What `var(token)` resolves to right here. Resolved from inside the pill's own
 * subtree rather than from `document`, because several ink tokens are
 * re-declared under `body:has([data-yc-app])` and a probe parked outside reads
 * the marketing value.
 */
const resolveToken = (near: Element, token: string): string => {
  const probe = globalThis.document.createElement('span');
  probe.style.color = `var(${token})`;
  near.append(probe);
  const value = globalThis.getComputedStyle(probe).color;
  probe.remove();
  return value;
};

/** The pill, and the count circle inside it. */
const pillParts = (canvasElement: HTMLElement, label: 'In stock' | 'Low stock') => {
  const pill = within(canvasElement).getByText(label);
  return { pill, count: pill.querySelector('span') as HTMLElement };
};

const meta = {
  title: 'Appointments/StockHealthPill',
  component: StockHealthPill,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The stock chip on a workspace prescription line: "In stock" or "Low stock", with the ' +
          'on-hand count in a filled circle. One boolean picks everything - the label, the pill ' +
          'tint, the border and the circle - so the two branches below are the whole surface.\n\n' +
          'The branch is `low`, not the quantity. A `qty` of 0 with `low` false renders a green ' +
          '"In stock" beside a zero, because the caller (`PrescriptionEditor`) passes ' +
          '`item.lowStock ?? false` and the component does not second-guess it. That is worth ' +
          'knowing before trusting a green chip.\n\n' +
          'The part that has already regressed once is the ink INSIDE the count circle, and the ' +
          'two branches are handled deliberately differently. The warning fill is a mid orange ' +
          'in both themes, so its ink is pinned to `--ink-fixed`; it used to take ' +
          '`text-neutral-0`, which inverts to near-white in light and left the count barely ' +
          'legible. The success fill THEMES the other way (deep green in light, light green in ' +
          'dark), so `text-neutral-0` is exactly right there - inverting with it - and pinning ' +
          '*that* one white measured 1.86:1 in dark. Two circles that look identical are ' +
          'therefore built on opposite rules, which is why both stories assert the token by ' +
          'name as well as the measured ratio.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    qty: 24,
    low: false,
  },
} satisfies Meta<typeof StockHealthPill>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InStock: Story = {
  name: 'In stock',
  play: async ({ canvasElement }) => {
    const { pill, count } = pillParts(canvasElement, 'In stock');
    const pillStyle = globalThis.getComputedStyle(pill);

    await expect(count).toHaveTextContent('24');

    // h-8. The pill sits in a row with the fulfillment dropdown and the billed badge,
    // so a drift in its height shows as a step in that row rather than as a bad pill.
    await expect(Math.round(pill.getBoundingClientRect().height)).toBe(32);
    const countBox = count.getBoundingClientRect();
    // size-6, and a circle rather than a lozenge - see `Counts` for why that matters.
    await expect(countBox.width).toBe(24);
    await expect(countBox.height).toBe(24);

    /* Border and label are the same token (`border-pill-success-text` /
       `text-pill-success-text`). Sourcing the border from the fill instead turns the
       chip from an outlined pill into a flat tint, which is a different component in
       a row that already contains three flat badges. */
    await expect(pillStyle.borderTopColor).toBe(pillStyle.color);
    await expect(parseRgb(pillStyle.borderTopColor).a).toBeGreaterThan(0);

    /* The success circle's ink is `text-neutral-0`, which THEMES - light on the deep
       green here, dark on the light green in dark mode. Pinning it to a literal white
       is the change that measured 1.86:1 in dark, and it looks perfect in light. */
    await expect(globalThis.getComputedStyle(count).color).toBe(
      resolveToken(count, '--color-neutral-0')
    );

    // Both inks are normal-size text (12px label, 11px count), so the bar is 4.5.
    await expect(inkContrast(pill)).toBeGreaterThanOrEqual(4.5);
    await expect(inkContrast(count)).toBeGreaterThanOrEqual(4.5);
  },
  parameters: {
    docs: {
      description: {
        story: 'The healthy branch: deep green ink and border on a pale green tint.',
      },
    },
  },
};

export const LowStock: Story = {
  name: 'Low stock',
  args: { qty: 3, low: true },
  play: async ({ canvasElement }) => {
    const { pill, count } = pillParts(canvasElement, 'Low stock');
    const pillStyle = globalThis.getComputedStyle(pill);

    await expect(count).toHaveTextContent('3');
    // The geometry is branch-blind: the two chips swap in and out of the same row slot
    // as stock moves, so a height difference would make the row twitch on a re-render.
    await expect(Math.round(pill.getBoundingClientRect().height)).toBe(32);
    await expect(count.getBoundingClientRect().width).toBe(24);
    await expect(pillStyle.borderTopColor).toBe(pillStyle.color);

    const countInk = globalThis.getComputedStyle(count).color;
    /* The opposite rule to the success branch, on a circle that looks the same.
       `bg-warning-700` stays a mid orange in both themes, so the ink is PINNED dark
       via `--ink-fixed`. It used to be `text-neutral-0`, which inverts to near-white
       and left a white "3" on orange. Asserting the absence is the half that matters:
       the two tokens agree in dark, so a regression here is invisible until someone
       opens the light theme. */
    await expect(countInk).toBe(resolveToken(count, '--ink-fixed'));
    await expect(countInk).not.toBe(resolveToken(count, '--color-neutral-0'));

    await expect(inkContrast(pill)).toBeGreaterThanOrEqual(4.5);
    await expect(inkContrast(count)).toBeGreaterThanOrEqual(4.5);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The warning branch. The count circle is the one place in this component where the ' +
          'ink is deliberately not the themed one.',
      },
    },
  },
};

export const Dark: Story = {
  name: 'Dark: two circles, two rules',
  globals: { theme: 'dark' },
  render: () => (
    <div className="flex items-center gap-3">
      <StockHealthPill qty={24} low={false} />
      <StockHealthPill qty={3} low />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const inStock = pillParts(canvasElement, 'In stock');
    const lowStock = pillParts(canvasElement, 'Low stock');

    /* The pill tints are translucent in dark, so this is the case a naive check gets
       wrong: `backgroundColor` reads a 15% orange while the reader sees that orange
       over `--page`. Compositing first is the only way the ratios below mean anything. */
    for (const { pill } of [inStock, lowStock]) {
      await expect(parseRgb(globalThis.getComputedStyle(pill).backgroundColor).a).toBeLessThan(1);
      await expect(groundAt(pill).a).toBe(1);
      await expect(inkContrast(pill)).toBeGreaterThanOrEqual(4.5);
    }

    /* Both counts clear the bar, but they get there by opposite routes - and this is
       the theme where the wrong route is invisible. `--ink-fixed` and
       `--color-neutral-0` are both dark values here, so the low chip reads fine even
       if it were wired to the wrong one; only the light theme would show it. Pinning
       the token by name is what makes this story able to tell them apart. */
    await expect(globalThis.getComputedStyle(lowStock.count).color).toBe(
      resolveToken(lowStock.count, '--ink-fixed')
    );
    await expect(globalThis.getComputedStyle(inStock.count).color).toBe(
      resolveToken(inStock.count, '--color-neutral-0')
    );
    await expect(inkContrast(lowStock.count)).toBeGreaterThanOrEqual(4.5);
    await expect(inkContrast(inStock.count)).toBeGreaterThanOrEqual(4.5);

    /* Green and amber have to stay distinguishable on the espresso ground - the label
       is 12px and the colour is what carries the state at a glance in a busy row. */
    await expect(globalThis.getComputedStyle(inStock.pill).color).not.toBe(
      globalThis.getComputedStyle(lowStock.pill).color
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Both branches together on the espresso ground, where the tints are translucent and ' +
          'the two count circles converge on dark ink for different reasons.',
      },
    },
  },
};

export const Counts: Story = {
  name: 'Zero, single and triple digits',
  render: () => (
    <div className="flex items-center gap-3">
      <StockHealthPill qty={0} low />
      <StockHealthPill qty={9} low={false} />
      <StockHealthPill qty={128} low={false} />
      <StockHealthPill qty={0} low={false} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* A zero on hand is the single most important count this chip ever shows, and it
       is the one a falsy guard eats. `{qty}` renders it today; `{qty || '-'}` or
       `{qty && ...}` would blank the circle on exactly the line a vet needs to see. */
    await expect(canvas.getAllByText('0')).toHaveLength(2);
    await expect(canvas.getByText('128')).toBeInTheDocument();

    for (const count of canvasElement.querySelectorAll<HTMLElement>('span > span')) {
      const box = count.getBoundingClientRect();
      /* `size-6` fixes both axes, so the circle stays a circle at every digit count
         rather than stretching into a lozenge at three digits - the pill's own width
         is what grows. It also means the digits are not clipped by the circle but
         constrained by it, so a four-digit stock level would overflow rather than
         truncate. */
      await expect(box.width).toBe(24);
      await expect(box.height).toBe(24);
      await expect(count.scrollWidth).toBeLessThanOrEqual(Math.ceil(box.width));
    }

    /* The chip reports `low`, not the quantity. Zero on hand with `low` false renders
       the green "In stock" - the caller passes `item.lowStock ?? false`, so an item
       whose low-stock flag never arrived is drawn as healthy no matter how empty the
       shelf is. Documented here rather than defended against, because the fix belongs
       upstream of this component. */
    const zeroPills = canvas.getAllByText('0').map((count) => count.parentElement as HTMLElement);
    await expect(zeroPills[0]).toHaveTextContent('Low stock');
    await expect(zeroPills[1]).toHaveTextContent('In stock');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The counts that stress the circle: an empty shelf on both branches, a single digit, ' +
          'and a three-digit stock level.',
      },
    },
  },
};
