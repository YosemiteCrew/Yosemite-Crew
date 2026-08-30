import type { Meta, StoryObj } from '@storybook/react';
import type { ReactNode } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Appointment } from '@yosemite-crew/types';

import ZoomOutEventList from './ZoomOutEventList';

/** The id `DayCalendar` gives its single shared popover; every marker points at it. */
const POPOVER_ID = 'day-calendar-appointment-popover';
const ORG_ID = 'org-storybook';

/** The real zoomed-out hour row (`getHourRowHeightPx('out')`). */
const HOUR_HEIGHT = 34;
/** One pixel is worth this many minutes at that row height. */
const PX_PER_MINUTE = HOUR_HEIGHT / 60;
/** Below this the marker drops its visible label (`MIN_HEIGHT_FOR_LABEL_PX`). */
const LABEL_THRESHOLD_PX = 16;

/**
 * The layout reads the minute-of-hour through `getDatePartsInPreferredTimeZone`, so the
 * preferred timezone decides where every marker lands. Clearing the key pins it to the
 * `Europe/Berlin` default, which is a whole-hour offset - so the minute of a UTC instant
 * survives the conversion and these fixtures mean the same thing on every runner. A
 * half-hour zone left behind by another story (Asia/Kolkata is in the picker) would slide
 * every expected pixel below by 30 minutes.
 */
const TIMEZONE_STORAGE_KEY = 'yc_preferred_timezone';
const withDefaultTimeZone = () => {
  let saved: string | null = null;
  try {
    saved = globalThis.localStorage.getItem(TIMEZONE_STORAGE_KEY);
    globalThis.localStorage.removeItem(TIMEZONE_STORAGE_KEY);
  } catch {
    // Storage can be unavailable; the helper falls back to Europe/Berlin anyway.
  }
  return () => {
    try {
      if (saved === null) globalThis.localStorage.removeItem(TIMEZONE_STORAGE_KEY);
      else globalThis.localStorage.setItem(TIMEZONE_STORAGE_KEY, saved);
    } catch {
      // Same: nothing to restore if storage was never readable.
    }
  };
};

const companionOf = (name: string) => ({
  id: `companion-${name.toLowerCase()}`,
  name,
  species: 'dog',
  breed: 'Beagle',
  parent: { id: `parent-${name.toLowerCase()}`, name: 'Lena Hartmann' },
});

/** One appointment inside the 09:00 hour, described by its minutes past the hour. */
const at = (name: string, startMinute: number, endMinute: number): Appointment => {
  const companion = companionOf(name);
  const startTime = new Date(Date.UTC(2026, 6, 14, 9, startMinute));
  const endTime = new Date(Date.UTC(2026, 6, 14, 9, endMinute));
  return {
    id: `appt-${name.toLowerCase()}`,
    patient: companion,
    companion,
    organisationId: ORG_ID,
    appointmentDate: startTime,
    startTime,
    endTime,
    timeSlot: `09:${String(startMinute).padStart(2, '0')}`,
    durationMinutes: endMinute - startMinute,
    status: 'UPCOMING',
    concern: 'Limping on left hind',
    appointmentType: {
      id: 'type-dental',
      name: 'Dental check',
      speciality: { id: 'spec-dentistry', name: 'Dentistry' },
    },
  };
};

/** What `getSlotEventKey` builds: id, companion name, ISO start, ISO end. */
const keyFor = (event: Appointment) =>
  [
    event.id,
    (event.companion ?? event.patient).name,
    event.startTime.toISOString(),
    event.endTime.toISOString(),
  ].join('-');

/** Every marker announces the same sentence; only the companion changes. */
const titleFor = (name: string) => `${name} · Hartmann • Dental check • Limping on left hind`;

/**
 * One hour cell of the zoomed-out grid. The list is `h-full`, so without a parent of a
 * known height every block below would be measured against zero.
 */
const HourCell = ({ height, children }: Readonly<{ height: number; children: ReactNode }>) => (
  <div data-hour-cell="" className="relative w-[220px] rounded-md bg-neutral-0" style={{ height }}>
    {children}
  </div>
);

/**
 * The coloured bars, in DOM order. The button inside each one is `-inset-y-2`, so it is
 * 16px taller than the bar it belongs to - measuring buttons would report a layout that
 * does not exist.
 */
const barsOf = (canvasElement: HTMLElement): HTMLElement[] =>
  within(canvasElement)
    .getAllByRole('button')
    .map((button) => button.parentElement as HTMLElement);

/** Where a bar sits inside the hour, in minutes past the hour. */
const minutesOf = (cell: HTMLElement, bar: HTMLElement) => {
  const cellTop = cell.getBoundingClientRect().top;
  const rect = bar.getBoundingClientRect();
  return {
    start: (rect.top - cellTop) / PX_PER_MINUTE,
    length: rect.height / PX_PER_MINUTE,
  };
};

const GAPPED = [at('Milo', 0, 15), at('Nala', 20, 35), at('Otto', 45, 55)];

const meta = {
  title: 'Appointments/Calendar/ZoomOutEventList',
  component: ZoomOutEventList,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The stack of appointment bars inside one hour of the zoomed-out calendar, where a whole ' +
          'hour is 34px tall (`getHourRowHeightPx("out")`).\n\n' +
          'It is a different layout rule from the zoomed-in packer, and the difference only shows ' +
          'when it is rendered. There are no lanes and nothing is absolutely positioned: the ' +
          'markers are a flex column, and each one is pushed down by the **gap from a running ' +
          'minute cursor** rather than by its own start minute. While events do not overlap the ' +
          'two are the same thing - a bar lands at `startMinute / 60 * height` - but the moment ' +
          "two events overlap the cursor is already past the second one's start, the gap clamps " +
          'to zero, and the second bar butts up against the first and pushes the stack past the ' +
          'bottom of its own hour. That is deliberate: at 34px an hour, two overlaid bars would be ' +
          'one unreadable smear.\n\n' +
          'Duration is clamped twice on the way in. It is floored at 5 minutes, ceilinged at the ' +
          'minutes left in the hour (`60 - startMinute`), and the result floored again at 10 - so ' +
          'the shortest bar the grid can draw is 10 minutes, about 5.7px, whatever the booking ' +
          'says. Below 16px the marker drops its visible label and keeps only the screen-reader ' +
          'one, so most bars at this zoom are colour plus an accessible name.\n\n' +
          'Each marker is keyed and identified by `getSlotEventKey` - id, companion name, ISO ' +
          'start, ISO end - and that same string is what comes back through `onMarkerClick` and ' +
          'what the parent compares against `activePopoverKey`. Change either end of it and the ' +
          'popover simply never opens, with nothing thrown.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    sortedSlotEvents: GAPPED,
    height: HOUR_HEIGHT,
    activePopoverKey: null,
    appointmentPopoverId: POPOVER_ID,
    draggedAppointmentId: null,
    onMarkerClick: fn(),
    onMarkerDoubleClick: fn(),
    onMarkerContextMenu: fn(),
    onAppointmentDragStart: fn(),
    onAppointmentDragEnd: fn(),
    onDropPreviewClear: fn(),
  },
  beforeEach: withDefaultTimeZone,
  decorators: [
    (Story, context) => (
      <HourCell height={context.args.height}>
        <Story />
      </HourCell>
    ),
  ],
} satisfies Meta<typeof ZoomOutEventList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Gaps: Story = {
  name: 'Three bookings with gaps between them',
  play: async ({ canvasElement }) => {
    const cell = canvasElement.querySelector('[data-hour-cell]') as HTMLElement;
    const bars = barsOf(canvasElement);
    await expect(bars).toHaveLength(3);

    /* While nothing overlaps, the running cursor and the raw start minute agree, so each
       bar lands exactly at its own start. This is the invariant the whole gap-based
       stacking exists to preserve, and it is only true because every preceding block
       contributes its own height as well as its margin - drop either term and the stack
       drifts a few pixels per booking, which reads as "the calendar is a bit off". */
    const expected = [
      { start: 0, length: 15 },
      { start: 20, length: 15 },
      { start: 45, length: 10 },
    ];
    for (const [index, bar] of bars.entries()) {
      const measured = minutesOf(cell, bar);
      await expect(measured.start).toBeCloseTo(expected[index].start, 1);
      await expect(measured.length).toBeCloseTo(expected[index].length, 1);
    }

    // Every bar is under the 16px label threshold at this zoom, so the label is the
    // 1px sr-only span rather than painted text.
    const label = within(bars[0]).getByText(titleFor('Milo'));
    await expect(Math.round(label.getBoundingClientRect().width)).toBe(1);
    await expect(bars[0].getBoundingClientRect().height).toBeLessThan(LABEL_THRESHOLD_PX);
  },
};

export const BackToBack: Story = {
  name: 'Two half hours with no gap',
  args: { sortedSlotEvents: [at('Milo', 0, 30), at('Nala', 30, 60)] },
  play: async ({ canvasElement }) => {
    const cell = canvasElement.querySelector('[data-hour-cell]') as HTMLElement;
    const [first, second] = barsOf(canvasElement);

    /* Zero gap means zero margin: the cursor is at minute 30 and the second booking
       starts at minute 30. A one-pixel seam here would be the only visual difference
       between "back to back" and "there is a gap", at a zoom where 1px is nearly two
       minutes. */
    await expect(second.getBoundingClientRect().top).toBeCloseTo(
      first.getBoundingClientRect().bottom,
      1
    );

    // And the pair fills the hour exactly, rather than spilling into the next one.
    const cellRect = cell.getBoundingClientRect();
    await expect(first.getBoundingClientRect().top).toBeCloseTo(cellRect.top, 1);
    await expect(second.getBoundingClientRect().bottom).toBeCloseTo(cellRect.bottom, 1);

    /* 30 minutes is 17px, over the 16px threshold, so these two are the rare bars at
       this zoom that do paint their label. The list's arithmetic is what flips that
       branch, which is why it is asserted here and not in the marker's own stories. */
    const label = within(first).getByText(titleFor('Milo'));
    await expect(label.getBoundingClientRect().width).toBeGreaterThan(1);
  },
};

export const Overlapping: Story = {
  name: 'An overlap is stacked, not overlaid',
  // 09:00-09:40 and 09:15-09:45: the second starts while the first is still running.
  args: { sortedSlotEvents: [at('Milo', 0, 40), at('Nala', 15, 45)] },
  play: async ({ canvasElement }) => {
    const cell = canvasElement.querySelector('[data-hour-cell]') as HTMLElement;
    const [first, second] = barsOf(canvasElement);

    /* The cursor is already at minute 40 when the second booking (minute 15) arrives, so
       its gap clamps to zero and it butts up against the first instead of landing on its
       own start. Nothing overlaps, and nothing is hidden behind anything. */
    await expect(second.getBoundingClientRect().top).toBeCloseTo(
      first.getBoundingClientRect().bottom,
      1
    );
    const secondPosition = minutesOf(cell, second);
    await expect(secondPosition.start).toBeCloseTo(40, 1);
    // Emphatically not at its real start minute, which is what an absolute layout
    // would have done and what the zoomed-in packer does with lanes instead.
    await expect(secondPosition.start).toBeGreaterThan(15);

    /* Both keep their full height - the inline `minHeight` is what stops the flex column
       from quietly shrinking them to fit - so the stack runs past the bottom of its own
       hour. The list is `overflow-visible` precisely so that spill stays visible. */
    await expect(secondPosition.length).toBeCloseTo(30, 1);
    await expect(second.getBoundingClientRect().bottom).toBeGreaterThan(
      cell.getBoundingClientRect().bottom
    );
  },
};

export const MinimumBlock: Story = {
  name: 'A two-minute booking still draws ten',
  args: { sortedSlotEvents: [at('Milo', 10, 12)] },
  play: async ({ canvasElement }) => {
    const cell = canvasElement.querySelector('[data-hour-cell]') as HTMLElement;
    const [bar] = barsOf(canvasElement);
    const measured = minutesOf(cell, bar);

    /* Two minutes would be 1.1px - a hairline nobody can hit. The duration is floored at
       5 and then the visible duration floored again at 10, so the shortest bar the grid
       can draw is 10 minutes. The 3px pixel floor underneath that never fires at the
       real 34px row height, because 10 minutes is already 5.7px. */
    await expect(measured.start).toBeCloseTo(10, 1);
    await expect(measured.length).toBeCloseTo(10, 1);
    await expect(bar.getBoundingClientRect().height).toBeCloseTo(10 * PX_PER_MINUTE, 1);

    /* The bar is 5.7px but the button is not: `-inset-y-2` grows the hit target by 8px
       top and bottom, which is the only reason a booking this short is clickable. */
    const button = within(canvasElement).getByRole('button');
    await expect(button.getBoundingClientRect().height).toBeCloseTo(
      bar.getBoundingClientRect().height + 16,
      1
    );

    // Under 16px there is no painted text at all, so the accessible name is the whole
    // of what this booking communicates to a screen reader.
    await expect(button).toHaveAccessibleName(titleFor('Milo'));
  },
};

export const ActiveMarker: Story = {
  name: 'The open marker is the one the key names',
  args: { activePopoverKey: keyFor(GAPPED[1]) },
  play: async ({ args, canvasElement }) => {
    const buttons = within(canvasElement).getAllByRole('button');

    /* Exactly one marker is expanded and it is the middle booking. The key carries the
       ISO start AND the ISO end, so two bookings for the same companion in the same hour
       stay distinguishable - a name-only key would open both. */
    const expanded = buttons.filter((button) => button.getAttribute('aria-expanded') === 'true');
    await expect(expanded).toHaveLength(1);
    await expect(expanded[0]).toHaveAccessibleName(titleFor('Nala'));
    await expect(expanded[0]).toHaveAttribute('aria-controls', POPOVER_ID);

    /* And the key the list hands back on click is byte-identical to the one it compares
       against. This is the whole contract between the list and its parent, and both
       halves are built in different files. */
    await userEvent.click(buttons[2]);
    await expect(args.onMarkerClick).toHaveBeenCalledWith(expect.anything(), keyFor(GAPPED[2]));
  },
};

export const Empty: Story = {
  name: 'An hour with nothing booked',
  args: { sortedSlotEvents: [] },
  play: async ({ canvasElement }) => {
    const cell = canvasElement.querySelector('[data-hour-cell]') as HTMLElement;
    const list = cell.firstElementChild as HTMLElement;

    await expect(within(canvasElement).queryAllByRole('button')).toHaveLength(0);
    await expect(list.children).toHaveLength(0);

    /* The empty list still fills its hour. It sits inside a slot that has to stay
       clickable to create a booking, so a container that collapsed to zero height would
       leave the emptiest hours of the day the hardest ones to book into. */
    await expect(list.getBoundingClientRect().height).toBeCloseTo(HOUR_HEIGHT, 1);
  },
};
