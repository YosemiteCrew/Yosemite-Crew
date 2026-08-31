import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';

import type { Team } from '@/app/features/organization/types/team';
import { useAuthStore } from '@/app/stores/authStore';
import { getCalendarColumnGridStyle } from '../calendarLayout';
import UserLabels from './UserLabels';

const ORG_ID = 'org-storybook';
const ELENA = 'practitioner-elena';
const RAVI = 'practitioner-ravi';
const PRIYA = 'practitioner-priya';

/**
 * A real asset on an allow-listed CDN host, so the photo branch renders through
 * next/image the way it does in the product instead of falling back to markup a
 * blocked host would produce.
 */
const CDN_PHOTO = 'https://d2il6osz49gpup.cloudfront.net/avatar/business1.png';

const teamMember = (practionerId: string, name: string, extras: Partial<Team> = {}): Team => ({
  _id: `team-${practionerId}`,
  practionerId,
  organisationId: ORG_ID,
  name,
  role: 'VETERINARIAN',
  speciality: [],
  status: 'Available',
  revokedPermissions: [],
  effectivePermissions: [],
  extraPerissions: [],
  ...extras,
});

const speciality = (name: string) => [{ organisationId: ORG_ID, name }];

/**
 * One member per shape of the subline, which is a two-part join: speciality and
 * "N today", each optional. Elena has both, Ravi only a speciality, Priya only a
 * count - so a join that stopped filtering the empty half would show a dangling
 * separator on two of these three columns.
 */
const TEAM: Team[] = [
  teamMember(ELENA, 'Dr. Elena Marsh', {
    image: CDN_PHOTO,
    speciality: speciality('Small animals'),
    todayAppointment: '5',
  }),
  teamMember(RAVI, 'Dr. Ravi Patel', { speciality: speciality('Dentistry') }),
  teamMember(PRIYA, 'Priya Raman', { todayAppointment: '3' }),
];

/** Four columns, no photos: the fourth is where the three-colour rotation wraps. */
const FOUR_WITHOUT_PHOTOS: Team[] = [
  teamMember('practitioner-1', 'Anna Bell'),
  teamMember('practitioner-2', 'Ben Cole'),
  teamMember('practitioner-3', 'Cara Dunn'),
  teamMember('practitioner-4', 'Dev Ellis'),
];

/**
 * The highlight comes off the shared auth singleton, not a prop. Other story files
 * seed the same singleton with real practitioner ids, so without an explicit value
 * here which column reads as "you" depends on story order. The snapshot is restored
 * on unmount so this file does not decide it for anyone else either.
 */
const withSignedIn = (attributes: Record<string, string> | null) => () => {
  const snapshot = useAuthStore.getState();
  useAuthStore.setState({ attributes });
  return () => {
    useAuthStore.setState(snapshot);
  };
};

/** The labels grid itself, and the band the decorator paints behind it. */
const gridOf = (canvasElement: HTMLElement) =>
  canvasElement.querySelector('div.grid') as HTMLElement;
const bandOf = (canvasElement: HTMLElement) =>
  canvasElement.querySelector('[data-band]') as HTMLElement;

/** The aria-hidden initials chips, in column order. */
const chipsIn = (canvasElement: HTMLElement) =>
  [...canvasElement.querySelectorAll('span[aria-hidden="true"]')] as HTMLElement[];

type Rgb = { r: number; g: number; b: number };

const parseRgb = (value: string): Rgb => {
  const [r = 0, g = 0, b = 0] = (value.match(/[\d.]+/g) ?? []).map(Number);
  return { r, g, b };
};

const toLinear = (channel: number): number => {
  const srgb = channel / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
};

const luminance = ({ r, g, b }: Rgb): number =>
  0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

/** Ink against an opaque ground. Both --ink and --screen-2 are opaque in both themes. */
const contrast = (ink: string, ground: string): number => {
  const inkLuminance = luminance(parseRgb(ink));
  const groundLuminance = luminance(parseRgb(ground));
  return (
    (Math.max(inkLuminance, groundLuminance) + 0.05) /
    (Math.min(inkLuminance, groundLuminance) + 0.05)
  );
};

/**
 * What `var(token)` resolves to right here, serialized the way a computed `color`
 * is so the two compare directly. Probed from inside the component's own subtree:
 * several of these tokens are re-declared under the PIMS `body:has([data-yc-app])`
 * scope and a probe parked outside reads the marketing value.
 */
const resolveToken = (near: Element, token: string): string => {
  const probe = globalThis.document.createElement('span');
  probe.style.color = `var(${token})`;
  near.append(probe);
  const value = globalThis.getComputedStyle(probe).color;
  probe.remove();
  return value;
};

const meta = {
  title: 'Appointments/Calendar/UserLabels',
  component: UserLabels,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The team column headers of the day planner: a 30px avatar - the practitioner photo, or ' +
          'initials on one of three rotating warm palettes - beside a 13px name and an optional ' +
          '"speciality · N today" subline.\n\n' +
          'Two things here are carried by colour alone and so fail silently. The palette rotates ' +
          'on the column INDEX, which is what keeps a colleague the same colour between visits; ' +
          "and the signed-in practitioner's own column is marked only by its ink. That ink is " +
          '--blue-text rather than the brand fill next to it in the palette: the fill is declared ' +
          'once at :root with no dark value, so the label saying "this column is you" sat at ' +
          '2.50:1 on the dark header until it was moved. The stories measure the contrast rather ' +
          'than look at it.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    team: TEAM,
    columnsStyle: getCalendarColumnGridStyle(TEAM.length, 170),
  },
  decorators: [
    /* The labels have no ground of their own - in the planner they sit on the
       --screen-2 band that CalendarTeamNamesRow paints. Rendering them on the bare
       preview canvas would hide every contrast problem the header actually has.

       The band also SCROLLS, which is not decoration either. This grid is `min-w-max`
       on a 170px-per-column track and CalendarTeamNamesRow is `min-w-max` around it,
       because the header has to stay in lockstep with the appointment columns beneath
       it - it is built to be wider than the screen and to scroll with the planner.
       A band that only painted the colour let that overrun escape onto the document,
       so a width sweep read the deliberate design as a phone-layout bug. maxWidth
       keeps the band inside whatever canvas it is given; the overrun scrolls. */
    (Story) => (
      <div
        data-band=""
        style={{ width: 520, maxWidth: '100%', overflowX: 'auto', background: 'var(--screen-2)' }}
      >
        <Story />
      </div>
    ),
  ],
  beforeEach: withSignedIn({ sub: 'practitioner-not-on-this-team' }),
} satisfies Meta<typeof UserLabels>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Three columns',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const grid = gridOf(canvasElement);
    await expect(grid.children).toHaveLength(3);

    /* The photo is a real 30px box. next/image lays out at its intrinsic size the
       moment the size utility stops applying, and a 400px avatar in a 170px column
       does not clip - it shoves every other column off the timeline. */
    const photo = canvas.getByRole('img', { name: 'Dr. Elena Marsh' });
    await expect(photo.getBoundingClientRect().width).toBeCloseTo(30, 0);
    await expect(photo.getBoundingClientRect().height).toBeCloseTo(30, 0);

    /* Only the two members without a photo fall back to initials, and those chips
       are aria-hidden: the name is real text right beside them, so an announced
       chip reads every column out twice. */
    const chips = chipsIn(canvasElement);
    await expect(chips).toHaveLength(2);
    await expect(chips.map((chip) => chip.textContent)).toEqual(['RP', 'PR']);
    await expect(chips[0].getBoundingClientRect().width).toBeCloseTo(30, 0);

    // All three shapes of the subline, including the two half-empty ones.
    await expect(canvas.getByText('Small animals · 5 today')).toBeVisible();
    await expect(canvas.getByText('Dentistry')).toBeVisible();
    await expect(canvas.getByText('3 today')).toBeVisible();
  },
};

export const Palettes: Story = {
  name: 'The avatar colour rotates every third column',
  args: {
    team: FOUR_WITHOUT_PHOTOS,
    columnsStyle: getCalendarColumnGridStyle(FOUR_WITHOUT_PHOTOS.length, 170),
  },
  play: async ({ canvasElement }) => {
    const chips = chipsIn(canvasElement);
    await expect(chips).toHaveLength(4);

    const fills = chips.map((chip) => globalThis.getComputedStyle(chip).backgroundColor);
    const inks = chips.map((chip) => globalThis.getComputedStyle(chip).color);

    /* Three palettes, then back to the first. The point of keying on the index is
       that a colleague keeps one colour across a day of re-renders; if the tokens
       ever resolve to nothing the chips all go transparent together, which still
       looks tidy and makes every column identical. */
    await expect(new Set(fills.slice(0, 3)).size).toBe(3);
    await expect(new Set(inks.slice(0, 3)).size).toBe(3);
    await expect(fills[3]).toBe(fills[0]);
    await expect(inks[3]).toBe(inks[0]);
    for (const fill of fills) {
      await expect(fill).not.toBe('rgba(0, 0, 0, 0)');
    }
  },
};

export const NameOnly: Story = {
  name: 'No speciality and nothing booked',
  args: {
    team: [teamMember(ELENA, 'Dr. Elena Marsh')],
    columnsStyle: getCalendarColumnGridStyle(1, 170),
  },
  play: async ({ canvasElement }) => {
    const name = within(canvasElement).getByText('Dr. Elena Marsh');
    const textBlock = name.parentElement as HTMLElement;

    /* The subline is dropped, not emptied. Both halves of the join are optional, so
       a member with neither would otherwise render an empty 11px div - an invisible
       element that still takes a line and makes this column taller than its
       neighbours, tipping the whole header row. */
    await expect(textBlock.children).toHaveLength(1);
    await expect(textBlock.textContent).toBe('Dr. Elena Marsh');
  },
};

export const SignedInColumn: Story = {
  name: 'The column that is you',
  beforeEach: withSignedIn({ sub: RAVI }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const mine = canvas.getByText('Dr. Ravi Patel');
    const theirs = canvas.getByText('Dr. Elena Marsh');

    // Exactly one column is marked, and it is the practitioner whose id matches.
    await expect(globalThis.getComputedStyle(mine).color).toBe(
      resolveToken(canvasElement, '--blue-text')
    );
    await expect(globalThis.getComputedStyle(theirs).color).toBe(
      resolveToken(canvasElement, '--ink')
    );

    /* And it is readable. This is the assertion the component's comment exists for:
       the brand FILL from the same blue family has no dark value, so marking the
       column with it left the label at 2.50:1 on the dark header. 13px bold is not
       large text, so AA here is 4.5:1. */
    const band = globalThis.getComputedStyle(bandOf(canvasElement)).backgroundColor;
    await expect(contrast(globalThis.getComputedStyle(mine).color, band)).toBeGreaterThanOrEqual(
      4.5
    );
  },
};

export const SignedInByEmail: Story = {
  name: 'Matched on email when there is no sub',
  args: {
    team: [
      teamMember(ELENA, 'Dr. Elena Marsh'),
      teamMember('ravi@brightpaws.test', 'Dr. Ravi Patel'),
    ],
    columnsStyle: getCalendarColumnGridStyle(2, 170),
  },
  beforeEach: withSignedIn({ email: 'ravi@brightpaws.test' }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Organisations whose practitioner ids ARE the sign-in email rely on the `sub ||
       email` fallback. Nothing throws when it goes: the header simply stops telling
       anyone which column is theirs, on exactly the deployments that need it. */
    await expect(globalThis.getComputedStyle(canvas.getByText('Dr. Ravi Patel')).color).toBe(
      resolveToken(canvasElement, '--blue-text')
    );
    await expect(globalThis.getComputedStyle(canvas.getByText('Dr. Elena Marsh')).color).toBe(
      resolveToken(canvasElement, '--ink')
    );
  },
};

export const LongName: Story = {
  name: 'A long name widens the whole track',
  args: {
    team: [
      teamMember(ELENA, 'Dr. Bartholomew Wigglesworth-Fairweather', {
        speciality: speciality('Exotic companion animal medicine'),
        todayAppointment: '12',
      }),
      ...TEAM.slice(1),
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const grid = gridOf(canvasElement);
    const name = canvas.getByText('Dr. Bartholomew Wigglesworth-Fairweather');

    /* Both lines carry `truncate`, but nothing here clamps: the grid is `min-w-max`,
       so its columns are never narrower than their own max-content and the ellipsis
       has no way to appear. Recorded as it behaves rather than as it reads - a long
       name grows the header track instead of clipping. */
    await expect(name.scrollWidth).toBe(name.clientWidth);
    await expect(grid.getBoundingClientRect().width).toBeGreaterThan(
      bandOf(canvasElement).getBoundingClientRect().width
    );

    /* What has to hold instead is that the growth is shared. The header grid sits
       directly above the appointment columns on the same track: three equal columns
       stay in step with the grid below whatever the widest name does, one wide
       column and two narrow ones puts every booking under the wrong practitioner. */
    const widths = [...grid.children].map((cell) => Math.round(cell.getBoundingClientRect().width));
    await expect(new Set(widths).size).toBe(1);
  },
};

export const Dark: Story = {
  name: 'Dark',
  globals: { theme: 'dark' },
  beforeEach: withSignedIn({ sub: RAVI }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const band = globalThis.getComputedStyle(bandOf(canvasElement)).backgroundColor;

    /* First, proof the story is in the dark palette at all. A story-level global that
       never reaches the preview fails with no symptom, and every assertion below
       would pass just as happily against the light values. */
    await expect(luminance(parseRgb(band))).toBeLessThan(0.1);

    /* The whole reason the component names --blue-text: this is the header that was
       painting #0057c2 on #221d17 at 2.50:1. --blue-text inverts with the theme, the
       brand fill it replaced does not. */
    const mine = globalThis.getComputedStyle(canvas.getByText('Dr. Ravi Patel')).color;
    await expect(mine).toBe(resolveToken(canvasElement, '--blue-text'));
    await expect(contrast(mine, band)).toBeGreaterThanOrEqual(4.5);

    // The columns that are not yours stay on plain ink, and stay readable too.
    const theirs = globalThis.getComputedStyle(canvas.getByText('Dr. Elena Marsh')).color;
    await expect(theirs).toBe(resolveToken(canvasElement, '--ink'));
    await expect(contrast(theirs, band)).toBeGreaterThanOrEqual(4.5);
  },
};
