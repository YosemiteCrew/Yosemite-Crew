import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, within } from 'storybook/test';
import type { Appointment } from '@yosemite-crew/types';

import ZoomInEventList from './ZoomInEventList';

const ORG_ID = 'org-storybook';
const POPOVER_ID = 'appointment-popover';

/** One hour row of the zoomed-in week grid, and the column it sits in. */
const HOUR_HEIGHT = 180;
const TRACK_WIDTH = 260;

/** `ZoomInMarker` insets each block by 2px on both sides of its lane. */
const LANE_GAP_PX = 2;

/**
 * Only the MINUTE within the hour positions a block - the list reads
 * `getDatePartsInPreferredTimeZone(startTime).minute` and never the hour - and
 * every timezone this app offers is a whole-hour offset, so a UTC literal lands
 * on the same pixel wherever the runner is.
 */
const at = (minute: number): Date =>
  new Date(`2026-07-14T09:${String(minute).padStart(2, '0')}:00.000Z`);

type EventSpec = {
  id: string;
  name: string;
  startMinute: number;
  durationMinutes: number;
};

const appointment = ({ id, name, startMinute, durationMinutes }: EventSpec): Appointment => {
  const startTime = at(startMinute);
  const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
  const companion = {
    id: `companion-${id}`,
    name,
    species: 'dog',
    breed: 'Beagle',
    parent: { id: `parent-${id}`, name: 'Lena Hartmann' },
  };
  return {
    id,
    patient: companion,
    companion,
    organisationId: ORG_ID,
    appointmentType: {
      id: 'svc-wellness',
      name: 'Wellness exam',
      speciality: { id: 'spec-general', name: 'General practice' },
    },
    appointmentDate: startTime,
    startTime,
    endTime,
    timeSlot: `09:${String(startMinute).padStart(2, '0')}`,
    durationMinutes,
    status: 'UPCOMING',
  };
};

const MILO = appointment({ id: 'appt-milo', name: 'Milo', startMinute: 15, durationMinutes: 30 });

/**
 * The key the list mints for each block and hands to the marker. Duplicated here
 * on purpose: the calendar keeps a popover open by holding this exact string, so
 * a change to its shape detaches the open popover with nothing failing.
 */
const slotEventKey = (event: Appointment): string =>
  [
    event.id,
    (event.companion ?? event.patient).name,
    event.startTime.toISOString(),
    event.endTime.toISOString(),
  ].join('-');

const trackOf = (canvasElement: HTMLElement): HTMLElement =>
  canvasElement.querySelector('[data-story-track]') as HTMLElement;

/** The positioned block, which is the marker's outer div rather than its button. */
const blockFor = (canvasElement: HTMLElement, name: string): HTMLElement =>
  within(canvasElement).getByText(name).closest('div.absolute') as HTMLElement;

const boxFor = (canvasElement: HTMLElement, name: string): DOMRect =>
  blockFor(canvasElement, name).getBoundingClientRect();

const topWithinTrack = (canvasElement: HTMLElement, name: string): number =>
  boxFor(canvasElement, name).top - trackOf(canvasElement).getBoundingClientRect().top;

const leftWithinTrack = (canvasElement: HTMLElement, name: string): number =>
  boxFor(canvasElement, name).left - trackOf(canvasElement).getBoundingClientRect().left;

const meta = {
  title: 'Appointments/Calendar/ZoomInEventList',
  component: ZoomInEventList,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The overlap solver for one hour cell of the zoomed-in calendar. It owns three passes ' +
          'that only exist as pixels: normalising each booking into a start and end minute, ' +
          'grouping the results into clusters of transitively-overlapping events, and packing ' +
          'each cluster greedily into the fewest lanes.\n\n' +
          'Two normalisations happen before any of that, and both change the layout rather than ' +
          'just the size of a block. A booking is never drawn as shorter than **10 minutes**, ' +
          'which can manufacture an overlap between two bookings that do not actually overlap. ' +
          'And a booking is clipped to `60 - startMinute`, so a two-hour surgery starting at ' +
          ':45 contributes only its first fifteen minutes to this cell - the rest belongs to the ' +
          'next one.\n\n' +
          'Lane packing is where the value is. A cluster gets as many lanes as it needs and every ' +
          'block in it divides the column by that count, so three appointments can share two ' +
          'lanes when the third fits underneath the first. That reuse is invisible to a unit ' +
          'test of the helper - the lane index is only meaningful once it has been turned into a ' +
          'percentage - and invisible to a screenshot of a normal day, because it needs three ' +
          'bookings arranged so that the outer two miss each other.\n\n' +
          'Every story below is one hour cell, 180px tall and 260px wide, holding a different ' +
          'arrangement of the same clinic day.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    sortedSlotEvents: [MILO],
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
  decorators: [
    // The list is `relative h-full`, so it needs a parent with a definite height
    // or every block collapses onto the same pixel.
    (Story) => (
      <div
        data-story-track
        className="relative bg-[var(--screen)]"
        style={{ width: TRACK_WIDTH, height: HOUR_HEIGHT }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ZoomInEventList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Single: Story = {
  name: 'One booking in the hour',
  args: { activePopoverKey: slotEventKey(MILO) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* 09:15 is a quarter down a 180px row and 30 minutes is half of it. Neither
       number is clamped here, which makes this the baseline the clamped stories
       are read against. */
    await expect(topWithinTrack(canvasElement, 'Milo · Hartmann')).toBeCloseTo(45, 0);
    await expect(boxFor(canvasElement, 'Milo · Hartmann').height).toBeCloseTo(90, 0);

    // One lane, so the block takes the column less its own 2px inset on each side.
    await expect(boxFor(canvasElement, 'Milo · Hartmann').width).toBeCloseTo(
      TRACK_WIDTH - LANE_GAP_PX * 2,
      0
    );
    await expect(leftWithinTrack(canvasElement, 'Milo · Hartmann')).toBeCloseTo(LANE_GAP_PX, 0);

    /* The list mints the marker key from four fields joined with hyphens, and the
       calendar holds that string to keep a popover open. `activePopoverKey` is
       set to a locally-composed copy, so if the key shape ever changes this
       assertion fails here rather than the calendar quietly closing its popover
       on the next re-render. */
    await expect(canvas.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
  },
};

export const TwoOverlapping: Story = {
  name: 'Two overlapping bookings, two lanes',
  args: {
    sortedSlotEvents: [
      appointment({ id: 'appt-milo', name: 'Milo', startMinute: 0, durationMinutes: 45 }),
      appointment({ id: 'appt-nala', name: 'Nala', startMinute: 15, durationMinutes: 45 }),
    ],
  },
  play: async ({ canvasElement }) => {
    const milo = boxFor(canvasElement, 'Milo · Hartmann');
    const nala = boxFor(canvasElement, 'Nala · Hartmann');

    // Two lanes, so each block is half the column less its insets - and the two
    // are equal, because both read the CLUSTER's lane count rather than their own.
    const laneWidth = (TRACK_WIDTH - LANE_GAP_PX * 4) / 2;
    await expect(milo.width).toBeCloseTo(laneWidth, 0);
    await expect(nala.width).toBeCloseTo(laneWidth, 0);

    // Side by side with a real gutter between them, not stacked and not touching.
    await expect(nala.left - milo.right).toBeCloseTo(LANE_GAP_PX * 2, 0);

    // Vertical position still comes from the clock, so the later booking still
    // starts lower: lanes decide the x axis and nothing else.
    await expect(topWithinTrack(canvasElement, 'Milo · Hartmann')).toBeCloseTo(0, 0);
    await expect(topWithinTrack(canvasElement, 'Nala · Hartmann')).toBeCloseTo(45, 0);
  },
};

export const ThreeInTwoLanes: Story = {
  name: 'Three transitive overlaps share two lanes',
  args: {
    sortedSlotEvents: [
      appointment({ id: 'appt-milo', name: 'Milo', startMinute: 0, durationMinutes: 20 }),
      appointment({ id: 'appt-nala', name: 'Nala', startMinute: 15, durationMinutes: 20 }),
      appointment({ id: 'appt-otto', name: 'Otto', startMinute: 30, durationMinutes: 20 }),
    ],
  },
  play: async ({ canvasElement }) => {
    const milo = boxFor(canvasElement, 'Milo · Hartmann');
    const nala = boxFor(canvasElement, 'Nala · Hartmann');
    const otto = boxFor(canvasElement, 'Otto · Hartmann');

    /* Three bookings, TWO lanes. Milo and Otto never overlap each other, so the
       greedy pass hands Otto the lane Milo has finished with - and the whole
       cluster divides by 2 rather than by 3. Divide by the count of events
       instead and every block here is a third of the column wide, with a third
       of the row empty, and no test of the helper notices. */
    const laneWidth = (TRACK_WIDTH - LANE_GAP_PX * 4) / 2;
    await expect(milo.width).toBeCloseTo(laneWidth, 0);
    await expect(nala.width).toBeCloseTo(laneWidth, 0);
    await expect(otto.width).toBeCloseTo(laneWidth, 0);

    // Milo and Otto are the same lane: same left edge, stacked vertically with
    // clear air between them.
    await expect(otto.left).toBeCloseTo(milo.left, 0);
    await expect(otto.top).toBeGreaterThan(milo.bottom);
    // Nala is the one that forced a second lane, and only she is in it.
    await expect(nala.left).toBeGreaterThan(milo.right);

    /* The cluster is transitive: Milo and Otto are only related through Nala, who
       overlaps both. Cluster by pairwise overlap with the previous event alone
       and Otto starts a new cluster, becomes full width, and lands on top of
       Nala. */
    await expect(nala.top).toBeGreaterThan(milo.top);
    await expect(nala.bottom).toBeGreaterThan(otto.top);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The arrangement that separates a correct solver from one that looks correct. Three ' +
          'appointments, each overlapping its neighbour, none overlapping across the whole run - ' +
          'so they belong to one cluster but need only two lanes.',
      },
    },
  },
};

export const BackToBack: Story = {
  name: 'Back to back bookings each keep the column',
  args: {
    sortedSlotEvents: [
      appointment({ id: 'appt-milo', name: 'Milo', startMinute: 0, durationMinutes: 20 }),
      appointment({ id: 'appt-otto', name: 'Otto', startMinute: 30, durationMinutes: 20 }),
    ],
  },
  play: async ({ canvasElement }) => {
    const milo = boxFor(canvasElement, 'Milo · Hartmann');
    const otto = boxFor(canvasElement, 'Otto · Hartmann');

    /* Nothing overlaps, so the second booking closes the first cluster and opens
       its own - and a cluster of one has one lane. Both blocks get the full
       column. The failure this guards is the plausible one: cluster per HOUR
       rather than per overlap run, and a quiet morning is drawn in half-width
       columns for no reason. */
    const fullWidth = TRACK_WIDTH - LANE_GAP_PX * 2;
    await expect(milo.width).toBeCloseTo(fullWidth, 0);
    await expect(otto.width).toBeCloseTo(fullWidth, 0);
    await expect(otto.left).toBeCloseTo(milo.left, 0);

    // 09:20 to 09:30 is real empty time and reads as such: 30px of gap.
    await expect(otto.top - milo.bottom).toBeCloseTo(30, 0);
  },
};

export const MinimumDuration: Story = {
  name: 'Two 5-minute bookings, forced apart',
  args: {
    sortedSlotEvents: [
      appointment({ id: 'appt-milo', name: 'Milo', startMinute: 0, durationMinutes: 5 }),
      appointment({ id: 'appt-nala', name: 'Nala', startMinute: 5, durationMinutes: 5 }),
    ],
  },
  play: async ({ canvasElement }) => {
    const milo = boxFor(canvasElement, 'Milo · Hartmann');
    const nala = boxFor(canvasElement, 'Nala · Hartmann');

    /* These two do not overlap: Nala's booking starts exactly when Milo's ends.
       They are drawn side by side anyway, because each is widened to a 10-minute
       floor BEFORE the overlap test runs - so Milo now "ends" at :10 and Nala
       "starts" at :05. The manufactured overlap is the point of this story: it is
       a layout consequence of a sizing clamp, and it only shows up on a day of
       short nurse appointments. */
    const laneWidth = (TRACK_WIDTH - LANE_GAP_PX * 4) / 2;
    await expect(milo.width).toBeCloseTo(laneWidth, 0);
    await expect(nala.width).toBeCloseTo(laneWidth, 0);
    await expect(nala.left).toBeGreaterThan(milo.right);

    // Tops are honest - 09:00 and 09:05, 15px apart on a 180px hour.
    await expect(topWithinTrack(canvasElement, 'Milo · Hartmann')).toBeCloseTo(0, 0);
    await expect(topWithinTrack(canvasElement, 'Nala · Hartmann')).toBeCloseTo(15, 0);

    /* Heights are not. Five minutes is 15px; the 10-minute floor lifts that to
       30px and the marker's own 40px minimum takes it the rest of the way - so
       the block claims about eight times the time it holds. Both clamps are
       deliberate, and at this zoom the 40px one is the binding half. */
    await expect(milo.height).toBeCloseTo(40, 0);
    await expect(nala.height).toBeCloseTo(40, 0);
  },
};

export const Dragged: Story = {
  name: 'One of a pair picked up',
  args: {
    sortedSlotEvents: [
      appointment({ id: 'appt-milo', name: 'Milo', startMinute: 0, durationMinutes: 45 }),
      appointment({ id: 'appt-nala', name: 'Nala', startMinute: 15, durationMinutes: 45 }),
    ],
    draggedAppointmentId: 'appt-nala',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const [milo, nala] = canvas.getAllByRole('button');

    /* The card being dragged is left in place at 55% rather than removed, so the
       vet can see where it came from while the drop preview shows where it would
       land. Removing it would also re-run the layout and re-flow its neighbour
       mid-gesture. */
    await expect(globalThis.getComputedStyle(nala).opacity).toBe('0.55');
    await expect(globalThis.getComputedStyle(milo).opacity).toBe('1');

    // Which one dims is matched on the appointment id, not the marker key, so
    // the same booking dims in every calendar view at once.
    await expect(nala).toHaveAccessibleName(/Nala · Hartmann/);

    // The layout is untouched by the drag: still two lanes, still side by side.
    await expect(boxFor(canvasElement, 'Nala · Hartmann').left).toBeGreaterThan(
      boxFor(canvasElement, 'Milo · Hartmann').right
    );
  },
};
