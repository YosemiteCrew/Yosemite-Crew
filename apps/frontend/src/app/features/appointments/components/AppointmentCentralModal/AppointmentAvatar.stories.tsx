import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';

import AppointmentAvatar from './AppointmentAvatar';

/**
 * A real asset on an allow-listed CDN host, so the photo branch renders what it
 * would in the app. Deliberately NOT the person avatar: the fallback resolves to
 * that one, so a pass-through story using it could not tell the two apart.
 */
const CDN_PHOTO = 'https://d2il6osz49gpup.cloudfront.net/avatar/business1.png';

/** The file `getSafeImageUrl(..., 'person')` degrades an untrusted source to. */
const PERSON_FALLBACK = 'avatar/parent1.png';

/** `--blue-text` in light. Named here only so the dark story can prove it did NOT get this. */
const LIGHT_BLUE_INK = 'rgb(22, 87, 201)';

/**
 * Resolve a token from inside the chip's own subtree rather than from `document`.
 * Several ink tokens are re-declared under `body:has([data-yc-app])`, so a probe
 * parked outside the component reads the marketing value and the comparison is
 * against the wrong number.
 */
const resolveColorToken = (near: Element, token: string): string => {
  const probe = globalThis.document.createElement('span');
  probe.style.color = `var(${token})`;
  near.append(probe);
  const value = globalThis.getComputedStyle(probe).color;
  probe.remove();
  return value;
};

const parseRgba = (value: string): [number, number, number, number] => {
  const parts = (value.match(/[\d.]+/g) ?? []).map(Number);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 1];
};

/**
 * `--color-primary-100` is a 16% tint in dark, so the chip's own
 * `backgroundColor` is not the colour anybody sees. Composite the translucent
 * layers down onto the first opaque ancestor - probing the raw rgba reports a
 * contrast that does not exist, which is how a 1.6:1 chip passes a colour check.
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

const chipsIn = (canvasElement: HTMLElement): HTMLElement[] =>
  Array.from(canvasElement.querySelectorAll<HTMLElement>('div[aria-hidden="true"]'));

const soleChip = (canvasElement: HTMLElement): HTMLElement => {
  const [chip] = chipsIn(canvasElement);
  if (!chip) throw new Error('no initials chip rendered');
  return chip;
};

const meta = {
  title: 'Appointments/AppointmentAvatar',
  component: AppointmentAvatar,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The small round avatar the central appointment panel puts next to a lead, a support ' +
          'staff member or a companion parent. It is two different elements behind one prop: ' +
          'with a `photoUrl` it is a `next/image`, and without one it is a monogram chip on ' +
          '`--color-primary-100`.\n\n' +
          'Three things about it only show up when it is rendered. The photo never goes ' +
          'straight to the DOM - `getSafeImageUrl(photoUrl, "person")` drops anything that is ' +
          'not an `https:` URL and substitutes the shared person avatar, so a relative upload ' +
          'path silently becomes the placeholder rather than a broken image. `size` drives the ' +
          'geometry inline but the 16px corner radius does NOT scale with it, so a 24px chip is ' +
          'a circle and a 48px chip is a squircle. And the two branches disagree about ' +
          'accessibility: the photo carries `alt={name}` and is announced, while the monogram ' +
          'chip is `aria-hidden`, on the assumption that the name is always written beside it.\n\n' +
          'The monogram ink is `--blue-text`, not the primary-700 fill step. `--color-primary-100` ' +
          'has a real dark value (a 16% tint that composites dark), so the fixed dark blue left ' +
          'these initials at 1.6:1 in dark mode - which is why there is a dark story below.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    size: { control: { type: 'range', min: 20, max: 64, step: 2 } },
    photoUrl: { control: 'text' },
  },
  args: {
    name: 'Amelia Kaur',
  },
} satisfies Meta<typeof AppointmentAvatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Initials: Story = {
  name: 'No photo on file',
  play: async ({ canvasElement }) => {
    const chip = soleChip(canvasElement);
    // First and LAST word, so a three-part name still yields two letters.
    await expect(chip).toHaveTextContent('AK');
    // No photo means no image element at all - the fallback is drawn, not fetched.
    await expect(within(canvasElement).queryByRole('img')).toBeNull();

    const box = chip.getBoundingClientRect();
    await expect(box.width).toBe(32);
    await expect(box.height).toBe(32);

    // 12px initials on a pale tint are the easiest thing in this panel to make
    // unreadable, and nothing in the app would show it - measure it.
    const ink = globalThis.getComputedStyle(chip.querySelector('span') as HTMLElement).color;
    await expect(contrastRatio(ink, effectiveBackground(chip))).toBeGreaterThanOrEqual(4.5);
  },
};

export const SingleWordName: Story = {
  name: 'One-word name',
  args: { name: 'Cher' },
  play: async ({ canvasElement }) => {
    /* Exactly one letter. Dropping the single-part branch in `getInitials` makes
       the first and last word the same word and the chip reads "CC" - which
       still looks like a plausible monogram, so nothing else would catch it. */
    await expect(soleChip(canvasElement)).toHaveTextContent('C');
    await expect(soleChip(canvasElement).textContent).toHaveLength(1);
  },
};

export const Sizes: Story = {
  name: 'Sizes 24 / 32 / 48',
  render: (args) => (
    <div className="flex items-center gap-3">
      <AppointmentAvatar {...args} size={24} />
      <AppointmentAvatar {...args} size={32} />
      <AppointmentAvatar {...args} size={48} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const chips = chipsIn(canvasElement);
    await expect(chips).toHaveLength(3);

    for (const [index, expected] of [24, 32, 48].entries()) {
      const box = chips[index].getBoundingClientRect();
      await expect(box.width).toBe(expected);
      await expect(box.height).toBe(expected);
      /* The radius is a constant 16px, NOT half the size. That is the whole
         reason the three chips do not look like the same shape scaled: 16 >= 24/2
         rounds the small one to a circle while the 48 stays a squircle. Anyone
         "fixing" this to `size / 2` changes the 48px avatar's silhouette. */
      await expect(globalThis.getComputedStyle(chips[index]).borderRadius).toBe('16px');
    }
  },
};

export const WithPhoto: Story = {
  name: 'Photo on file',
  args: { photoUrl: CDN_PHOTO, size: 48 },
  play: async ({ canvasElement }) => {
    // The photo branch IS announced - it is the only one of the two that is.
    const img = within(canvasElement).getByRole('img', { name: 'Amelia Kaur' });
    // Intrinsic width/height come off `size`; without them next/image reserves
    // the wrong box and the row reflows once the file lands.
    await expect(img).toHaveAttribute('width', '48');
    await expect(img).toHaveAttribute('height', '48');
    // An https source survives `getSafeImageUrl` untouched. Asserting the
    // fallback is absent is the half that matters: a validator that rejected
    // every URL would still render an avatar and look completely fine.
    const src = decodeURIComponent(img.getAttribute('src') ?? '');
    await expect(src).toContain('avatar/business1.png');
    await expect(src).not.toContain(PERSON_FALLBACK);
    // The monogram is the other branch, not a layer underneath the photo.
    await expect(chipsIn(canvasElement)).toHaveLength(0);
  },
};

export const UntrustedPhotoUrl: Story = {
  name: 'Non-https photo degrades to the placeholder',
  args: { photoUrl: '/uploads/staff/amelia-kaur.png' },
  play: async ({ canvasElement }) => {
    const img = within(canvasElement).getByRole('img', { name: 'Amelia Kaur' });
    const src = decodeURIComponent(img.getAttribute('src') ?? '');
    /* An upload path, an `http:` URL or the literal string "undefined" is
       replaced by the shared person avatar. The guard worth pinning is the
       second half: the rejected value must not reach the DOM at all, because a
       src that merely 404s still leaks the path into the markup. */
    await expect(src).toContain(PERSON_FALLBACK);
    await expect(src).not.toContain('/uploads/');
  },
};

export const Dark: Story = {
  name: 'Dark: the monogram ink tracks the theme',
  globals: { theme: 'dark' },
  play: async ({ canvasElement }) => {
    const chip = soleChip(canvasElement);
    const ink = globalThis.getComputedStyle(chip.querySelector('span') as HTMLElement).color;

    // The ink is whatever --blue-text currently resolves to, which in dark is the
    // light periwinkle. A literal, or the primary-700 fill step, pins it to the
    // light value and the chip goes to 1.6:1 on a tint that composites dark.
    await expect(ink).toBe(resolveColorToken(chip, '--blue-text'));
    await expect(ink).not.toBe(LIGHT_BLUE_INK);

    /* And the number the comment in the component is about. The tint has to be
       composited onto the espresso page before it means anything: read straight
       off the chip it is a 16% periwinkle and the ratio looks fine either way. */
    await expect(contrastRatio(ink, effectiveBackground(chip))).toBeGreaterThanOrEqual(4.5);
  },
};
