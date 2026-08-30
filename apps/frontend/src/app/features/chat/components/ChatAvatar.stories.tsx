import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';

import { ChatAvatar, type ChatAvatarProps } from './ChatAvatar';

type SizeToken = NonNullable<ChatAvatarProps['size']>;

/**
 * Every story is bedded on `--screen-2`, because that is the token the presence
 * dot borders itself with. On any other surface the dot's 2px ring reads as a
 * halo rather than as the cut-out it is meant to be, and a broken ring colour
 * would look deliberate.
 */
const Bed = (Story: React.ComponentType) => (
  <div data-testid="bed" className="flex flex-wrap items-end gap-6 bg-[var(--screen-2)] p-6">
    <Story />
  </div>
);

const Specimen = ({
  testId,
  caption,
  children,
}: {
  testId: string;
  caption: string;
  children: React.ReactNode;
}) => (
  <div data-testid={testId} className="inline-flex flex-col items-center gap-2">
    {children}
    <span className="text-[10px] text-[var(--ink-muted)]">{caption}</span>
  </div>
);

/**
 * The avatar is two nested spans and neither carries a role or a test id: the
 * outer one only exists to position the presence dot, the inner one is the
 * monogram box that every size token measures. Both handles come from the DOM
 * shape, so a refactor that flattens them fails loudly here instead of quietly
 * moving the dot.
 */
const boxes = (specimen: HTMLElement) => {
  const outer = specimen.firstElementChild as HTMLElement;
  return { outer, monogram: outer.firstElementChild as HTMLElement };
};

/** The dot has no role, no text and no label, so its class is the only handle. */
const presenceDots = (outer: HTMLElement): HTMLElement[] =>
  Array.from(outer.querySelectorAll<HTMLElement>('.chat-presence-dot'));

/**
 * Computed value of a design token, resolved through a throwaway probe mounted
 * in the SAME subtree as the element under test. Comparing a background
 * (`rgb(232, 224, 210)`) against the raw token text (`#e8e0d2`) never matches,
 * and the avatar tokens are re-declared for dark and again inside the
 * PIMS-scoped block - a probe parked on `document.body` can resolve a different
 * value than the avatar beside it.
 */
const resolveToken = (near: HTMLElement, token: string): string => {
  const probe = globalThis.document.createElement('span');
  probe.style.backgroundColor = `var(${token})`;
  near.append(probe);
  const value = globalThis.getComputedStyle(probe).backgroundColor;
  probe.remove();
  return value;
};

/**
 * `row` is the only token with a responsive arm (`size-9 xl:size-10`), so its
 * expected size is read off the same breakpoint the class uses. Hard-coding
 * either number would make the story pass or fail by harness: the verify runner
 * loads `iframe.html` directly at a fixed 1280 no matter which viewport global
 * a story pins, while the manager honours the pin and renders 375.
 */
const rowSizePx = (): number => (globalThis.matchMedia('(min-width: 1280px)').matches ? 40 : 36);

const meta = {
  title: 'Chat/ChatAvatar',
  component: ChatAvatar,
  decorators: [Bed],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Monogram avatar for every chat surface - conversation rows, the channel header, the ' +
          'colleague and network directories. Three mutually exclusive faces: deterministic ' +
          'coloured initials seeded from the name, a neutral group glyph, and a blue rounded-square ' +
          'clinic glyph for across-the-network rows. Seven size tokens carry the fixed pixel sizes ' +
          'the design calls for, and `row` is the only one that steps up on the wide desktop frame.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    name: 'Marta Alvarez (owner)',
    size: 'md',
  },
} satisfies Meta<typeof ChatAvatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Initials with a presence dot',
  args: { online: true },
  play: async ({ canvasElement }) => {
    const { outer, monogram } = boxes(within(canvasElement).getByTestId('bed'));

    /* "(owner)" is a directory suffix the network lists append, not a third name.
       Dropping the `split('(')` would render "MA(" here - two initials where the
       second is a bracket - and nothing else in the app would notice. */
    await expect(monogram.textContent).toBe('MA');

    const box = monogram.getBoundingClientRect();
    // md is spelled `h-11 w-11` rather than `size-11`; both must still be 44.
    await expect(Math.round(box.width)).toBe(44);
    await expect(Math.round(box.height)).toBe(44);

    const [dot, ...extra] = presenceDots(outer);
    await expect(extra).toHaveLength(0);
    const dotBox = dot.getBoundingClientRect();
    await expect(Math.round(dotBox.width)).toBe(10);
    await expect(Math.round(dotBox.height)).toBe(10);

    /* The dot is out of flow and hangs 2px past the bottom-right corner. The
       relation that matters is the last one: the avatar's own box stays 44px, so
       a conversation list does not reflow the instant somebody comes online. */
    await expect(Math.round(dotBox.right - box.right)).toBe(2);
    await expect(Math.round(dotBox.bottom - box.bottom)).toBe(2);
    await expect(Math.round(outer.getBoundingClientRect().width)).toBe(44);
  },
};

export const Glyphs: Story = {
  name: 'Person, group and clinic',
  render: (args) => (
    <>
      <Specimen testId="spec-person" caption="person, offline">
        <ChatAvatar {...args} name="Marta Alvarez" />
      </Specimen>
      <Specimen testId="spec-group" caption="group">
        <ChatAvatar {...args} name="Ward round · ICU" group />
      </Specimen>
      <Specimen testId="spec-business" caption="clinic">
        <ChatAvatar {...args} name="Riverside Veterinary Clinic" business />
      </Specimen>
    </>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const person = boxes(canvas.getByTestId('spec-person'));
    const group = boxes(canvas.getByTestId('spec-group'));
    const business = boxes(canvas.getByTestId('spec-business'));

    // Offline is the absence of the dot, not a greyed-out one.
    await expect(presenceDots(person.outer)).toHaveLength(0);

    /* The glyph branches suppress the initials entirely. Without the `!isGlyph`
       guard a group would render "WR" stacked behind the people glyph - legible
       enough in review to be missed, and wrong on every conversation row. */
    await expect(person.monogram.textContent).toBe('MA');
    await expect(group.monogram.textContent).toBe('');
    await expect(business.monogram.textContent).toBe('');

    for (const host of [group.monogram, business.monogram]) {
      const svgs = host.querySelectorAll('svg');
      await expect(svgs).toHaveLength(1);
      /* The glyph is decoration next to a name that is already in the row, so it
         must stay out of the accessibility tree. react-icons spreads unknown
         props onto the <svg>; if that ever stops, screen readers start reading
         the raw icon title and nothing visual changes. */
      await expect(svgs[0]).toHaveAttribute('aria-hidden', 'true');
    }

    /* A group is a neutral band swatch, deliberately NOT seeded from its title:
       a channel is not a person and must not borrow a person's accent. */
    const band = resolveToken(group.monogram, '--band');
    await expect(globalThis.getComputedStyle(group.monogram).backgroundColor).toBe(band);
    await expect(globalThis.getComputedStyle(person.monogram).backgroundColor).not.toBe(band);

    /* A clinic is the only face that is not a circle - a 12px rounded square in
       the blue tint, which is what tells a network row apart from a colleague. */
    await expect(globalThis.getComputedStyle(business.monogram).borderTopLeftRadius).toBe('12px');
    await expect(globalThis.getComputedStyle(business.monogram).backgroundColor).toBe(
      resolveToken(business.monogram, '--blue-soft')
    );
    const personRadius = Number.parseFloat(
      globalThis.getComputedStyle(person.monogram).borderTopLeftRadius
    );
    // `rounded-full` resolves to an enormous px value; anything at or above half
    // the 44px box paints as a circle.
    await expect(personRadius).toBeGreaterThanOrEqual(22);
  },
};

/**
 * The seven tokens and the pixel size each one promises. These are read off the
 * design, not off the class strings, so renaming `size-9` to something that
 * computes differently is caught here rather than in a screenshot diff.
 */
const SIZE_SCALE: ReadonlyArray<readonly [SizeToken, number]> = [
  ['xs', 26],
  ['xxs', 30],
  ['sm', 36],
  ['row', 0], // responsive, resolved in the play function
  ['md', 44],
  ['lg', 48],
  ['xl', 52],
];

export const SizeScale: Story = {
  name: 'Seven size tokens',
  parameters: {
    docs: {
      description: {
        story:
          'Each token is a fixed pixel size the layouts depend on: 26 for the compact list, 30 for ' +
          'the conversation-info member row, 36/40 for the conversation row itself, 44 and 48 for ' +
          'headers, 52 for the conversation-info header.',
      },
    },
  },
  render: ({ name }) => (
    <>
      {SIZE_SCALE.map(([token]) => (
        <Specimen key={token} testId={`spec-${token}`} caption={token}>
          <ChatAvatar name={name} size={token} />
        </Specimen>
      ))}
    </>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const [token, fixed] of SIZE_SCALE) {
      const expected = token === 'row' ? rowSizePx() : fixed;
      const { monogram } = boxes(canvas.getByTestId(`spec-${token}`));
      const box = monogram.getBoundingClientRect();
      await expect({ token, w: Math.round(box.width), h: Math.round(box.height) }).toEqual({
        token,
        w: expected,
        h: expected,
      });
    }
  },
};

export const NameFallbacks: Story = {
  name: 'What the monogram does to an awkward name',
  render: (args) => (
    <>
      <Specimen testId="spec-single" caption="one word">
        <ChatAvatar {...args} name="Kiko" />
      </Specimen>
      <Specimen testId="spec-suffixed" caption="(owner) suffix">
        <ChatAvatar {...args} name="Marta Alvarez (owner)" />
      </Specimen>
      <Specimen testId="spec-three" caption="three words">
        <ChatAvatar {...args} name="Ana Maria Lopez" />
      </Specimen>
      <Specimen testId="spec-hyphen" caption="hyphenated">
        <ChatAvatar {...args} name="Konstantina Papadopoulou-Fitzgerald" />
      </Specimen>
      <Specimen testId="spec-blank" caption="blank">
        <ChatAvatar {...args} name="   " />
      </Specimen>
    </>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const monogramOf = (testId: string) => boxes(canvas.getByTestId(testId)).monogram.textContent;

    // A single name yields a single initial, not a padded or doubled one.
    await expect(monogramOf('spec-single')).toBe('K');
    await expect(monogramOf('spec-suffixed')).toBe('MA');
    // Two initials is the cap: a middle name must not push the box to three glyphs.
    await expect(monogramOf('spec-three')).toBe('AM');
    // Split is on whitespace only, so a double-barrelled surname stays one part.
    await expect(monogramOf('spec-hyphen')).toBe('KP');
    /* A name that is only whitespace still has to paint something. An empty
       monogram is a coloured blank disc that reads as a loading state. */
    await expect(monogramOf('spec-blank')).toBe('?');

    // The fallback does not collapse the box - it is still a full 44px avatar.
    const blank = boxes(canvas.getByTestId('spec-blank')).monogram.getBoundingClientRect();
    await expect(Math.round(blank.width)).toBe(44);
  },
};

/**
 * One name per palette slot. The seeds are picked so that
 * `hash(name) % 4` lands on 0, 1, 2 and 3 respectively - if the palette is ever
 * reordered or resized these names move, and the story below says so by failing
 * on the distinct-colour count rather than on a hard-coded hex.
 */
const BUCKET_SEEDS = ['Iris Lund', 'Sam Okafor', 'Lena Fischer', 'Nadia Osei'] as const;

export const SeededAccent: Story = {
  name: 'Colour is seeded from the name',
  render: (args) => (
    <>
      {BUCKET_SEEDS.map((seed) => (
        <Specimen key={seed} testId={`spec-${seed.split(' ')[0].toLowerCase()}`} caption={seed}>
          <ChatAvatar {...args} name={seed} />
        </Specimen>
      ))}
      <Specimen testId="spec-iris-again" caption="Iris Lund, second row">
        <ChatAvatar {...args} name="Iris Lund" />
      </Specimen>
    </>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const bgOf = (testId: string) =>
      globalThis.getComputedStyle(boxes(canvas.getByTestId(testId)).monogram).backgroundColor;

    /* The same person keeps the same colour wherever they appear - the sidebar
       row, the header and the member list are three separate renders of one
       name, and a colour that drifted between them would look like two people. */
    await expect(bgOf('spec-iris-again')).toBe(bgOf('spec-iris'));

    /* All four palette slots are reachable and distinct. A hash that degenerated
       to a constant, or two palette entries that drifted onto the same tint,
       both show up as a smaller set - and both would look merely "calm" in
       review rather than broken. */
    const swatches = new Set(
      BUCKET_SEEDS.map((seed) => bgOf(`spec-${seed.split(' ')[0].toLowerCase()}`))
    );
    await expect(swatches.size).toBe(4);
  },
};
