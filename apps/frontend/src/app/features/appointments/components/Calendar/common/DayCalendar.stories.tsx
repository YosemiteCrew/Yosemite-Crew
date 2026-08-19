import type { Meta, StoryObj } from '@storybook/react';
import { expect, fireEvent, fn, within } from 'storybook/test';
import type { Appointment } from '@yosemite-crew/types';

import { DayCalendar } from './DayCalendar';

const ORG_ID = 'org-storybook';

/**
 * Availability is handed in as plain minute-of-day numbers, never as instants, so
 * the visible window below is the same in every timezone. The APPOINTMENTS are
 * instants and are read in the preferred zone (Europe/Berlin by default), so they
 * are pinned to 06:30 and 07:15 UTC - 08:30 and 09:15 Berlin, comfortably inside
 * the availability. Both stay inside `[480, 780]`, so they cannot widen the
 * window and move every pixel assertion in this file.
 */
const AVAILABILITY = [
  { startMinute: 480, endMinute: 600 },
  { startMinute: 660, endMinute: 780 },
];

/**
 * `computeDayWindow` pads the availability by 30 minutes and snaps to the hour:
 * min 480-30 -> 07:00, max 780+30 -> 14:00. Zoomed in an hour is 180px
 * (`getHourRowHeightPx('in')`), i.e. 15px per 5-minute step, so one minute is 3px
 * and the grid is 1260px tall.
 */
const WINDOW_START = 420;
const WINDOW_END = 840;
const PIXELS_PER_STEP = 15;
const MINUTES_PER_STEP = 5;

/** Pixel offset of a minute-of-day from the top of the timeline grid. */
const topPxForMinute = (minute: number): number =>
  ((minute - WINDOW_START) / MINUTES_PER_STEP) * PIXELS_PER_STEP;

const DAY = new Date('2026-07-14T10:00:00.000Z');

const appointment = (
  id: string,
  name: string,
  startIso: string,
  durationMinutes: number,
  concern: string
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
    timeSlot: `${startTime.toISOString()}`,
    durationMinutes,
    status: 'UPCOMING',
    concern,
  };
};

const EVENTS: Appointment[] = [
  appointment('appt-1', 'Milo', '2026-07-14T06:30:00.000Z', 30, 'Lameness recheck'),
  appointment('appt-2', 'Nala', '2026-07-14T07:15:00.000Z', 45, 'Vaccination'),
];

/** The dragged card is `appt-1`, so the day's own marker dims to 0.55 opacity. */
const DRAG_LABEL = 'Milo · Lameness recheck';

const getTimeline = (canvasElement: HTMLElement): HTMLElement =>
  canvasElement.querySelector('section[aria-label="Appointment timeline"]') as HTMLElement;

const getGrid = (canvasElement: HTMLElement): HTMLElement =>
  canvasElement.querySelector('[data-timeline-grid]') as HTMLElement;

/** Dim rectangles are the only nodes painted with the dim token, inline. */
const getDimSegments = (canvasElement: HTMLElement): HTMLElement[] =>
  Array.from(canvasElement.querySelectorAll<HTMLElement>('[style*="calendar-dim-overlay"]'));

const getDragAvailabilityRects = (canvasElement: HTMLElement): HTMLElement[] =>
  Array.from(canvasElement.querySelectorAll<HTMLElement>('.bg-calendar-availability-overlay'));

/** Offset of an overlay from the top of the grid, in CSS pixels. */
const offsetFromGridTop = (canvasElement: HTMLElement, el: HTMLElement): number =>
  el.getBoundingClientRect().top - getGrid(canvasElement).getBoundingClientRect().top;

const meta = {
  title: 'Appointments/Calendar/DayCalendar',
  component: DayCalendar,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The single-day timeline, drawn in the two states it only ever reaches **mid-gesture**.\n\n' +
          '`TimelineOverlays` renders three layers into the same absolutely-positioned box, and ' +
          'two of them are gated on `draggedAppointmentId`. The dim ranges are always there, so ' +
          'they are the only part any snapshot has ever contained; the drag-availability ' +
          'highlights and the dashed drop ghost exist for the duration of a pointer drag and are ' +
          'gone the moment it ends. Nothing static - no unit test, no Chromatic frame - could hold ' +
          'them, which is why they had never been reviewed.\n\n' +
          'The ghost here is **not** the shared `DropPreviewOverlay` used by the week grid. ' +
          'DayCalendar carries its own copy inline, with its own geometry: `top` is measured from ' +
          '`windowStart` rather than modulo the hour, the height floor is 12px rather than 14px, ' +
          'and there is no clamp to the end of the hour because there is no hour cell to clamp to. ' +
          'Two implementations of one affordance that can drift apart, and only one of them had a ' +
          'story.\n\n' +
          'Every measurement below is exact rather than approximate. The window is derived from ' +
          'the availability minutes alone (07:00-14:00), an hour is 180px zoomed in, so a minute ' +
          'is 3px and each assertion names the pixel the design implies.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    events: EVENTS,
    date: DAY,
    canEditAppointments: true,
    availabilityLoaded: true,
    // Auto-scroll would park the viewport on the first event and make the visible
    // slice of a 1260px grid depend on the wall clock. Pinned to the top instead.
    skipAutoScroll: true,
    getVisibleAvailabilityIntervals: () => AVAILABILITY,
    getDropAvailabilityIntervals: () => AVAILABILITY,
    handleViewAppointment: fn(),
    handleDetailAppointment: fn(),
    handleRescheduleAppointment: fn(),
    canDragAppointment: () => true,
    onAppointmentDragStart: fn(),
    onAppointmentDragEnd: fn(),
    onAppointmentDropAt: fn(),
    onDragHoverTarget: fn(),
  },
  decorators: [
    (Story) => (
      <div className="h-[620px] w-[380px] bg-[var(--screen)]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DayCalendar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Resting: Story = {
  name: 'Resting (no drag)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The timeline is a two-track grid: a fixed 52px time gutter and the events
       column. Both the track count and the child count are asserted, because every
       pixel measurement below is taken from this box - a gutter that grew a third
       track would move each overlay sideways while leaving its `top` untouched, so
       the offsets alone would still read as correct. */
    const grid = getGrid(canvasElement);
    const tracks = getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/);
    await expect(tracks).toHaveLength(2);
    await expect(Number.parseFloat(tracks[0])).toBeCloseTo(52, 0);
    await expect(grid.children).toHaveLength(2);
    // 07:00 through 14:00 inclusive down the gutter. The window is derived, not
    // given, so this is the assertion that pins it: eight labels, or the whole
    // file's geometry is being measured against a different day.
    await expect(canvas.getAllByText(/^\d{1,2}:00 (AM|PM)$/)).toHaveLength(8);
    await expect(canvas.getByText('7:00 AM')).toBeInTheDocument();
    await expect(canvas.getByText('2:00 PM')).toBeInTheDocument();

    /* The dim ranges are the complement of availability across the window: 07:00-08:00,
       10:00-11:00 and 13:00-14:00. Three of them, each exactly one hour = 180px. If
       `computeUnavailableSegments` ever stopped closing the trailing gap this would be
       two, and the tail of the day would silently read as bookable. */
    const dimmed = getDimSegments(canvasElement);
    await expect(dimmed).toHaveLength(3);
    await expect(offsetFromGridTop(canvasElement, dimmed[0])).toBeCloseTo(topPxForMinute(420), 0);
    await expect(offsetFromGridTop(canvasElement, dimmed[1])).toBeCloseTo(topPxForMinute(600), 0);
    await expect(offsetFromGridTop(canvasElement, dimmed[2])).toBeCloseTo(topPxForMinute(780), 0);
    dimmed.forEach((segment) => {
      expect(segment.getBoundingClientRect().height).toBeCloseTo(180, 0);
    });

    // The two drag-only layers are absent, which is the whole point of the gate.
    await expect(getDragAvailabilityRects(canvasElement)).toHaveLength(0);
    await expect(canvasElement.querySelector('.border-dashed')).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The state every existing snapshot holds: dim ranges over the closed hours, markers, ' +
          'nothing else. It is here as the baseline the next two stories are read against - the ' +
          'dim layer must survive a drag unchanged, and the drag layers must not exist without one.',
      },
    },
  },
};

export const DragInFlight: Story = {
  name: 'Drag in flight (availability highlights)',
  args: {
    draggedAppointmentId: 'appt-1',
    draggedAppointmentLabel: DRAG_LABEL,
    draggedAppointmentDurationMinutes: 45,
  },
  play: async ({ canvasElement }) => {
    const rects = getDragAvailabilityRects(canvasElement);
    await expect(rects).toHaveLength(2);

    /* The highlight is NOT the availability interval. Its foot is extended by the
       dragged appointment's duration, because a 45-minute card may START at the last
       bookable minute: 08:00-10:00 becomes 08:00-10:45 = 495px, not 360px. Get that
       wrong and the band lies about where the card can land. */
    await expect(offsetFromGridTop(canvasElement, rects[0])).toBeCloseTo(topPxForMinute(480), 0);
    await expect(rects[0].getBoundingClientRect().height).toBeCloseTo(495, 0);
    await expect(offsetFromGridTop(canvasElement, rects[1])).toBeCloseTo(topPxForMinute(660), 0);
    await expect(rects[1].getBoundingClientRect().height).toBeCloseTo(495, 0);

    // The dim layer is untouched by the drag - the two layers stack, they do not swap.
    await expect(getDimSegments(canvasElement)).toHaveLength(3);
    // No pointer has entered the timeline yet, so there is no landing ghost.
    await expect(canvasElement.querySelector('.border-dashed')).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A card has been picked up but the pointer has not yet moved over the timeline. Two ' +
          'rounded highlights mark where it may land, and they sit ABOVE the dim layer (`z-20` ' +
          'against `z-1`), so a highlight that overlapped a closed hour would still read as open. ' +
          'Each band runs the length of its availability interval plus the dragged duration, ' +
          'which is why an 08:00-10:00 window highlights 165 minutes rather than 120.',
      },
    },
  },
};

export const DropPreviewGhost: Story = {
  name: 'Drop preview ghost (drag over 09:00)',
  args: {
    draggedAppointmentId: 'appt-1',
    draggedAppointmentLabel: DRAG_LABEL,
    draggedAppointmentDurationMinutes: 45,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const timeline = getTimeline(canvasElement);
    const gridRect = getGrid(canvasElement).getBoundingClientRect();

    /* The handler turns a clientY into a minute by ratio against the grid's own rect,
       so the pointer is placed by that same ratio rather than by a hard-coded pixel.
       09:00 is 120 minutes into a 420-minute window. Hoisted out of any `waitFor`:
       dispatching inside a retried callback re-queues on every mutation and wedges
       the tab instead of failing. */
    const clientY =
      gridRect.top + ((540 - WINDOW_START) / (WINDOW_END - WINDOW_START)) * gridRect.height;
    fireEvent.dragOver(timeline, { clientY });

    const label = await canvas.findByText(DRAG_LABEL);
    const band = label.parentElement as HTMLElement;
    const anchor = band.parentElement as HTMLElement;

    // 09:00 is inside the 08:00-10:00 interval, so `calcNearestAvailableMinute`
    // returns it unchanged: 120 minutes past 07:00 = 360px.
    await expect(offsetFromGridTop(canvasElement, anchor)).toBeCloseTo(topPxForMinute(540), 0);
    // 45 minutes at 3px per minute, well over the 12px floor.
    await expect(band.getBoundingClientRect().height).toBeCloseTo(135, 0);
    // The band is the dashed outline, not a solid block - it has to read as a
    // placeholder rather than as a booked card.
    await expect(getComputedStyle(band).borderTopStyle).toBe('dashed');
    // The highlights stay drawn underneath; the ghost is added to them, not swapped in.
    await expect(getDragAvailabilityRects(canvasElement)).toHaveLength(2);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The pointer is dragged to 09:00 and the dashed ghost appears at the landing minute, ' +
          "carrying the dragged card's own label so the surgeon can see WHAT is about to move " +
          'and not merely where.\n\n' +
          'The minute is snapped through `calcNearestAvailableMinute`, which rounds to 5 and then ' +
          'pulls to the closest availability interval within a 12-minute tolerance - drag to a ' +
          'closed hour more than 12 minutes from anything bookable and the ghost does not draw at ' +
          'all. That is the branch a static frame can never show, because it needs a pointer.',
      },
    },
  },
};

export const DropPreviewFallbackLabel: Story = {
  name: 'Drop preview ghost (no label)',
  args: {
    draggedAppointmentId: 'appt-1',
    draggedAppointmentLabel: null,
    draggedAppointmentDurationMinutes: 5,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const timeline = getTimeline(canvasElement);
    const gridRect = getGrid(canvasElement).getBoundingClientRect();

    const clientY =
      gridRect.top + ((480 - WINDOW_START) / (WINDOW_END - WINDOW_START)) * gridRect.height;
    fireEvent.dragOver(timeline, { clientY });

    // Exact string, and a role-free text query on a word that appears nowhere else
    // in this canvas - the preview decorator's sr-only <h1> reads
    // "Appointments/Calendar/DayCalendar - Drop preview ghost (no label)".
    const label = await canvas.findByText('Appointment');
    const band = label.parentElement as HTMLElement;

    await expect(offsetFromGridTop(canvasElement, band.parentElement as HTMLElement)).toBeCloseTo(
      topPxForMinute(480),
      0
    );
    /* 5 minutes would be 15px, which clears the floor - but the floor is 12px here and
       14px in the shared `DropPreviewOverlay`, so the two ghosts disagree about the
       shortest visible drag. Named rather than fixed: this story exists to make the
       divergence visible, not to hide it. */
    await expect(band.getBoundingClientRect().height).toBeCloseTo(15, 0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'A drag that carries no label falls back to the bare word "Appointment" rather than an ' +
          'unidentifiable dashed box. The duration is dropped to the 5-minute minimum as well, ' +
          "which is where DayCalendar's 12px height floor and the week grid's 14px floor part " +
          'company - the same gesture draws a different minimum band depending on which calendar ' +
          'you are in.',
      },
    },
  },
};
