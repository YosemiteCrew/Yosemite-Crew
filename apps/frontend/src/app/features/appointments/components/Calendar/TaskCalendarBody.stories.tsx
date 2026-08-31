import type { Meta, StoryObj } from '@storybook/react';
import { expect, fireEvent, fn, within } from 'storybook/test';

import type { Team } from '@/app/features/organization/types/team';
import type { Task } from '@/app/features/tasks/types/task';
import { useAuthStore } from '@/app/stores/authStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { useTeamStore } from '@/app/stores/teamStore';
import type { DropAvailabilityInterval } from './taskCalendarAvailabilityUtils';
import { TaskCalendarBody } from './TaskCalendarBody';

const ORG_ID = 'org-storybook';
const ME = 'vet-weber';
const RAVI = 'vet-patel';
const PRIYA = 'nurse-raman';

/**
 * Instants are UTC in the middle of the working day; the grids read them in the
 * PREFERRED zone (Europe/Berlin, +2 in July), so the Tuesday task sits at 09:00
 * Tue and the Wednesday one at 11:00 Wed on any machine.
 */
const CURRENT_DATE = new Date('2026-07-14T12:00:00.000Z');
const WEEK_START = new Date('2026-07-13T12:00:00.000Z');

const HOURS_IN_DAY = 24;
const DAYS_IN_WEEK = 7;

const teamMember = (practionerId: string, name: string): Team => ({
  _id: `team-${practionerId}`,
  practionerId,
  organisationId: ORG_ID,
  name,
  role: 'VETERINARIAN',
  speciality: [],
  status: 'Available',
  revokedPermissions: [],
  effectivePermissions: [],
  extraPerissions: [],
});

/** Column order is team order, which is what makes "the second column" a fact. */
const TEAM: Team[] = [
  teamMember(ME, 'Dr. Elena Weber'),
  teamMember(RAVI, 'Dr. Ravi Patel'),
  teamMember(PRIYA, 'Priya Raman'),
];

const task = (over: Partial<Task> & Pick<Task, '_id' | 'name' | 'dueAt'>): Task => ({
  organisationId: ORG_ID,
  assignedTo: ME,
  assignedBy: ME,
  audience: 'EMPLOYEE_TASK',
  source: 'CUSTOM',
  category: 'GENERAL',
  status: 'PENDING',
  ...over,
});

/** On the rendered day, so it is in BOTH lists. */
const TUESDAY_TASK = task({
  _id: 't-haematology',
  name: 'Chase the haematology result',
  dueAt: new Date('2026-07-14T07:00:00.000Z'),
});

/**
 * The day after. Deliberately absent from `dayEvents` and present in
 * `filteredList`, because that gap is the only way to prove which list each
 * branch actually hands down - the two props are interchangeable to the eye.
 */
const WEDNESDAY_TASK = task({
  _id: 't-drip-stands',
  name: 'Refill the ward drip stands',
  dueAt: new Date('2026-07-15T09:00:00.000Z'),
});

const DAY_EVENTS: Task[] = [TUESDAY_TASK];
const WEEK_EVENTS: Task[] = [TUESDAY_TASK, WEDNESDAY_TASK];

const MEMBER_NAMES: Record<string, string> = {
  [ME]: 'Dr. Elena Weber',
  [RAVI]: 'Dr. Ravi Patel',
  [PRIYA]: 'Priya Raman',
};

/**
 * A whole bookable day, so `calcNearestAvailableMinute` never swallows a drop.
 * Module-level and stable: the grids call this during render, and a fresh array
 * per call would recompute the overlay geometry on every pass.
 */
const FULL_DAY: DropAvailabilityInterval[] = [{ startMinute: 0, endMinute: 24 * 60 - 30 }];
const fullDayAvailability = (): DropAvailabilityInterval[] => FULL_DAY;

/** Every hour cell on screen, in document order: hour by hour, columns within. */
const taskSlots = (canvasElement: HTMLElement): HTMLElement[] => [
  ...canvasElement.querySelectorAll<HTMLElement>('section[aria-label^="Tasks slot for"]'),
];

/**
 * Drop on the vertical middle of a cell. The minute is read as a ratio of the
 * cell's own box, so the middle of the 03:00 row is 03:30 whatever the grid has
 * been scrolled to - which is why the assertions below can name a minute.
 */
const dropOnMiddleOf = (slot: HTMLElement) => {
  const rect = slot.getBoundingClientRect();
  fireEvent.drop(slot, { clientY: rect.top + rect.height / 2 });
};

const meta = {
  title: 'Appointments/Calendar/TaskCalendarBody',
  component: TaskCalendarBody,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The switch under the tasks planner. It looks like a pass-through and is not: it picks ' +
          'the grid, assembles the props the three grids share, and decides **which event list ' +
          'each one gets**.\n\n' +
          'Three things here can break without anything looking wrong.\n\n' +
          '`day` and `team` are handed `dayEvents`, `week` is handed `filteredList`. Swap them and ' +
          'the day grid would quietly show the whole week filtered to nothing, or the week grid ' +
          'would show one day. The fixtures below make that visible by keeping a task in the week ' +
          'list that is NOT in the day list.\n\n' +
          'The drop handler is wrapped differently per branch. `team` passes `handleDrop` ' +
          'straight through, so the column the chip was dropped on reaches `moveTask` as a target ' +
          'assignee; `day` and `week` wrap it in a two-argument arrow that drops that third ' +
          'value on the floor. Reassignment-by-drag therefore only exists in one of the three ' +
          'grids, by construction.\n\n' +
          'And any `activeCalendar` outside those three renders **nothing at all** - not an empty ' +
          'grid, not a message. `activeCalendar` is a plain `string`, so a typo or a new view key ' +
          'added upstream blanks the planner rather than failing loudly.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    activeCalendar: 'day',
    dayEvents: DAY_EVENTS,
    filteredList: WEEK_EVENTS,
    currentDate: CURRENT_DATE,
    weekStart: WEEK_START,
    zoomMode: 'in',
    canEditTasks: true,
    draggedTaskId: null,
    draggedTaskLabel: null,
    canDragTask: () => true,
    getDropAvailabilityIntervals: fullDayAvailability,
    resolveDisplayName: (memberId?: string) => MEMBER_NAMES[memberId ?? ''] ?? '-',
    handleViewTask: fn(),
    handleChangeStatusTask: fn(),
    handleRescheduleTask: fn(),
    setCurrentDate: fn(),
    handleTaskDragStart: fn(),
    handleTaskDragEnd: fn(),
    // The drop handler calls `.catch()` on whatever this returns, so it has to be
    // a real promise rather than a bare spy.
    moveTask: fn(async () => {}),
    onCreateTaskAt: fn(),
    onDragHoverTarget: fn(),
  },
  decorators: [
    (Story) => (
      // The host is named so "Unknown view" can assert the component contributed
      // no element at all, rather than merely no grid.
      <div
        data-testid="task-calendar-body-host"
        className="h-[720px] w-full bg-[var(--screen)] overflow-hidden"
      >
        <Story />
      </div>
    ),
  ],
  beforeEach: () => {
    const authSnapshot = useAuthStore.getState();
    const orgSnapshot = useOrgStore.getState();
    const teamSnapshot = useTeamStore.getState();

    // Only the team branch reads these, but they are seeded for every story so
    // the three views are rendered against identical state.
    useOrgStore.setState({ primaryOrgId: ORG_ID, status: 'loaded' });
    useTeamStore.setState({
      teamsById: Object.fromEntries(TEAM.map((member) => [member._id, member])),
      teamIdsByOrgId: { [ORG_ID]: TEAM.map((member) => member._id) },
      status: 'loaded',
    });
    useAuthStore.setState({ attributes: { sub: ME }, status: 'unauthenticated' });

    return () => {
      useAuthStore.setState(authSnapshot);
      useOrgStore.setState(orgSnapshot);
      useTeamStore.setState(teamSnapshot);
    };
  },
} satisfies Meta<typeof TaskCalendarBody>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DayGrid: Story = {
  name: 'activeCalendar "day"',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // One column of 24 hour cells.
    await expect(taskSlots(canvasElement)).toHaveLength(HOURS_IN_DAY);

    /* The list, not just the grid. The day branch is handed `dayEvents`, so the
       Wednesday task in `filteredList` must not appear - if the two props were
       swapped this assertion is the only one in the file that would notice. */
    await expect(
      canvas.getByRole('button', { name: /Chase the haematology result/ })
    ).toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: /Refill the ward drip stands/ })).toBeNull();
  },
};

export const WeekGrid: Story = {
  name: 'activeCalendar "week"',
  args: { activeCalendar: 'week' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Seven columns of 24 hours.
    await expect(taskSlots(canvasElement)).toHaveLength(HOURS_IN_DAY * DAYS_IN_WEEK);

    /* The week branch takes `filteredList` and buckets the days itself, which is
       why the Wednesday task appears here and nowhere else. Both are asserted:
       "the second one is present" alone would pass with the day list handed in. */
    await expect(
      canvas.getByRole('button', { name: /Chase the haematology result/ })
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole('button', { name: /Refill the ward drip stands/ })
    ).toBeInTheDocument();
  },
};

export const TeamGrid: Story = {
  name: 'activeCalendar "team"',
  args: { activeCalendar: 'team' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Three team members, 24 hours each. The columns come from the team store
       rather than from any prop, so this count is what proves the branch reached
       `Task/UserCalendar` and not one of the other two. */
    await expect(taskSlots(canvasElement)).toHaveLength(HOURS_IN_DAY * TEAM.length);
    await expect(canvas.getByText('Dr. Ravi Patel')).toBeInTheDocument();

    // Team is the other branch on `dayEvents`, so the Wednesday task is out here
    // as well.
    await expect(canvas.queryByRole('button', { name: /Refill the ward drip stands/ })).toBeNull();
  },
};

export const UnknownView: Story = {
  name: 'activeCalendar outside day/week/team',
  args: { activeCalendar: 'month' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Not "no grid" - no element. The host is empty, which is the difference
       between a view that renders nothing and one that renders an empty shell.
       `activeCalendar` is typed as `string`, so this is the branch a new view key
       lands in until someone adds it here. */
    await expect(canvas.getByTestId('task-calendar-body-host').children).toHaveLength(0);
    await expect(taskSlots(canvasElement)).toHaveLength(0);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The phone frame owns a `month` view that the shared `activeCalendar` union never ' +
          'carries. Should it ever be pushed up, this is what the desktop planner would draw: a ' +
          'toolbar over nothing.',
      },
    },
  },
};

export const DayDrop: Story = {
  name: 'Drop in the day grid (no assignee forwarded)',
  args: {
    draggedTaskId: TUESDAY_TASK._id,
    draggedTaskLabel: TUESDAY_TASK.name,
  },
  play: async ({ args, canvasElement }) => {
    // Hour 3, dropped on its vertical middle: 03:00 + 30 minutes.
    dropOnMiddleOf(taskSlots(canvasElement)[3]);

    /* The third argument is `undefined`, and that is structural rather than
       incidental: the day branch wraps the drop handler in a two-argument arrow,
       so a target assignee cannot reach `moveTask` from this grid even though
       `TaskSlot` offers one. */
    await expect(args.moveTask).toHaveBeenCalledWith(CURRENT_DATE, 210, undefined);
    // The drag is ended by the same handler that performs the move, so a drop
    // never leaves the grid stuck in its dragging state.
    await expect(args.handleTaskDragEnd).toHaveBeenCalledTimes(1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'A drag held in flight (`draggedTaskId` is a prop here - this component owns no drag ' +
          'state) and dropped on an empty hour. Worth seeing as much as measuring: the drop ' +
          'overlays only render while a drag is live.',
      },
    },
  },
};

export const TeamDrop: Story = {
  name: "Drop into a colleague's column (assignee forwarded)",
  args: {
    activeCalendar: 'team',
    draggedTaskId: TUESDAY_TASK._id,
    draggedTaskLabel: TUESDAY_TASK.name,
  },
  play: async ({ args, canvasElement }) => {
    /* Cells run hour by hour with the three columns inside each, so hour 3 of the
       second column - Ravi's - is index 10. */
    const slots = taskSlots(canvasElement);
    await expect(slots).toHaveLength(HOURS_IN_DAY * TEAM.length);
    dropOnMiddleOf(slots[3 * TEAM.length + 1]);

    /* Ravi's practitioner id reaches `moveTask`, which is the whole reason the
       team branch passes `handleDrop` directly instead of wrapping it: dragging a
       chip sideways is how a task is reassigned, and the two other grids have no
       sideways to drag it in. */
    await expect(args.moveTask).toHaveBeenCalledWith(CURRENT_DATE, 210, RAVI);
    await expect(args.handleTaskDragEnd).toHaveBeenCalledTimes(1);
  },
};
