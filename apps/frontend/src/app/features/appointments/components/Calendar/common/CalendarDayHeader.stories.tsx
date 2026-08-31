import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import type { Team } from '@/app/features/organization/types/team';
import { useAuthStore } from '@/app/stores/authStore';
import { getCalendarColumnGridStyle } from '../calendarLayout';
import CalendarDayHeader from './CalendarDayHeader';

const ORG_ID = 'org-storybook';
const ELENA = 'practitioner-elena';
const RAVI = 'practitioner-ravi';
const PRIYA = 'practitioner-priya';

const teamMember = (practionerId: string, name: string, specialityName?: string): Team => ({
  _id: `team-${practionerId}`,
  practionerId,
  organisationId: ORG_ID,
  name,
  role: 'VETERINARIAN',
  speciality: specialityName ? [{ organisationId: ORG_ID, name: specialityName }] : [],
  status: 'Available',
  revokedPermissions: [],
  effectivePermissions: [],
  extraPerissions: [],
});

const TEAM: Team[] = [
  teamMember(ELENA, 'Dr. Elena Marsh', 'Small animals'),
  teamMember(RAVI, 'Dr. Ravi Patel', 'Dentistry'),
  teamMember(PRIYA, 'Priya Raman'),
];

/** Eight columns at 170px is 1360px of track - wider than any laptop pane. */
const WIDE_TEAM: Team[] = Array.from({ length: 8 }, (_, index) =>
  teamMember(`practitioner-${index}`, `Dr. Member ${index + 1}`, 'Small animals')
);

/**
 * `weekday` and `dateNumber` arrive pre-formatted from the planner, which builds
 * them with `{ weekday: 'short' }` and `{ day: 'numeric' }` in the practice's
 * preferred timezone. The header itself does no date maths at all, so these are
 * plain strings rather than a Date that would drift with the runner's offset.
 */
const WEEKDAY = 'Tue';
const DATE_NUMBER = '14';

/**
 * The nested `UserLabels` paints one column in --blue-text when `attributes.sub`
 * matches its practitioner id, and it reads that off the shared auth singleton.
 * Other story files seed the same singleton with real practitioner ids, so without
 * an explicit value here which column reads as "you" depends on story order. The
 * snapshot is restored on unmount so this file does not decide it for anyone else.
 */
const withSignedInPractitioner = (sub: string) => () => {
  const snapshot = useAuthStore.getState();
  useAuthStore.setState({ attributes: { sub } });
  return () => {
    useAuthStore.setState(snapshot);
  };
};

/** The sticky date band: weekday, date number and (sometimes) the day arrows. */
const navOf = (canvasElement: HTMLElement) =>
  within(canvasElement).getByText(WEEKDAY).closest('div.sticky') as HTMLElement;

/** The date pair itself, which the arrows flank. */
const dateBlockOf = (canvasElement: HTMLElement) =>
  within(canvasElement).getByText(WEEKDAY).parentElement as HTMLElement;

/** The team names band underneath: gutter, labels grid, gutter. */
const namesRowOf = (canvasElement: HTMLElement, memberName: string) => {
  const labels = within(canvasElement).getByText(memberName).closest('div.grid') as HTMLElement;
  return { band: labels.parentElement as HTMLElement, labels };
};

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

const contrast = (ink: string, ground: string): number => {
  const inkLuminance = luminance(parseRgb(ink));
  const groundLuminance = luminance(parseRgb(ground));
  return (
    (Math.max(inkLuminance, groundLuminance) + 0.05) /
    (Math.min(inkLuminance, groundLuminance) + 0.05)
  );
};

/** Resolves a design token to the colour the browser actually paints, in place. */
const resolveToken = (near: Element, token: string): string => {
  const probe = globalThis.document.createElement('span');
  probe.style.color = `var(${token})`;
  near.append(probe);
  const value = globalThis.getComputedStyle(probe).color;
  probe.remove();
  return value;
};

const meta = {
  title: 'Appointments/Calendar/CalendarDayHeader',
  component: CalendarDayHeader,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The whole top of the day planner: the sticky date band stacked on the team names row.\n\n' +
          'It has two shapes, and which one you get is decided by the props rather than by a ' +
          'variant. The appointments planner omits the day arrows because its toolbar already ' +
          'owns the date-nav pill, and takes the wider padding that lines the date up with the ' +
          'hour column; the task calendar passes both handlers and keeps its arrows inline. The ' +
          'arrows are all-or-nothing - one handler on its own renders neither, which is worth ' +
          'knowing before wiring half of it.\n\n' +
          "Everything here lives inside the planner's horizontal scroll track, so the date band " +
          'is `sticky left-0 w-fit`: it stays legible at any scroll offset instead of riding off ' +
          'the side with the columns, and it does not stretch across the full scrollable width.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    weekday: WEEKDAY,
    dateNumber: DATE_NUMBER,
    team: TEAM,
    teamColumnsStyle: getCalendarColumnGridStyle(TEAM.length, 170),
  },
  beforeEach: withSignedInPractitioner('practitioner-not-on-this-team'),
} satisfies Meta<typeof CalendarDayHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Appointments planner: no inline arrows',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const nav = navOf(canvasElement);
    const { band } = namesRowOf(canvasElement, 'Dr. Elena Marsh');

    /* No arrows at all. This planner navigates from its toolbar pill, and a second
       pair of day arrows inside the scroll track is not a duplicate control so much
       as two controls that disagree about which day is showing. */
    await expect(canvas.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();

    /* Without them the band takes the wider padding, which is what puts the date
       over the 64px hour column rather than 8px adrift of it. */
    await expect(globalThis.getComputedStyle(nav).paddingLeft).toBe('16px');
    await expect(globalThis.getComputedStyle(nav).paddingRight).toBe('16px');

    await expect(canvas.getByText(DATE_NUMBER)).toBeVisible();

    // The date band sits above the names row, not beside it.
    await expect(nav.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      band.getBoundingClientRect().top + 1
    );
  },
};

export const WithDayArrows: Story = {
  name: 'Task calendar: inline day arrows',
  args: { onPrevDay: fn(), onNextDay: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const nav = navOf(canvasElement);
    const previous = canvas.getByRole('button', { name: 'Previous' });
    const next = canvas.getByRole('button', { name: 'Next' });

    /* Two icon buttons that differ only in which way a chevron points, sitting a few
       pixels apart. Nothing about a swapped pair looks wrong; the calendar just
       walks the wrong way. */
    await userEvent.click(previous);
    await expect(args.onPrevDay).toHaveBeenCalledTimes(1);
    await expect(args.onNextDay).not.toHaveBeenCalled();
    await userEvent.click(next);
    await expect(args.onNextDay).toHaveBeenCalledTimes(1);
    await expect(args.onPrevDay).toHaveBeenCalledTimes(1);

    // They flank the date rather than stacking on one side of it.
    const dateBlock = dateBlockOf(canvasElement).getBoundingClientRect();
    await expect(previous.getBoundingClientRect().right).toBeLessThanOrEqual(dateBlock.left);
    await expect(next.getBoundingClientRect().left).toBeGreaterThanOrEqual(dateBlock.right);

    // The band tightens its padding to make room for them.
    await expect(globalThis.getComputedStyle(nav).paddingLeft).toBe('8px');
  },
};

export const HalfWiredArrows: Story = {
  name: 'One handler renders neither arrow',
  args: { onNextDay: fn() },
  play: async ({ canvasElement }) => {
    /* `hasInlineNav` needs BOTH handlers. Wiring one is not half a nav, it is no nav
       - and it fails as a missing control rather than as an error, on a calendar
       whose only other way to change day is the toolbar this variant does not have. */
    await expect(within(canvasElement).queryAllByRole('button')).toHaveLength(0);
    await expect(within(canvasElement).getByText(DATE_NUMBER)).toBeVisible();
  },
};

export const StickyDate: Story = {
  name: 'The date holds under horizontal scroll',
  args: {
    team: WIDE_TEAM,
    teamColumnsStyle: getCalendarColumnGridStyle(WIDE_TEAM.length, 170),
    onPrevDay: fn(),
    onNextDay: fn(),
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
    const nav = navOf(canvasElement);
    const header = nav.parentElement as HTMLElement;

    // `min-w-max` means the header is as wide as the team track, not as wide as the pane.
    await expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth);

    /* `w-fit` on the band: it sizes to the date and its arrows, not to the 1360px
       track. Stretched, its --screen-2 fill would cover the whole names row. */
    await expect(nav.getBoundingClientRect().width).toBeLessThan(
      header.getBoundingClientRect().width / 2
    );

    scroller.scrollLeft = 400;
    const scrollerBox = () => scroller.getBoundingClientRect();

    await waitFor(async () => {
      // The header itself has moved left, so this is a real scroll and not a no-op.
      await expect(header.getBoundingClientRect().left).toBeLessThan(scrollerBox().left - 100);
    });

    /* The date stayed welded to the edge of the scrollport, and stayed opaque while
       team names slid underneath it. Lose either and the day being viewed scrolls
       out of sight on exactly the wide teams that need the scrolling. */
    await expect(nav.getBoundingClientRect().left).toBeCloseTo(scrollerBox().left, 0);
    await expect(globalThis.getComputedStyle(nav).backgroundColor).toBe(
      resolveToken(nav, '--screen-2')
    );
  },
};

export const SignedInColumn: Story = {
  name: 'The column that is you',
  beforeEach: withSignedInPractitioner(RAVI),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const { labels } = namesRowOf(canvasElement, 'Dr. Elena Marsh');
    const highlight = resolveToken(canvasElement, '--blue-text');

    const names = TEAM.map((member) => canvas.getByText(member.name as string));
    const marked = names.filter((name) => globalThis.getComputedStyle(name).color === highlight);

    /* Exactly one column, and it is the practitioner whose id matches - not the
       first, and not all of them. The header composes `UserLabels`, which reads the
       signed-in id off the auth store rather than taking it as a prop, so a broken
       match here is a header that quietly stops telling anyone which column is
       theirs (or marks every column as everyone). */
    await expect(marked).toHaveLength(1);
    await expect(marked[0]).toHaveTextContent('Dr. Ravi Patel');

    /* And the columns it marks are the ones the appointments grid draws under: three
       equal columns on the same track. An uneven header is every booking of the day
       sitting under the wrong name. */
    const widths = [...labels.children].map((cell) =>
      Math.round(cell.getBoundingClientRect().width)
    );
    await expect(new Set(widths).size).toBe(1);
  },
};

export const Dark: Story = {
  name: 'Dark',
  globals: { theme: 'dark' },
  args: { onPrevDay: fn(), onNextDay: fn() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const nav = navOf(canvasElement);
    const navFill = globalThis.getComputedStyle(nav).backgroundColor;

    /* First, proof the story is in the dark palette at all. A story-level global that
       never reaches the preview fails with no symptom, and every token assertion
       below would pass just as happily against the light values. */
    await expect(luminance(parseRgb(navFill))).toBeLessThan(0.1);
    await expect(navFill).toBe(resolveToken(nav, '--screen-2'));

    /* The date is the one thing on this band that has to survive every scroll
       position, so it is the one worth measuring against the fill behind it. 14px
       bold is not large text, so AA is 4.5:1. */
    const dateNumber = globalThis.getComputedStyle(canvas.getByText(DATE_NUMBER)).color;
    await expect(dateNumber).toBe(resolveToken(nav, '--ink'));
    await expect(contrast(dateNumber, navFill)).toBeGreaterThanOrEqual(4.5);

    // The all-caps weekday label is the quieter ink and still has to clear AA.
    const weekday = globalThis.getComputedStyle(canvas.getByText(WEEKDAY)).color;
    await expect(weekday).toBe(resolveToken(nav, '--ink-faint'));
    await expect(contrast(weekday, navFill)).toBeGreaterThanOrEqual(4.5);
  },
};
