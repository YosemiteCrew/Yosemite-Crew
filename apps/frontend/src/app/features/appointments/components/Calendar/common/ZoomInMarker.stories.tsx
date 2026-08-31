import type { Meta, StoryObj } from '@storybook/react';
import type { ReactNode } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Appointment } from '@yosemite-crew/types';

import ZoomInMarker from './ZoomInMarker';

/** The id `DayCalendar` gives its single shared popover; every marker points at it. */
const POPOVER_ID = 'day-calendar-appointment-popover';
const ORG_ID = 'org-storybook';
/** `ZoomInEventList` builds this from the appointment; here it is just the handshake. */
const ITEM_KEY = 'timed-Milo-0';

/** The real zoomed-in hour row (`getHourRowHeightPx('in')`). */
const HOUR_HEIGHT = 180;
/** Divides cleanly by two and by three, so every lane figure below is exact. */
const COLUMN_WIDTH = 600;

const companionOf = (name: string) => ({
  id: `companion-${name.toLowerCase()}`,
  name,
  species: 'dog',
  breed: 'Beagle',
  parent: { id: `parent-${name.toLowerCase()}`, name: 'Lena Hartmann' },
});

/* The marker never reads the clock - `ZoomInEventList` has already turned the times
   into `topPx` and `blockHeightPx` - so these two instants only have to exist. They
   are still built with the local-date constructor rather than a UTC literal, because
   nothing here should start sliding if a future prop does read them. */
const START = new Date(2026, 6, 14, 9, 0);
const END = new Date(2026, 6, 14, 9, 30);

const appointment = (overrides: Partial<Appointment> = {}): Appointment => {
  const companion = companionOf('Milo');
  return {
    id: 'appt-milo',
    patient: companion,
    companion,
    organisationId: ORG_ID,
    appointmentDate: START,
    startTime: START,
    endTime: END,
    timeSlot: '09:00 - 09:30',
    durationMinutes: 30,
    status: 'UPCOMING',
    concern: 'Limping on left hind',
    appointmentType: {
      id: 'type-dental',
      name: 'Dental check',
      speciality: { id: 'spec-dentistry', name: 'Dentistry' },
    },
    ...overrides,
  };
};

/** Swap the companion without losing the `patient`/`companion` pairing the marker reads. */
const forCompanion = (name: string): Partial<Appointment> => {
  const companion = companionOf(name);
  return { patient: companion, companion };
};

/** Every status the appointment calendar paints, one fill each. */
const STATUSES: Appointment['status'][] = [
  'REQUESTED',
  'UPCOMING',
  'CHECKED_IN',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
];

/**
 * The marker is `absolute` and sizes itself in percentages of its lane, so it needs a
 * positioned box of a known width to mean anything at all. 600px stands in for one
 * day column at the real 180px hour height.
 */
const HourColumn = ({ children }: Readonly<{ children: ReactNode }>) => (
  <div
    data-hour-column=""
    className="relative rounded-md bg-neutral-0"
    style={{ width: `${COLUMN_WIDTH}px`, height: `${HOUR_HEIGHT}px` }}
  >
    {children}
  </div>
);

type Parts = { column: HTMLElement; button: HTMLElement; block: HTMLElement };

const partsOf = (canvasElement: HTMLElement): Parts => {
  const column = canvasElement.querySelector('[data-hour-column]') as HTMLElement;
  const button = within(canvasElement).getAllByRole('button')[0];
  // The block is the positioned wrapper; the button inside it is `size-full`, so
  // measuring the button would silently pass even if the wrapper's geometry broke.
  return { column, button, block: button.parentElement as HTMLElement };
};

const boxWithin = (column: HTMLElement, block: HTMLElement) => {
  const columnRect = column.getBoundingClientRect();
  const blockRect = block.getBoundingClientRect();
  return {
    left: Math.round(blockRect.left - columnRect.left),
    top: Math.round(blockRect.top - columnRect.top),
    width: Math.round(blockRect.width),
    height: Math.round(blockRect.height),
  };
};

const meta = {
  title: 'Appointments/Calendar/ZoomInMarker',
  component: ZoomInMarker,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'One appointment card on the zoomed-in day and week grids. `ZoomInEventList` hands it a ' +
          'lane and a pixel box; everything else it decides for itself from those two numbers, ' +
          'which is why it is worth drawing at each size rather than once.\n\n' +
          '`getMarkerSizing(laneCount, blockHeightPx)` picks the tier. A single lane at 72px or ' +
          'more is **tall**: a 60px avatar and the service and the reason on their own bulleted ' +
          'lines. At 44px it is **medium**: a 34px avatar and one subtitle line with the two ' +
          'joined by a bullet. Below 44px it is **small**: a 24px avatar, tighter padding ' +
          '(`py-0.5`, `pl-1.5 pr-2`) and the companion name alone, because a 40px block cannot ' +
          'carry a second line without clipping it. More than one lane drops the avatar ' +
          'altogether and keeps the service only - the narrow tier is a different composition, ' +
          'not the tall one scaled down.\n\n' +
          'The lane maths is `100 / laneCount` wide, offset by `laneIndex`, inset 2px each side ' +
          "so the block lands on the frame's `left: 6px; right: 6px` once the slot's own 4px is " +
          'added. A REQUESTED booking dashes the outline while keeping the 3px leading spine ' +
          'solid, which is the only visual difference between a request and a confirmed booking ' +
          'at this size.\n\n' +
          'Interaction comes from `getMarkerButtonProps`, shared with the zoomed-out marker: the ' +
          'popover ARIA triplet, click / double-click / context-menu dispatch, the ' +
          '`canDragAppointment` gate on `draggable`, and the 0.55 opacity while this appointment ' +
          'is the one being dragged. All of it fails silently - the card looks identical whether ' +
          'or not it points at a popover that exists.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    ev: appointment(),
    itemKey: ITEM_KEY,
    laneIndex: 0,
    laneCount: 1,
    topPx: 0,
    blockHeightPx: HOUR_HEIGHT,
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
    (Story) => (
      <HourColumn>
        <Story />
      </HourColumn>
    ),
  ],
} satisfies Meta<typeof ZoomInMarker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Tall: Story = {
  name: 'A full hour, single lane',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const { column, button, block } = partsOf(canvasElement);

    /* The tall tier is the only one that keeps the service and the reason apart, each
       with its own leading bullet. The medium tier joins the same two strings, so a
       tier that silently fell through would still show both words and look fine. */
    await expect(canvas.getByText('• Dental check')).toBeInTheDocument();
    await expect(canvas.getByText('• Limping on left hind')).toBeInTheDocument();

    // min(60, round(180 * 0.52)) - the avatar grows with the block up to a 60px ceiling.
    const avatar = block.querySelector('img') as HTMLElement;
    await expect(Math.round(avatar.getBoundingClientRect().width)).toBe(60);
    await expect(Math.round(avatar.getBoundingClientRect().height)).toBe(60);
    // Decorative: the card already names the companion in text, and an alt would
    // make a screen reader announce it twice.
    await expect(avatar).toHaveAttribute('alt', '');

    // The frame's 8px / 12px card padding, which only the short tier is allowed to break.
    const buttonStyle = globalThis.getComputedStyle(button);
    await expect(buttonStyle.paddingTop).toBe('8px');
    await expect(buttonStyle.paddingLeft).toBe('12px');
    await expect(buttonStyle.paddingRight).toBe('12px');

    // One lane is the whole column less the 2px lane gap on each side.
    await expect(boxWithin(column, block)).toEqual({
      left: 2,
      top: 0,
      width: COLUMN_WIDTH - 4,
      height: HOUR_HEIGHT,
    });

    /* A confirmed booking is a solid 1px outline with the leading edge thickened to
       3px. The Requested story is the same measurement with one value changed. */
    const blockStyle = globalThis.getComputedStyle(block);
    await expect(blockStyle.borderTopStyle).toBe('solid');
    await expect(blockStyle.borderTopWidth).toBe('1px');
    await expect(blockStyle.borderLeftWidth).toBe('3px');
  },
};

export const Medium: Story = {
  name: 'A 15-minute card joins the subtitle onto one line',
  // 15 minutes at the 180px hour row: over the 44px medium threshold, under 72px.
  args: { blockHeightPx: 45 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const { button, block } = partsOf(canvasElement);

    // One line, the two fields joined by a bullet, and no leading bullet of its own.
    await expect(canvas.getByText('Dental check • Limping on left hind')).toBeInTheDocument();
    await expect(canvas.queryByText('• Dental check')).toBeNull();

    // Fixed 34px here, not the tall tier's height-derived size.
    const avatar = block.querySelector('img') as HTMLElement;
    await expect(Math.round(avatar.getBoundingClientRect().width)).toBe(34);

    // Still a full-size card: only the short tier tightens the vertical padding.
    await expect(globalThis.getComputedStyle(button).paddingTop).toBe('8px');

    /* Two lines of content inside a 45px box. If the tier ever drifted to the tall
       composition here, the second line would be clipped by the block's own
       `overflow-hidden` rather than reported by anything. */
    const content = button.lastElementChild as HTMLElement;
    await expect(content.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      block.getBoundingClientRect().bottom
    );
  },
};

export const Short: Story = {
  name: 'A 40px block carries the name only',
  // 40px is the floor `ZoomInEventList` applies, so this is the shortest card there is.
  args: { blockHeightPx: 40 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const { button, block } = partsOf(canvasElement);

    await expect(canvas.getByText('Milo · Hartmann')).toBeInTheDocument();
    /* Neither subtitle composition survives here. A 40px block with an 11px second
       line does not overflow visibly - the block clips it - so a tier that leaked
       into this size would look like a slightly cramped card, not a bug. */
    await expect(canvas.queryByText('• Dental check')).toBeNull();
    await expect(canvas.queryByText('Dental check • Limping on left hind')).toBeNull();

    // Small still keeps an avatar, at 24px, unlike the multi-lane tier.
    const avatar = block.querySelector('img') as HTMLElement;
    await expect(Math.round(avatar.getBoundingClientRect().width)).toBe(24);

    // py-0.5 / pl-1.5 pr-2: the one tier allowed to break the 8px/12px card padding,
    // which is what lets a 24px avatar and a 12.5px name fit inside 40px at all.
    const buttonStyle = globalThis.getComputedStyle(button);
    await expect(buttonStyle.paddingTop).toBe('2px');
    await expect(buttonStyle.paddingLeft).toBe('6px');
    await expect(buttonStyle.paddingRight).toBe('8px');
  },
};

export const MultiLane: Story = {
  name: 'The middle of three overlapping lanes',
  args: {
    ev: appointment(forCompanion('Bartholomew Wigglesworth III')),
    laneIndex: 1,
    laneCount: 3,
    topPx: 45,
    blockHeightPx: 90,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const { column, block } = partsOf(canvasElement);

    /* Multi-lane drops the avatar entirely. It is not the tall tier scaled down: at
       196px wide the avatar would eat the half of the card the name needs. */
    await expect(block.querySelector('img')).toBeNull();

    // Service only. The reason is dropped rather than truncated into ambiguity.
    await expect(canvas.getByText('Dental check')).toBeInTheDocument();
    await expect(canvas.queryByText(/Limping/)).toBeNull();

    /* A third of the column, offset by one lane, inset 2px each side. Off-by-one lane
       maths reads as "the cards look a bit wrong" and nothing else. */
    await expect(boxWithin(column, block)).toEqual({
      left: COLUMN_WIDTH / 3 + 2,
      top: 45,
      width: COLUMN_WIDTH / 3 - 4,
      height: 90,
    });

    // The long name clamps inside its lane instead of widening it into the next one.
    const name = canvas.getByText('Bartholomew Wigglesworth III · Hartmann');
    await expect(name.scrollWidth).toBeGreaterThan(name.clientWidth);
    await expect(block.getBoundingClientRect().right).toBeLessThanOrEqual(
      column.getBoundingClientRect().right
    );
  },
};

export const Requested: Story = {
  name: 'A request dashes the outline and keeps the spine',
  args: { ev: appointment({ status: 'REQUESTED' }), blockHeightPx: 90 },
  play: async ({ canvasElement }) => {
    const { block } = partsOf(canvasElement);
    const blockStyle = globalThis.getComputedStyle(block);

    /* Three sides dashed, the leading spine solid and still 3px. This is the entire
       visual difference between a request and a confirmed booking on the grid, and
       `borderStyle` and `borderLeftStyle` are set in that order - reverse them and
       every card in the calendar goes dashed with nothing thrown. */
    await expect(blockStyle.borderTopStyle).toBe('dashed');
    await expect(blockStyle.borderRightStyle).toBe('dashed');
    await expect(blockStyle.borderBottomStyle).toBe('dashed');
    await expect(blockStyle.borderLeftStyle).toBe('solid');
    await expect(blockStyle.borderLeftWidth).toBe('3px');
  },
};

export const Draggable: Story = {
  name: 'Draggable, and mid-drag',
  args: {
    canDragAppointment: () => true,
    draggedAppointmentId: 'appt-milo',
    blockHeightPx: 90,
  },
  play: async ({ canvasElement }) => {
    const { button } = partsOf(canvasElement);

    /* `draggable` is gated on `canDragAppointment`, so a permission check that stops
       returning true turns every card into a dead drag target with no other symptom. */
    await expect(button).toHaveAttribute('draggable', 'true');
    await expect(globalThis.getComputedStyle(button).cursor).toBe('grab');

    // The dragged card fades to 0.55 so the drop preview underneath it reads.
    await expect(globalThis.getComputedStyle(button).opacity).toBe('0.55');
  },
};

export const Wiring: Story = {
  name: 'Popover wiring and the three dispatches',
  args: { activePopoverKey: ITEM_KEY, blockHeightPx: 90 },
  play: async ({ args, canvasElement }) => {
    const { button } = partsOf(canvasElement);

    // All three attributes fail invisibly: the card looks and clicks exactly the same
    // whether or not it points at a popover that exists.
    await expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    await expect(button).toHaveAttribute('aria-controls', POPOVER_ID);
    // Expanded only because the parent's stored key matches this marker's own itemKey.
    await expect(button).toHaveAttribute('aria-expanded', 'true');

    /* The hover title carries the full sentence the card truncates away, and it is the
       only place the reason survives on a narrow lane. */
    await expect(button).toHaveAttribute(
      'title',
      'Milo · Hartmann • Dental check • Limping on left hind'
    );

    // Not draggable without `canDragAppointment`, and an undragged card stays opaque.
    await expect(button).toHaveAttribute('draggable', 'false');
    await expect(globalThis.getComputedStyle(button).opacity).toBe('1');

    /* Click hands back the key, not the appointment: the parent stores it as
       `activePopoverKey` and compares it back. Double-click and context menu hand back
       the appointment instead. Three handlers on one element, all wired in
       `getMarkerButtonProps`, and each one is a plausible copy-paste of the others. */
    await userEvent.click(button);
    await expect(args.onMarkerClick).toHaveBeenCalledWith(expect.anything(), ITEM_KEY);

    await userEvent.dblClick(button);
    await expect(args.onMarkerDoubleClick).toHaveBeenCalledWith(args.ev);

    await userEvent.pointer({ keys: '[MouseRight]', target: button });
    await expect(args.onMarkerContextMenu).toHaveBeenCalledWith(expect.anything(), args.ev);
  },
};

export const Statuses: Story = {
  name: 'One fill per status',
  args: { blockHeightPx: 90 },
  render: (args) => (
    <>
      {STATUSES.map((status, index) => (
        <ZoomInMarker
          key={status}
          {...args}
          ev={{ ...args.ev, id: `appt-${status.toLowerCase()}`, status }}
          itemKey={`timed-${status}`}
          laneIndex={index}
          laneCount={STATUSES.length}
        />
      ))}
    </>
  ),
  play: async ({ canvasElement }) => {
    const blocks = within(canvasElement)
      .getAllByRole('button')
      .map((button) => button.parentElement as HTMLElement);
    await expect(blocks).toHaveLength(STATUSES.length);

    const fills = blocks.map((block) => globalThis.getComputedStyle(block).backgroundColor);
    /* Six statuses, six fills. `getStatusStyle` lowercases the SCREAMING_CASE status to
       look the palette up and falls back to the requested style on a miss, so a broken
       mapping does not throw - it paints the whole grid one colour and the grid still
       reads as a grid. */
    await expect(new Set(fills).size).toBe(STATUSES.length);
    for (const fill of fills) {
      await expect(fill).not.toBe('rgba(0, 0, 0, 0)');
    }

    // The border tracks the fill: a card whose outline came from a different status
    // than its fill would still look deliberate.
    const borders = blocks.map((block) => globalThis.getComputedStyle(block).borderTopColor);
    await expect(new Set(borders).size).toBe(STATUSES.length);
  },
};
