import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';

import { getStartOfWeek } from '@/app/features/appointments/components/Calendar/weekHelpers';
import { setPreferredTimeZone, TIMEZONE_STORAGE_KEY } from '@/app/lib/timezone';
import TaskWeekNav from './TaskWeekNav';

/** Local calendar date, formatted the way `getStartOfWeek` reasons about dates. */
const isoLocalDate = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;

/**
 * Wednesday 11 March 2026, 09:00 local. Built from the local constructor, never
 * from an ISO string: `getStartOfWeek` walks back with `getDay()`/`setDate()`, so a
 * UTC literal would land on a different weekday depending on the reader's offset
 * and the label would silently move.
 */
const MID_MARCH = new Date(2026, 2, 11, 9, 0);

/** Wednesday 1 April 2026 - its Monday is 30 March, so the week straddles a month. */
const EARLY_APRIL = new Date(2026, 3, 1, 9, 0);

/**
 * The nav owns neither date: it reads `currentDate` and pushes updater functions
 * into two setters that live in the tasks page. Holding both here is what makes
 * the arrows do anything at all, and rendering both values is what proves they
 * move together - a version that updated only `setCurrentDate` would relabel
 * itself correctly while the agenda board underneath stayed on the old week.
 */
const WeekNavHarness = ({ currentDate: initialDate }: React.ComponentProps<typeof TaskWeekNav>) => {
  const [currentDate, setCurrentDate] = useState(initialDate);
  const [weekStart, setWeekStart] = useState(() => getStartOfWeek(initialDate, 1));

  return (
    <div className="flex flex-col items-start gap-3">
      <TaskWeekNav
        currentDate={currentDate}
        setCurrentDate={setCurrentDate}
        setWeekStart={setWeekStart}
      />
      <p className="text-[12px] text-text-tertiary">Current date {isoLocalDate(currentDate)}</p>
      <p className="text-[12px] text-text-tertiary">Week start {isoLocalDate(weekStart)}</p>
    </div>
  );
};

/**
 * Pin the formatting zone to the runner's own zone for the duration of the story.
 *
 * The label is built by formatting Dates that `getStartOfWeek` produced at LOCAL
 * midnight through `formatDateInPreferredTimeZone`, which falls back to
 * Europe/Berlin when nothing is stored. Those two zones agreeing is an accident of
 * where the machine is: run this east of Berlin and local midnight is the previous
 * evening in Berlin, so "9 - 15 Mar" renders as "8 - 14 Mar" and the story fails
 * for a reason that has nothing to do with the component. Storing the runner's own
 * zone makes the two agree everywhere. If the zone is not in the canonical list the
 * setter refuses and the Berlin fallback stands, which is the behaviour every
 * machine west of Berlin already gets.
 */
const withRunnerTimeZone = () => {
  const previous = globalThis.localStorage.getItem(TIMEZONE_STORAGE_KEY);
  setPreferredTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  return () => {
    if (previous === null) globalThis.localStorage.removeItem(TIMEZONE_STORAGE_KEY);
    else globalThis.localStorage.setItem(TIMEZONE_STORAGE_KEY, previous);
  };
};

const meta = {
  title: 'Tasks/TaskWeekNav',
  component: TaskWeekNav,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The week-range control for the tasks planner. It lives in the page title row rather ' +
          "than inside the agenda board - it is threaded into `TitleCalendar`'s " +
          '`actionBeforeAdd` slot - so nothing in the product renders it on its own, and until ' +
          'now nothing rendered it in isolation either.\n\n' +
          'It is smaller than it looks. Two icon-only arrows and one derived string, and the ' +
          'string has **two branches**: a week inside one month prints the month once ' +
          '("9 - 15 Mar"), a week that straddles two prints it twice ("30 Mar - 5 Apr"). The ' +
          'label is always **Monday-aligned** (`getStartOfWeek(currentDate, 1)`) whatever day ' +
          'of the week `currentDate` happens to be, matching the agenda board it describes.\n\n' +
          'It also drives **two** setters, `setCurrentDate` and `setWeekStart`, with the same ' +
          '7-day shift. Only the first one changes what this component renders, so a break in ' +
          'the second is invisible here and shows up as an agenda board a week behind its own ' +
          'label. The stories render both values for that reason.\n\n' +
          'The dates are formatted through `formatDateInPreferredTimeZone`, which reads a stored ' +
          'timezone token and falls back to Europe/Berlin - see `withRunnerTimeZone` in the ' +
          'story source for why that matters for a control whose input is a local-midnight Date.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    currentDate: MID_MARCH,
    // Replaced by the harness's own state; present so the args table is complete.
    setCurrentDate: () => {},
    setWeekStart: () => {},
  },
  beforeEach: withRunnerTimeZone,
  render: (args) => <WeekNavHarness {...args} />,
} satisfies Meta<typeof TaskWeekNav>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'A week inside one month',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* One month name, an en dash between the two day numbers. The dash is U+2013
       from the source string, not a hyphen - a search-and-replace that "tidied" it
       would change the rendered label and nothing else would notice. */
    await expect(canvas.getByText('9 – 15 Mar')).toBeInTheDocument();

    // Monday-aligned from a Wednesday: the input date is the 11th, the week the
    // label describes starts on the 9th.
    await expect(canvas.getByText('Current date 2026-03-11')).toBeInTheDocument();
    await expect(canvas.getByText('Week start 2026-03-09')).toBeInTheDocument();

    /* Both arrows are icon-only, and both icons are `aria-hidden`, so the
       `aria-label` is the ENTIRE accessible name - lose it and the control becomes
       two unnamed buttons for anyone not looking at the screen. */
    const previous = canvas.getByRole('button', { name: 'Previous week' });
    const next = canvas.getByRole('button', { name: 'Next week' });
    for (const arrow of [previous, next]) {
      await expect(arrow.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
      // 30px round targets, the design's compact size. Measured because the pill
      // around them has no intrinsic height of its own.
      const box = arrow.getBoundingClientRect();
      await expect(Math.round(box.width)).toBe(30);
      await expect(Math.round(box.height)).toBe(30);
    }

    // Previous sits before the label and Next after it, which is the only thing
    // distinguishing them for a reader who is looking rather than listening.
    await expect(previous.getBoundingClientRect().left).toBeLessThan(
      next.getBoundingClientRect().left
    );
  },
};

export const AcrossTwoMonths: Story = {
  name: 'A week spanning two months',
  args: { currentDate: EARLY_APRIL },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* The second branch: when the first and last day fall in different months the
       label carries BOTH month names and the leading day gets its own. Getting this
       wrong reads as "30 - 5 Apr", which is not an error anything would throw. */
    await expect(canvas.getByText('30 Mar – 5 Apr')).toBeInTheDocument();

    // The Monday is in the previous month even though `currentDate` is in April.
    await expect(canvas.getByText('Current date 2026-04-01')).toBeInTheDocument();
    await expect(canvas.getByText('Week start 2026-03-30')).toBeInTheDocument();
  },
};

export const PreviousWeek: Story = {
  name: 'After Previous week',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Previous week' }));

    await expect(canvas.getByText('2 – 8 Mar')).toBeInTheDocument();
    /* Both setters take the same -7 days. The label is driven by `currentDate`
       alone, so `weekStart` is asserted separately - it is the value the agenda
       board reads, and a version that forgot it would look right here. */
    await expect(canvas.getByText('Current date 2026-03-04')).toBeInTheDocument();
    await expect(canvas.getByText('Week start 2026-03-02')).toBeInTheDocument();
  },
};

export const NextWeekIntoApril: Story = {
  name: 'Next week, three times, into the cross-month label',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const next = canvas.getByRole('button', { name: 'Next week' });

    await userEvent.click(next);
    await expect(canvas.getByText('16 – 22 Mar')).toBeInTheDocument();
    await expect(canvas.getByText('Week start 2026-03-16')).toBeInTheDocument();

    /* Two more weeks walks the label into the second branch without changing any
       prop - which is the only way a reader ever meets it. It also crosses the EU
       clock change on 29 March: `addDays` moves the calendar day and leaves the
       09:00 local wall time alone, so the shift stays exactly seven days rather
       than 167 or 169 hours. */
    await userEvent.click(next);
    await userEvent.click(next);
    await expect(canvas.getByText('30 Mar – 5 Apr')).toBeInTheDocument();
    await expect(canvas.getByText('Current date 2026-04-01')).toBeInTheDocument();
    await expect(canvas.getByText('Week start 2026-03-30')).toBeInTheDocument();
  },
};
