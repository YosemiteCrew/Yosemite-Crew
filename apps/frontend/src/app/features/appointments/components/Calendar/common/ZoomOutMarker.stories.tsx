import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Appointment } from '@yosemite-crew/types';

import { getHourRowHeightPx } from '../calendarLayout';
import ZoomOutMarker from './ZoomOutMarker';

const ORG_ID = 'org-storybook';
/** The id the day view gives its single shared popover; every marker points at it. */
const POPOVER_ID = 'day-calendar-appointment-popover';
const ITEM_KEY = 'slot-poppy-0930';

/**
 * Zoomed out, an hour of the day is 34px tall - so a 30-minute booking is a 17px
 * bar and a 20-minute one is 11px. Taken from the layout helper rather than typed
 * as a number: the whole point of these stories is where those heights fall
 * relative to the component's own 16px label cut, and a hard-coded 34 would keep
 * agreeing with itself after the row height changed.
 */
const HOUR_PX = getHourRowHeightPx('out');
const HALF_HOUR_PX = HOUR_PX / 2;

/**
 * Local dates, not UTC literals. Nothing in this marker reads a clock, but the
 * fixtures are lifted into neighbouring stories often enough that a literal that
 * slides by the runner's offset is not worth leaving here.
 */
const START = new Date(2026, 6, 14, 9, 30);
const END = new Date(2026, 6, 14, 10, 0);

const booking = (
  name: string,
  parent: string,
  status: Appointment['status'],
  overrides: Partial<Appointment> = {}
): Appointment => {
  const animal = {
    id: `companion-${name.toLowerCase()}`,
    name,
    species: 'dog',
    breed: 'Beagle',
    parent: { id: `parent-${parent.toLowerCase()}`, name: parent },
  };
  return {
    id: `appt-${name.toLowerCase()}`,
    patient: animal,
    companion: animal,
    organisationId: ORG_ID,
    appointmentDate: START,
    startTime: START,
    endTime: END,
    timeSlot: '09:30 - 10:00',
    durationMinutes: 30,
    status,
    ...overrides,
  };
};

const POPPY = booking('Poppy', 'Maya Whitfield', 'UPCOMING', {
  appointmentType: {
    id: 'svc-dental',
    name: 'Dental consultation',
    speciality: { id: 'spec-dentistry', name: 'Dentistry' },
  },
  concern: 'Post-op recheck',
});

const MILO = booking('Milo', 'Lena Hartmann', 'CHECKED_IN', { concern: 'Nail trim' });

/**
 * What the component assembles: the companion display name (companion, then the
 * owner's LAST name, joined by a middle dot) and then the service and the reason,
 * joined by bullets. Two different separators, both of them easy to swap by
 * accident, and this string is the marker's accessible name as well as its label.
 */
const POPPY_TITLE = 'Poppy · Whitfield • Dental consultation • Post-op recheck';
const MILO_TITLE = 'Milo · Hartmann • Nail trim';

const laneOf = (canvasElement: HTMLElement) =>
  canvasElement.querySelector('[data-lane]') as HTMLElement;

/** The marker root: the button is absolutely positioned inside it. */
const markerOf = (button: HTMLElement) => button.parentElement as HTMLElement;

/** The bar behind the button - the aria-hidden span carrying the status colour. */
const barOf = (marker: HTMLElement) => marker.querySelector('span[aria-hidden]') as HTMLElement;

type Rgba = { r: number; g: number; b: number; a: number };

const parseRgba = (value: string): Rgba => {
  const [r = 0, g = 0, b = 0, a = 1] = (value.match(/[\d.]+/g) ?? []).map(Number);
  return { r, g, b, a };
};

/**
 * Flatten a translucent layer onto the ground under it. The dark palette paints the
 * status bars as ~0.17-alpha tints, so reading a bar's own `rgba()` as if it were
 * opaque measures a bright colour nobody ever sees: the label below comes out at
 * 2.4:1 against a bar that in fact sits at 6.8:1.
 */
const flatten = (layer: Rgba, ground: Rgba): Rgba => ({
  r: layer.r * layer.a + ground.r * (1 - layer.a),
  g: layer.g * layer.a + ground.g * (1 - layer.a),
  b: layer.b * layer.a + ground.b * (1 - layer.a),
  a: 1,
});

const toLinear = (channel: number): number => {
  const srgb = channel / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
};

/** Relative luminance: 0 is black, 1 is white. */
const luminance = ({ r, g, b }: Rgba): number =>
  0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

const luminanceOf = (value: string): number => luminance(parseRgba(value));

/** The marker label against its own bar, with both composited onto the lane. */
const labelContrast = (inkValue: string, barValue: string, laneValue: string): number => {
  const bar = flatten(parseRgba(barValue), parseRgba(laneValue));
  const ink = flatten(parseRgba(inkValue), bar);
  const inkLuminance = luminance(ink);
  const barLuminance = luminance(bar);
  return (
    (Math.max(inkLuminance, barLuminance) + 0.05) / (Math.min(inkLuminance, barLuminance) + 0.05)
  );
};

const resolveToken = (near: Element, token: string): string => {
  const probe = globalThis.document.createElement('span');
  probe.style.color = `var(${token})`;
  near.append(probe);
  const value = globalThis.getComputedStyle(probe).color;
  probe.remove();
  return value;
};

const meta = {
  title: 'Appointments/Calendar/ZoomOutMarker',
  component: ZoomOutMarker,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'One appointment in the zoomed-out day planner, where an hour is 34px of track. The ' +
          'marker is a status-coloured bar with the button that owns the popover, the ' +
          'double-click and the drag laid over it.\n\n' +
          'Its one branch is the 16px cut: below that a single line of 9.5px text no longer fits ' +
          'the bar, so the label is dropped and the same string is kept as `sr-only` text instead ' +
          'of being clipped to a couple of pixels of letter-tops. That is the difference between ' +
          'a short booking that reads as a colour and one that reads as a smear, and it is ' +
          'invisible to a screen reader either way - which is exactly why the boundary is pinned ' +
          'from both sides here.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    ev: POPPY,
    itemKey: ITEM_KEY,
    marginTopPx: HALF_HOUR_PX,
    blockHeightPx: HALF_HOUR_PX,
    activePopoverKey: null,
    appointmentPopoverId: POPOVER_ID,
    onMarkerClick: fn(),
    onMarkerDoubleClick: fn(),
    onMarkerContextMenu: fn(),
    onDropPreviewClear: fn(),
  },
  decorators: [
    /* The lane the planner puts markers in: a flex column, 150px of team track wide.
       Flex matters. `marginTopPx` is the appointment's start minute within the hour,
       and in a plain block parent that margin would collapse straight out through
       the container and position nothing at all. */
    (Story) => (
      <div
        data-lane=""
        className="flex flex-col px-1"
        style={{ width: 150, background: 'var(--screen)' }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ZoomOutMarker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'A 30-minute booking',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    const marker = markerOf(button);
    const lane = laneOf(canvasElement);

    /* Height IS duration and offset IS start time - there is no other rendering of
       either at this zoom. A marker an hour row too far down is a plausible-looking
       booking at the wrong time, so both are measured against the lane rather than
       trusted to the style prop. */
    await expect(marker.getBoundingClientRect().height).toBeCloseTo(HALF_HOUR_PX, 0);
    await expect(marker.getBoundingClientRect().top - lane.getBoundingClientRect().top).toBeCloseTo(
      HALF_HOUR_PX,
      0
    );

    // Popover wiring. All three fail silently: the marker looks and clicks exactly
    // the same whether or not it points at a popover that exists.
    await expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    await expect(button).toHaveAttribute('aria-controls', POPOVER_ID);
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(button).toHaveAttribute('title', POPPY_TITLE);

    /* At 17px the label is painted, and at 150px of column it is clipped - so the
       accessible name is the only place the reason survives. */
    const label = canvas.getByText(POPPY_TITLE);
    await expect(label).toBeVisible();
    await expect(label.scrollWidth).toBeGreaterThan(label.clientWidth);
    await expect(button).toHaveAccessibleName(POPPY_TITLE);

    /* Without `canDragAppointment` the marker is not draggable and says so with the
       cursor. A grab cursor over an appointment nobody is allowed to move is an
       invitation to a drag that silently does nothing. */
    await expect(button).toHaveAttribute('draggable', 'false');
    await expect(globalThis.getComputedStyle(button).cursor).toBe('pointer');

    /* The click hands back the key the parent stores as `activePopoverKey`, not the
       appointment - feed back the wrong half and the popover simply never opens. */
    await userEvent.click(button);
    await expect(args.onMarkerClick).toHaveBeenCalledWith(expect.anything(), ITEM_KEY);

    // Double-click opens the workspace and takes the appointment itself.
    await userEvent.dblClick(button);
    await expect(args.onMarkerDoubleClick).toHaveBeenCalledWith(POPPY);
  },
};

export const LabelThreshold: Story = {
  name: 'The 16px label cut, from both sides',
  render: (args) => (
    <>
      <ZoomOutMarker {...args} ev={POPPY} itemKey="poppy-16" blockHeightPx={16} marginTopPx={0} />
      <ZoomOutMarker {...args} ev={MILO} itemKey="milo-15" blockHeightPx={15} marginTopPx={12} />
    </>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const [tall, short] = canvas.getAllByRole('button');

    /* 16 keeps its label and 15 loses it. The comparison is `>=`, so a single
       character changed there moves the whole cut by a pixel - which is invisible
       in review and turns every half-hour booking on the busiest calendars into a
       bar with a sliver of letter-tops in it. */
    const shown = canvas.getByText(POPPY_TITLE);
    await expect(shown).not.toHaveClass('sr-only');
    await expect(shown.getBoundingClientRect().height).toBeGreaterThan(1);

    const announced = canvas.getByText(MILO_TITLE);
    await expect(announced).toHaveClass('sr-only');
    await expect(announced.getBoundingClientRect().height).toBeLessThanOrEqual(1);

    /* Dropping the text costs nothing to a screen reader: both markers keep the
       full name. Sighted users get the colour, so the bar has to still be painted -
       a bare marker with a transparent bar is a booking that is not there. */
    await expect(tall).toHaveAccessibleName(POPPY_TITLE);
    await expect(short).toHaveAccessibleName(MILO_TITLE);
    await expect(globalThis.getComputedStyle(barOf(markerOf(short))).backgroundColor).not.toBe(
      'rgba(0, 0, 0, 0)'
    );
    await expect(markerOf(short).getBoundingClientRect().height).toBeCloseTo(15, 0);
  },
};

export const Dragging: Story = {
  name: 'Being dragged to a new slot',
  args: {
    canDragAppointment: () => true,
    draggedAppointmentId: POPPY.id,
    onAppointmentDragStart: fn(),
    onAppointmentDragEnd: fn(),
  },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button');

    // Draggable only when the caller says this appointment may be moved.
    await expect(button).toHaveAttribute('draggable', 'true');
    await expect(globalThis.getComputedStyle(button).cursor).toBe('grab');

    /* The one being carried is faded, which is how the drop preview underneath it
       stays legible. It is set from the id rather than from a local dragging flag,
       so the marker fades in every lane the appointment is drawn in. */
    await expect(globalThis.getComputedStyle(button).opacity).toBe('0.55');
  },
};

export const Statuses: Story = {
  name: 'One colour per status',
  render: (args) => (
    <>
      {(['UPCOMING', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const).map(
        (status, index) => (
          <ZoomOutMarker
            key={status}
            {...args}
            ev={booking(`Case${index}`, 'Lena Hartmann', status)}
            itemKey={`case-${status}`}
            marginTopPx={4}
            blockHeightPx={HOUR_PX}
          />
        )
      )}
    </>
  ),
  play: async ({ canvasElement }) => {
    const buttons = within(canvasElement).getAllByRole('button');
    await expect(buttons).toHaveLength(5);

    const fills = buttons.map(
      (button) => globalThis.getComputedStyle(barOf(markerOf(button))).backgroundColor
    );
    const inks = buttons.map(
      (button) => globalThis.getComputedStyle(button.firstElementChild as HTMLElement).color
    );

    /* Five statuses, five fills and five inks. `getStatusStyle` lowercases the
       SCREAMING_CASE status to look the palette up and falls back to the "requested"
       style on a miss - so a broken mapping does not throw, it paints the whole day
       one colour, and a day of identical bars still reads as a day. */
    await expect(new Set(fills).size).toBe(5);
    await expect(new Set(inks).size).toBe(5);
    for (const fill of fills) {
      await expect(fill).not.toBe('rgba(0, 0, 0, 0)');
    }

    /* And every one of the five is readable on its own bar. The label is 9.5px
       semibold, so AA is 4.5:1 and there is no headroom to spend: retuning one
       status token is a two-line change that can leave a whole day of bookings
       legible everywhere except on the status somebody just adjusted. */
    const lane = globalThis.getComputedStyle(laneOf(canvasElement)).backgroundColor;
    for (const [index, ink] of inks.entries()) {
      await expect(labelContrast(ink, fills[index], lane)).toBeGreaterThanOrEqual(4.5);
    }
  },
};

export const Dark: Story = {
  name: 'Dark',
  globals: { theme: 'dark' },
  args: { blockHeightPx: HOUR_PX },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    const bar = barOf(markerOf(button));

    /* Proof the story is in the dark palette at all before anything is read off it -
       a story-level global that never reaches the preview fails with no symptom, and
       the token assertions below would pass just as happily against the light values. */
    const lane = globalThis.getComputedStyle(laneOf(canvasElement)).backgroundColor;
    await expect(luminanceOf(lane)).toBeLessThan(0.1);

    /* Bar, border and label all come from the one status family, and each one is a
       token rather than a literal - a marker painted from a light-mode hex is
       perfectly legible in review and unreadable in the product at night. */
    const barStyle = globalThis.getComputedStyle(bar);
    await expect(barStyle.backgroundColor).toBe(
      resolveToken(canvasElement, '--status-upcoming-bg')
    );
    await expect(barStyle.borderTopColor).toBe(
      resolveToken(canvasElement, '--status-upcoming-border')
    );
    await expect(barStyle.borderTopWidth).toBe('1px');
    const ink = globalThis.getComputedStyle(canvas.getByText(POPPY_TITLE)).color;
    await expect(ink).toBe(resolveToken(canvasElement, '--status-upcoming-text'));

    /* Readable on the bar it is printed on. Worth measuring here rather than only in
       light: the dark bars are 0.17-alpha tints of the status hue, so the colour the
       label actually sits on is not the token at all, it is that tint flattened onto
       whatever the lane is painting. */
    await expect(labelContrast(ink, barStyle.backgroundColor, lane)).toBeGreaterThanOrEqual(4.5);
  },
};
