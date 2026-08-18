import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import TimeSlot from './TimeSlot';
import {
  type AvailabilityState,
  type Interval,
  type SetAvailability,
  timeIndex,
  timeOptions,
} from './utils';

const DAY = 'Monday';

type TimeSlotHarnessProps = {
  /** Which end of the interval this chip edits. */
  field: keyof Interval;
  /** Seed for the day's single interval. */
  interval: Interval;
  disabled?: boolean;
  /** Fires with the whole interval after a pick, so the reset rule is visible. */
  onIntervalChange: (interval: Interval) => void;
};

/**
 * `TimeSlot` writes through a `setAvailability` dispatcher rather than owning a
 * value, so it cannot render on its own: the chip label comes back out of the
 * state the picker just wrote. The harness holds that state the way the
 * Availability card does, which is also what makes the "start later than end
 * clears the end" branch reachable from a story.
 */
const TimeSlotHarness = ({ field, interval, disabled, onIntervalChange }: TimeSlotHarnessProps) => {
  const [availability, setAvailability] = useState<AvailabilityState>(() => ({
    [DAY]: { enabled: true, intervals: [interval] },
  }));
  // The component passes an updater function, so the harness needs the current
  // value outside React's state queue to report the result to the actions panel.
  const latest = useRef(availability);

  const handleSetAvailability: SetAvailability = (update) => {
    const next = typeof update === 'function' ? update(latest.current) : update;
    latest.current = next;
    onIntervalChange(next[DAY].intervals[0]);
    setAvailability(next);
  };

  return (
    <TimeSlot
      interval={availability[DAY].intervals[0]}
      timeOptions={timeOptions}
      timeIndex={timeIndex}
      setAvailability={handleSetAvailability}
      day={DAY}
      intervalIndex={0}
      field={field}
      disabled={disabled}
    />
  );
};

/** The list hangs below the chip at `top-[110%]`, so the frame needs room under it. */
const Room = (Story: React.ComponentType) => (
  <div className="flex min-h-[300px] items-start p-6">
    <Story />
  </div>
);

const meta = {
  title: 'Appointments/Availability/TimeSlot',
  component: TimeSlotHarness,
  decorators: [Room],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The time chip in the Availability card - two per interval, seven days of them - and the ' +
          'option list it opens. Only the chip had ever been drawn: the list is gated on ' +
          '`open && !disabled`, so every story and every Chromatic snapshot of the Availability ' +
          'screen showed a closed 32px pill and nothing else.\n\n' +
          'What that hid is a panel with **97 rows** in it. `generateTimeOptions` walks the day in ' +
          '15-minute steps and appends 23:59, and all of them mount at once inside an ' +
          '`absolute left-0 top-[110%] max-h-[200px] overflow-y-scroll` box - about five rows ' +
          'visible over a scroller with `scrollbar-hidden`, so there is no visible affordance ' +
          'saying the other ninety-two exist. It also does not scroll the current value into view, ' +
          'so opening a chip reading 9:00 AM shows a list starting at 12:00 AM.\n\n' +
          'The panel is a fixed `w-[110px]` while the chip is `w-[100px] sm:w-[110px]`, so below ' +
          '640px the list is 10px wider than the control it belongs to and overhangs its right ' +
          'edge - visible at the Mobile (375) viewport and nowhere else.\n\n' +
          'The open chip also has a state of its own that no snapshot contained: while the list is ' +
          'up it swaps `border-[var(--hairline)]` for `border-[var(--blue)]` plus a ' +
          '`shadow-[0_0_0_3px_var(--glow-b10)]` ring, the same treatment `focus-visible` gets. ' +
          'The stories below open the list and assert it has its rows, not merely that a flag ' +
          'flipped - an empty panel would satisfy the weaker check.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    field: 'start',
    interval: { start: '09:00', end: '17:00' },
    onIntervalChange: fn(),
  },
} satisfies Meta<typeof TimeSlotHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {
  name: 'Chip only',
  parameters: {
    docs: {
      story:
        'The resting control: 32px tall, 9px radius, 1.5px hairline over `--field-bg`, with the ' +
        'label in 13px semibold tabular figures so 9:00 and 11:45 stay the same width.',
    },
  },
};

export const OptionListOpen: Story = {
  name: 'Option list open',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chip = canvas.getByRole('button', { name: '9:00 AM' });
    await userEvent.click(chip);
    // The list is a plain sibling div with no role or label, so anchor on the
    // chip rather than on a query that could match the trigger itself.
    const panel = chip.nextElementSibling as HTMLElement;
    await expect(panel).toBeInTheDocument();
    // Assert the list has its ROWS. "aria-expanded flipped" would pass on an
    // empty box, which is exactly how a dropdown regression stays invisible.
    const options = within(panel).getAllByRole('button');
    await expect(options).toHaveLength(97);
    await expect(options[0]).toHaveTextContent('12:00 AM');
    await expect(options.at(-1)).toHaveTextContent('11:59 PM');
    await expect(within(panel).getByRole('button', { name: '9:15 AM' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      story:
        'All 97 quarter-hours, mounted at once. The box caps at 200px and scrolls, and it opens at ' +
        'the top of the day rather than at the selected value.',
    },
  },
};

export const TimePicked: Story = {
  name: 'Picking a time',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const chip = canvas.getByRole('button', { name: '9:00 AM' });
    await userEvent.click(chip);
    const panel = chip.nextElementSibling as HTMLElement;
    await userEvent.click(within(panel).getByRole('button', { name: '10:30 AM' }));
    // The chip is the only place the pick becomes visible, so assert the label
    // moved - and that the list closed behind it.
    await expect(chip).toHaveTextContent('10:30 AM');
    await expect(chip.nextElementSibling).toBeNull();
    await expect(args.onIntervalChange).toHaveBeenLastCalledWith({ start: '10:30', end: '17:00' });
  },
  parameters: {
    docs: {
      story:
        'Selecting writes through `setAvailability` and closes the list in the same handler. The ' +
        'chip only relabels because the parent echoed the new state back into `interval`.',
    },
  },
};

export const StartPastEndClearsEnd: Story = {
  name: 'Start past end clears the end',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const chip = canvas.getByRole('button', { name: '9:00 AM' });
    await userEvent.click(chip);
    const panel = chip.nextElementSibling as HTMLElement;
    await userEvent.click(within(panel).getByRole('button', { name: '6:00 PM' }));
    // 18:00 is past the 17:00 end, so the component blanks `end` rather than
    // leaving an interval that runs backwards.
    await expect(args.onIntervalChange).toHaveBeenLastCalledWith({ start: '18:00', end: '' });
  },
  parameters: {
    docs: {
      story:
        'A start later than the current end wipes the end, using `timeIndex` to compare the two ' +
        'values. The neighbouring end chip then falls back to its "Select" label - a state that ' +
        'exists only after this specific pick.',
    },
  },
};

export const NoValue: Story = {
  name: 'Empty (Select)',
  args: { field: 'end', interval: { start: '09:00', end: '' } },
  parameters: {
    docs: {
      story:
        'An interval with no end yet. `getTimeLabelFromValue` returns an empty string, so the chip ' +
        'falls back to "Select" - shown in the same 13px semibold as a real time rather than as ' +
        'placeholder-toned text.',
    },
  },
};

export const Disabled: Story = {
  name: 'Disabled (list cannot open)',
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chip = canvas.getByRole('button', { name: '9:00 AM' });
    await userEvent.click(chip);
    // Two independent guards: the `disabled` attribute, and `open && !disabled`
    // on the panel. Assert the list genuinely did not mount.
    await expect(chip).toBeDisabled();
    await expect(chip.nextElementSibling).toBeNull();
  },
  parameters: {
    docs: {
      story:
        'The day toggle turns its chips off. There is no dimmed styling for this - the chip looks ' +
        'identical and simply stops responding, which is worth seeing beside the enabled one.',
    },
  },
};
