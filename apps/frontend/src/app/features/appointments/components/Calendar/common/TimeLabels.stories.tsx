import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import type { ReactNode } from 'react';
import { getPixelsPerStepForZoom } from '@/app/features/appointments/components/Calendar/calendarLayout';
import { MINUTES_PER_STEP } from '@/app/features/appointments/components/Calendar/helpers';

import TimeLabels from './TimeLabels';

/**
 * The two densities the calendar actually runs at. Taken from the real helper
 * rather than retyped, so a change to the hour row height moves these stories
 * with it: 180px / 12 steps zoomed in, 34px / 12 steps zoomed out.
 */
const ZOOMED_IN = getPixelsPerStepForZoom('in');
const ZOOMED_OUT = getPixelsPerStepForZoom('out');

const HOUR = 60;

/**
 * TimeLabels' own root is `relative` but has zero height - every label is
 * absolutely positioned off it - so it needs a box tall enough for the computed
 * window or the labels stack outside anything you can look at. The gutter is
 * 52px wide in `DayCalendar`; a little wider here so the labels are readable on
 * their own.
 */
const Gutter = ({ height, children }: Readonly<{ height: number; children: ReactNode }>) => (
  <div
    className="overflow-auto"
    style={{ width: 120, maxHeight: 460, background: 'var(--screen)' }}
  >
    <div className="relative" style={{ height, paddingLeft: 8, paddingTop: 12 }}>
      {children}
    </div>
  </div>
);

const windowHeightPx = (windowStart: number, windowEnd: number, pixelsPerStep: number) =>
  ((windowEnd - windowStart) / MINUTES_PER_STEP) * pixelsPerStep + 24;

/** Vertical distance between two labels, which is what `top` resolves to. */
const gapBetween = (canvasElement: HTMLElement, first: string, second: string) => {
  const canvas = within(canvasElement);
  return Math.round(
    canvas.getByText(second).getBoundingClientRect().top -
      canvas.getByText(first).getBoundingClientRect().top
  );
};

/** Every clock label on screen, hour and sub-hour alike. */
const CLOCK_LABEL = /^\d{1,2}:\d{2} (AM|PM)$/;
const ON_THE_HOUR = /^\d{1,2}:00 (AM|PM)$/;

const meta = {
  title: 'Appointments/Calendar/TimeLabels',
  component: TimeLabels,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The time gutter down the left of the day calendar. It is handed a window in minutes ' +
          'since midnight and works out which labels belong in it, which is more arithmetic than ' +
          'the output suggests.\n\n' +
          'Hour labels run from `ceil(windowStart / 60)` to `floor(windowEnd / 60)` inclusive, so ' +
          'a window that ends exactly on the hour gets a label on its closing edge - a full day ' +
          'therefore carries midnight twice, once at each end.\n\n' +
          'Sub-hour labels have two separate gates and it matters which one fires. A ' +
          '`slotStepMinutes` of 60 or more returns none at all, because there is nothing between ' +
          'the hours to name. Below that, the labels are dropped again whenever a slot is worth ' +
          'less than 14px, which is the density rule: zoomed out an hour is 34px tall, a quarter ' +
          'of it is 8.5px, and drawing four labels into that space produces an unreadable smear ' +
          'rather than more information. Nothing about the markup says which gate suppressed a ' +
          'label, so the stories drive both.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    windowStart: 8 * HOUR,
    windowEnd: 18 * HOUR,
    pixelsPerStep: ZOOMED_IN,
    slotStepMinutes: 15,
  },
  decorators: [
    (Story, context) => (
      <Gutter
        height={windowHeightPx(
          context.args.windowStart,
          context.args.windowEnd,
          context.args.pixelsPerStep ?? ZOOMED_IN
        )}
      >
        <Story />
      </Gutter>
    ),
  ],
} satisfies Meta<typeof TimeLabels>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BusinessHours: Story = {
  name: 'Business hours, quarter-hour labels',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // 08:00 through 18:00 inclusive - the closing hour gets a label because the
    // range is built with `+ 1`, and losing it leaves the last row unlabelled.
    await expect(canvas.getAllByText(ON_THE_HOUR)).toHaveLength(11);
    await expect(canvas.getByText('6:00 PM')).toBeInTheDocument();
    // Three quarter-hour labels per hour for ten hours, none of them landing on
    // an hour that already has its own label (`minute % 60` is skipped).
    await expect(canvas.getAllByText(CLOCK_LABEL)).toHaveLength(11 + 30);
    await expect(canvas.getByText('8:15 AM')).toBeInTheDocument();
    // The step is 15, not MINUTES_PER_STEP: the gutter is not labelled every 5
    // minutes just because the geometry is computed in 5-minute steps.
    await expect(canvas.queryByText('8:05 AM')).not.toBeInTheDocument();
    // One hour is one 180px row zoomed in.
    await expect(gapBetween(canvasElement, '8:00 AM', '9:00 AM')).toBe(180);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The everyday case: a ten-hour clinic day zoomed in, where a quarter hour is 45px and ' +
          'comfortably over the 14px floor.',
      },
    },
  },
};

export const FullDay: Story = {
  name: 'Full day, zoomed out',
  args: { windowStart: 0, windowEnd: 24 * HOUR, pixelsPerStep: ZOOMED_OUT },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // 0 through 24 inclusive is 25 labels, and the slot labels are gone, so the
    // clock-label count and the hour count are the same number here.
    await expect(canvas.getAllByText(CLOCK_LABEL)).toHaveLength(25);
    // Midnight at both ends: hour 24 normalises back to 12:00 AM rather than
    // rendering "24:00" or being dropped.
    await expect(canvas.getAllByText('12:00 AM')).toHaveLength(2);
    await expect(gapBetween(canvasElement, '1:00 AM', '2:00 AM')).toBe(34);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The whole day in one 816px column. This is the window `getVisibleHourRange` falls back ' +
          'to, and the only place the duplicated midnight label shows up.',
      },
    },
  },
};

export const DenseZoomOut: Story = {
  name: 'Zoomed out, slot labels suppressed',
  args: { pixelsPerStep: ZOOMED_OUT },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // A quarter of a 34px hour is 8.5px, under the 14px floor, so the sub-hour
    // labels are dropped even though slotStepMinutes still asks for them.
    await expect(canvas.queryByText('8:15 AM')).not.toBeInTheDocument();
    // The hours survive the density rule - it thins the gutter, it does not
    // empty it.
    await expect(canvas.getAllByText(ON_THE_HOUR)).toHaveLength(11);
    await expect(canvas.getAllByText(CLOCK_LABEL)).toHaveLength(11);
    await expect(gapBetween(canvasElement, '8:00 AM', '9:00 AM')).toBe(34);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same window and the same `slotStepMinutes` as the default story, at the zoomed-out ' +
          'density. Only `pixelsPerStep` changed, and it is what decides whether the quarter-hour ' +
          'labels exist at all - the calendar never tells the gutter to stop asking for them.',
      },
    },
  },
};

export const HalfHourSteps: Story = {
  name: 'Half-hour step',
  args: { slotStepMinutes: 30 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('8:30 AM')).toBeInTheDocument();
    await expect(canvas.queryByText('8:15 AM')).not.toBeInTheDocument();
    // One label per hour, and none doubled onto an hour boundary.
    await expect(canvas.getAllByText(CLOCK_LABEL)).toHaveLength(11 + 10);
  },
  parameters: {
    docs: {
      description: {
        story:
          'A 30-minute booking grid. The step drives the label positions directly, so the gutter ' +
          'always agrees with the rules `SlotGridLines` draws in the columns beside it.',
      },
    },
  },
};

export const HourlySteps: Story = {
  name: 'Hourly step, no sub-hour labels',
  args: { slotStepMinutes: 60 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The other gate: `step >= 60` returns early, so nothing sub-hour is drawn
    // even though this is the zoomed-in density with 180px of room per hour.
    await expect(canvas.queryByText('8:15 AM')).not.toBeInTheDocument();
    await expect(canvas.queryByText('8:30 AM')).not.toBeInTheDocument();
    await expect(canvas.getAllByText(CLOCK_LABEL)).toHaveLength(11);
    // Still fully zoomed in - this is the step gate, not the density gate.
    await expect(gapBetween(canvasElement, '8:00 AM', '9:00 AM')).toBe(180);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The hourly calendar. Worth having next to the zoomed-out story: both render an ' +
          'hours-only gutter, for entirely different reasons, and only the row spacing tells them ' +
          'apart.',
      },
    },
  },
};
