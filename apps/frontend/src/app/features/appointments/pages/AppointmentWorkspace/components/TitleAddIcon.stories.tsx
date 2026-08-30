import type { Meta, StoryObj } from '@storybook/react';
import { expect } from 'storybook/test';

import { TitleAddIcon } from './TitleAddIcon';

/** `--color-text-brand` in light. Named here only so the dark story can prove it did NOT get this. */
const LIGHT_BRAND_FILL = 'rgb(22, 87, 201)';

const parseRgba = (value: string): [number, number, number, number] => {
  const parts = (value.match(/[\d.]+/g) ?? []).map(Number);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 1];
};

/**
 * Resolve a token from inside the icon's own subtree rather than off `document`.
 * Several tokens are re-declared under `body:has([data-yc-app])`, so a probe parked
 * outside the component reads the marketing value and the comparison is against the
 * wrong number.
 */
const resolveColorToken = (near: Element, token: string): string => {
  const probe = globalThis.document.createElement('span');
  probe.style.color = `var(${token})`;
  near.append(probe);
  const value = globalThis.getComputedStyle(probe).color;
  probe.remove();
  return value;
};

/**
 * Composite the translucent layers down onto the first opaque ancestor. Reading the
 * raw `backgroundColor` off one node reports a contrast that does not exist.
 */
const effectiveBackground = (element: Element): [number, number, number] => {
  const layers: Array<[number, number, number, number]> = [];
  for (let node: Element | null = element; node; node = node.parentElement) {
    const layer = parseRgba(globalThis.getComputedStyle(node).backgroundColor);
    if (layer[3] > 0) {
      layers.push(layer);
      if (layer[3] >= 1) break;
    }
  }
  let ground: [number, number, number] = [255, 255, 255];
  for (const [r, g, b, alpha] of layers.reverse()) {
    ground = [
      r * alpha + ground[0] * (1 - alpha),
      g * alpha + ground[1] * (1 - alpha),
      b * alpha + ground[2] * (1 - alpha),
    ];
  }
  return ground;
};

const relativeLuminance = ([r, g, b]: [number, number, number]): number => {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

const contrastRatio = (ink: string, ground: [number, number, number]): number => {
  const [r, g, b] = parseRgba(ink);
  const inkLuminance = relativeLuminance([r, g, b]);
  const groundLuminance = relativeLuminance(ground);
  return (
    (Math.max(inkLuminance, groundLuminance) + 0.05) /
    (Math.min(inkLuminance, groundLuminance) + 0.05)
  );
};

const discIn = (canvasElement: HTMLElement): HTMLElement => {
  const disc = canvasElement.querySelector<HTMLElement>('span[aria-hidden="true"]');
  if (!disc) throw new Error('no disc rendered');
  return disc;
};

const meta = {
  title: 'Workspace/TitleAddIcon',
  component: TitleAddIcon,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The blue disc that opens the "Services & Packages" and "Prescription" container ' +
          'titles. It takes no props and carries no behaviour, so the only things that can go ' +
          'wrong with it are the two this file measures: the fill silently resolving to nothing ' +
          '(`bg-text-brand` is a token utility - a renamed token leaves an invisible white plus ' +
          'on the bone surface, and nothing else in the app would report it), and the disc ' +
          'squashing to an ellipse when the title beside it runs long.\n\n' +
          'It is `aria-hidden` on purpose. The plus is decoration next to a written title, not ' +
          'a control - the real "Add" affordances are elsewhere in the container header - so ' +
          'the white stroke is held to the shape-discernibility bar against the page rather ' +
          'than a text-contrast bar against its own fill.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof TitleAddIcon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'The glyph',
  play: async ({ canvasElement }) => {
    const disc = discIn(canvasElement);

    // size-6 disc, 16px glyph. Both are hard-coded in the component, and both are
    // what makes it line up with the 20px title text it sits in front of.
    const box = disc.getBoundingClientRect();
    await expect(box.width).toBe(24);
    await expect(box.height).toBe(24);
    const glyph = disc.querySelector('svg')?.getBoundingClientRect();
    await expect(glyph?.width).toBe(16);
    await expect(glyph?.height).toBe(16);

    /* The failure this guards: `bg-text-brand` resolving to nothing. The plus is
       stroked `white` with no fallback, so a dropped token does not render a blue
       square in the wrong shade - it renders nothing at all on the warm-bone page,
       and the title just loses its icon. Assert the fill is opaque AND that it is
       the token, not a literal someone pasted in. */
    const fill = globalThis.getComputedStyle(disc).backgroundColor;
    await expect(parseRgba(fill)[3]).toBe(1);
    await expect(fill).toBe(resolveColorToken(disc, '--color-text-brand'));
    await expect(
      contrastRatio(fill, effectiveBackground(disc.parentElement as HTMLElement))
    ).toBeGreaterThanOrEqual(3);

    // Decorative: the title beside it already says "Services & Packages". Announcing
    // a bare "+" ahead of it would be noise, so nothing here reaches the a11y tree.
    await expect(disc).toHaveAttribute('aria-hidden', 'true');
    await expect(disc.textContent).toBe('');
  },
};

export const BesideALongTitle: Story = {
  name: 'Beside a title that has to truncate',
  parameters: { layout: 'padded' },
  render: () => (
    <div className="flex w-[220px] items-center gap-2">
      <TitleAddIcon />
      <span className="min-w-0 truncate text-base font-semibold text-text-primary">
        Services &amp; Packages for this visit
      </span>
    </div>
  ),
  play: async ({ canvasElement }) => {
    /* `shrink-0` is the whole point of this story. The icon is the first item in a
       flex title row, so without it the disc is the thing that gives way when the
       title runs long: it flattens into a 14px ellipse with a perfectly round plus
       still centred in it, which reads as a rendering glitch rather than a layout
       bug. The title is the element that is supposed to truncate. */
    const box = discIn(canvasElement).getBoundingClientRect();
    await expect(box.width).toBe(24);
    await expect(box.width).toBe(box.height);
  },
};

export const Dark: Story = {
  name: 'Dark: the fill tracks the theme',
  globals: { theme: 'dark' },
  play: async ({ canvasElement }) => {
    const disc = discIn(canvasElement);
    const fill = globalThis.getComputedStyle(disc).backgroundColor;

    /* `--color-text-brand` has a real dark value (the light periwinkle). Pinning the
       deep light blue here would leave the disc barely separated from the espresso
       page, and the story would still look plausible in a thumbnail. */
    await expect(fill).toBe(resolveColorToken(disc, '--color-text-brand'));
    await expect(fill).not.toBe(LIGHT_BRAND_FILL);

    // The shape still has to be discernible against whatever the page went to.
    await expect(
      contrastRatio(fill, effectiveBackground(disc.parentElement as HTMLElement))
    ).toBeGreaterThanOrEqual(3);
  },
};
