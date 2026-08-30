import type { Meta, StoryObj } from '@storybook/react';
import type { ReactNode } from 'react';
import { expect, fireEvent, fn, userEvent, within } from 'storybook/test';

import SlotCreateButton from './SlotCreateButton';

/* One hour cell of the week grid, at the real zoomed-in row height
   (`getHourRowHeightPx('in')`). The height is not decoration: the minute the
   caller books is a fraction of it, so a 180px cell is the difference between
   this story documenting the contract and inventing one. */
const CELL_HEIGHT = 180;
const CELL_WIDTH = 220;
const DROP_HOUR = 9;

/* The label Slot builds for a real cell (`buildSlotLabels`): weekday, month and
   day, then the hour. It is the button's only content, so it is also the only
   thing a screen reader has to tell one of these apart from the 167 others on a
   week view. */
const CREATE_LABEL = 'Create appointment on Tuesday, July 14 at 9:00 AM';

/**
 * The resolver on the other side of `onPick`, copied from `Slot`'s
 * `minuteFromSlotPointer`. It is what makes the two callback arguments mean
 * something: the pointer's clientY is only a booking time relative to the
 * CONTAINER's box, and the container the button hands back is its parent, not
 * itself. Both clamps are real - y is held inside the cell and the minute inside
 * the hour, so the last pixel of 09:00 books 09:59 and never 10:00.
 */
const minuteFromPointer = (clientY: number, container: HTMLElement) => {
  const rect = container.getBoundingClientRect();
  const y = Math.max(0, Math.min(rect.height, clientY - rect.top));
  const minuteWithinHour = Math.max(
    0,
    Math.min(59, Math.round((y / Math.max(1, rect.height)) * 60))
  );
  return DROP_HOUR * 60 + minuteWithinHour;
};

const SlotCell = ({ children }: Readonly<{ children: ReactNode }>) => (
  <div
    data-slot-cell=""
    className="relative bg-neutral-0"
    style={{ height: `${CELL_HEIGHT}px`, width: `${CELL_WIDTH}px` }}
  >
    {/* Drawn as overlays rather than as borders on the cell: a border would shrink
        the padding box the button is `inset-0` against, and the geometry asserted
        below is exactly that box. */}
    <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-card-border" />
    <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-card-border" />
    {children}
  </div>
);

const getCell = (canvasElement: HTMLElement) =>
  canvasElement.querySelector('[data-slot-cell]') as HTMLElement;

/** The recorded calls, typed: `args.onPick` is a spy but is declared as the prop. */
const callsOf = (spy: unknown) => (spy as { mock: { calls: [number, HTMLElement][] } }).mock.calls;

const meta = {
  title: 'Appointments/Calendar/SlotCreateButton',
  component: SlotCreateButton,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The invisible layer that turns an empty hour into a booking. There is nothing to look ' +
          'at - it paints no pixels - but it owns a contract that only exists at the moment of a ' +
          'click, and a play function is the only place that contract is written down.\n\n' +
          'It reports two things: the raw `clientY` of the pointer, and **the parent element**, ' +
          'read off `event.currentTarget.parentElement`. Neither is useful alone. `Slot` divides ' +
          "the offset within the parent's box by that box's height to get the minute within the " +
          'hour, so a handler that reported the button instead of the cell, or a pixel offset ' +
          'instead of a page coordinate, would still book an appointment - just at the wrong time. ' +
          'That is the failure these stories exist for.\n\n' +
          'Click and double-click are wired to the same resolver, so a slot still books when a ' +
          'user double-clicks it out of habit. The consequence is that a double-click fires ' +
          '`onPick` three times (click, click, dblclick), all resolving the same minute - drawn ' +
          'below, because `Slot` turns each one into a create call.\n\n' +
          'Being a real `button` rather than a div is what makes an empty hour bookable from the ' +
          'keyboard at all: it carries the slot label as its accessible name and takes the global ' +
          'focus ring, which is the only time this control is ever visible.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    label: CREATE_LABEL,
    onPick: fn(),
  },
  decorators: [
    (Story) => (
      <SlotCell>
        <Story />
      </SlotCell>
    ),
  ],
} satisfies Meta<typeof SlotCreateButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Idle (invisible, but named and reachable)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: CREATE_LABEL });
    const cell = getCell(canvasElement);
    const buttonRect = button.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();

    // Nothing is painted, so the accessible name carries the whole affordance.
    await expect(button.textContent).toBe('');

    /* It covers the hour exactly. A layer that fell short would leave dead
       minutes at the top or bottom of every cell in the calendar, and a layer
       that overflowed would book the neighbouring hour. */
    await expect(buttonRect.top).toBeCloseTo(cellRect.top, 1);
    await expect(buttonRect.bottom).toBeCloseTo(cellRect.bottom, 1);
    await expect(buttonRect.height).toBeCloseTo(CELL_HEIGHT, 1);
    await expect(buttonRect.width).toBeCloseTo(CELL_WIDTH, 1);

    /* z-1 puts it under the appointment markers (z-20) and the hour rules (z-10),
       so clicking an existing card opens the card rather than booking over it. */
    await expect(getComputedStyle(button).zIndex).toBe('1');

    /* Tabbed rather than focused programmatically: :focus-visible does not fire on
       .focus() in Chromium, and the global 2px ring is the only moment this
       control is visible to anyone. */
    await userEvent.tab();
    await expect(button).toHaveFocus();
    const focusStyle = getComputedStyle(button);
    await expect(focusStyle.outlineStyle).toBe('solid');
    await expect(focusStyle.outlineWidth).toBe('2px');
  },
};

export const ClickNearTheTop: Story = {
  name: 'Click near the top of the hour',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: CREATE_LABEL });
    const cell = getCell(canvasElement);
    // 3px into a 180px hour. fireEvent rather than userEvent because the whole
    // point is to control the coordinate, not to land in the middle of the box.
    const clientY = cell.getBoundingClientRect().top + 3;

    fireEvent.click(button, { clientY });

    /* The pointer coordinate is passed through untouched, and the container is the
       CELL - not the button. `toHaveBeenCalledWith` compares that node by
       identity, so a switch to `event.currentTarget` would fail here even though
       the two boxes happen to coincide. */
    await expect(args.onPick).toHaveBeenCalledTimes(1);
    await expect(args.onPick).toHaveBeenCalledWith(clientY, cell);
    // 3 / 180 of an hour rounds to one minute past nine.
    await expect(minuteFromPointer(clientY, cell)).toBe(DROP_HOUR * 60 + 1);
  },
};

export const ClickNearTheBottom: Story = {
  name: 'Click on the last pixel of the hour',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: CREATE_LABEL });
    const cell = getCell(canvasElement);
    const clientY = cell.getBoundingClientRect().bottom - 1;

    fireEvent.click(button, { clientY });

    await expect(args.onPick).toHaveBeenCalledWith(clientY, cell);
    /* 179 / 180 of an hour is 59.67 minutes, which rounds to 60 - i.e. the top of
       the NEXT hour. The clamp is what stops a click at the bottom of the 09:00
       cell from booking 10:00, and it is only reachable from the last three
       pixels of a row. */
    await expect(minuteFromPointer(clientY, cell)).toBe(DROP_HOUR * 60 + 59);
  },
};

export const DoubleClick: Story = {
  name: 'Double-click books the same minute (three times)',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: CREATE_LABEL });
    const cell = getCell(canvasElement);

    await userEvent.dblClick(button);

    /* onClick fires for each of the two clicks and onDoubleClick for the pair, so
       one gesture resolves three times, always against the same pixel and the same
       container. Slot turns every one of them into a create call - worth knowing
       before a caller assumes one gesture is one booking. */
    const calls = callsOf(args.onPick);
    await expect(calls).toHaveLength(3);
    await expect(new Set(calls.map(([clientY]) => clientY)).size).toBe(1);
    for (const [, container] of calls) {
      await expect(container).toBe(cell);
    }

    /* And the double-click path resolves through the same maths as a single click.
       Dispatched by hand for this half: user-event reports no useful coordinate
       here, so a minute asserted off its gesture would be measuring the test
       library rather than the component. */
    const clientY = cell.getBoundingClientRect().top + CELL_HEIGHT / 2;
    fireEvent.dblClick(button, { clientY });
    const [lastY, lastContainer] = callsOf(args.onPick)[3];
    await expect(lastY).toBe(clientY);
    // Half way down the 09:00 cell, on the half-hour rule: 09:30.
    await expect(minuteFromPointer(lastY, lastContainer)).toBe(DROP_HOUR * 60 + 30);
  },
};
