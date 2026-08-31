import type { Meta, StoryObj } from '@storybook/react';
import { expect, waitFor, within } from 'storybook/test';

import type { Team } from '@/app/features/organization/types/team';
import { useAuthStore } from '@/app/stores/authStore';
import { getCalendarColumnGridStyle } from '../calendarLayout';
import { CalendarTeamNamesRow } from './CalendarTeamNamesRow';

const ORG_ID = 'org-storybook';
const ELENA = 'practitioner-elena';
const RAVI = 'practitioner-ravi';
const PRIYA = 'practitioner-priya';

const teamMember = (
  practionerId: string,
  name: string,
  speciality?: string,
  todayAppointment?: string
): Team => ({
  _id: `team-${practionerId}`,
  practionerId,
  organisationId: ORG_ID,
  name,
  role: 'VETERINARIAN',
  speciality: speciality ? [{ organisationId: ORG_ID, name: speciality }] : [],
  todayAppointment,
  status: 'Available',
  revokedPermissions: [],
  effectivePermissions: [],
  extraPerissions: [],
});

const TEAM: Team[] = [
  teamMember(ELENA, 'Dr. Elena Marsh', 'Small animals', '5'),
  teamMember(RAVI, 'Dr. Ravi Patel', 'Dentistry', '2'),
  teamMember(PRIYA, 'Priya Raman'),
];

/** Eight columns at 170px is 1360px of track - wider than any laptop pane. */
const WIDE_TEAM: Team[] = Array.from({ length: 8 }, (_, index) =>
  teamMember(`practitioner-${index}`, `Dr. Member ${index + 1}`, 'Small animals', String(index))
);

/**
 * `UserLabels` paints one column in --blue-text when `attributes.sub` matches its
 * practitioner id, and it reads that off the shared auth singleton. Other story
 * files seed the same singleton with real practitioner ids, so without an explicit
 * value here which column reads as "you" depends on story order. The snapshot is
 * restored on unmount so this file does not decide it for anyone else either.
 */
const withSignedInPractitioner = (sub: string) => () => {
  const snapshot = useAuthStore.getState();
  useAuthStore.setState({ attributes: { sub } });
  return () => {
    useAuthStore.setState(snapshot);
  };
};

/** The band is the parent of the labels grid: gutter, UserLabels, gutter. */
const bandOf = (canvasElement: HTMLElement, memberName: string): HTMLElement => {
  const labels = within(canvasElement).getByText(memberName).closest('div.grid') as HTMLElement;
  return labels.parentElement as HTMLElement;
};

/** Relative brightness of an `rgb(...)` string: 0 is black, 1 is white. */
const brightnessOf = (rgb: string): number => {
  const [r, g, b] = rgb.match(/\d+(\.\d+)?/g)?.map(Number) ?? [255, 255, 255];
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};

/** Resolves a design token to the colour the browser actually paints. */
const resolveToken = (host: HTMLElement, token: string): string => {
  const probe = globalThis.document.createElement('span');
  probe.style.color = `var(${token})`;
  host.append(probe);
  const painted = globalThis.getComputedStyle(probe).color;
  probe.remove();
  return painted;
};

const meta = {
  title: 'Appointments/Calendar/CalendarTeamNamesRow',
  component: CalendarTeamNamesRow,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The band that carries the team column headers. `UserLabels` draws the names; this ' +
          'component owns everything around them - the --screen-2 strip, the hairline it closes ' +
          'on, and the two 64px gutters that hold the strip in line with the hour column below ' +
          'it.\n\n' +
          'The gutters are the reason it exists. The band lives inside a horizontally scrolling ' +
          'track, so both are `sticky` and both take `background: inherit` - which is what stops ' +
          'the team names sliding underneath them in plain sight when a wide team is scrolled. ' +
          'An inherited background is invisible when it works and invisible in review when it ' +
          'does not, so the stories measure it rather than look at it.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    team: TEAM,
    teamColumnsStyle: getCalendarColumnGridStyle(TEAM.length, 170),
  },
  beforeEach: withSignedInPractitioner('practitioner-not-on-this-team'),
} satisfies Meta<typeof CalendarTeamNamesRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Three columns',
  play: async ({ canvasElement }) => {
    const band = bandOf(canvasElement, 'Dr. Elena Marsh');
    const [leftGutter, labels, rightGutter] = Array.from(band.children) as HTMLElement[];

    /* Both gutters are exactly 64px, matching the hour-label column of the grid
       underneath. They are stated as a pair as well as a number: a band whose
       gutters differ is a band whose columns no longer line up with the timeline,
       and every appointment in the day reads against the wrong practitioner. */
    await expect(leftGutter.getBoundingClientRect().width).toBeCloseTo(64, 0);
    await expect(rightGutter.getBoundingClientRect().width).toBeCloseTo(64, 0);
    await expect(labels.children).toHaveLength(TEAM.length);

    /* The band closes on --hairline, which is what every sibling calendar band
       closes on. It once closed on --color-neutral-200; that token is now an alias
       of --hairline, so the two are indistinguishable by eye today and the only
       thing keeping them from drifting apart again is an assertion. */
    const styles = globalThis.getComputedStyle(band);
    await expect(styles.borderBottomWidth).toBe('1px');
    await expect(styles.borderBottomColor).toBe(resolveToken(band, '--hairline'));

    // The strip is the raised --screen-2, not the page beneath it.
    await expect(styles.backgroundColor).toBe(resolveToken(band, '--screen-2'));
  },
};

export const StickyGutters: Story = {
  name: 'Gutters hold under horizontal scroll',
  args: {
    team: WIDE_TEAM,
    teamColumnsStyle: getCalendarColumnGridStyle(WIDE_TEAM.length, 170),
  },
  decorators: [
    (Story) => (
      <div data-scroll-host="" style={{ width: 480, overflowX: 'auto' }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const scroller = canvasElement.querySelector('[data-scroll-host]') as HTMLElement;
    const band = bandOf(canvasElement, 'Dr. Member 1');
    const [leftGutter, , rightGutter] = Array.from(band.children) as HTMLElement[];

    // `min-w-max` means the band is as wide as its track, not as wide as the pane.
    await expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth);

    scroller.scrollLeft = 300;
    const scrollerBox = () => scroller.getBoundingClientRect();

    await waitFor(async () => {
      // The band itself has moved left, so this is a real scroll and not a no-op.
      await expect(band.getBoundingClientRect().left).toBeLessThan(scrollerBox().left - 100);
    });

    /* Both gutters stayed welded to the edges of the scrollport. Lose the sticky and
       they travel with the band: the leftmost columns then run off the side with no
       chrome to sit under, which reads as names sliced in half. */
    await expect(leftGutter.getBoundingClientRect().left).toBeCloseTo(scrollerBox().left, 0);
    await expect(rightGutter.getBoundingClientRect().right).toBeCloseTo(scrollerBox().right, 0);

    /* And they are opaque while they do it. `background: inherit` is the only thing
       between a scrolled-under name and the gutter it should disappear behind - a
       transparent gutter looks perfect until something scrolls beneath it. */
    const gutterFill = globalThis.getComputedStyle(leftGutter).backgroundColor;
    await expect(gutterFill).toBe(globalThis.getComputedStyle(band).backgroundColor);
    await expect(gutterFill).not.toBe('rgba(0, 0, 0, 0)');
  },
};

export const SingleMember: Story = {
  name: 'A one-practitioner clinic',
  args: {
    team: [TEAM[0]],
    teamColumnsStyle: getCalendarColumnGridStyle(1, 170),
  },
  play: async ({ canvasElement }) => {
    const band = bandOf(canvasElement, 'Dr. Elena Marsh');
    const [leftGutter, labels, rightGutter] = Array.from(band.children) as HTMLElement[];

    await expect(labels.children).toHaveLength(1);

    /* The gutters are fixed track, not padding that collapses when there is little
       to pad. One practitioner is the smallest real case and the one where a
       percentage-based gutter would quietly stop matching the hour column. */
    await expect(leftGutter.getBoundingClientRect().width).toBeCloseTo(64, 0);
    await expect(rightGutter.getBoundingClientRect().width).toBeCloseTo(64, 0);
    await expect(labels.getBoundingClientRect().width).toBeGreaterThanOrEqual(170);
  },
};

export const CurrentPractitioner: Story = {
  name: 'The column that is you',
  beforeEach: withSignedInPractitioner(RAVI),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const mine = canvas.getByText('Dr. Ravi Patel');
    const theirs = canvas.getByText('Dr. Elena Marsh');

    /* One column is marked as the signed-in practitioner's, by colour alone. Colour
       alone is exactly the kind of signal that survives a refactor while pointing at
       the wrong person, and --blue-text is specifically the ink-tuned member of the
       blue family - the brand fill next to it has no dark value at all. */
    await expect(globalThis.getComputedStyle(mine).color).toBe(
      resolveToken(canvasElement, '--blue-text')
    );
    await expect(globalThis.getComputedStyle(theirs).color).toBe(
      resolveToken(canvasElement, '--ink')
    );
  },
};

export const Dark: Story = {
  name: 'Dark',
  globals: { theme: 'dark' },
  play: async ({ canvasElement }) => {
    const band = bandOf(canvasElement, 'Dr. Elena Marsh');
    const [leftGutter] = Array.from(band.children) as HTMLElement[];

    /* First, proof the story is in the dark palette at all. A story-level global
       that never reaches the preview fails with no symptom - the viewport global
       has exactly that shape, it resizes the iframe from the manager and does
       nothing when the story is opened directly - and every token assertion below
       would pass just as happily against the light values. */
    const bandFill = globalThis.getComputedStyle(band).backgroundColor;
    await expect(brightnessOf(bandFill)).toBeLessThan(0.3);

    // The band tracks the token rather than a light-mode literal.
    await expect(bandFill).toBe(resolveToken(band, '--screen-2'));

    /* The dark strip is where an inherited-background bug would be worst: a
       transparent gutter over dark names is not a subtle smear, it is unreadable
       text sliding across the date. Same check as the scrolled story, run against
       the palette nobody opens. */
    await expect(globalThis.getComputedStyle(leftGutter).backgroundColor).toBe(
      globalThis.getComputedStyle(band).backgroundColor
    );
    await expect(globalThis.getComputedStyle(band).borderBottomColor).toBe(
      resolveToken(band, '--hairline')
    );
  },
};
