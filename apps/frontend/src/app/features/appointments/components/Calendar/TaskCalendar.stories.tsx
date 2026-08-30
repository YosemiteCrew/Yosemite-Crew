import type { Meta, StoryObj } from '@storybook/react';
import { expect, fireEvent, fn, userEvent, within } from 'storybook/test';
import type { InternalAxiosRequestConfig } from 'axios';

import type { Team } from '@/app/features/organization/types/team';
import { type Task, TaskFilters, TaskStatusFilters } from '@/app/features/tasks/types/task';
import api from '@/app/services/axios';
import { useAuthStore } from '@/app/stores/authStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { useTeamStore } from '@/app/stores/teamStore';
import TaskCalendar from './TaskCalendar';

const ORG_ID = 'org-storybook';
const ME = 'vet-weber';
const RAVI = 'vet-patel';
const PRIYA = 'nurse-raman';

/**
 * Instants are UTC in the middle of the working day. Every day and hour this
 * planner derives is computed in the PREFERRED zone (Europe/Berlin, +2 in July),
 * never the browser's, so the four tasks below land on Tuesday 14 July at 09:00,
 * 11:00, 13:00 and 15:00 on any machine - four separate hour rows, so no two
 * markers ever share a slot and change the lane geometry.
 */
const CURRENT_DATE = new Date('2026-07-14T12:00:00.000Z');
/** Monday. `getWeekDays` runs Mon-Sun, so this is the head of the fixture week. */
const WEEK_START = new Date('2026-07-13T12:00:00.000Z');

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

const TEAM: Team[] = [
  teamMember(ME, 'Dr. Elena Weber'),
  teamMember(RAVI, 'Dr. Ravi Patel'),
  teamMember(PRIYA, 'Priya Raman'),
];

/**
 * `assignedBy` is the load-bearing field, not `assignedTo`.
 * `canCurrentUserEditTask` grants the drag only to the person who created the
 * assignment, and `shouldAllowTaskAvailabilityBypass` waives the assignee's
 * availability check for that same person. Every fixture is created by the
 * signed-in vet, so the drops below are decided entirely in the browser and
 * never wait on an availability fetch.
 */
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

const MINE = task({
  _id: 't-haematology',
  name: 'Chase the haematology result',
  dueAt: new Date('2026-07-14T07:00:00.000Z'),
});

const RAVIS = task({
  _id: 't-sharps',
  name: 'Restock the sharps bin',
  dueAt: new Date('2026-07-14T09:00:00.000Z'),
  assignedTo: RAVI,
  status: 'IN_PROGRESS',
});

/** No assignee at all - the one move the planner refuses without asking anyone. */
const UNASSIGNED = task({
  _id: 't-theatre-list',
  name: 'Confirm the theatre list',
  dueAt: new Date('2026-07-14T11:00:00.000Z'),
  assignedTo: '',
});

/** A master occurrence: `isSeriesTask` is true, so a drop asks for a scope. */
const RECURRING = task({
  _id: 't-drip-stands',
  name: 'Refill the ward drip stands',
  dueAt: new Date('2026-07-14T13:00:00.000Z'),
  recurrence: { type: 'DAILY', isMaster: true },
});

const TASKS: Task[] = [MINE, RAVIS, UNASSIGNED, RECURRING];

const HOURS_IN_DAY = 24;

/**
 * The planner reaches for the API on mount and on drag. `axios` talks to the real
 * dev API (`NEXT_PUBLIC_BASE_URL`), so left alone a story would fire cross-origin
 * requests from the canvas. Swapping the shared instance's adapter answers all of
 * them locally with an empty payload; the real adapter goes back on unmount.
 */
const withOfflineApi = () => {
  const originalAdapter = api.defaults.adapter;
  api.defaults.adapter = ((config: InternalAxiosRequestConfig) =>
    Promise.resolve({
      data: { data: [] },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    })) as typeof api.defaults.adapter;
  return () => {
    api.defaults.adapter = originalAdapter;
  };
};

const withSeededStores = () => {
  const authSnapshot = useAuthStore.getState();
  const orgSnapshot = useOrgStore.getState();
  const teamSnapshot = useTeamStore.getState();

  useOrgStore.setState({ primaryOrgId: ORG_ID, status: 'loaded' });
  useTeamStore.setState({
    teamsById: Object.fromEntries(TEAM.map((member) => [member._id, member])),
    teamIdsByOrgId: { [ORG_ID]: TEAM.map((member) => member._id) },
    status: 'loaded',
  });
  // `attributes.sub` IS the drag permission here - it is compared against every
  // task's `assignedBy`. Seeded explicitly rather than left to whatever a
  // neighbouring story put in the singleton, or which markers are draggable would
  // depend on which story you opened first.
  useAuthStore.setState({ attributes: { sub: ME }, status: 'unauthenticated' });

  return () => {
    useAuthStore.setState(authSnapshot);
    useOrgStore.setState(orgSnapshot);
    useTeamStore.setState(teamSnapshot);
  };
};

/**
 * `useIsPhone` reads `matchMedia`, and the viewport global only resizes the
 * preview iframe from the Storybook MANAGER - open the story frame directly, as
 * the story runner does, and the query still answers for the runner's own window.
 * Pinning the width is what makes the phone branch deterministic in both places.
 */
const withViewportWidth = (widthPx: number) => () => {
  const original = globalThis.matchMedia;
  globalThis.matchMedia = ((query: string) => {
    const min = /\(min-width:\s*(\d+)px\)/.exec(query);
    const max = /\(max-width:\s*(\d+)px\)/.exec(query);
    if (!min && !max) return original.call(globalThis, query);
    const matches = (!min || widthPx >= Number(min[1])) && (!max || widthPx <= Number(max[1]));
    return {
      matches,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList;
  }) as typeof globalThis.matchMedia;
  return () => {
    globalThis.matchMedia = original;
  };
};

/** Every hour cell on screen, in document order. */
const taskSlots = (canvasElement: HTMLElement): HTMLElement[] => [
  ...canvasElement.querySelectorAll<HTMLElement>('section[aria-label^="Tasks slot for"]'),
];

/** Pick up a task chip and drop it on an empty hour cell. */
const dragTaskOnto = async (marker: HTMLElement, slot: HTMLElement) => {
  fireEvent.dragStart(marker);
  const rect = slot.getBoundingClientRect();
  // The drop minute is read as a ratio of the cell's own box, so the pointer is
  // placed by that box rather than by a hard-coded pixel.
  fireEvent.drop(slot, { clientY: rect.top + rect.height / 2 });
};

const meta = {
  title: 'Appointments/Calendar/TaskCalendar',
  component: TaskCalendar,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The tasks planner: the shared calendar toolbar, the drag/drop machinery, the phone ' +
          'day list and the three desktop grids. Two of its states exist nowhere else in the ' +
          'component tree, because both are reducer state reached only by completing a gesture.\n\n' +
          '**The drag-error banner.** A refused move writes its reason into `dragError` and the ' +
          'container renders it as a strip between the toolbar and the grid. No prop reaches it; ' +
          'the only way in is to pick a chip up and put it down somewhere the move cannot be ' +
          'planned.\n\n' +
          '**The recurrence-scope prompt.** Dropping a chip that belongs to a repeating series ' +
          'does NOT move it - the drop is held un-committed while `RecurrenceScopeModal` asks ' +
          'which occurrences the change applies to, so the card stays in the slot it came from ' +
          'and cancelling needs no rollback.\n\n' +
          'Both are reachable here without a network round trip, and the fixtures are built for ' +
          'it: every task is `assignedBy` the signed-in vet, which is what grants the drag ' +
          '(`canCurrentUserEditTask`) AND waives the assignee availability fetch ' +
          '(`shouldAllowTaskAvailabilityBypass`), so a drop resolves entirely in the browser.\n\n' +
          '`canEditTasks` is worth reading closely: it removes the toolbar CTA and makes the ' +
          'create-slot handler refuse, but it does NOT remove the invisible create button, and it ' +
          'does not reach `canDragTask` at all - the drag is gated on authorship instead. See ' +
          '"Without edit permission".',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    filteredList: TASKS,
    allTasks: TASKS,
    activeCalendar: 'day',
    currentDate: CURRENT_DATE,
    weekStart: WEEK_START,
    canEditTasks: true,
    filterOptions: TaskFilters,
    statusOptions: TaskStatusFilters,
    activeFilter: 'all',
    activeStatus: 'all',
    setActiveCalendar: fn(),
    setCurrentDate: fn(),
    setWeekStart: fn(),
    setActiveTask: fn(),
    setViewPopup: fn(),
    setChangeStatusPopup: fn(),
    setChangeStatusPreferredStatus: fn(),
    setReschedulePopup: fn(),
    setActiveFilter: fn(),
    setActiveStatus: fn(),
    onAddTask: fn(),
    onCreateFromCalendarSlot: fn(),
  },
  decorators: [
    (Story) => (
      <div className="h-[760px] w-full bg-[var(--page)] p-3">
        <Story />
      </div>
    ),
  ],
  beforeEach: () => {
    const restoreApi = withOfflineApi();
    const restoreStores = withSeededStores();
    return () => {
      restoreStores();
      restoreApi();
    };
  },
} satisfies Meta<typeof TaskCalendar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DayView: Story = {
  name: 'Day view',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    // One column of 24 hour cells: the day grid, and only the day grid.
    await expect(taskSlots(canvasElement)).toHaveLength(HOURS_IN_DAY);
    const viewPill = within(canvas.getByRole('group', { name: 'Calendar view' }));
    await expect(viewPill.getByRole('button', { name: 'Day' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    /* The CTA lives in the shared toolbar rather than the page header, and it is
       labelled for tasks - `Header` defaults to "New appointment", so a container
       that forgot `addButtonText` would put the appointments CTA on this page. */
    await expect(canvas.getByRole('button', { name: 'New task' })).toBeInTheDocument();

    // Four chips, one per hour row, each draggable because the signed-in vet
    // created all four assignments.
    await expect(canvas.getAllByRole('button', { name: 'View task' })).toHaveLength(TASKS.length);
    await expect(
      canvas.getByRole('button', { name: /Chase the haematology result/ })
    ).toHaveAttribute('draggable', 'true');

    /* Clicking an empty hour books it. The slot buttons are invisible and cover
       the whole cell, so this is the only way to tell the create path is wired at
       all - and it is the half that "Without edit permission" turns off. */
    await userEvent.click(canvas.getAllByRole('button', { name: /^Create task on / })[3]);
    await expect(args.onCreateFromCalendarSlot).toHaveBeenCalledTimes(1);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The single-day grid with four tasks on Tuesday 14 July: one of the vet’s own, one ' +
          'assigned to a colleague, one with no assignee and one repeating daily. The last two ' +
          'are what the drag stories below pick up.',
      },
    },
  },
};

export const WeekView: Story = {
  name: 'Week view',
  args: { activeCalendar: 'week' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Seven day columns of 24 hours each.
    await expect(taskSlots(canvasElement)).toHaveLength(HOURS_IN_DAY * 7);

    /* The pager has to step a WEEK. `Header` derives `navigatesByWeek` from
       `activeCalendar === 'week' && !!setWeekStart`, so a container that did not
       pass `setWeekStart` still rendered this grid while the chevrons rolled it
       forward one day at a time - and were labelled "Next day" over a week view.
       That is exactly the bug this planner shipped. */
    await expect(canvas.getByRole('button', { name: 'Previous week' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Next week' })).toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Next day' })).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The seven-day grid. It is handed `filteredList` rather than the day-scoped list, ' +
          'because the week has to bucket every task itself.',
      },
    },
  },
};

export const TeamView: Story = {
  name: 'Team view (one column per member)',
  args: { activeCalendar: 'team' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Three team members, 24 hours each. The columns come from the team store
    // rather than a prop, so this count is what proves the seeding reached it.
    await expect(taskSlots(canvasElement)).toHaveLength(HOURS_IN_DAY * TEAM.length);
    await expect(canvas.getByText('Dr. Ravi Patel')).toBeInTheDocument();
    await expect(canvas.getByText('Priya Raman')).toBeInTheDocument();

    /* Only tasks with a resolvable assignee reach a column, so the unassigned
       task is absent from this view while the other three are placed. That is a
       real disappearance, not a filter the user chose. */
    await expect(canvas.queryByRole('button', { name: /Confirm the theatre list/ })).toBeNull();
    await expect(
      canvas.getByRole('button', { name: /Chase the haematology result/ })
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The day split by assignee. A task with an empty `assignedTo` matches no column and is ' +
          'silently dropped from this view - it is still on the day and week grids.',
      },
    },
  },
};

export const ReadOnly: Story = {
  name: 'Without edit permission',
  args: { canEditTasks: false },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    // The CTA is gone, and the grid is still fully drawn - a member without edit
    // rights must still see the day.
    await expect(canvas.queryByRole('button', { name: 'New task' })).toBeNull();
    await expect(taskSlots(canvasElement)).toHaveLength(HOURS_IN_DAY);

    /* The create affordance is NOT removed: the invisible full-cell button is
       still there and still focusable, and the permission is enforced one layer
       further in, inside `handleCreateTaskAt`. Clicking it is silent - no toast,
       no disabled cursor, nothing. Worth a decision rather than a shrug. */
    const createButtons = canvas.getAllByRole('button', { name: /^Create task on / });
    await expect(createButtons).toHaveLength(HOURS_IN_DAY);
    await userEvent.click(createButtons[3]);
    await expect(args.onCreateFromCalendarSlot).not.toHaveBeenCalled();

    /* And the chips stay draggable. `canDragTask` is `canCurrentUserEditTask`,
       which asks who created the assignment and never consults `canEditTasks` -
       so this member may still drag a task they raised into a new slot. */
    await expect(
      canvas.getByRole('button', { name: /Chase the haematology result/ })
    ).toHaveAttribute('draggable', 'true');
  },
  parameters: {
    docs: {
      description: {
        story:
          '`canEditTasks` false. It reaches two places and misses a third: the toolbar CTA goes, ' +
          'the create handler refuses, and the drag permission is untouched because it is derived ' +
          'from task authorship instead. The three are separate derivations of one word, which is ' +
          'the reason to look at them together.',
      },
    },
  },
};

export const DragErrorBanner: Story = {
  name: 'Drop refused (drag-error banner)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const marker = canvas.getByRole('button', { name: /Confirm the theatre list/ });

    // Hour 3 is empty, so the drop lands on bare grid rather than on another chip.
    await dragTaskOnto(marker, taskSlots(canvasElement)[3]);

    /* The refusal is stated, not swallowed. `resolveTaskMove` rejects a task with
       no resolvable assignee before anything is written, and the reason goes into
       the banner between the toolbar and the grid rather than into a toast that
       has already faded by the time the user looks up. */
    const banner = await canvas.findByText('Task assignee is required.');
    await expect(banner).toBeInTheDocument();

    // The task has not moved and no prompt was raised - a refused drop writes
    // nothing at all.
    await expect(within(globalThis.document.body).queryByRole('dialog')).toBeNull();
    await expect(
      canvas.getByRole('button', { name: /Confirm the theatre list/ })
    ).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The state no static render reaches. A chip with no assignee is dragged onto an empty ' +
          'hour; `resolveTaskMove` cannot resolve a target, so it sets the drag error and returns ' +
          'before the write. The banner is the only surface that carries the reason.',
      },
    },
  },
};

export const SeriesScopePrompt: Story = {
  name: 'Dropping one of a series (scope prompt)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const marker = canvas.getByRole('button', { name: /Refill the ward drip stands/ });

    await dragTaskOnto(marker, taskSlots(canvasElement)[3]);

    /* The prompt portals to document.body, so it is outside the story canvas. */
    const dialog = await within(globalThis.document.body).findByRole('dialog');
    await expect(dialog).toHaveTextContent(
      '"Refill the ward drip stands" is part of a recurring series.'
    );
    await expect(within(dialog).getByRole('heading', { level: 2 })).toHaveTextContent(
      'Edit recurring task'
    );

    /* Opened on the narrowest scope, so confirming without a choice moves only
       the occurrence that was actually dragged. */
    await expect(within(dialog).getByRole('radio', { name: 'This task only' })).toBeChecked();
    await expect(
      within(dialog).getByRole('radio', { name: 'All tasks in the series' })
    ).not.toBeChecked();

    // Nothing is committed while the prompt is open: the chip is still in the
    // hour it was dragged from, and no error was raised either.
    await expect(
      canvas.getByRole('button', { name: /Refill the ward drip stands/ })
    ).toBeInTheDocument();
    await expect(canvas.queryByText('Task assignee is required.')).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Dropping an occurrence of a repeating task holds the move instead of writing it, and ' +
          'asks which occurrences it applies to - the same choice the Reschedule and TaskInfo ' +
          'paths offer. Cancelling needs no rollback precisely because nothing was written.',
      },
    },
  },
};

export const EmptyDay: Story = {
  name: 'Nothing due',
  args: { filteredList: [], allTasks: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // No chips, but the day is still a full, bookable grid rather than an empty
    // panel - the way back from an empty day is to add to it.
    await expect(canvas.queryAllByRole('button', { name: 'View task' })).toHaveLength(0);
    await expect(taskSlots(canvasElement)).toHaveLength(HOURS_IN_DAY);
    await expect(canvas.getAllByRole('button', { name: /^Create task on / })).toHaveLength(
      HOURS_IN_DAY
    );
    await expect(canvas.getByRole('button', { name: 'New task' })).toBeInTheDocument();
  },
};

export const PhoneList: Story = {
  name: 'Phone (375): the day list',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  beforeEach: withViewportWidth(375),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Below 768px the time grid is not rendered at all - not hidden, not shrunk.
       The Day/Week/Team pill and the "New task" CTA both live in the shared
       desktop `Header`, which the phone branch never mounts; the phone list
       carries its own day pager, so the pager is NOT the thing to look for. */
    await expect(taskSlots(canvasElement)).toHaveLength(0);
    await expect(canvas.queryByRole('group', { name: 'Calendar view' })).toBeNull();
    await expect(canvas.queryByRole('button', { name: 'New task' })).toBeNull();

    // What replaces them: a bucketed day list with its own scope filter.
    await expect(canvas.getByRole('group', { name: 'Task board scope' })).toBeInTheDocument();
    await expect(canvas.getByRole('heading', { level: 2 })).toHaveTextContent('Tasks (4)');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The phone frame. A task time grid cannot shrink to 375px, so the planner becomes a ' +
          'thumb-checkable day list bucketed into Overdue / Today / Later this week, with an ' +
          'Everyone / My board / Parents scope pill of its own.',
      },
    },
  },
};
