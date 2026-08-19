import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, within } from 'storybook/test';
import type { Appointment } from '@yosemite-crew/types';

import WeekCalendar from './WeekCalendar';

const ORG_ID = 'org-storybook';

/** Monday 13 July 2026. `getWeekDays` runs Mon-Sun, so index 6 is the Sunday. */
const WEEK_START = new Date('2026-07-13T12:00:00.000Z');

/**
 * Availability is handed in as minute-of-day numbers, so it reads the same in every
 * timezone. 08:30-10:00 and 11:00-13:15 - deliberately NOT on the hour, so the
 * percentage geometry of a part-hour dim band is exercised rather than a run of
 * 0%/100% rectangles that would pass with the maths inverted.
 */
const AVAILABILITY = [
  { startMinute: 510, endMinute: 600 },
  { startMinute: 660, endMinute: 795 },
];

const appointment = (
  id: string,
  name: string,
  startIso: string,
  durationMinutes: number
): Appointment => {
  const startTime = new Date(startIso);
  const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
  return {
    id,
    patient: {
      id: `companion-${id}`,
      name,
      species: 'dog',
      breed: 'Beagle',
      parent: { id: `parent-${id}`, name: 'Lena Hartmann' },
    },
    companion: {
      id: `companion-${id}`,
      name,
      species: 'dog',
      breed: 'Beagle',
      parent: { id: `parent-${id}`, name: 'Lena Hartmann' },
    },
    organisationId: ORG_ID,
    room: { id: 'room-consult-1', name: 'Consult 1' },
    appointmentDate: startTime,
    startTime,
    endTime,
    timeSlot: '09:00 - 09:30',
    durationMinutes,
    status: 'UPCOMING',
    concern: 'Lameness recheck',
  };
};

/**
 * 07:00 and 10:00 UTC are 09:00 and 12:00 in the preferred zone (Europe/Berlin).
 * Both sit inside the availability span above, so the visible hour range is the
 * same in every story here - 08:00 to 14:00 - and the two shading stories can be
 * read directly against the unshaded one.
 */
const EVENTS: Appointment[] = [
  appointment('appt-1', 'Milo', '2026-07-14T07:00:00.000Z', 30),
  appointment('appt-2', 'Nala', '2026-07-15T10:00:00.000Z', 45),
];

const getDimOverlays = (canvasElement: HTMLElement): HTMLElement[] =>
  Array.from(canvasElement.querySelectorAll<HTMLElement>('[style*="calendar-dim-overlay"]'));

/** The hour row carrying a given gutter label, e.g. '8:00 AM'. */
const getHourRow = (canvasElement: HTMLElement, hourLabel: string): HTMLElement =>
  within(canvasElement).getByText(hourLabel).closest('.yc-week-grid__shell') as HTMLElement;

/** The seven-day column grid inside one hour row. */
const getDayColumnsGrid = (canvasElement: HTMLElement, hourLabel: string): HTMLElement =>
  getHourRow(canvasElement, hourLabel).querySelector('.grid') as HTMLElement;

/** Column index of the day cell an overlay is painted into, 0 = Monday. */
const getDayColumnIndex = (overlay: HTMLElement): number => {
  const cell = overlay.parentElement as HTMLElement;
  return Array.from(cell.parentElement?.children ?? []).indexOf(cell);
};

const meta = {
  title: 'Appointments/Calendar/WeekCalendar',
  component: WeekCalendar,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The seven-day grid, and the shading that tells a receptionist which hours the clinic is ' +
          'actually open.\n\n' +
          'That shading had never been drawn. `availabilityLoaded` defaults to `false` and ' +
          '`getVisibleAvailabilityIntervals` returns `[]` until an async fetch resolves, and ' +
          '`computeUnavailableSegments` returns an empty list for that combination - so the ' +
          'resting render of this component, the one every static frame captures, is a grid with ' +
          'ZERO shading in which every hour of every day reads as bookable. The real product ' +
          'state, a week with its closed hours dimmed, only exists after a network round trip.\n\n' +
          'The empty-and-loaded case inverts the same branch and is the one that matters ' +
          'clinically: no intervals plus `availabilityLoaded: true` means the day is CLOSED, and ' +
          'the helper returns one segment covering the whole visible range. Get the flag wrong in ' +
          'either direction and a closed Sunday is indistinguishable from a Sunday whose rota has ' +
          'not loaded yet.\n\n' +
          'The overlays are positioned in percentages of their own hour cell rather than pixels, ' +
          'so a part-hour band is `top: 25%` of a 180px row. The stories assert both the ' +
          'percentage the formula produces and the pixel it resolves to, because a percentage ' +
          'against a collapsed parent still reads as a correct style attribute.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    events: EVENTS,
    weekStart: WEEK_START,
    canEditAppointments: true,
    // Auto-scroll parks the grid on the first event, which would make the visible
    // slice of a 1260px column depend on the wall clock. Pinned to the top instead.
    skipAutoScroll: true,
    handleViewAppointment: fn(),
    handleDetailAppointment: fn(),
    handleRescheduleAppointment: fn(),
    handleChangeRoomAppointment: fn(),
  },
  decorators: [
    (Story) => (
      <div className="h-[560px] w-[1100px] max-w-full bg-[var(--screen)]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof WeekCalendar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AvailabilityLoading: Story = {
  name: 'Availability not loaded (the resting render)',
  args: {
    availabilityLoaded: false,
    getVisibleAvailabilityIntervals: () => [],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The grid is complete before it is empty of shading, and both halves of that
       are asserted: seven day tracks carrying seven day cells, and seven hour rows
       running 08:00 to 14:00. A grid that lost a column would still report zero dim
       overlays, so the count below only means something next to these. */
    const dayGrid = getDayColumnsGrid(canvasElement, '8:00 AM');
    await expect(getComputedStyle(dayGrid).gridTemplateColumns.trim().split(/\s+/)).toHaveLength(7);
    await expect(dayGrid.children).toHaveLength(7);
    await expect(canvas.getAllByText(/^\d{1,2}:00 (AM|PM)$/)).toHaveLength(7);
    await expect(canvas.getByText('8:00 AM')).toBeInTheDocument();
    await expect(canvas.getByText('2:00 PM')).toBeInTheDocument();
    await expect(canvas.queryByText('7:00 AM')).toBeNull();
    await expect(canvas.getByText('Milo · Hartmann')).toBeInTheDocument();
    await expect(canvas.getByText('Nala · Hartmann')).toBeInTheDocument();

    /* And not one hour is dimmed. This is not an empty-data story: it is the default
       prop values, which is what makes it worth drawing. Every hour of every day
       reads as open, including the ones the clinic is shut. */
    await expect(getDimOverlays(canvasElement)).toHaveLength(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The component with its own defaults, which is what mounts on every page load before the ' +
          'availability request comes back. `computeUnavailableSegments` short-circuits on an ' +
          'empty interval list when `availabilityLoaded` is false, so the grid is uniformly open.\n\n' +
          'This is the correct behaviour - guessing at closed hours before the rota arrives would ' +
          'be worse - but it means the shaded state below is the one a reviewer has never seen, ' +
          'and the one that regresses unnoticed.',
      },
    },
  },
};

export const AvailabilityLoaded: Story = {
  name: 'Availability loaded (closed hours dimmed)',
  args: {
    availabilityLoaded: true,
    getVisibleAvailabilityIntervals: () => AVAILABILITY,
  },
  play: async ({ canvasElement }) => {
    /* Four bands per day: 08:00-08:30 before opening, the 10:00-11:00 lunch gap, and
       13:15-15:00 after close, which straddles two hour rows and so paints twice.
       Seven days: 28. A miscount here means a day column lost its shading entirely,
       which no visual diff of a single cell would catch. */
    await expect(getDimOverlays(canvasElement)).toHaveLength(28);

    // The 08:00 row: the clinic opens at 08:30, so the band is the TOP half of the row.
    const openingRow = getHourRow(canvasElement, '8:00 AM');
    const openingBands = Array.from(
      openingRow.querySelectorAll<HTMLElement>('[style*="calendar-dim-overlay"]')
    );
    await expect(openingBands).toHaveLength(7);
    await expect(openingBands[0].style.top).toBe('0%');
    await expect(openingBands[0].style.height).toBe('50%');
    // The percentage has to resolve against the 180px hour cell, not a collapsed
    // parent - a correct-looking style attribute over a zero-height box shades nothing.
    await expect(openingBands[0].getBoundingClientRect().height).toBeCloseTo(90, 0);

    /* The 13:00 row is the interesting one: availability ends at 13:15, so the band
       starts a quarter of the way down rather than at the top. This is the only
       assertion in the file that would still pass with `topPct` and `heightPct`
       swapped if both were whole hours - which is why the fixture is 13:15. */
    const closingRow = getHourRow(canvasElement, '1:00 PM');
    const closingBands = Array.from(
      closingRow.querySelectorAll<HTMLElement>('[style*="calendar-dim-overlay"]')
    );
    await expect(closingBands).toHaveLength(7);
    await expect(closingBands[0].style.top).toBe('25%');
    await expect(closingBands[0].style.height).toBe('75%');
    await expect(closingBands[0].getBoundingClientRect().height).toBeCloseTo(135, 0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The state the product actually runs in once the rota resolves: 08:30-10:00 and ' +
          '13:15 close, with everything outside dimmed by `--color-calendar-dim-overlay`.\n\n' +
          'Segments are computed as the COMPLEMENT of availability across the visible range, then ' +
          'clipped per hour cell, so a segment that spans a row boundary paints two rectangles ' +
          'rather than one tall one. The overlay sits at `z-1`, under both the drag highlights ' +
          'and the appointment markers, so a booking already made outside opening hours still ' +
          'reads clearly through the dim.',
      },
    },
  },
};

export const ClosedDay: Story = {
  name: 'Availability loaded, Sunday closed',
  args: {
    availabilityLoaded: true,
    // Sunday returns no intervals at all. With the loaded flag set, that means
    // CLOSED - not "unknown" - and the helper answers with one full-range segment.
    getVisibleAvailabilityIntervals: (day: Date) => (day.getDay() === 0 ? [] : AVAILABILITY),
  },
  play: async ({ canvasElement }) => {
    // Six open days at four bands each, plus a Sunday dimmed in all seven hour rows.
    await expect(getDimOverlays(canvasElement)).toHaveLength(31);

    /* 09:00 is inside the open days' availability, so the only band in that row belongs
       to the closed column - and it must be the last one, Sunday. Asserting the column
       index rather than merely the count is what makes this a real check: an
       off-by-one in `getWeekDays` would shade Saturday and still count 31. */
    const openHourRow = getHourRow(canvasElement, '9:00 AM');
    const bands = Array.from(
      openHourRow.querySelectorAll<HTMLElement>('[style*="calendar-dim-overlay"]')
    );
    await expect(bands).toHaveLength(1);
    await expect(getDayColumnIndex(bands[0])).toBe(6);
    await expect(bands[0].style.top).toBe('0%');
    await expect(bands[0].style.height).toBe('100%');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The branch that separates "closed" from "still loading", and the reason the two cannot ' +
          'share a render. An empty interval list with `availabilityLoaded: true` produces a ' +
          'single segment spanning the whole visible range, so the Sunday column is dimmed top to ' +
          'bottom while the other six keep their normal opening bands.\n\n' +
          'Flip the flag and this column becomes indistinguishable from an open one, which is ' +
          'exactly the failure the loading story above documents.',
      },
    },
  },
};
