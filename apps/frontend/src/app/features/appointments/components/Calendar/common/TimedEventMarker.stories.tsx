import type { Meta, StoryObj } from '@storybook/react';
import { expect, fireEvent, fn, within } from 'storybook/test';
import type { Appointment } from '@yosemite-crew/types';

import TimedEventMarker from './TimedEventMarker';
import type { LaidOutEvent } from '@/app/features/appointments/types/calendar';
import {
  EVENT_HORIZONTAL_GAP_PX,
  MINUTES_PER_STEP,
  PIXELS_PER_STEP,
} from '@/app/features/appointments/components/Calendar/helpers';
import {
  getPixelsPerStepForZoom,
  type CalendarZoomMode,
} from '@/app/features/appointments/components/Calendar/calendarLayout';

const ORG_ID = 'org-storybook';
const APPOINTMENT_ID = 'appt-timed-1';
const POPOVER_ID = 'appointment-popover';
const ITEM_KEY = 'timed-appt-timed-1';

/** Width of the day column the markers are laid into. Fixed, because every
    width assertion below divides it. */
const TRACK_WIDTH = 260;

/**
 * `DayCalendar` derives both of these and hands them down; recomputed here from
 * the same constants rather than pasted as 0.75 / 0.1417, so a change to the hour
 * row height moves the fixtures and the expected pixels together.
 */
const yScaleFor = (zoomMode: CalendarZoomMode): number =>
  getPixelsPerStepForZoom(zoomMode) / PIXELS_PER_STEP;

/** `layoutDayEvents` measures in unscaled pixels: 20px per 5 minutes, so 4px/min. */
const pxForMinutes = (minutes: number): number => (minutes / MINUTES_PER_STEP) * PIXELS_PER_STEP;

const COMPANION: Appointment['patient'] = {
  id: 'companion-milo',
  name: 'Milo',
  species: 'dog',
  breed: 'Beagle',
  parent: { id: 'parent-lena', name: 'Lena Hartmann' },
};

/**
 * The marker renders no date or time of its own - position comes from `topPx`
 * and `heightPx`, which the parent has already computed - so UTC instants here
 * cannot slide the layout by the runner's offset.
 */
const APPOINTMENT: Appointment = {
  id: APPOINTMENT_ID,
  patient: COMPANION,
  companion: COMPANION,
  organisationId: ORG_ID,
  appointmentType: {
    id: 'svc-wellness',
    name: 'Wellness exam',
    speciality: { id: 'spec-general', name: 'General practice' },
  },
  appointmentDate: new Date('2026-07-14T09:15:00.000Z'),
  startTime: new Date('2026-07-14T09:15:00.000Z'),
  endTime: new Date('2026-07-14T09:45:00.000Z'),
  timeSlot: '09:15 - 09:45',
  durationMinutes: 30,
  status: 'UPCOMING',
  concern: 'Lameness recheck',
};

const laidOut = (patch: Partial<LaidOutEvent> = {}): LaidOutEvent => ({
  ...APPOINTMENT,
  // 09:15 in a window that opens at 09:00, and a 30-minute booking.
  topPx: pxForMinutes(15),
  heightPx: pxForMinutes(30),
  columnIndex: 0,
  columnsCount: 1,
  ...patch,
});

const MARKER_TITLE = 'Milo · Hartmann • Wellness exam • Lameness recheck';

/** The positioned block, which is the marker's outer div rather than its button. */
const blockOf = (button: HTMLElement): HTMLElement => button.parentElement as HTMLElement;

const trackOf = (canvasElement: HTMLElement): HTMLElement =>
  canvasElement.querySelector('[data-story-track]') as HTMLElement;

/** Offsets measured against the track, so they survive the story's own padding. */
const topWithinTrack = (canvasElement: HTMLElement, el: HTMLElement): number =>
  el.getBoundingClientRect().top - trackOf(canvasElement).getBoundingClientRect().top;

const leftWithinTrack = (canvasElement: HTMLElement, el: HTMLElement): number =>
  el.getBoundingClientRect().left - trackOf(canvasElement).getBoundingClientRect().left;

const meta = {
  title: 'Appointments/Calendar/TimedEventMarker',
  component: TimedEventMarker,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          "The appointment block in the day calendar's timed area, and the densest branch set in " +
          'the calendar: two completely different renders behind one `zoomMode` prop, a label ' +
          'that appears only above a measured height, two different height floors, and column ' +
          'packing that comes in through props rather than being computed here.\n\n' +
          '**Zoomed in** it is a card: a bordered, status-tinted box with the companion name, a ' +
          'subtitle built from the service and the reason, and a 26px avatar. **Zoomed out** the ' +
          'box goes transparent, a tint span paints the colour inset by 2px, and the only text is ' +
          'an 8px name overlay - which itself disappears below 11px, leaving a coloured sliver ' +
          'whose meaning exists solely in the screen-reader label and the hover title.\n\n' +
          'The two floors are worth knowing apart: zoomed in a block is never shorter than 40px ' +
          '(a 5-minute booking is drawn at eight times its duration), zoomed out never shorter ' +
          'than 3px. Neither is a rounding - both are deliberate, and both make the block lie ' +
          'about its duration in exchange for being clickable at all.\n\n' +
          'Nothing here is computed from times. `topPx`, `heightPx`, `columnIndex` and ' +
          '`columnsCount` all arrive from `layoutDayEvents`, and `yScale` from the zoom - so ' +
          'these stories feed the marker the same numbers the calendar would, and measure what it ' +
          'draws from them.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    ev: laidOut(),
    itemKey: ITEM_KEY,
    yScale: yScaleFor('in'),
    zoomMode: 'in',
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
    // The marker is `position: absolute` with no positioned parent of its own, so
    // without this every offset it computes would be measured against the page.
    (Story) => (
      <div
        data-story-track
        className="relative bg-[var(--screen)]"
        style={{ width: TRACK_WIDTH, height: 320 }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TimedEventMarker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ZoomedIn: Story = {
  name: 'Zoomed in, one column',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    const block = blockOf(button);

    /* 09:15 is a quarter of an hour down a 180px row and 30 minutes is half of
       it: 45px and 90px. Both are `topPx * yScale` and `heightPx * yScale` with
       nothing clamped - the numbers the rest of the stories are read against. */
    await expect(topWithinTrack(canvasElement, block)).toBeCloseTo(45, 0);
    await expect(block.getBoundingClientRect().height).toBeCloseTo(90, 0);

    /* One column, so the block is the full track less a gap on BOTH sides. The
       gap is applied twice to the width and once to the left, which is what keeps
       neighbouring columns from sharing a border. */
    await expect(block.getBoundingClientRect().width).toBeCloseTo(
      TRACK_WIDTH - EVENT_HORIZONTAL_GAP_PX * 2,
      0
    );
    await expect(leftWithinTrack(canvasElement, block)).toBeCloseTo(EVENT_HORIZONTAL_GAP_PX, 0);

    // Service and reason are joined into one subtitle line, and the hover title
    // carries all three so a truncated card still answers a pointer.
    await expect(canvas.getByText('Milo · Hartmann')).toBeVisible();
    await expect(canvas.getByText('Wellness exam • Lameness recheck')).toBeVisible();
    await expect(button).toHaveAttribute('title', MARKER_TITLE);

    /* The block is the popover's trigger, and that relationship is entirely in
       ARIA - there is no visible affordance saying a card opens a dialog. */
    await expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(button).toHaveAttribute('aria-controls', POPOVER_ID);

    // No `canDragAppointment`, so the card is not draggable and says so with the
    // pointer cursor rather than the grab hand.
    await expect(button).toHaveAttribute('draggable', 'false');
    await expect(globalThis.getComputedStyle(button).cursor).toBe('pointer');

    /* Click reports the item key, not the appointment: the calendar keys its
       open popover by the key, so a marker that passed the id would open nothing
       and fail silently. */
    await fireEvent.click(button);
    await expect(args.onMarkerClick).toHaveBeenCalledWith(expect.anything(), ITEM_KEY);
  },
};

export const ZoomedInPacked: Story = {
  name: 'Zoomed in, three overlapping columns',
  args: { ev: laidOut({ columnsCount: 3, columnIndex: 0 }) },
  render: (args) => (
    <>
      {[0, 1, 2].map((columnIndex) => (
        <TimedEventMarker
          key={columnIndex}
          {...args}
          itemKey={`${ITEM_KEY}-${columnIndex}`}
          ev={laidOut({
            id: `${APPOINTMENT_ID}-${columnIndex}`,
            columnsCount: 3,
            columnIndex,
            // Staggered starts, so the three read as a real overlap rather than
            // as one card drawn three times.
            topPx: pxForMinutes(15 + columnIndex * 5),
          })}
        />
      ))}
    </>
  ),
  play: async ({ canvasElement }) => {
    const blocks = within(canvasElement).getAllByRole('button').map(blockOf);
    await expect(blocks).toHaveLength(3);

    const boxes = blocks.map((block) => block.getBoundingClientRect());

    /* Every column is the same width - the marker divides by `columnsCount`, so a
       card that kept a stale count would be wider than its neighbours and overlap
       them rather than overflowing anything. */
    await expect(boxes[1].width).toBeCloseTo(boxes[0].width, 1);
    await expect(boxes[2].width).toBeCloseTo(boxes[0].width, 1);

    /* Equal gutters, and the gutter is twice the gap because each side of the
       pair contributes one. Asserted as a relation rather than as 4px: it is the
       evenness that the eye reads, and a one-sided gap would still measure a
       "gap" per column. */
    const firstGutter = boxes[1].left - boxes[0].right;
    const secondGutter = boxes[2].left - boxes[1].right;
    await expect(firstGutter).toBeCloseTo(EVENT_HORIZONTAL_GAP_PX * 2, 1);
    await expect(secondGutter).toBeCloseTo(firstGutter, 1);

    // The rightmost column still ends inside the day column: the percentage
    // widths and the pixel gaps have to agree, and they only do because the gap
    // is subtracted from the width rather than added to the offset.
    const track = trackOf(canvasElement).getBoundingClientRect();
    await expect(boxes[0].left - track.left).toBeCloseTo(EVENT_HORIZONTAL_GAP_PX, 1);
    await expect(track.right - boxes[2].right).toBeCloseTo(EVENT_HORIZONTAL_GAP_PX, 1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Three appointments booked over each other. The packing itself is done upstream by ' +
          '`layoutDayEvents`; what the marker owns is turning `columnIndex`/`columnsCount` into a ' +
          'percentage width and a pixel gutter, which is the half that produces overlapping or ' +
          'overflowing cards when it is wrong.',
      },
    },
  },
};

export const InFlight: Story = {
  name: 'Draggable, mid-flight',
  args: {
    canDragAppointment: () => true,
    draggedAppointmentId: APPOINTMENT_ID,
  },
  play: async ({ args, canvasElement }) => {
    const button = within(canvasElement).getByRole('button');

    // Draggability is a permission question, not a status one: the calendar
    // passes a predicate, and the grab cursor is the only resting-state signal.
    await expect(button).toHaveAttribute('draggable', 'true');
    await expect(globalThis.getComputedStyle(button).cursor).toBe('grab');

    /* The card being dragged stays in place at 55% opacity rather than
       disappearing, so the vet can see where it came from while the drop preview
       shows where it would land. */
    await expect(globalThis.getComputedStyle(button).opacity).toBe('0.55');

    /* A real `DataTransfer`, not a stub object: `new DragEvent()` in Chromium
       refuses to convert a plain object and throws at construction, so the
       jsdom-style `{ setData: fn() }` fixture cannot run here. The instance the
       component actually wrote into is captured off the event instead, which
       means the payload below is read back rather than spied on.

       The listener is added directly on the button, so it runs in the target
       phase - ahead of React's delegated handler at the root - and only stores
       the reference; the read happens after the dispatch has finished. */
    let transfer: DataTransfer | null = null;
    button.addEventListener(
      'dragstart',
      (event) => {
        transfer = (event as DragEvent).dataTransfer;
      },
      { once: true }
    );
    await fireEvent.dragStart(button, { dataTransfer: new globalThis.DataTransfer() });

    // The payload is the appointment id. The drop target reads it back out of
    // `text/plain`, so an empty or mis-keyed payload is a drag that silently
    // does nothing on release.
    await expect(transfer).not.toBeNull();
    await expect((transfer as unknown as DataTransfer).getData('text/plain')).toBe(APPOINTMENT_ID);
    await expect(args.onAppointmentDragStart).toHaveBeenCalledTimes(1);
    /* The grabbing cursor is forced onto document.body for the whole gesture,
       because the pointer leaves the card the moment it moves. It is global
       state, so failing to clear it wedges the cursor for the rest of the
       session. */
    await expect(globalThis.document.body.style.cursor).toBe('grabbing');

    await fireEvent.dragEnd(button);
    await expect(globalThis.document.body.style.cursor).toBe('');
    await expect(args.onDropPreviewClear).toHaveBeenCalledTimes(1);
    await expect(args.onAppointmentDragEnd).toHaveBeenCalledTimes(1);
  },
};

export const ZoomedOut: Story = {
  name: 'Zoomed out, tall enough to label',
  args: {
    zoomMode: 'out',
    yScale: yScaleFor('out'),
    ev: laidOut({ topPx: 0, heightPx: pxForMinutes(60) }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    const block = blockOf(button);

    // A full hour at the zoomed-out row height, which is 34px - comfortably over
    // the 11px the label needs.
    await expect(block.getBoundingClientRect().height).toBeCloseTo(34, 0);
    await expect(canvas.getByText('Milo · Hartmann')).toBeVisible();

    /* The block itself is transparent and an inset span carries the colour, so
       the tint is 2px narrower than the block on each side. That inset is what
       separates two adjacent slivers; paint the block directly and a column of
       back-to-back appointments reads as one continuous bar. */
    await expect(globalThis.getComputedStyle(block).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    const tint = block.firstElementChild as HTMLElement;
    await expect(
      tint.getBoundingClientRect().left - block.getBoundingClientRect().left
    ).toBeCloseTo(2, 0);

    /* The hit target is deliberately larger than the block: `-inset-y-2` grows it
       8px at top and bottom, so a 34px bar is a 50px target. Without it the
       zoomed-out calendar is close to unclickable. */
    await expect(button.getBoundingClientRect().height).toBeCloseTo(
      block.getBoundingClientRect().height + 16,
      0
    );

    // The visible overlay is aria-hidden and the button carries the full detail
    // in an sr-only span, so the accessible name is richer than the 8px label.
    await expect(button).toHaveAccessibleName(MARKER_TITLE);
  },
};

export const ZoomedOutSliver: Story = {
  name: 'Zoomed out, sliver below the label threshold',
  args: {
    zoomMode: 'out',
    yScale: yScaleFor('out'),
    ev: laidOut({ topPx: 0, heightPx: pxForMinutes(15) }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    const height = blockOf(button).getBoundingClientRect().height;

    /* A quarter hour is 8.5px here. That is between the 3px block floor and the
       11px label threshold, which is the point: the label is gone because there
       is no room for a line of 8px text, NOT because the block collapsed. */
    await expect(height).toBeCloseTo(8.5, 1);
    await expect(height).toBeGreaterThan(3);
    await expect(height).toBeLessThan(11);

    // Nothing visible says whose appointment this is.
    await expect(canvas.queryByText('Milo · Hartmann')).toBeNull();
    /* It survives only in the a11y tree and the hover title, which is the whole
       reason the sr-only span carries the fuller string rather than the bare
       name: a sliver is the one render where the title is the only detail. */
    await expect(button).toHaveAccessibleName(MARKER_TITLE);
    await expect(button).toHaveAttribute('title', MARKER_TITLE);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The state a zoomed-out week is mostly made of: short bookings drawn as colour and ' +
          'nothing else. Read beside the story above it, the pair pins the 11px cut-off - the ' +
          'only thing separating a labelled bar from an anonymous one.',
      },
    },
  },
};

export const ShortAndUnlabelled: Story = {
  name: 'Five-minute booking, no subtitle',
  args: {
    ev: laidOut({
      heightPx: pxForMinutes(5),
      status: 'CANCELLED',
      appointmentType: undefined,
      concern: undefined,
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    const block = blockOf(button);

    /* 5 minutes is 15px of real estate and the card is drawn at 40px - eight
       times its duration. The floor exists so the avatar and the name fit, and it
       is the one place the calendar knowingly misreports a booking's length. */
    await expect(block.getBoundingClientRect().height).toBeCloseTo(40, 0);

    // With neither a service nor a reason the subtitle node is not rendered at
    // all, and the hover title collapses to the name rather than trailing a
    // bullet with nothing after it.
    await expect(button).toHaveAttribute('title', 'Milo · Hartmann');
    await expect(canvas.getByText('Milo · Hartmann')).toBeVisible();

    /* Colour is the only thing that says a block is cancelled, and it is wired
       through `getStatusStyle` by lower-cased status string - a status the map
       does not know falls back to the "requested" tokens rather than failing. */
    await expect(block.style.backgroundColor).toBe('var(--status-cancelled-bg)');
    await expect(block.style.borderColor).toBe('var(--status-cancelled-border)');
    await expect(globalThis.getComputedStyle(block).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  },
};
