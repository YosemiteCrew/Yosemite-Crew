import type { Meta, StoryObj } from '@storybook/react';
import { expect, fireEvent, fn, within } from 'storybook/test';
import type { Appointment } from '@yosemite-crew/types';

import Slot from './Slot';

const ORG_ID = 'org-storybook';

/** One hour cell of the week grid: 09:00, zoomed in, so the row is 180px tall. */
const DROP_HOUR = 9;
const HOUR_HEIGHT = 180;
const ZOOM_OUT_HOUR_HEIGHT = 34;
const DROP_DATE = new Date('2026-07-14T00:00:00.000Z');

const appointment = (id: string, name: string, minuteOfHour: number): Appointment => {
  // Only the MINUTE within the hour positions a marker (`ZoomInEventList` reads
  // `getDatePartsInPreferredTimeZone(startTime).minute`), and every zone this app
  // supports is a whole-hour offset, so the marker lands on the same pixel everywhere.
  const startTime = new Date(`2026-07-14T09:${String(minuteOfHour).padStart(2, '0')}:00.000Z`);
  const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);
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
    timeSlot: '09:15 - 09:45',
    durationMinutes: 30,
    status: 'UPCOMING',
    concern: 'Lameness recheck',
  };
};

const SLOT_EVENTS: Appointment[] = [appointment('appt-1', 'Milo', 15)];

const DRAG_LABEL = 'Nala · Hartmann';

const getSlotSection = (canvasElement: HTMLElement): HTMLElement =>
  canvasElement.querySelector('section[aria-label^="Appointments slot"]') as HTMLElement;

const getAvailabilityRects = (canvasElement: HTMLElement): HTMLElement[] =>
  Array.from(canvasElement.querySelectorAll<HTMLElement>('.bg-calendar-availability-overlay'));

const offsetFromSlotTop = (canvasElement: HTMLElement, el: HTMLElement): number =>
  el.getBoundingClientRect().top - getSlotSection(canvasElement).getBoundingClientRect().top;

const meta = {
  title: 'Appointments/Calendar/Slot',
  component: Slot,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'One hour cell of the week grid - and the drag affordance it draws for exactly as long ' +
          'as a pointer is held down.\n\n' +
          'Slot renders a full week: seven columns times the visible hours, so a single ' +
          'availability rectangle here is repeated dozens of times on screen. It is also gated on ' +
          '`draggedAppointmentId`, which means no snapshot, unit test or Chromatic frame has ever ' +
          'contained one. The maths behind it is the kind that ships broken quietly: three clamps ' +
          'in eight lines, and every one of them only bites at a cell boundary.\n\n' +
          'The rectangle is **not** the availability interval. `computeAvailabilitySegments` ' +
          "clips the interval to this hour, then extends its foot by the dragged appointment's " +
          'own duration - because a 30-minute card may legally START at the last bookable minute. ' +
          'That has two consequences the stories below draw: an interval that ends BEFORE this ' +
          "hour can still paint a band inside it, and a band can run past the interval's stated " +
          'end. A final `Math.max(4, ...)` floor keeps a sliver visible when the overlap is a ' +
          'couple of minutes, which is what the zoomed-out story is for - at 34px an hour, three ' +
          'minutes is under two pixels.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    slotEvents: SLOT_EVENTS,
    height: HOUR_HEIGHT,
    dayIndex: 0,
    length: 6,
    canEditAppointments: true,
    dropDate: DROP_DATE,
    dropHour: DROP_HOUR,
    zoomMode: 'in',
    handleViewAppointment: fn(),
    handleRescheduleAppointment: fn(),
    canDragAppointment: () => true,
    onAppointmentDragStart: fn(),
    onAppointmentDragEnd: fn(),
    onAppointmentDropAt: fn(),
    onDragHoverTarget: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-[260px] bg-[var(--screen)]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Slot>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Resting: Story = {
  name: 'Resting (no drag)',
  args: {
    dropAvailabilityIntervals: [{ startMinute: 540, endMinute: 585 }],
    draggedAppointmentDurationMinutes: 30,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The card sits where its minute says: 09:15 is a quarter down a 180px row, and
       30 minutes is 90px - clear of the 40px block minimum, so this is the real
       duration rather than a floor. Both numbers are the baseline the drag stories
       are read against, because the overlays are positioned by the same arithmetic. */
    const card = canvas.getByText('Milo · Hartmann').closest('.absolute') as HTMLElement;
    await expect(offsetFromSlotTop(canvasElement, card)).toBeCloseTo(45, 0);
    await expect(card.getBoundingClientRect().height).toBeCloseTo(90, 0);

    // One interactive object in the cell: the card. No create button, because
    // `onCreateAppointmentAt` is not wired, and no drag affordance at rest.
    const [cardButton, ...extraButtons] = canvas.getAllByRole('button');
    await expect(extraButtons).toHaveLength(0);
    // The title carries the reason as well as the companion, so a block truncated
    // to two words still answers a hover.
    await expect(cardButton).toHaveAttribute('title', 'Milo · Hartmann • Lameness recheck');
    await expect(cardButton).toHaveAttribute('draggable', 'true');

    // Availability is a DRAG affordance, so an idle calendar must not advertise it.
    await expect(getAvailabilityRects(canvasElement)).toHaveLength(0);
    await expect(canvasElement.querySelector('.border-dashed')).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The cell as every existing frame holds it: one 09:15 card in a 09:00 hour, no overlays. ' +
          'The availability intervals are already supplied here - they simply draw nothing until ' +
          'something is being dragged.',
      },
    },
  },
};

export const DragInFlight: Story = {
  name: 'Drag in flight (band clipped to the hour)',
  args: {
    draggedAppointmentId: 'appt-2',
    draggedAppointmentLabel: DRAG_LABEL,
    draggedAppointmentDurationMinutes: 30,
    dropAvailabilityIntervals: [{ startMinute: 555, endMinute: 585 }],
  },
  play: async ({ canvasElement }) => {
    const rects = getAvailabilityRects(canvasElement);
    await expect(rects).toHaveLength(1);

    // 09:15 is a quarter into the row: 45px of 180px.
    await expect(offsetFromSlotTop(canvasElement, rects[0])).toBeCloseTo(45, 0);
    /* The interval ends at 09:45, but a 30-minute card starting at 09:45 is legal, so
       the foot runs to 10:15 - past this cell - and is clipped at the hour boundary.
       135px, not the 90px the interval alone would give. A band that stopped at the
       interval end would tell the vet they cannot drop at 09:45, when they can. */
    await expect(rects[0].getBoundingClientRect().height).toBeCloseTo(135, 0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'A card is in flight over a cell whose availability runs 09:15-09:45. The band starts at ' +
          'the interval, but its foot is the interval end plus the dragged duration, clipped to ' +
          'the end of the hour - so it fills the row from 09:15 down rather than stopping at 09:45.',
      },
    },
  },
};

export const SpilloverFromPreviousHour: Story = {
  name: 'Drag in flight (spill from the hour above)',
  args: {
    draggedAppointmentId: 'appt-2',
    draggedAppointmentLabel: DRAG_LABEL,
    draggedAppointmentDurationMinutes: 30,
    dropAvailabilityIntervals: [{ startMinute: 480, endMinute: 530 }],
  },
  play: async ({ canvasElement }) => {
    const rects = getAvailabilityRects(canvasElement);
    /* The interval is 08:00-08:50 and this is the 09:00 cell, so on a naive reading
       nothing should draw here at all. It does, and correctly: a 30-minute card
       dropped at 08:50 runs to 09:20, so the top 20 minutes of this hour are a valid
       landing zone. The band is 60px and starts flush at the top. */
    await expect(rects).toHaveLength(1);
    await expect(offsetFromSlotTop(canvasElement, rects[0])).toBeCloseTo(0, 0);
    await expect(rects[0].getBoundingClientRect().height).toBeCloseTo(60, 0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The least obvious branch, and the reason the segments are computed per cell rather than ' +
          'sliced from the day. An availability interval that closes at 08:50 still paints inside ' +
          "the 09:00 cell, because the dragged card's duration is added to the interval foot " +
          'before it is clipped. Drop the `+ effectiveDuration` term and this rectangle vanishes, ' +
          'with no test anywhere noticing.',
      },
    },
  },
};

export const ZoomedOutFloor: Story = {
  name: 'Zoomed out (4px floor)',
  args: {
    zoomMode: 'out',
    height: ZOOM_OUT_HOUR_HEIGHT,
    slotEvents: [],
    draggedAppointmentId: 'appt-2',
    draggedAppointmentLabel: DRAG_LABEL,
    draggedAppointmentDurationMinutes: 5,
    dropAvailabilityIntervals: [{ startMinute: 480, endMinute: 538 }],
  },
  play: async ({ canvasElement }) => {
    const rects = getAvailabilityRects(canvasElement);
    await expect(rects).toHaveLength(1);
    /* Three minutes of overlap on a 34px hour is 1.7px - a hairline the eye reads as
       a border, not as a droppable band. `Math.max(4, ...)` rounds it up to 4px, which
       is the ONLY state where the rectangle is deliberately taller than the time it
       represents. Visible only with the zoomed-in stories above for comparison. */
    await expect(rects[0].getBoundingClientRect().height).toBeCloseTo(4, 0);
    await expect(offsetFromSlotTop(canvasElement, rects[0])).toBeCloseTo(0, 0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same overlay in the zoomed-out calendar, where an hour is 34px rather than 180px. ' +
          'Proportionally the band would be under two pixels, so the 4px floor takes over. Note ' +
          "the floor is 4px here and 6px in `DayCalendar`'s copy of the same idea - two " +
          'implementations of one affordance, with different minimums.',
      },
    },
  },
};

export const DropPreviewGhost: Story = {
  name: 'Drop preview ghost (drag over 09:30)',
  args: {
    draggedAppointmentId: 'appt-2',
    draggedAppointmentLabel: DRAG_LABEL,
    draggedAppointmentDurationMinutes: 30,
    dropAvailabilityIntervals: [{ startMinute: 540, endMinute: 585 }],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const section = getSlotSection(canvasElement);
    const rect = section.getBoundingClientRect();

    /* The minute comes from the pointer's ratio down the cell's own rect, so the
       pointer is placed by that ratio rather than a raw pixel. Dispatched here, above
       any `waitFor`: a dispatch inside a retried callback re-queues on every mutation
       and wedges the tab instead of failing. */
    fireEvent.dragOver(section, {
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    });

    const label = await canvas.findByText(DRAG_LABEL);
    const ghost = label.parentElement as HTMLElement;

    // 09:30 is inside the 09:00-09:45 interval, so the snap returns it unchanged and
    // the ghost sits at the half-hour rule: 90px of 180px.
    await expect(offsetFromSlotTop(canvasElement, ghost)).toBeCloseTo(90, 0);
    /* 30 minutes would be 90px, but only 30 minutes of the hour remain, so
       `Math.min(duration, 60 - minute % 60)` happens to agree here. The two clamps
       coincide at the half hour and diverge everywhere else - which is exactly why
       this reads as correct in review and still overflows at :45. */
    await expect(ghost.getBoundingClientRect().height).toBeCloseTo(90, 0);
    await expect(getComputedStyle(ghost).borderTopStyle).toBe('dashed');
    // The availability band stays under it; the ghost is added, not swapped in.
    await expect(getAvailabilityRects(canvasElement)).toHaveLength(1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Both drag layers at once, which is the state the vet actually sees: the solid band says ' +
          'where a drop is allowed, the dashed ghost says where THIS drop would land, and it ' +
          "carries the dragged card's label so the two can be told apart mid-gesture.\n\n" +
          'The ghost itself is the shared `DropPreviewOverlay`, which has its own story for the ' +
          'clamp cases. What only exists here is the composition - the pointer handler that turns ' +
          'a clientY into a minute, snaps it to the nearest availability interval within 12 ' +
          'minutes, and hands it down. Drag more than 12 minutes from anything bookable and no ' +
          'ghost draws at all.',
      },
    },
  },
};
