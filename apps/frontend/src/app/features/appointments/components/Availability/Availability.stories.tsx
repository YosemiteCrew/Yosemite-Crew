import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import Availability from './Availability';
import {
  daysOfWeek,
  DEFAULT_INTERVAL,
  type AvailabilityState,
  type DayAvailability,
  type Interval,
  type SetAvailability,
} from './utils';

/**
 * A closed day keeps its hours in state rather than dropping them, which is what
 * `convertFromGetApi` produces and what makes "turn it back on" restore 9-5
 * instead of opening an empty row.
 */
const buildWeek = (open: Record<string, Interval[]>): AvailabilityState =>
  Object.fromEntries(
    daysOfWeek.map((day): [string, DayAvailability] => {
      const intervals = open[day];
      return [
        day,
        intervals
          ? { enabled: true, intervals: intervals.map((iv) => ({ ...iv })) }
          : { enabled: false, intervals: [{ ...DEFAULT_INTERVAL }] },
      ];
    })
  );

const NINE_TO_FIVE: Interval[] = [{ ...DEFAULT_INTERVAL }];

/** Monday to Friday open, weekend closed - the shape `convertFromGetApi` falls back to. */
const WEEKDAYS = buildWeek({
  Monday: NINE_TO_FIVE,
  Tuesday: NINE_TO_FIVE,
  Wednesday: NINE_TO_FIVE,
  Thursday: NINE_TO_FIVE,
  Friday: NINE_TO_FIVE,
});

/** Monday runs three ranges with distinct hours, so a wrong-index delete is visible. */
const SPLIT_MONDAY = buildWeek({
  Monday: [
    { start: '09:00', end: '11:00' },
    { start: '12:00', end: '14:00' },
    { start: '15:00', end: '18:00' },
  ],
  Tuesday: NINE_TO_FIVE,
  Wednesday: NINE_TO_FIVE,
  Thursday: NINE_TO_FIVE,
  Friday: NINE_TO_FIVE,
});

/** Every day identical, so seven rows of equal height can be measured against each other. */
const OPEN_WEEK = buildWeek(
  Object.fromEntries(daysOfWeek.map((day): [string, Interval[]] => [day, NINE_TO_FIVE]))
);

type HarnessProps = {
  /** Seeds the week. Every control in the editor writes back through `setAvailability`. */
  initialAvailability: AvailabilityState;
  twoColumnLayout?: boolean;
  readOnly?: boolean;
  /** Fires with the resolved week after any control writes. */
  onAvailabilityChange: (next: AvailabilityState) => void;
};

/**
 * `Availability` owns no state: the day toggles, the add/remove range controls and
 * both time chips are updaters over one `AvailabilityState` object held by the
 * caller. Without somewhere for those writes to land the component renders once
 * and then ignores every click, so the harness holds the week the way `TeamInfo`
 * does.
 */
const Harness = ({
  initialAvailability,
  twoColumnLayout,
  readOnly,
  onAvailabilityChange,
}: HarnessProps) => {
  const [availability, setAvailability] = useState<AvailabilityState>(initialAvailability);
  // Every handler dispatches an updater function, so the spy needs the current
  // week from outside React's state queue to report what was actually written.
  const latest = useRef(availability);

  const handleSetAvailability: SetAvailability = (update) => {
    const next = typeof update === 'function' ? update(latest.current) : update;
    latest.current = next;
    onAvailabilityChange(next);
    setAvailability(next);
  };

  return (
    <div className="rounded-2xl border border-card-border">
      <Availability
        availability={availability}
        setAvailability={handleSetAvailability}
        twoColumnLayout={twoColumnLayout}
        readOnly={readOnly}
      />
    </div>
  );
};

type Canvas = ReturnType<typeof within>;

/** Every chip label comes out of `getTimeLabelFromValue`, so 09:00 reads "9:00 AM". */
const TIME_CHIP = /^\d{1,2}:\d{2} (AM|PM)$/;

/**
 * A row is a bare grid div with no role or test id. Its toggle is the only
 * addressable thing in it, and the toggle's label is a direct child of the row.
 */
const rowFor = (canvas: Canvas, day: string): HTMLElement => {
  const toggle = canvas.getByRole('checkbox', { name: `Enable availability for ${day}` });
  const row = toggle.closest('label')?.parentElement;
  if (!row) throw new Error(`No row rendered for ${day}`);
  return row;
};

/** Children in source order: toggle, day name, ranges (or "Day off"), actions. */
const partsOf = (row: HTMLElement) => ({
  name: row.children[1] as HTMLElement,
  body: row.children[2] as HTMLElement,
  actions: row.children[3] as HTMLElement,
});

/** The pill is `aria-hidden` chrome; the knob is its only child. */
const pillOf = (toggle: HTMLElement) => {
  const track = toggle.closest('label')?.querySelector('span[aria-hidden="true"]');
  if (!track) throw new Error('Day toggle rendered without its pill');
  return { track: track as HTMLElement, knob: track.firstElementChild as HTMLElement };
};

const meta = {
  title: 'Appointments/Availability/Availability',
  component: Harness,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The weekly availability editor: seven rows of `toggle | day | ranges | actions` inside ' +
          "one card, separated by hairline rules. It is used for a team member's hours in " +
          '`TeamInfo` and for the onboarding availability step.\n\n' +
          'Nothing here is stateful. Every control is an updater over a single ' +
          '`AvailabilityState` object owned by the caller, so the stories hold that object in a ' +
          'harness - a story that passed a static `availability` and a no-op setter would render ' +
          'correctly and then swallow every click, which is exactly the failure worth catching.\n\n' +
          'Three behaviours are only reachable through interaction. The first range of a day has ' +
          'no remove control, because `deleteInterval` refuses index 0 and would otherwise leave ' +
          'a button that does nothing. A closed day keeps its hours in state rather than clearing ' +
          'them, so toggling it back on restores the hours it had. And `readOnly` removes the ' +
          'add, copy and remove controls entirely rather than dimming them, leaving the hours ' +
          'readable but untouchable.\n\n' +
          'The row is a viewport-driven reflow, not a container query. Four columns need about ' +
          '500px (40 + 96 + two 100px time chips + two 28px circles plus gaps), which ran the ' +
          'Add and Copy circles off a 390px screen. Below `sm` the ranges drop to a second line ' +
          'and the actions stay beside the day name. See the Phone story for the caveat about ' +
          'asserting that from a directly loaded preview iframe.\n\n' +
          'The day toggle is drawn wrong in every story below, and drawing it is how that was ' +
          'found: the off-state knob renders outside its own track. The Weekday hours story has ' +
          'the measurements and the cause.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    initialAvailability: WEEKDAYS,
    onAvailabilityChange: fn(),
  },
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Weekday hours',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggles = daysOfWeek.map((day) =>
      canvas.getByRole('checkbox', { name: `Enable availability for ${day}` })
    );
    // The pill is decorative and `aria-hidden`, so this native checkbox is the
    // only place a day's on/off state is announced.
    await expect(toggles.filter((t) => (t as HTMLInputElement).checked)).toHaveLength(5);
    await expect(canvas.getAllByText('Day off')).toHaveLength(2);
    // Actions exist only on open days - a closed row must not offer to add a
    // range to a day that is not being worked.
    await expect(canvas.getAllByRole('button', { name: /^Add range for / })).toHaveLength(5);
    await expect(canvas.getAllByRole('button', { name: 'dublicate-button' })).toHaveLength(5);

    // The knob is positioned against the label, so its 3px -> 17px travel is the
    // one part of the pill the global checkbox rule cannot reach (see the
    // component description). Height is likewise honoured; width is NOT, and is
    // deliberately not asserted here - see below.
    const on = pillOf(toggles[daysOfWeek.indexOf('Monday')]);
    const off = pillOf(toggles[daysOfWeek.indexOf('Sunday')]);
    await expect(Math.round(on.track.getBoundingClientRect().height)).toBe(22);
    const travel =
      on.knob.getBoundingClientRect().left -
      on.track.getBoundingClientRect().left -
      (off.knob.getBoundingClientRect().left - off.track.getBoundingClientRect().left);
    await expect(Math.round(travel)).toBe(14);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The default week the API falls back to when a member has never saved hours: Monday to ' +
          'Friday open 9-5, the weekend closed.\n\n' +
          'Look closely at the weekend toggles. The knob renders **outside** its track, as a loose ' +
          'dot to the left of the pill. Measured at 1280px: the track is 25.53px wide rather than ' +
          "the 36px `w-9` asks for, and the off knob's left edge lands 11.47px to the left of the " +
          "track's left edge, so only about 4.5px of a 16px knob overlaps the pill at all. The on " +
          'knob is inside, but sits 2.53px from the left edge instead of hard right, which leaves ' +
          'the two states reading almost the same.\n\n' +
          "Cause: `globals.css` styles `input[type='checkbox']` unlayered, with " +
          '`position: relative; width: 20px; height: 20px` and a border. Unlayered CSS beats every ' +
          "Tailwind utility regardless of specificity, so the input's `absolute size-full " +
          'opacity-0` loses on `position` and `width`. The "visually hidden" input therefore stays ' +
          'in the flex flow as a real 20px box, shrinks to 14.47px, and squeezes the track into ' +
          'the 25.53px left over in the 40px column. The knob is absolute against the label rather ' +
          'than the track, so it stays where the design put it while the track moves out from ' +
          'under it. Not fixed here - stories do not touch component source.',
      },
    },
  },
};

export const ToggleADay: Story = {
  name: 'Toggling a day on and off',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('checkbox', { name: 'Enable availability for Sunday' }));
    const sunday = rowFor(canvas, 'Sunday');
    // Closed days retain their intervals, so opening one brings back 9-5 rather
    // than an empty row with no way to pick a time.
    await expect(within(sunday).getAllByRole('button', { name: TIME_CHIP })).toHaveLength(2);
    await expect(
      within(sunday).getByRole('button', { name: 'Add range for Sunday' })
    ).toBeInTheDocument();

    await userEvent.click(canvas.getByRole('checkbox', { name: 'Enable availability for Friday' }));
    const friday = rowFor(canvas, 'Friday');
    await expect(within(friday).getByText('Day off')).toBeInTheDocument();
    // Closing a day withdraws its chips AND its actions: no control in the row
    // should still be able to write to a day that is off.
    await expect(within(friday).queryAllByRole('button')).toHaveLength(0);

    await expect(args.onAvailabilityChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        Sunday: { enabled: true, intervals: [{ start: '09:00', end: '17:00' }] },
        Friday: { enabled: false, intervals: [{ start: '09:00', end: '17:00' }] },
      })
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Both directions in one pass. The write is a functional update over the whole week, so ' +
          'the assertion checks that the two days that changed are the only two that changed and ' +
          'that a closed Friday still carries the hours it will get back.',
      },
    },
  },
};

export const MultipleRanges: Story = {
  name: 'A day with three ranges',
  args: { initialAvailability: SPLIT_MONDAY },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const monday = rowFor(canvas, 'Monday');
    await expect(within(monday).getAllByRole('button', { name: TIME_CHIP })).toHaveLength(6);

    // Range 1 has no remove control at all: `deleteInterval` returns `prev`
    // unchanged for index 0, so a button there would be visibly dead.
    const removers = within(monday).getAllByRole('button', { name: /^Remove range / });
    await expect(removers.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Remove range 2 for Monday',
      'Remove range 3 for Monday',
    ]);

    await userEvent.click(removers[0]);
    // The middle range and only the middle range. An off-by-one in the index
    // filter would drop the last one and still leave a plausible-looking row.
    const remaining = within(monday)
      .getAllByRole('button', { name: TIME_CHIP })
      .map((chip) => chip.textContent);
    await expect(remaining).toEqual(['9:00 AM', '11:00 AM', '3:00 PM', '6:00 PM']);
    await expect(within(monday).getAllByRole('button', { name: /^Remove range / })).toHaveLength(1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'A split shift. The remove controls are numbered from the range they act on, so their ' +
          'labels renumber as ranges go - after this delete the surviving second range is ' +
          '"Remove range 2", not "Remove range 3".',
      },
    },
  },
};

export const AddRange: Story = {
  name: 'Adding a range',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const monday = rowFor(canvas, 'Monday');
    await userEvent.click(within(monday).getByRole('button', { name: 'Add range for Monday' }));

    // The new range is a copy of DEFAULT_INTERVAL, so the row shows 9-5 twice
    // over until it is edited.
    const chips = within(monday)
      .getAllByRole('button', { name: TIME_CHIP })
      .map((chip) => chip.textContent);
    await expect(chips).toEqual(['9:00 AM', '5:00 PM', '9:00 AM', '5:00 PM']);
    await expect(within(monday).getAllByRole('button', { name: /^Remove range / })).toHaveLength(1);

    await expect(args.onAvailabilityChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        Monday: {
          enabled: true,
          intervals: [
            { start: '09:00', end: '17:00' },
            { start: '09:00', end: '17:00' },
          ],
        },
      })
    );
    // Only the row that was clicked grew. Each row closes over its own day name,
    // and seven identical Add buttons sit one above the other.
    await expect(
      within(rowFor(canvas, 'Tuesday')).getAllByRole('button', { name: TIME_CHIP })
    ).toHaveLength(2);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Add appends a fresh `DEFAULT_INTERVAL`, which duplicates the range already there when ' +
          'the day is still on its defaults. The two chip pairs are identical until one is ' +
          'edited, and only the second pair can be removed.',
      },
    },
  },
};

export const ReadOnly: Story = {
  name: 'Read only',
  args: { initialAvailability: SPLIT_MONDAY, readOnly: true },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const toggles = daysOfWeek.map((day) =>
      canvas.getByRole('checkbox', { name: `Enable availability for ${day}` })
    );
    await expect(toggles.every((t) => (t as HTMLInputElement).disabled)).toBe(true);

    // Not dimmed - gone. Nothing that writes is rendered, including on the day
    // with three ranges where the remove controls would otherwise sit.
    await expect(canvas.queryAllByRole('button', { name: /^Add range for / })).toHaveLength(0);
    await expect(canvas.queryAllByRole('button', { name: 'dublicate-button' })).toHaveLength(0);
    await expect(canvas.queryAllByRole('button', { name: /^Remove range / })).toHaveLength(0);

    // The hours themselves stay on screen: a viewer without edit permission
    // still needs to read when the member works.
    const chips = within(rowFor(canvas, 'Monday')).getAllByRole('button', { name: TIME_CHIP });
    await expect(chips).toHaveLength(6);
    await expect(chips.every((chip) => (chip as HTMLButtonElement).disabled)).toBe(true);

    await userEvent.click(toggles[daysOfWeek.indexOf('Monday')], { pointerEventsCheck: 0 });
    await expect(args.onAvailabilityChange).not.toHaveBeenCalled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'What a member without `canEditAvailability` sees in `TeamInfo`. The toggle keeps its ' +
          'colour, so the week still reads at a glance; only the controls that write are ' +
          'withdrawn.',
      },
    },
  },
};

export const TwoColumnLayout: Story = {
  name: 'Two column layout',
  args: { initialAvailability: OPEN_WEEK, twoColumnLayout: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const boxes = daysOfWeek.map((day) => rowFor(canvas, day).getBoundingClientRect());

    // `columns-1 md:columns-2`, so below 768px this collapses back to one column.
    const twoUp = globalThis.window.matchMedia('(min-width: 768px)').matches;
    await expect(new Set(boxes.map((box) => Math.round(box.left))).size).toBe(twoUp ? 2 : 1);

    // Seven identical rows must measure identically. CSS multi-column will split
    // a row across the column break unless `break-inside-avoid` holds, and a
    // fragmented row renders as two short boxes rather than failing loudly.
    await expect(new Set(boxes.map((box) => Math.round(box.height))).size).toBe(1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The optional CSS multi-column arrangement, currently unused by any call site in the ' +
          'app. Rows are balanced across two columns from 768px up and stacked below it.',
      },
    },
  },
};

export const Phone: Story = {
  name: 'Phone: the ranges drop to a second line',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const monday = partsOf(rowFor(canvas, 'Monday'));
    const nameBox = monday.name.getBoundingClientRect();

    // The reflow is a viewport media query (`sm:` is 640px), and the viewport
    // global is applied by the Storybook manager resizing the preview iframe.
    // A directly loaded `iframe.html` has no manager, so it renders the wide
    // branch at the panel width - assert whichever branch is actually on screen
    // rather than the one the story is pinned to.
    if (globalThis.window.matchMedia('(min-width: 640px)').matches) {
      await expect(monday.body.getBoundingClientRect().top).toBeLessThan(nameBox.bottom);
    } else {
      // Ranges under the day name, actions still beside it. The Add and Copy
      // circles are the only way to add a range or copy a day, so pushing them
      // off a 390px screen made the row unusable rather than merely clipped.
      await expect(monday.body.getBoundingClientRect().top).toBeGreaterThanOrEqual(nameBox.bottom);
      await expect(monday.actions.getBoundingClientRect().top).toBeLessThan(nameBox.bottom);
    }

    // A closed day has no ranges and no actions, so it never takes the second
    // line: "Day off" sits on the first one at every width.
    const sunday = partsOf(rowFor(canvas, 'Sunday'));
    await expect(sunday.body.getBoundingClientRect().top).toBeLessThan(
      sunday.name.getBoundingClientRect().bottom
    );

    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'At 375px the row becomes three columns and the ranges move to a line of their own ' +
          'spanning columns 2 and 3, while the toggle, the day name and the two action circles ' +
          'stay on the first line.',
      },
    },
  },
};
