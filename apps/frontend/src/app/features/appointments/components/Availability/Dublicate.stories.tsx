import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import Dublicate from './Dublicate';
import {
  daysOfWeek,
  type AvailabilityState,
  type Interval,
  type SetAvailability,
} from '@/app/features/appointments/components/Availability/utils';

const ONE_INTERVAL: Interval[] = [{ start: '09:00', end: '17:00' }];
const SPLIT_SHIFT: Interval[] = [
  { start: '09:00', end: '13:00' },
  { start: '14:00', end: '18:30' },
];

const describeDay = (day: { enabled: boolean; intervals: Interval[] }): string => {
  if (!day.enabled || day.intervals.length === 0) return 'Closed';
  return day.intervals.map((iv) => `${iv.start}-${iv.end}`).join(', ');
};

const buildAvailability = (sourceDay: string, intervals: Interval[]): AvailabilityState =>
  Object.fromEntries(
    daysOfWeek.map((name) => [
      name,
      name === sourceDay
        ? { enabled: true, intervals }
        : { enabled: false, intervals: [] as Interval[] },
    ])
  );

type HarnessProps = {
  /** The day being copied FROM. Its own row in the panel renders disabled. */
  day: string;
  /** Seed hours for `day`; Apply clones these onto every checked target. */
  intervals: Interval[];
  /** Fires when the popover writes back through `setAvailability`. */
  onApply: () => void;
};

/**
 * Stands in for a single `Availability` row: the copy control plus a readout of
 * the week it writes into. `Dublicate` only takes a `setAvailability` dispatch,
 * so without somewhere for the write to land, Apply would be a no-op with
 * nothing to look at.
 */
const Harness = ({ day, intervals, onApply }: HarnessProps) => {
  const [availability, setAvailability] = useState<AvailabilityState>(() =>
    buildAvailability(day, intervals)
  );

  const handleSetAvailability: SetAvailability = (update) => {
    setAvailability((prev) => (typeof update === 'function' ? update(prev) : update));
    onApply();
  };

  return (
    <div className="flex min-h-[420px] flex-col gap-4 p-6">
      <div className="flex items-center gap-3">
        <span className="text-[13px] font-semibold text-[var(--ink)]">{day}</span>
        <span className="text-[13px] text-[var(--ink-muted)]">
          {describeDay(availability[day])}
        </span>
        <Dublicate setAvailability={handleSetAvailability} day={day} />
      </div>

      <ul className="flex w-[260px] flex-col gap-1 rounded-2xl border border-card-border p-3">
        {daysOfWeek.map((name) => (
          <li key={name} className="text-[12.5px] text-[var(--ink-body)]">
            {`${name}: ${describeDay(availability[name])}`}
          </li>
        ))}
      </ul>
    </div>
  );
};

/** Opens the popover and hands back the canvas it lives in (it is not portalled). */
const openPanel = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole('button', { name: 'dublicate-button' }));
  return canvas;
};

const meta = {
  title: 'Appointments/Availability/Dublicate',
  component: Harness,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The "Copy to other days" control on each row of the availability editor: a 28px ' +
          'outlined circle that opens a popover of the seven weekdays plus an Apply row.\n\n' +
          'Everything below the button is behind `open`, a local `useState` with no prop to ' +
          'reveal it, so no snapshot had ever contained the popover - only the circle. That is ' +
          'the same blind spot that let four production bugs ship on this branch, among them a ' +
          'popover whose grid template used a comma (invalid CSS, silently dropped, six children ' +
          'collapsed into one column).\n\n' +
          'The popover is `absolute left-0 top-[120%]`, **not** portalled, so unlike the ' +
          'workspace search panels it is clipped by any scrolling ancestor and paints inside the ' +
          "row's stacking context at `z-10`. Its box is fixed at `w-[120px]` with " +
          '`max-h-[200px] overflow-y-scroll scrollbar-hidden`, and the seven rows are `min-h-11` ' +
          'each - about 308px of content in a 200px box. So the panel always scrolls, the ' +
          'scrollbar is hidden, and the Apply button scrolls **with** the list rather than being ' +
          'pinned to the bottom: at rest it sits below the fold, under Saturday. None of that is ' +
          'visible until the panel is drawn, and at 120px wide the longer day names ("Wednesday") ' +
          'have no `truncate` to fall back on.\n\n' +
          'The source day is rendered as a disabled checkbox at `opacity-60` rather than being ' +
          'omitted, so the list is always seven rows tall and the row you are copying from keeps ' +
          'its position. `copyTargets` is seeded from `day` in a `useState` initialiser, so the ' +
          'disabled row is fixed at mount.\n\n' +
          'Each story opens the panel with a `play` function and counts its checkboxes rather ' +
          'than checking that the trigger toggled - an empty popover is still a rounded, ' +
          'bordered box and would pass the weaker assertion.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    day: 'Monday',
    intervals: ONE_INTERVAL,
    onApply: fn(),
  },
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {
  name: 'Trigger only',
  parameters: {
    docs: {
      description: {
        story:
          'The resting state and the only one previously drawn: a 28px `--hairline` circle with a ' +
          '13px copy glyph in `--ink-faint`, sized to match the sibling add-range control.',
      },
    },
  },
};

export const PanelOpen: Story = {
  name: 'Copy-to-days panel open',
  play: async ({ canvasElement }) => {
    const canvas = await openPanel(canvasElement);
    // Count the rows: the panel mounting is not the same as the panel having content.
    const checkboxes = canvas.getAllByRole('checkbox');
    await expect(checkboxes).toHaveLength(7);
    await expect(canvas.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
    // The source day is present but not selectable.
    await expect(
      canvas.getByRole('checkbox', { name: 'Copy availability to Monday' })
    ).toBeDisabled();
    await expect(
      canvas.getByRole('checkbox', { name: 'Copy availability to Tuesday' })
    ).toBeEnabled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'All seven weekdays in a 120px box that is 108px shorter than its content. Apply is the ' +
          'last child of the same scroll container, so reading this story means scrolling the ' +
          'panel to find it.',
      },
    },
  },
};

export const CopyApplied: Story = {
  name: 'Apply copies the hours',
  play: async ({ canvasElement, args }) => {
    const canvas = await openPanel(canvasElement);
    await userEvent.click(canvas.getByRole('checkbox', { name: 'Copy availability to Tuesday' }));
    await userEvent.click(canvas.getByRole('checkbox', { name: 'Copy availability to Thursday' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Apply' }));

    await expect(args.onApply).toHaveBeenCalled();
    // The panel closes itself on a successful apply.
    await expect(canvas.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
    // The write landed on exactly the checked days, and enabled them.
    await expect(canvas.getByText('Tuesday: 09:00-17:00')).toBeInTheDocument();
    await expect(canvas.getByText('Thursday: 09:00-17:00')).toBeInTheDocument();
    await expect(canvas.getByText('Wednesday: Closed')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Two targets checked and applied. Each target is set `enabled: true` and given a copy ' +
          "of the source day's intervals, then the panel closes and clears its own checkboxes - " +
          'so reopening it starts from nothing selected rather than from the previous run.',
      },
    },
  },
};

export const SplitShift: Story = {
  name: 'Copying a split shift',
  args: { intervals: SPLIT_SHIFT },
  play: async ({ canvasElement }) => {
    const canvas = await openPanel(canvasElement);
    await userEvent.click(canvas.getByRole('checkbox', { name: 'Copy availability to Saturday' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Apply' }));
    await expect(canvas.getByText('Saturday: 09:00-13:00, 14:00-18:30')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A day with two ranges. Both are cloned onto the target, not just the first - the clone ' +
          'is a fresh array of fresh objects, so editing the copy afterwards cannot reach back ' +
          'into the day it came from.',
      },
    },
  },
};

export const ApplyWithNothingChecked: Story = {
  name: 'Apply with nothing checked',
  play: async ({ canvasElement, args }) => {
    const canvas = await openPanel(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Apply' }));
    // Closes, but must not dispatch: a no-op write would flip every day to
    // `enabled: true` with a default interval.
    await expect(canvas.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
    await expect(args.onApply).not.toHaveBeenCalled();
    await expect(canvas.getByText('Tuesday: Closed')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Apply with an empty selection is a dismissal, not a write. Worth a story because the ' +
          'button looks identical either way, and because the disabled source row means "select ' +
          'all" and "select nothing" are only one click apart.',
      },
    },
  },
};
