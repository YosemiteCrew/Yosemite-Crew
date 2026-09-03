import type { Meta, StoryObj } from '@storybook/react';
import { expect, fireEvent, fn, waitFor, within } from 'storybook/test';

import type { DropAvailabilityInterval } from '@/app/features/appointments/components/Calendar/availabilityIntervals';
import type { Task } from '@/app/features/tasks/types/task';
import { setPreferredTimeZone } from '@/app/lib/timezone';
import WeekCalendar from './WeekCalendar';

const ORG_ID = 'org-storybook';
const ZOOM_IN_HOUR_PX = 180;
const ZOOM_OUT_HOUR_PX = 34;
const DAYS_IN_WEEK = 7;

/** Monday 13 July 2026 through Sunday the 19th. Local parts, never a UTC literal. */
const at = (day: number, hour: number, minute: number) => new Date(2026, 6, day, hour, minute);
const WEEK_START = at(13, 0, 0);

const TIMEZONE_STORAGE_KEY = 'yc_preferred_timezone';

/**
 * Pin the calendar's preferred zone to the zone this browser is already in.
 *
 * `getWeekDays` builds the seven columns from LOCAL midnights, and every task is
 * then matched to a column with `isOnPreferredTimeZoneCalendarDay`, which reads a
 * token out of localStorage and falls back to Europe/Berlin. Leave those two zones
 * free to disagree and the whole week slides by a column on a runner far enough
 * east or west: a Monday task lands on Sunday, and nothing about the failure says
 * timezone. Pinning the preferred zone to the device zone makes the local
 * constructors above mean exactly what they read as. The previous token is
 * restored on unmount because the key is shared with every other story here.
 */
const withDeviceTimeZone = () => {
  const previous = globalThis.localStorage.getItem(TIMEZONE_STORAGE_KEY);
  setPreferredTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  return () => {
    if (previous === null) globalThis.localStorage.removeItem(TIMEZONE_STORAGE_KEY);
    else globalThis.localStorage.setItem(TIMEZONE_STORAGE_KEY, previous);
  };
};

const DISPLAY_NAMES: Record<string, string> = {
  'practitioner-elena': 'Dr. Elena Weber',
  'practitioner-ravi': 'Dr. Ravi Patel',
};

const task = (id: string, name: string, dueAt: Date, overrides: Partial<Task> = {}): Task => ({
  _id: id,
  organisationId: ORG_ID,
  assignedTo: 'practitioner-elena',
  assignedBy: 'practitioner-ravi',
  audience: 'EMPLOYEE_TASK',
  source: 'CUSTOM',
  category: 'MEDICATION',
  status: 'PENDING',
  name,
  dueAt,
  ...overrides,
});

const MONDAY_TASK = 'Bruno · fluids rate check';
const WEDNESDAY_TASK = 'Juno · post-op meds';
const FRIDAY_TASK = 'Ward round · kennels';
const SUNDAY_TASK = 'Nala · suture check';

const TASKS: Task[] = [
  task('task-mon', MONDAY_TASK, at(13, 9, 20)),
  task('task-wed', WEDNESDAY_TASK, at(15, 11, 30)),
  task('task-fri', FRIDAY_TASK, at(17, 16, 5)),
  /* Sunday matters on its own. The strip used to carry two 64px arrow rails, which
     left room for six columns of the seven `getWeekDays` returns, so the last day of
     the week was pushed off the visible grid. A fixture on Sunday is the only thing
     that fails if that ever comes back. */
  task('task-sun', SUNDAY_TASK, at(19, 8, 0)),
  /* Eight days after the Monday, so same weekday, same hour, next week. The grid is
     handed whatever the page fetched for the range and has to drop it. */
  task('task-next-week', 'Milo · cast check', at(21, 9, 20)),
];

const startOfThisWeek = () => {
  const day = new Date();
  day.setHours(0, 0, 0, 0);
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  return day;
};

const NO_INTERVALS: DropAvailabilityInterval[] = [];
/** 09:00-10:00, as minutes-of-day, so the bands sit in the same rows in every zone. */
const WEDNESDAY_MORNING: DropAvailabilityInterval[] = [{ startMinute: 9 * 60, endMinute: 10 * 60 }];

/** Every hour-and-day cell, hour by hour, seven cells at a time. */
const dayHourSlots = (canvasElement: HTMLElement): HTMLElement[] => [
  ...canvasElement.querySelectorAll<HTMLElement>('section[aria-label^="Tasks slot"]'),
];

/** The cell at one column of one hour row. The grid nests days inside hours. */
const cellAt = (canvasElement: HTMLElement, hour: number, dayIndex: number): HTMLElement =>
  dayHourSlots(canvasElement)[hour * DAYS_IN_WEEK + dayIndex];

/** The grid that lays the seven day columns out inside one hour row. */
const dayGrid = (canvasElement: HTMLElement): HTMLElement =>
  dayHourSlots(canvasElement)[0].parentElement?.parentElement as HTMLElement;

/** The 64px time gutter of the hour row a cell belongs to. */
const hourGutter = (cell: HTMLElement): HTMLElement => {
  const row = ((cell.parentElement as HTMLElement).parentElement as HTMLElement)
    .parentElement as HTMLElement;
  return row.firstElementChild as HTMLElement;
};

/** The seven columns of the date strip above the grid. */
const dayLabelCells = (canvasElement: HTMLElement): HTMLElement[] =>
  [...(canvasElement.querySelector('.yc-table-head')?.children ?? [])] as HTMLElement[];

const chips = (root: ParentNode): HTMLElement[] => [
  ...root.querySelectorAll<HTMLElement>('button[aria-haspopup="dialog"]'),
];

const bands = (root: ParentNode): HTMLElement[] => [
  ...root.querySelectorAll<HTMLElement>('[class*="calendar-availability-overlay"]'),
];

/**
 * The grid scrolls itself to the first task of the week on mount, with
 * `behavior: 'smooth'` unless the browser asks for reduced motion. Measuring on the
 * next tick reads a position mid-flight, and any scroll event closes an open
 * popover, so wait for both scrollers to stop first.
 */
const settleAutoScroll = async (canvasElement: HTMLElement) => {
  const scrollers = [
    ...canvasElement.querySelectorAll<HTMLElement>('[data-calendar-scroll="true"]'),
  ];
  let previous: number[] = scrollers.map(() => Number.NaN);
  await waitFor(
    () => {
      const current = scrollers.map((element) => element.scrollTop);
      const settled = current.every((value, index) => value === previous[index]);
      previous = current;
      expect(settled).toBe(true);
    },
    { timeout: 8000, interval: 100 }
  );
};

/** The vertical scroller. The first `data-calendar-scroll` node is the horizontal one. */
const verticalScroller = (canvasElement: HTMLElement): HTMLElement =>
  [...canvasElement.querySelectorAll<HTMLElement>('[data-calendar-scroll="true"]')].at(
    -1
  ) as HTMLElement;

const openTaskPopover = async (chip: HTMLElement): Promise<HTMLElement> => {
  const box = chip.getBoundingClientRect();
  /* `mouseOver`, not `mouseEnter`. TaskMarker uses React's `onMouseEnter`, which
     React synthesizes from the native `mouseout`/`mouseover` pair it delegates at
     the root - native `mouseenter` is not one of its dependencies and does not
     bubble, so it opened nothing. In jsdom the equivalent Jest test passes, so this
     only ever failed in a real browser, which is where stories run. The popover is
     positioned from the coordinates on the event and they carry through unchanged:
     React builds the synthetic enter event from this `mouseover`. */
  fireEvent.mouseOver(chip, {
    clientX: box.left + box.width / 2,
    clientY: box.top + box.height / 2,
  });
  return waitFor(() => {
    const dialog = globalThis.document.querySelector<HTMLElement>(
      'dialog[data-popover-panel="true"]'
    );
    expect(dialog).not.toBeNull();
    return dialog as HTMLElement;
  });
};

const meta = {
  title: 'Appointments/Calendar/TaskWeekCalendar',
  component: WeekCalendar,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The seven-day tasks grid: its own date strip, a 24-hour rail shared across all seven ' +
          'columns, and a `TaskSlot` in every one of the 168 cells. `TaskSlot` and `DayLabels` ' +
          'each have a story; the week LAYOUT that assembles them did not, which is where its ' +
          'defects lived - the strip used to reserve two 64px arrow rails, leaving room for six of ' +
          'the seven days `getWeekDays` returns, so Sunday was simply off the grid.\n\n' +
          'Placement runs through two different clocks and they have to agree. The columns are ' +
          'built from LOCAL midnights by `getWeekDays`, while a task is matched to a column by ' +
          "comparing calendar dates in the PRACTICE's preferred zone. For a clinic whose zone " +
          "differs from the browser's, those two disagree and the whole week can slide by a " +
          'column. Every story here pins the two together, which is a fixture decision, not a fix.\n\n' +
          'One prop is inert: `date` is threaded down to `DayLabels` as `currentDate`, but ' +
          '`CalendarWeekDayCell` decides which column is today from the live clock, so passing a ' +
          'different `date` changes nothing on screen. Paging moved to the header toolbar, so ' +
          'unlike the day grid this one has no navigation of its own.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    events: TASKS,
    weekStart: WEEK_START,
    date: WEEK_START,
    zoomMode: 'in',
    canEditTasks: true,
    slotStepMinutes: 15,
    draggedTaskDurationMinutes: 30,
    handleViewTask: fn(),
    handleChangeStatusTask: fn(),
    handleRescheduleTask: fn(),
    onCreateTaskAt: fn(),
    onTaskDropAt: fn(),
    onTaskDragStart: fn(),
    onTaskDragEnd: fn(),
    onDragHoverTarget: fn(),
    canDragTask: () => true,
    resolveDisplayName: (memberId?: string) => DISPLAY_NAMES[memberId ?? ''] ?? '-',
  },
  decorators: [
    (Story) => (
      <div className="h-[720px] w-full max-w-[900px] bg-[var(--screen)]">
        <Story />
      </div>
    ),
  ],
  beforeEach: withDeviceTimeZone,
} satisfies Meta<typeof WeekCalendar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'A week of tasks',
  play: async ({ canvasElement }) => {
    await settleAutoScroll(canvasElement);

    // Seven columns times a full 24-hour rail. Both halves matter: seven declared
    // tracks with a column missing still reads as seven tracks.
    await expect(dayHourSlots(canvasElement)).toHaveLength(24 * DAYS_IN_WEEK);
    const grid = dayGrid(canvasElement);
    await expect(getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/)).toHaveLength(7);
    await expect(grid.children).toHaveLength(7);

    // Four chips, not five: the fifth fixture is the same weekday and hour one week
    // on, so a filter that matched the weekday alone would draw it on the Monday.
    await expect(chips(canvasElement)).toHaveLength(4);
    await expect(within(cellAt(canvasElement, 9, 0)).getByText(MONDAY_TASK)).toBeInTheDocument();
    await expect(
      within(cellAt(canvasElement, 11, 2)).getByText(WEDNESDAY_TASK)
    ).toBeInTheDocument();
    await expect(within(cellAt(canvasElement, 16, 4)).getByText(FRIDAY_TASK)).toBeInTheDocument();
    // Sunday is the last column and is genuinely on the grid, not clipped off it.
    await expect(within(cellAt(canvasElement, 8, 6)).getByText(SUNDAY_TASK)).toBeInTheDocument();

    /* The chip sits at its due minute inside its hour: 11:30 is halfway down a 180px
       row. The week grid gives each cell the same rail as the day grid, so a chip
       must not snap to the top of the hour here either. */
    const wednesdayChip = within(cellAt(canvasElement, 11, 2))
      .getByText(WEDNESDAY_TASK)
      .closest('button') as HTMLElement;
    const offsetInHour =
      (wednesdayChip.parentElement as HTMLElement).getBoundingClientRect().top -
      cellAt(canvasElement, 11, 2).getBoundingClientRect().top;
    await expect(offsetInHour).toBeCloseTo(90, 0);

    // The strip carries the seven dates of the week in order, 13 to 19.
    const labels = dayLabelCells(canvasElement);
    await expect(labels).toHaveLength(7);
    await expect(labels.map((cell) => cell.textContent?.slice(-2))).toEqual([
      '13',
      '14',
      '15',
      '16',
      '17',
      '18',
      '19',
    ]);
    /* This week is not the current one, so no column is washed. The wash is the only
       signal "today" has, so its absence here is what makes it legible in the
       ThisWeek story. */
    await expect(
      labels.filter((cell) => getComputedStyle(cell).backgroundColor !== 'rgba(0, 0, 0, 0)')
    ).toHaveLength(0);

    /* 7 x 170px of columns plus the 64px gutter does not fit an 900px panel, so the
       grid scrolls sideways rather than squeezing, and the gutter is pinned so the
       hour stays readable once it does. */
    const [horizontal] = [
      ...canvasElement.querySelectorAll<HTMLElement>('[data-calendar-scroll="true"]'),
    ];
    await expect(horizontal.scrollWidth).toBeGreaterThan(horizontal.clientWidth);
    [...grid.children].forEach((column) => {
      expect((column as HTMLElement).getBoundingClientRect().width).toBeGreaterThanOrEqual(170);
    });
    const gutter = hourGutter(cellAt(canvasElement, 9, 0));
    await expect(gutter).toHaveTextContent('9:00 AM');
    await expect(gutter).toHaveTextContent('9:15 AM');

    /* The view opens on the first task of the week rather than at midnight. On a
       4320px rail with the earliest task at 09:20 that is the difference between
       landing on the week's work and landing on nine empty hours. */
    await expect(verticalScroller(canvasElement).scrollTop).toBeGreaterThan(0);

    /* Now scroll the week sideways, which is what the assertions above make
       unavoidable at this width, and read the gutter again.

       It declares `sticky left-0` and computes to `position: sticky`, and it still
       travels the full 300px out of view. A sticky box is pinned to its nearest
       SCROLLPORT, and the hour rows sit inside a second one: the vertical container
       sets `overflow-y: auto`, which computes `overflow-x` to auto with it. That
       inner box is `min-w-max`, so it is never itself scrolled sideways - the gutter
       is pinned to a scrollport that is being carried away underneath it. The 64px
       spacer in the header IS a direct child of the scrolled track and does hold its
       place, so the strip stays put while the hour labels slide out from under it.

       Asserted as it behaves rather than as it was meant to. Fixing it moves the
       -300 to 0, which is the right way for this to fail. */
    await expect(getComputedStyle(gutter).position).toBe('sticky');
    const spacer = canvasElement.querySelector('div.sticky.left-0.z-40') as HTMLElement;
    horizontal.scrollLeft = 300;
    await waitFor(() => {
      const left = horizontal.getBoundingClientRect().left;
      expect(Math.round(gutter.getBoundingClientRect().left - left)).toBe(-300);
      expect(Math.round(spacer.getBoundingClientRect().left - left)).toBe(0);
    });
  },
  parameters: {
    docs: {
      description: {
        story:
          'A fixed week with four tasks spread across it, one of them on the Sunday. The fifth ' +
          'fixture is the same weekday and hour one week later and is deliberately not drawn.\n\n' +
          'Seven 170px columns and a 64px gutter do not fit a 900px panel, so this is also where ' +
          'the sideways scroll is read - and where the time gutter is found not to survive it. It ' +
          'declares `sticky left-0`, but the hour rows live inside a second scroll container ' +
          '(`overflow-y: auto` computes `overflow-x` to auto with it) which is `min-w-max` and so ' +
          'never scrolls itself. The gutter is therefore pinned to a scrollport that is being ' +
          'carried sideways underneath it, and scrolls out of view along with the days, while the ' +
          "header's 64px spacer stays put and covers the gap. Scroll to Friday and there is no " +
          'longer anything on screen saying which hour a row is.',
      },
    },
  },
};

export const EmptyWeek: Story = {
  name: 'A week with nothing scheduled',
  args: { events: [] },
  play: async ({ args, canvasElement }) => {
    await settleAutoScroll(canvasElement);

    // The rail does not collapse: 168 cells and a full week of dates.
    await expect(dayHourSlots(canvasElement)).toHaveLength(24 * DAYS_IN_WEEK);
    await expect(chips(canvasElement)).toHaveLength(0);
    await expect(dayLabelCells(canvasElement)).toHaveLength(7);

    /* Every cell is a create target, and the callback has to name both the column
       and the minute: a quarter down the 11:00 row of the Thursday is the 16th at
       675 minutes past midnight. The day is passed as the cell's own date, so a grid
       that handed back `weekStart` instead would put every new task on the Monday. */
    const thursday11 = cellAt(canvasElement, 11, 3);
    const create = within(thursday11).getByRole('button', { name: /^Create task on / });
    const box = thursday11.getBoundingClientRect();
    fireEvent.click(create, {
      clientX: box.left + box.width / 2,
      clientY: box.top + box.height / 4,
    });
    await expect(args.onCreateTaskAt).toHaveBeenCalledTimes(1);
    const [createdDate, createdMinute, createdAssignee] = args.onCreateTaskAt.mock.calls[0];
    await expect(createdDate.getTime()).toBe(at(16, 0, 0).getTime());
    await expect(createdMinute).toBe(675);
    // A week grid has no assignee column, so the third argument stays undefined and
    // the caller falls back to whoever the page has selected.
    await expect(createdAssignee).toBeUndefined();
  },
  parameters: {
    docs: {
      description: {
        story:
          'An empty week is the same grid: 168 cells, the same date strip, and an invisible ' +
          'full-cell create button in every one of them. This is where the create wiring is read, ' +
          'because it is the only thing an empty week offers.',
      },
    },
  },
};

export const ZoomedOut: Story = {
  name: 'Zoomed out (34px hours, 108px columns)',
  args: { zoomMode: 'out' },
  play: async ({ canvasElement }) => {
    await settleAutoScroll(canvasElement);

    await expect(Math.round(cellAt(canvasElement, 9, 0).getBoundingClientRect().height)).toBe(
      ZOOM_OUT_HOUR_PX
    );
    /* The column floor drops from 170px to 108px, which is the whole point of the
       zoom: 7 x 108 plus the gutter is 820px, so the week comes close to fitting a
       laptop panel without sideways scrolling. */
    [...dayGrid(canvasElement).children].forEach((column) => {
      expect((column as HTMLElement).getBoundingClientRect().width).toBeGreaterThanOrEqual(108);
    });

    // A 15-minute step is 8.5px here, under the 14px floor, so the gutter carries the
    // hour alone rather than four labels overprinting each other.
    await expect(hourGutter(cellAt(canvasElement, 9, 0)).textContent).toBe('9:00 AM');

    /* The chip renders no text at this zoom, so the `title` is the only thing naming
       it, and its height is clamped to 12px so it cannot grow into the row below. */
    const monday = canvasElement.querySelector<HTMLElement>(
      `button[title^="${MONDAY_TASK}"]`
    ) as HTMLElement;
    await expect(monday).not.toBeNull();
    await expect(monday.textContent).toBe('');
    await expect(
      Math.round((monday.parentElement as HTMLElement).getBoundingClientRect().height)
    ).toBe(12);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The whole week at 34px an hour. Both floors move at once - the row height and the ' +
          'column width - so this is the only view in which a full week and a full day are on ' +
          'screen together, and it is also where the task chip stops carrying any text.',
      },
    },
  },
};

export const ThisWeek: Story = {
  name: 'The current week (today, and the now line)',
  args: { weekStart: startOfThisWeek(), date: startOfThisWeek(), events: [] },
  play: async ({ canvasElement }) => {
    await settleAutoScroll(canvasElement);
    const todayIndex = (new Date().getDay() + 6) % 7;

    /* Exactly one column is washed, and it is the right one. Counted rather than
       asserted on the today column alone: the strip's previous version put a disc
       behind every date, which left "today" with no signal at all, and a check that
       only looked at today's cell would have passed on it. */
    const washed = dayLabelCells(canvasElement)
      .map((cell, index) => ({ index, background: getComputedStyle(cell).backgroundColor }))
      .filter(({ background }) => background !== 'rgba(0, 0, 0, 0)');
    await expect(washed).toHaveLength(1);
    await expect(washed[0].index).toBe(todayIndex);

    /* The now line is drawn once, into today's column, not across the week. The
       overlay lays out its own seven-column grid on the same track sizes as the
       cells, so the dot has to land inside today's column - a line that spanned the
       row would read as "now" on Sunday as much as on today. */
    const dots = await waitFor(() => {
      // Polled rather than read once: `useCalendarNow` re-renders the grid on the
      // minute, so the line can be committed a tick after the play function starts.
      const found = [...canvasElement.querySelectorAll<HTMLElement>('[class*="size-[7px]"]')];
      expect(found).toHaveLength(1);
      return found;
    });
    const dotBox = dots[0].getBoundingClientRect();
    const todayColumn = (
      dayGrid(canvasElement).children[todayIndex] as HTMLElement
    ).getBoundingClientRect();
    await expect(dotBox.left).toBeGreaterThanOrEqual(todayColumn.left - 8);
    await expect(dotBox.right).toBeLessThanOrEqual(todayColumn.right);

    /* Vertically it has to agree with the hour rail it is drawn over. Tolerance
       because the clock keeps moving: an hour is 180px, so a minute is 3px and the
       seconds hand alone can account for that between render and measurement. */
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const expected =
      cellAt(canvasElement, 0, 0).getBoundingClientRect().top + (minutes / 60) * ZOOM_IN_HOUR_PX;
    await expect(Math.abs(dotBox.top + dotBox.height / 2 - expected)).toBeLessThan(7);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The week containing today, which is the only state in which either the column wash or ' +
          'the now line exists. Deliberately empty of tasks so nothing competes with the two ' +
          'signals being read.\n\n' +
          'This story reads the live clock rather than freezing it. Freezing would hide the one ' +
          'thing the line has to get right: it is drawn by this file rather than by the shared ' +
          '`NowIndicator` the Team tab renders, so the two are free to disagree about position, ' +
          'colour and dot size, and they do.',
      },
    },
  },
};

export const ReadOnly: Story = {
  name: 'Without edit permission',
  args: { canEditTasks: false },
  play: async ({ canvasElement }) => {
    await settleAutoScroll(canvasElement);

    // Nothing is hidden from a viewer: the week still reads correctly.
    await expect(chips(canvasElement)).toHaveLength(4);

    const chip = within(cellAt(canvasElement, 11, 2))
      .getByText(WEDNESDAY_TASK)
      .closest('button') as HTMLElement;
    const panel = within(await openTaskPopover(chip));

    /* The permission gate lives in the popover footer and nowhere else. View
       survives - which also proves the query would find the other two if they were
       there - while the mutating actions are removed rather than disabled, so a
       viewer is never offered a control that answers with a toast. */
    await expect(panel.getByRole('button', { name: 'View task' })).toBeInTheDocument();
    await expect(panel.queryByRole('button', { name: 'Change task status' })).toBeNull();
    await expect(panel.queryByRole('button', { name: 'Reschedule task' })).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same week for someone without task edit permission. The grid is identical, because ' +
          'this is a gate on the actions rather than on the data, and only the popover footer ' +
          'changes.',
      },
    },
  },
};

export const DragInFlight: Story = {
  name: 'A task in flight (one open day)',
  args: {
    draggedTaskId: 'task-next-week',
    draggedTaskLabel: 'Milo · cast check',
    // Open on the Wednesday only. The provider is keyed on the day it is handed,
    // which is the contract this story exists to hold.
    getDropAvailabilityIntervals: fn((date: Date) =>
      date.getDay() === 3 ? WEDNESDAY_MORNING : NO_INTERVALS
    ),
  },
  play: async ({ args, canvasElement }) => {
    /* No settle here, and none needed: `useCalendarAutoScroll` is passed
       `skip: !!draggedTaskId`, so a grid that scrolled itself out from under a drag
       in progress would show up as a non-zero scrollTop. */
    await expect(verticalScroller(canvasElement).scrollTop).toBe(0);

    /* Called once per day column per hour row, and always with the cell's own date
       and nothing else. Both halves matter: a grid that passed `weekStart` would
       paint all seven columns identically, and one that passed a second argument
       would silently exercise a code path the team grid owns. */
    const calls = args.getDropAvailabilityIntervals.mock.calls;
    await expect(calls.every((call) => call.length === 1)).toBe(true);
    await expect([...new Set(calls.map(([date]) => date.getDate()))].sort((a, b) => a - b)).toEqual(
      [13, 14, 15, 16, 17, 18, 19]
    );

    /* Two bands, both in the Wednesday column. The second is the half hour AFTER the
       window closes, because a 30-minute task may legally start at the last open
       minute - drop the `+ duration` term and the 10:00 row stops accepting a drop
       it should accept. */
    await expect(bands(canvasElement)).toHaveLength(2);
    await expect(bands(cellAt(canvasElement, 9, 2))).toHaveLength(1);
    await expect(bands(cellAt(canvasElement, 10, 2))).toHaveLength(1);
    await expect(
      Math.round(bands(cellAt(canvasElement, 9, 2))[0].getBoundingClientRect().height)
    ).toBe(ZOOM_IN_HOUR_PX);
    await expect(
      Math.round(bands(cellAt(canvasElement, 10, 2))[0].getBoundingClientRect().height)
    ).toBe(ZOOM_IN_HOUR_PX / 2);
    // The same hour on the day either side is closed, and says so by drawing nothing.
    await expect(bands(cellAt(canvasElement, 9, 1))).toHaveLength(0);
    await expect(bands(cellAt(canvasElement, 9, 3))).toHaveLength(0);

    const target = cellAt(canvasElement, 9, 2);
    let box = target.getBoundingClientRect();
    fireEvent.dragOver(target, {
      clientX: box.left + box.width / 2,
      clientY: box.top + box.height / 2,
    });
    /* Re-read the rect: `onDragOver` runs the edge auto-scroll, so the cell may have
       moved between the hover and the drop, and a stale rect would aim the drop at a
       different minute. */
    box = target.getBoundingClientRect();
    fireEvent.drop(target, {
      clientX: box.left + box.width / 2,
      clientY: box.top + box.height / 2,
    });

    await expect(args.onTaskDropAt).toHaveBeenCalledTimes(1);
    const [droppedDate, droppedMinute, droppedAssignee] = args.onTaskDropAt.mock.calls[0];
    // Halfway down the 09:00 row of the Wednesday: the 15th, at 570 minutes past
    // midnight, with no assignee.
    await expect(droppedDate.getTime()).toBe(at(15, 0, 0).getTime());
    await expect(droppedMinute).toBe(570);
    await expect(droppedAssignee).toBeUndefined();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A task picked up elsewhere on the page and dragged over the week, with only the ' +
          'Wednesday open. Two layers appear that have no resting render: the solid bands marking ' +
          'where a drop is allowed and, once the pointer is over a cell, the dashed ghost naming ' +
          'the task in flight.\n\n' +
          'The one-open-day shape is the point. An availability provider is called per column with ' +
          "that column's own date, so a week in which six days are closed has to look like six " +
          'plain columns and one banded one. A grid that passed the week start instead would paint ' +
          'all seven the same and no other story would notice.',
      },
    },
  },
};
