import type { Meta, StoryObj } from '@storybook/react';
import { expect, fireEvent, fn, waitFor, within } from 'storybook/test';

import type { DropAvailabilityInterval } from '@/app/features/appointments/components/Calendar/availabilityIntervals';
import type { Team } from '@/app/features/organization/types/team';
import type { Task } from '@/app/features/tasks/types/task';
import { setPreferredTimeZone } from '@/app/lib/timezone';
import { useAuthStore } from '@/app/stores/authStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { useTeamStore } from '@/app/stores/teamStore';
import UserCalendar from './UserCalendar';

const ORG_ID = 'org-storybook';
const ZOOM_IN_HOUR_PX = 180;
const ZOOM_OUT_HOUR_PX = 34;

const ELENA = 'practitioner-elena';
const RAVI = 'practitioner-ravi';
const PRIYA = 'practitioner-priya';

/** Tuesday 14 July 2026. Local parts, never a UTC literal. */
const at = (day: number, hour: number, minute: number) => new Date(2026, 6, day, hour, minute);
const DAY = at(14, 0, 0);

const TIMEZONE_STORAGE_KEY = 'yc_preferred_timezone';

/**
 * Pin the calendar's preferred zone to the zone this browser is already in.
 *
 * A task is routed to an hour row by `getHourInPreferredTimeZone` and kept on the
 * day by `isOnPreferredTimeZoneCalendarDay`, both of which read a token out of
 * localStorage and fall back to Europe/Berlin. A fixture written as
 * `'...T09:20:00.000Z'` therefore lands in a different row depending on where the
 * runner is sitting. Pinning the preferred zone to the device zone lets every
 * fixture be built from local parts, which is the one construction that means the
 * same wall-clock time everywhere. The previous token is restored on unmount,
 * because the key is shared with every other story in this Storybook.
 */
const withDeviceTimeZone = () => {
  const previous = globalThis.localStorage.getItem(TIMEZONE_STORAGE_KEY);
  setPreferredTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  return () => {
    if (previous === null) globalThis.localStorage.removeItem(TIMEZONE_STORAGE_KEY);
    else globalThis.localStorage.setItem(TIMEZONE_STORAGE_KEY, previous);
  };
};

const teamMember = (practionerId: string, name: string, todayAppointment: string): Team => ({
  _id: `team-${practionerId}`,
  practionerId,
  organisationId: ORG_ID,
  name,
  role: 'VETERINARIAN',
  speciality: [],
  todayAppointment,
  status: 'Available',
  revokedPermissions: [],
  effectivePermissions: [],
  extraPerissions: [],
});

const ELENA_NAME = 'Dr. Elena Marsh';
const RAVI_NAME = 'Dr. Ravi Patel';
const PRIYA_NAME = 'Priya Raman';

const TEAM: Team[] = [
  teamMember(ELENA, ELENA_NAME, '4'),
  teamMember(RAVI, RAVI_NAME, '2'),
  teamMember(PRIYA, PRIYA_NAME, '0'),
];

/** Eight columns is past the point where the grid stops fitting any panel. */
const BIG_TEAM: Team[] = [
  ...TEAM,
  teamMember('practitioner-mo', 'Mo Achterberg', '3'),
  teamMember('practitioner-lena', 'Lena Fischer', '1'),
  teamMember('practitioner-tom', 'Tom Okafor', '5'),
  teamMember('practitioner-ana', 'Ana Duarte', '2'),
  teamMember('practitioner-sam', 'Sam Vidal', '0'),
];

/**
 * Seed the three singletons this grid reads before it can draw a single column,
 * and put them back afterwards.
 *
 * The auth id is seeded rather than left alone on purpose. `UserLabels` colours a
 * column header when `attributes.sub` matches a member's practitioner id, and
 * other story files in this Storybook write real practitioner ids into the same
 * store - so without an explicit value here, WHICH column reads as "you" would
 * depend on which story you happened to open first.
 */
const withTeam = (team: Team[], currentUserId: string) => () => {
  const orgSnapshot = useOrgStore.getState();
  const teamSnapshot = useTeamStore.getState();
  const authSnapshot = useAuthStore.getState();
  const restoreTimeZone = withDeviceTimeZone();

  useOrgStore.setState({ primaryOrgId: ORG_ID, status: 'loaded' });
  useTeamStore.getState().setTeamsForOrg(ORG_ID, team);
  useAuthStore.setState({ attributes: { sub: currentUserId } });

  return () => {
    restoreTimeZone();
    useOrgStore.setState(orgSnapshot);
    useTeamStore.setState(teamSnapshot);
    useAuthStore.setState(authSnapshot);
  };
};

const DISPLAY_NAMES: Record<string, string> = {
  [ELENA]: ELENA_NAME,
  [RAVI]: RAVI_NAME,
  [PRIYA]: PRIYA_NAME,
};

const task = (id: string, name: string, dueAt: Date, assignedTo: string): Task => ({
  _id: id,
  organisationId: ORG_ID,
  assignedTo,
  assignedBy: ELENA,
  audience: 'EMPLOYEE_TASK',
  source: 'CUSTOM',
  category: 'MEDICATION',
  status: 'PENDING',
  name,
  dueAt,
});

const FLUIDS = 'Bruno · fluids rate check';
const MEDS = 'Juno · post-op meds';
const ROUND = 'Ward round · kennels';
const ORPHAN = 'Milo · cast check';

const TASKS: Task[] = [
  task('task-fluids', FLUIDS, at(14, 9, 20), ELENA),
  /* A FHIR-style reference rather than a bare id. `normalizeId` splits on `/` and
     lower-cases, so this still has to land in Ravi's column - the API returns both
     shapes and a column keyed on string equality would quietly drop half the board. */
  task('task-meds', MEDS, at(14, 11, 30), `Practitioner/${RAVI}`),
  // The team row's own `_id`, a third shape the assignee field arrives in.
  task('task-round', ROUND, at(14, 14, 5), `team-${ELENA}`),
  /* Assigned to somebody who is not on this team. It is dropped rather than parked
     in the first column, which is the branch worth having a fixture for: the grid
     has no "unassigned" column to fall back to. */
  task('task-orphan', ORPHAN, at(14, 10, 0), 'practitioner-nobody'),
];

const NO_INTERVALS: DropAvailabilityInterval[] = [];
/** 09:00-10:00, as minutes-of-day, so the bands sit in the same rows in every zone. */
const RAVI_MORNING: DropAvailabilityInterval[] = [{ startMinute: 9 * 60, endMinute: 10 * 60 }];

/** Every member-hour cell, hour by hour, one cell per column at a time. */
const memberCells = (canvasElement: HTMLElement): HTMLElement[] => [
  ...canvasElement.querySelectorAll<HTMLElement>('section[aria-label^="Tasks slot"]'),
];

const cellAt = (
  canvasElement: HTMLElement,
  hour: number,
  memberIndex: number,
  teamSize: number
): HTMLElement => memberCells(canvasElement)[hour * teamSize + memberIndex];

/** The grid that lays the team columns out inside one hour row. */
const teamGrid = (canvasElement: HTMLElement): HTMLElement =>
  memberCells(canvasElement)[0].parentElement?.parentElement as HTMLElement;

/** The 64px time gutter of the hour row a cell belongs to. */
const hourGutter = (cell: HTMLElement): HTMLElement => {
  const row = ((cell.parentElement as HTMLElement).parentElement as HTMLElement)
    .parentElement as HTMLElement;
  return row.firstElementChild as HTMLElement;
};

const chips = (root: ParentNode): HTMLElement[] => [
  ...root.querySelectorAll<HTMLElement>('button[aria-haspopup="dialog"]'),
];

const bands = (root: ParentNode): HTMLElement[] => [
  ...root.querySelectorAll<HTMLElement>('[class*="calendar-availability-overlay"]'),
];

const scrollers = (canvasElement: HTMLElement): HTMLElement[] => [
  ...canvasElement.querySelectorAll<HTMLElement>('[data-calendar-scroll="true"]'),
];

/**
 * The grid scrolls itself to the first task on mount, with `behavior: 'smooth'`
 * unless the browser asks for reduced motion. Measuring on the next tick reads a
 * position mid-flight, and any scroll event closes an open popover, so wait for
 * both scrollers to stop first.
 */
const settleAutoScroll = async (canvasElement: HTMLElement) => {
  const nodes = scrollers(canvasElement);
  let previous: number[] = nodes.map(() => Number.NaN);
  await waitFor(
    () => {
      const current = nodes.map((element) => element.scrollTop);
      const settled = current.every((value, index) => value === previous[index]);
      previous = current;
      expect(settled).toBe(true);
    },
    { timeout: 8000, interval: 100 }
  );
};

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
  title: 'Appointments/Calendar/TaskUserCalendar',
  component: UserCalendar,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'One day, one column per team member: the Team tab of the tasks planner. It shares ' +
          '`TaskSlot` with the day and week grids and nothing else - the column set comes from the ' +
          'team store, the header band and the sticky gutters are its own, and it is the only task ' +
          'surface with a per-column drop target.\n\n' +
          'The routing is the part worth reading. A task carries `assignedTo` as a free string, ' +
          "and the same person arrives as a bare practitioner id, as the team row's `_id`, or as " +
          'a `Practitioner/...` reference, so each column matches against a SET of normalised ids ' +
          'rather than one. A task whose assignee matches nobody is dropped: there is no ' +
          'unassigned column, so it leaves the board silently.\n\n' +
          'Two differences from the sibling grids show up here and are asserted below rather than ' +
          'fixed. The now line is the shared `NowIndicator`, whose dot is 16px, while the day and ' +
          'week grids draw their own 7px one; and the availability provider is called with two ' +
          'arguments here and one everywhere else, so a provider written for the day grid has to ' +
          'cope with an assignee it never expected.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    events: TASKS,
    date: DAY,
    zoomMode: 'in',
    canEditTasks: true,
    slotStepMinutes: 15,
    draggedTaskDurationMinutes: 30,
    handleViewTask: fn(),
    handleChangeStatusTask: fn(),
    handleRescheduleTask: fn(),
    setCurrentDate: fn(),
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
  // Ravi is "you", so exactly one column header should be tinted.
  beforeEach: withTeam(TEAM, RAVI),
} satisfies Meta<typeof UserCalendar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Three team columns',
  play: async ({ args, canvasElement }) => {
    await settleAutoScroll(canvasElement);
    const canvas = within(canvasElement);

    // Three columns times a full 24-hour rail. Both halves matter: three declared
    // tracks with a column missing still reads as three tracks.
    await expect(memberCells(canvasElement)).toHaveLength(24 * 3);
    const grid = teamGrid(canvasElement);
    await expect(getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/)).toHaveLength(3);
    await expect(grid.children).toHaveLength(3);

    /* Three chips from four fixtures. The fourth is assigned to someone who is not
       on this team and leaves the board entirely, which is the behaviour to be aware
       of rather than the behaviour to admire. */
    await expect(chips(canvasElement)).toHaveLength(3);
    await expect(canvasElement.querySelector(`button[title^="${ORPHAN}"]`)).toBeNull();

    await expect(within(cellAt(canvasElement, 9, 0, 3)).getByText(FLUIDS)).toBeInTheDocument();
    // The `Practitioner/...` reference resolves to Ravi's column, not to nowhere.
    await expect(within(cellAt(canvasElement, 11, 1, 3)).getByText(MEDS)).toBeInTheDocument();
    // Assigned by the team row's `_id`, and still Elena's column.
    await expect(within(cellAt(canvasElement, 14, 0, 3)).getByText(ROUND)).toBeInTheDocument();
    // Priya is rostered and has nothing on: an empty column, not a missing one.
    await expect(chips(cellAt(canvasElement, 9, 2, 3))).toHaveLength(0);

    /* A chip sits at its due minute inside its hour: 11:30 is halfway down a 180px
       row. Each column gets the same rail as the single-day grid. */
    const raviChip = within(cellAt(canvasElement, 11, 1, 3))
      .getByText(MEDS)
      .closest('button') as HTMLElement;
    const offsetInHour =
      (raviChip.parentElement as HTMLElement).getBoundingClientRect().top -
      cellAt(canvasElement, 11, 1, 3).getBoundingClientRect().top;
    await expect(offsetInHour).toBeCloseTo(90, 0);

    /* Exactly one column header reads as "you", and it is the right one. Counted
       rather than checked on Ravi alone: a bug that tinted every name would pass a
       check that only looked at his. */
    const names = [ELENA_NAME, RAVI_NAME, PRIYA_NAME].map(
      (name) => getComputedStyle(canvas.getByText(name)).color
    );
    await expect(names[1]).not.toBe(names[0]);
    await expect(names[2]).toBe(names[0]);

    // The date band reads from the preferred zone, so it agrees with the rows below
    // it rather than with the browser's own clock.
    await expect(canvas.getByText('Tue')).toBeInTheDocument();
    await expect(canvas.getByText('14')).toBeInTheDocument();

    /* The stepper reports a functional update rather than a date, so the assertion
       has to run the updater. Applied to the rendered day it must step one day each
       way - a swapped pair of handlers looks identical until you do this. */
    await fireEvent.click(canvas.getByRole('button', { name: 'Next' }));
    await fireEvent.click(canvas.getByRole('button', { name: 'Previous' }));
    const [[forward], [back]] = args.setCurrentDate.mock.calls as [
      [(previous: Date) => Date],
      [(previous: Date) => Date],
    ];
    await expect(forward(DAY).getDate()).toBe(DAY.getDate() + 1);
    await expect(back(DAY).getDate()).toBe(DAY.getDate() - 1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'A fixed Tuesday with three rostered members. Elena has two tasks that arrived with two ' +
          "different spellings of her id, Ravi's came in as a FHIR reference, and Priya has " +
          'nothing on - an empty column rather than an absent one, which is what makes a quiet ' +
          'day distinguishable from a member who was never rostered.\n\n' +
          'Worth noting while reading the markup: every cell of an hour row carries the SAME ' +
          'accessible name ("Tasks slot for Tuesday, July 14 at 9:00 AM"), because the label is ' +
          'built from the date and hour and nothing else. In this grid that is three identical ' +
          'labels per row, so the assignee a slot belongs to is not announced anywhere.',
      },
    },
  },
};

export const ManyMembers: Story = {
  name: 'Eight columns (the gutter does not stay put)',
  beforeEach: withTeam(BIG_TEAM, RAVI),
  play: async ({ canvasElement }) => {
    await settleAutoScroll(canvasElement);
    const canvas = within(canvasElement);
    const grid = teamGrid(canvasElement);

    await expect(grid.children).toHaveLength(8);
    await expect(memberCells(canvasElement)).toHaveLength(24 * 8);
    /* `getCalendarColumnGridStyle(8, 170)`. The floor is what keeps a name and its
       subline legible, and it is the reason this view scrolls sideways instead of
       squeezing. Measured off the box rather than `getComputedStyle().width`, which
       would report the content box. */
    [...grid.children].forEach((column) => {
      expect((column as HTMLElement).getBoundingClientRect().width).toBeGreaterThanOrEqual(170);
    });

    const [horizontal] = scrollers(canvasElement);
    await expect(horizontal.scrollWidth).toBeGreaterThan(horizontal.clientWidth);

    /* The sticky rails, read at two scroll offsets because a single reading cannot
       tell "pinned" from "has not moved yet".

       Both boxes declare `sticky left-0` and both compute to `position: sticky`, and
       only one of them holds. The date band is a direct child of the scrolled track
       and stays at the left edge. The hour gutter travels the full 400px out of
       view, because a sticky box is pinned to its nearest SCROLLPORT and the hour
       rows sit inside a second one: the vertical container sets `overflow-y: auto`,
       which computes `overflow-x` to auto with it, and that inner box is `min-w-max`
       so it never scrolls sideways itself. The gutter is pinned to a scrollport that
       is being carried away underneath it.

       Asserted as it behaves rather than as it was meant to. Fixing it moves the
       -400 to 0, which is the right way for this to fail. */
    const gutter = hourGutter(cellAt(canvasElement, 9, 0, 8));
    const band = canvas.getByText('Tue').closest('div.sticky') as HTMLElement;
    await expect(getComputedStyle(gutter).position).toBe('sticky');
    await expect(getComputedStyle(band).position).toBe('sticky');
    await expect(
      Math.round(gutter.getBoundingClientRect().left - horizontal.getBoundingClientRect().left)
    ).toBe(0);

    horizontal.scrollLeft = 400;
    await waitFor(() => {
      const left = horizontal.getBoundingClientRect().left;
      expect(Math.round(band.getBoundingClientRect().left - left)).toBe(0);
      expect(Math.round(gutter.getBoundingClientRect().left - left)).toBe(-400);
    });
    // The right-hand rail is the same story: `sticky right-0`, in the same wrong
    // scrollport, so the grid loses both of its edges at once.
    const rightRail = (gutter.parentElement as HTMLElement).lastElementChild as HTMLElement;
    await expect(
      rightRail.getBoundingClientRect().right - horizontal.getBoundingClientRect().right
    ).toBeGreaterThan(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'Eight rostered members, which is past the point where the grid fits any panel: 8 x ' +
          '170px of columns plus the two 64px rails is 1488px. Nothing re-forms for the narrower ' +
          'space - the columns hold their floor and the container scrolls sideways.\n\n' +
          'Which makes this the story where the sticky rails are found not to be sticking. Scroll ' +
          'to the eighth colleague and the date band holds its place, while the time gutter and ' +
          'the right-hand rail both slide out of the panel with the columns, so the hour a row ' +
          'represents stops being on screen exactly when there are enough columns to need it. ' +
          'Both boxes are declared the same way; the difference is which scroll container they ' +
          'are nested in, and the day and week grids share the same shape.',
      },
    },
  },
};

export const ZoomedOut: Story = {
  name: 'Zoomed out (34px hours, 108px columns)',
  args: { zoomMode: 'out' },
  play: async ({ canvasElement }) => {
    await settleAutoScroll(canvasElement);

    await expect(Math.round(cellAt(canvasElement, 9, 0, 3).getBoundingClientRect().height)).toBe(
      ZOOM_OUT_HOUR_PX
    );
    // The column floor drops from 170px to 108px, so three members plus both rails
    // fit a laptop panel without scrolling sideways.
    [...teamGrid(canvasElement).children].forEach((column) => {
      expect((column as HTMLElement).getBoundingClientRect().width).toBeGreaterThanOrEqual(108);
    });

    // A 15-minute step is 8.5px here, under the 14px floor, so the gutter carries the
    // hour alone rather than four labels overprinting each other.
    await expect(hourGutter(cellAt(canvasElement, 9, 0, 3)).textContent).toBe('9:00 AM');

    /* The chip renders no text at this zoom, so the `title` is the only thing naming
       it, and its height is clamped to 12px so it cannot grow into the row below. */
    const fluids = canvasElement.querySelector<HTMLElement>(
      `button[title^="${FLUIDS}"]`
    ) as HTMLElement;
    await expect(fluids).not.toBeNull();
    await expect(fluids.textContent).toBe('');
    await expect(
      Math.round((fluids.parentElement as HTMLElement).getBoundingClientRect().height)
    ).toBe(12);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The whole day at 34px an hour with 108px columns. Both floors move at once, which is ' +
          'what lets a full 24 hours and a small team be on screen together, and it is also where ' +
          'the task chip stops carrying any text.',
      },
    },
  },
};

export const Today: Story = {
  name: 'Today (the now line)',
  args: { date: new Date(), events: [] },
  play: async ({ canvasElement }) => {
    await settleAutoScroll(canvasElement);

    /* The shared `NowIndicator`, whose dot is `size-4` - 16px. The day and week
       grids draw their own line with a 7px dot, so the same page shows the same
       moment three different ways depending on which tab is open.

       Polled rather than read once: `useCalendarNow` re-renders the grid on the
       minute, so the line can be committed a tick after the play function starts. */
    const dots = await waitFor(() => {
      const found = [...canvasElement.querySelectorAll<HTMLElement>('div.size-4.rounded-full')];
      expect(found).toHaveLength(1);
      return found;
    });
    const dotBox = dots[0].getBoundingClientRect();
    await expect(Math.round(dotBox.height)).toBe(16);

    /* Where the line sits, not merely that it exists. The overlay is positioned over
       the same hour rail the cells are laid on, so the line has to land at now's
       minute inside now's hour row. Tolerance because the clock keeps moving: an
       hour is 180px, so a minute is 3px and the seconds hand alone can account for
       that between render and measurement. */
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const expected =
      cellAt(canvasElement, 0, 0, 3).getBoundingClientRect().top + (minutes / 60) * ZOOM_IN_HOUR_PX;
    await expect(Math.abs(dotBox.top + dotBox.height / 2 - expected)).toBeLessThan(7);

    /* One line across the whole team, not one per column: it is a single row in the
       middle track of the header's 64px / columns / 64px grid, so it spans every
       member at once. Right for a day view, and the reason the week grid has to do
       something different. */
    const grid = teamGrid(canvasElement);
    const line = dots[0].parentElement as HTMLElement;
    await expect(line.getBoundingClientRect().width).toBeGreaterThan(
      grid.getBoundingClientRect().width / 2
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same grid on the current date, which is the only state in which the now line is ' +
          'drawn at all. It also changes where the view opens: with a now position the mount-time ' +
          'auto-scroll parks on the line rather than on the first task.\n\n' +
          'This story reads the live clock on purpose. Freezing it would hide the thing worth ' +
          'seeing, which is that this tab renders the shared `NowIndicator` while the day and week ' +
          'tabs of the same page each draw their own.',
      },
    },
  },
};

export const ReadOnly: Story = {
  name: 'Without edit permission',
  args: { canEditTasks: false },
  play: async ({ canvasElement }) => {
    await settleAutoScroll(canvasElement);

    // Nothing is hidden from a viewer: every column still reads correctly.
    await expect(chips(canvasElement)).toHaveLength(3);

    const chip = within(cellAt(canvasElement, 11, 1, 3))
      .getByText(MEDS)
      .closest('button') as HTMLElement;
    const panel = within(await openTaskPopover(chip));

    /* The permission gate lives in the popover footer and nowhere else. View
       survives - which also proves the query would find the other two if they were
       there - while the mutating actions are removed rather than disabled, so a
       viewer is never offered a control that answers with a toast. */
    await expect(panel.getByRole('button', { name: 'View task' })).toBeInTheDocument();
    await expect(panel.queryByRole('button', { name: 'Change task status' })).toBeNull();
    await expect(panel.queryByRole('button', { name: 'Reschedule task' })).toBeNull();

    // The card names both ends of the assignment through the caller's own lookup,
    // rather than printing the raw practitioner ids the task actually carries.
    await expect(panel.getByText(RAVI_NAME)).toBeInTheDocument();
    await expect(panel.getByText(ELENA_NAME)).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same day for someone without task edit permission. The grid is identical, because ' +
          'this is a gate on the actions rather than on the data, and only the popover footer ' +
          'changes.',
      },
    },
  },
};

export const DragInFlight: Story = {
  name: 'A task in flight (one open column)',
  args: {
    draggedTaskId: 'task-orphan',
    draggedTaskLabel: ORPHAN,
    // Open for Ravi only. The provider is keyed on the assignee it is handed, which
    // is the contract this story exists to hold.
    getDropAvailabilityIntervals: fn((_date: Date, assigneeId?: string) =>
      assigneeId === RAVI ? RAVI_MORNING : NO_INTERVALS
    ),
  },
  play: async ({ args, canvasElement }) => {
    await settleAutoScroll(canvasElement);

    /* Called with the day AND the column's assignee. The day and week grids call the
       same prop with one argument, so a provider shared between the three tabs sees
       two different shapes; that asymmetry is only visible with both asserted. */
    const calls = args.getDropAvailabilityIntervals.mock.calls;
    await expect(calls.every((call) => call.length === 2)).toBe(true);
    await expect([...new Set(calls.map(([, assigneeId]) => assigneeId))].sort()).toEqual(
      [ELENA, PRIYA, RAVI].sort()
    );

    /* Two bands, both in Ravi's column. The second is the half hour AFTER his window
       closes, because a 30-minute task may legally start at the last open minute -
       drop the `+ duration` term and the 10:00 row stops accepting a drop it should
       accept. */
    await expect(bands(canvasElement)).toHaveLength(2);
    await expect(bands(cellAt(canvasElement, 9, 1, 3))).toHaveLength(1);
    await expect(bands(cellAt(canvasElement, 10, 1, 3))).toHaveLength(1);
    await expect(
      Math.round(bands(cellAt(canvasElement, 9, 1, 3))[0].getBoundingClientRect().height)
    ).toBe(ZOOM_IN_HOUR_PX);
    await expect(
      Math.round(bands(cellAt(canvasElement, 10, 1, 3))[0].getBoundingClientRect().height)
    ).toBe(ZOOM_IN_HOUR_PX / 2);
    // The same hour in the columns either side is closed and says so by drawing
    // nothing, which is the whole reason the bands are worth per-column geometry.
    await expect(bands(cellAt(canvasElement, 9, 0, 3))).toHaveLength(0);
    await expect(bands(cellAt(canvasElement, 9, 2, 3))).toHaveLength(0);

    const target = cellAt(canvasElement, 9, 1, 3);
    let box = target.getBoundingClientRect();
    fireEvent.dragOver(target, {
      clientX: box.left + box.width / 2,
      clientY: box.top + box.height / 2,
    });
    await expect(args.onDragHoverTarget).toHaveBeenCalledWith(DAY, RAVI);

    /* Re-read the rect: `onDragOver` runs the edge auto-scroll, so the cell may have
       moved between the hover and the drop, and a stale rect would aim the drop at a
       different minute. */
    box = target.getBoundingClientRect();
    fireEvent.drop(target, {
      clientX: box.left + box.width / 2,
      clientY: box.top + box.height / 2,
    });
    // Halfway down the 09:00 row of Ravi's column: 570 minutes past midnight, and
    // the assignee the drop would reassign the task to.
    await expect(args.onTaskDropAt).toHaveBeenCalledWith(DAY, 570, RAVI);

    /* The grid still auto-scrolled itself on mount even though a drag is in flight.
       The week grid passes `skip: !!draggedTaskId` to the same hook and this one does
       not, so the two tabs disagree about whether a mount mid-drag is allowed to move
       the board under the pointer. */
    await expect(scrollers(canvasElement).at(-1)?.scrollTop).toBeGreaterThan(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          "A task in flight over a team whose only open column is Ravi's. The bands and the " +
          'dashed landing ghost have no resting render at all, and this is the only task surface ' +
          'where they are computed per COLUMN, so a closed colleague and an open one sit side by ' +
          'side.\n\n' +
          'The drop reports the assignee as well as the minute, which is what makes a sideways ' +
          'drag a reassignment rather than a reschedule. Nothing in the grid distinguishes the two ' +
          'gestures for the person doing it: the same drop callback fires whether the task landed ' +
          "in its own column or somebody else's.",
      },
    },
  },
};
