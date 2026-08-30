import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';

import CalendarHourLabel from './CalendarHourLabel';

/** Row heights the calendars actually pass: `getHourRowHeightPx('in' | 'out')`. */
const ZOOM_IN_HEIGHT = 180;
const ZOOM_OUT_HEIGHT = 34;

/** `useSlotOffsetMinutes(15, ...)` - the offsets are handed in at every zoom level. */
const QUARTER_HOURS = [15, 30, 45];

/**
 * Every calendar renders this inside a `grid-cols-[64px_minmax(0,1fr)_64px]` track,
 * so the gutter is 64px wide and the labels hug its right edge. Rendered at panel
 * width the right-offset measurements below would be meaningless.
 */
const withGutter = (Story: React.ComponentType) => (
  <div style={{ width: 64, background: 'var(--screen)' }}>
    <Story />
  </div>
);

/** The label's own row - the component root, which carries the inline height. */
const rowOf = (label: HTMLElement): HTMLElement => label.parentElement as HTMLElement;

/** Distance from the row's top edge to the label's vertical centre. */
const centreOffset = (row: HTMLElement, label: HTMLElement): number => {
  const box = label.getBoundingClientRect();
  return box.top + box.height / 2 - row.getBoundingClientRect().top;
};

const meta = {
  title: 'Appointments/Calendar/CalendarHourLabel',
  component: CalendarHourLabel,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'One cell of the time gutter. Everything it draws is positioning: the hour label is ' +
          'absolutely placed at `top-0` and pulled up by half its own height so it straddles the ' +
          'hour boundary rather than sitting under it, and each slot sub-label is placed at its ' +
          "minute's percentage down the row and straddles its own line the same way.\n\n" +
          'Two props exist for one edge case. The FIRST visible hour has no boundary above it - a ' +
          'straddling label there is half outside the scroll container and reads as clipped - so ' +
          '`pinFirstHour` drops the translate for that row only, and `firstHour` says which hour ' +
          'that is, because the week grid starts at whatever hour has bookings rather than at ' +
          'midnight.\n\n' +
          'Sub-labels are gated on `showSlotTimeLabels`, not on the offsets being empty: the ' +
          'offsets are handed in at both zoom levels and suppressed when a quarter hour is under ' +
          '14px tall.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    hour: 9,
    height: ZOOM_IN_HEIGHT,
    slotOffsetMinutes: QUARTER_HOURS,
    showSlotTimeLabels: true,
  },
  decorators: [withGutter],
} satisfies Meta<typeof CalendarHourLabel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Quarter-hour gutter, zoomed in',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const hourLabel = canvas.getByText('9:00 AM');
    const row = rowOf(hourLabel);
    const rowBox = row.getBoundingClientRect();

    // The row is exactly the height it was told to be; the grid column next to it
    // is laid out from the same number, so a drift here shears the whole gutter.
    await expect(rowBox.height).toBeCloseTo(ZOOM_IN_HEIGHT, 0);

    /* The hour label is CENTRED on the boundary line, not resting below it. This is
       the whole point of the -translate-y-1/2, and losing it moves every label half
       a row down - which still looks deliberate, and puts 9:00 next to the 9:30
       gridline. */
    await expect(centreOffset(row, hourLabel)).toBeCloseTo(0, 0);

    // Half past is half way down: 90px into a 180px row.
    await expect(centreOffset(row, canvas.getByText('9:30 AM'))).toBeCloseTo(ZOOM_IN_HEIGHT / 2, 0);
    await expect(centreOffset(row, canvas.getByText('9:15 AM'))).toBeCloseTo(ZOOM_IN_HEIGHT / 4, 0);

    /* Every label is right-aligned 10px inside the 64px gutter. The hour and its
       sub-labels are positioned by two different rules, so they only line up
       because both pin `right-[10px]` - and a ragged gutter is the kind of thing
       that survives review. */
    for (const label of [
      hourLabel,
      canvas.getByText('9:15 AM'),
      canvas.getByText('9:30 AM'),
      canvas.getByText('9:45 AM'),
    ]) {
      await expect(rowBox.right - label.getBoundingClientRect().right).toBeCloseTo(10, 0);
    }

    // Four labels, no more: one per hour plus one per quarter.
    await expect(row.querySelectorAll('span')).toHaveLength(4);
  },
};

export const ZoomedOut: Story = {
  name: 'Zoomed out, hour only',
  args: { height: ZOOM_OUT_HEIGHT, showSlotTimeLabels: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const row = rowOf(canvas.getByText('9:00 AM'));
    await expect(row.getBoundingClientRect().height).toBeCloseTo(ZOOM_OUT_HEIGHT, 0);

    /* The offsets are still supplied at this zoom - the caller does not empty the
       array, it flips the flag - so a component that keyed off `slotOffsetMinutes.length`
       instead would stack four labels inside 34px and pass every snapshot. */
    await expect(row.querySelectorAll('span')).toHaveLength(1);
    await expect(canvas.queryByText('9:15 AM')).toBeNull();
  },
};

export const PinnedFirstHour: Story = {
  name: 'First hour pinned, the rest straddle',
  args: { pinFirstHour: true, firstHour: 8, showSlotTimeLabels: false },
  render: (args) => (
    <div>
      <CalendarHourLabel {...args} hour={8} />
      <CalendarHourLabel {...args} hour={9} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const first = canvas.getByText('8:00 AM');
    const second = canvas.getByText('9:00 AM');
    const firstTop = first.getBoundingClientRect().top - rowOf(first).getBoundingClientRect().top;

    // The first visible hour sits fully inside its row: there is no boundary above
    // it to straddle, and half a label above the scroll container reads as clipped.
    await expect(firstTop).toBeCloseTo(0, 0);

    // Every later hour keeps the straddle, so its centre is on the row's top edge.
    await expect(centreOffset(rowOf(second), second)).toBeCloseTo(0, 0);

    /* `firstHour` is the half that gets forgotten: without it the pin lands on hour
       0, the grid starts at 08:00, and nothing is pinned. Stated as a relation so
       it fails when the two rows are treated the same way. */
    const secondTop =
      second.getBoundingClientRect().top - rowOf(second).getBoundingClientRect().top;
    await expect(firstTop).toBeGreaterThan(secondTop);
  },
};

export const MidnightAndNoon: Story = {
  name: 'Midnight and noon',
  render: (args) => (
    <div>
      <CalendarHourLabel {...args} hour={0} />
      <CalendarHourLabel {...args} hour={12} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Both ends of the 12-hour wrap in one frame. Hour 0 is the one that breaks
       quietly - "0:00 AM" is wrong but legible - and noon is the one that breaks
       loudly, because 12 % 12 is 0 as well. */
    await expect(canvas.getByText('12:00 AM')).toBeVisible();
    await expect(canvas.getByText('12:00 PM')).toBeVisible();

    // The sub-labels run through their own formatter, with its own copy of the wrap.
    await expect(canvas.getByText('12:15 AM')).toBeVisible();
    await expect(canvas.getByText('12:45 PM')).toBeVisible();
  },
};
