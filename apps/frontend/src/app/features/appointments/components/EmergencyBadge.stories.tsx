import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';

import EmergencyBadge from './EmergencyBadge';

/* ------------------------------------------------------------------ *
 * Contrast measurement
 *
 * `--color-danger-100` is a flat `#fdebea` in light but `rgba(234, 55, 41, 0.18)`
 * in dark, so reading the badge's own `backgroundColor` in dark returns the
 * DECLARED translucent value, not the colour a reader sees. The ink actually
 * lands on that red composited over `--page`. Anything short of compositing the
 * layers reports a ratio for a pairing that is not on screen - and reports it
 * confidently, which is the failure this file exists to catch.
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
 * walk begins at the element because the badge's tint is part of the ground its
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

/** WCAG contrast of the badge's ink against the ground actually painted behind it. */
const inkContrast = (el: HTMLElement): number => {
  const ink = luminance(parseRgb(getComputedStyle(el).color));
  const ground = luminance(groundAt(el));
  return (Math.max(ink, ground) + 0.05) / (Math.min(ink, ground) + 0.05);
};

/** The workspace header row: a shrink-0 name and status pill, then the badge. */
const HeaderRow = ({ width, children }: { width: number; children: React.ReactNode }) => (
  <div className="flex items-center gap-2" style={{ width }}>
    <span className="shrink-0 font-satoshi text-[17px] font-bold">Poppy</span>
    <span className="shrink-0 rounded-full border px-2.5 py-[3px] text-[10px] font-bold uppercase">
      Upcoming
    </span>
    {children}
  </div>
);

const meta = {
  title: 'Appointments/EmergencyBadge',
  component: EmergencyBadge,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The one "Emergency" flag, rendered by the calendar popover header and by the ' +
          'appointment workspace header. Both call it bare - no props - so everything it ' +
          'guarantees, it guarantees from its own style object.\n\n' +
          'Its colour set is the part that regresses silently. `--color-danger-100` is a flat ' +
          '`#fdebea` in light but a translucent `rgba(234, 55, 41, 0.18)` in dark, so the ink ' +
          'lands on that red composited over `--page` rather than on the declared tint. Nothing ' +
          'about a broken pairing is visible from the source, and a computed-style check that ' +
          'skips the compositing step reports a passing number for a colour nobody sees. The ' +
          'stories below measure the real ratio in both themes.\n\n' +
          'The other guarantee is `whitespace-nowrap`. The badge is the only shrinkable item in ' +
          'the workspace header row (the name and the status pill are both `shrink-0`), so ' +
          'without nowrap it is the thing that collapses first - and it collapses into a ' +
          'two-line badge next to a one-line pill, which is a layout break rather than a ' +
          'truncation.',
      },
    },
  },
  tags: ['autodocs'],
  args: {},
} satisfies Meta<typeof EmergencyBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Default',
  play: async ({ canvasElement }) => {
    const badge = within(canvasElement).getByText('Emergency');
    const style = getComputedStyle(badge);

    /* 22px (`h-5.5`) is not arbitrary: it is the height that lines the badge up with
       the 21.5px StatusPill it sits beside in the workspace header. A drift to `h-5`
       or `h-6` shows up as a badge floating half a pixel proud of the pill. */
    await expect(Math.round(badge.getBoundingClientRect().height)).toBe(22);
    await expect(style.borderRadius).toBe('8px');
    await expect(style.paddingLeft).toBe('8px');
    await expect(style.paddingRight).toBe('8px');
    await expect(style.borderTopWidth).toBe('1px');
    await expect(style.borderTopStyle).toBe('solid');
    await expect(style.fontSize).toBe('12px');
    await expect(style.whiteSpace).toBe('nowrap');

    /* The warning glyph is decoration - the word beside it already says "Emergency".
       Losing `aria-hidden` puts an unnamed graphic into the accessible name, which no
       sighted review would ever catch. */
    await expect(badge.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    await expect(badge).toHaveTextContent(/^Emergency$/);

    // The outline is the badge's whole identity; an unresolved --error-color kills it.
    await expect(parseRgb(style.borderTopColor).a).toBeGreaterThan(0);

    // 12px/500 is normal text, so the AA bar is 4.5 rather than the large-text 3.0.
    await expect(inkContrast(badge)).toBeGreaterThanOrEqual(4.5);
  },
  parameters: {
    docs: {
      description: {
        story: 'How both call sites render it: bare, on the light bone ground.',
      },
    },
  },
};

export const Positioned: Story = {
  name: 'With a caller className',
  args: { className: 'absolute top-2 right-2' },
  decorators: [
    (Story) => (
      /* No border on the frame: `right-2` offsets from the PADDING box, so a 1px
         border would make the measured gap 9px and the story would be asserting the
         decorator rather than the badge. */
      <div className="relative h-24 w-64 rounded-lg bg-black/5">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const badge = within(canvasElement).getByText('Emergency');
    const box = badge.getBoundingClientRect();
    const frame = (badge.parentElement as HTMLElement).getBoundingClientRect();

    /* `className` reaches the element through a template literal appended to a long
       class string. Nothing type-checks that it survived a refactor, and a dropped
       prop leaves the badge sitting in flow - which looks deliberate everywhere it
       is called bare, so only a positioning caller would ever notice. */
    await expect(getComputedStyle(badge).position).toBe('absolute');
    await expect(Math.round(frame.right - box.right)).toBe(8);
    await expect(Math.round(box.top - frame.top)).toBe(8);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The badge pinned into a corner by its caller. Neither production call site passes a ' +
          'className today, so the passthrough is unexercised anywhere else.',
      },
    },
  },
};

export const TightRow: Story = {
  name: 'Squeezed in a header row',
  render: () => (
    <div className="flex flex-col gap-4">
      <HeaderRow width={420}>
        <EmergencyBadge />
      </HeaderRow>
      <HeaderRow width={150}>
        <EmergencyBadge />
      </HeaderRow>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const [roomy, tight] = within(canvasElement).getAllByText('Emergency');
    const roomyBox = roomy.getBoundingClientRect();
    const tightBox = tight.getBoundingClientRect();

    /* Identical width in a 420px row and a 150px one. `whitespace-nowrap` raises the
       badge's min-content width to its full text width, so flexbox cannot shrink it -
       the ROW overflows instead, which is the correct trade for a safety flag. Drop
       the nowrap and this becomes a two-line badge beside a one-line status pill. */
    await expect(Math.round(tightBox.width)).toBe(Math.round(roomyBox.width));
    await expect(Math.round(tightBox.height)).toBe(22);

    // Still on the row's single line, not pushed under the status pill.
    await expect(Math.round(tightBox.height)).toBe(Math.round(roomyBox.height));
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same badge in a roomy header row and in one too narrow for its contents. It is ' +
          'the only item in that row without `shrink-0`, so it is the one flexbox would squeeze.',
      },
    },
  },
};

export const Dark: Story = {
  name: 'Dark theme',
  globals: { theme: 'dark' },
  play: async ({ canvasElement }) => {
    const badge = within(canvasElement).getByText('Emergency');
    const style = getComputedStyle(badge);

    /* The dark tint is translucent, so this is the case the naive check gets wrong:
       `backgroundColor` reads `rgba(234, 55, 41, 0.18)` while the reader sees that
       red over `--page`. Compositing first is the only way the number means anything. */
    await expect(parseRgb(style.backgroundColor).a).toBeLessThan(1);
    await expect(groundAt(badge).a).toBe(1);
    await expect(inkContrast(badge)).toBeGreaterThanOrEqual(4.5);

    // Geometry must survive the theme swap too - the style object is theme-blind.
    await expect(Math.round(badge.getBoundingClientRect().height)).toBe(22);
    await expect(parseRgb(style.borderTopColor).a).toBeGreaterThan(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'On the espresso ground, where the tint is a translucent red rather than a flat pink. ' +
          'The ink is measured against the composited result, not the declared value.',
      },
    },
  },
};
