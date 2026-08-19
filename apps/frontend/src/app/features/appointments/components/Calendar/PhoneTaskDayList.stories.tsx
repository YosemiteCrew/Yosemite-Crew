import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import PhoneTaskDayList from './PhoneTaskDayList';
import type { Task } from '@/app/features/tasks/types/task';

const ORG_ID = 'org-storybook';
const ME = 'vet-weber';

/**
 * Instants are UTC and sit in the middle of the working day on purpose. Every
 * bucket rule in `buildTaskDayList` compares date keys in the PREFERRED zone
 * (Europe/Berlin by default, +2 in July), never the browser's, so a 07:00-15:00 UTC
 * fixture keeps its day whatever machine renders it - and the rendered clock times
 * below are the Berlin ones, two hours on.
 */
const NOW = new Date('2026-07-14T09:20:00.000Z');
const ANCHOR = new Date('2026-07-14T12:00:00.000Z');

const MEMBER_NAMES: Record<string, string> = {
  [ME]: 'Dr. Elena Weber',
  'vet-osei': 'Dr. Ama Osei',
  'parent-hartmann': 'Lena Hartmann',
};

const task = (over: Partial<Task> & Pick<Task, '_id' | 'name' | 'dueAt'>): Task => ({
  organisationId: ORG_ID,
  assignedTo: ME,
  audience: 'EMPLOYEE_TASK',
  source: 'CUSTOM',
  category: 'GENERAL',
  status: 'PENDING',
  ...over,
});

/** Due 09:00 Berlin, 2h20 before `NOW` - the overdue bucket. */
const OVERDUE_MINE = task({
  _id: 't-overdue',
  name: 'Chase Bruno’s haematology result',
  dueAt: new Date('2026-07-14T07:00:00.000Z'),
  companionId: 'companion-bruno',
});

/** Due 16:00 Berlin, assigned to someone else - visible on Everyone, not on My board. */
const TODAY_OTHER = task({
  _id: 't-today',
  name: 'Restock consult 2 sharps bin',
  dueAt: new Date('2026-07-14T14:00:00.000Z'),
  assignedTo: 'vet-osei',
  status: 'IN_PROGRESS',
});

/** Two days out - the rolling six-day "Later this week" window. */
const LATER_MINE = task({
  _id: 't-later',
  name: 'Post-op call, Juno',
  dueAt: new Date('2026-07-16T08:00:00.000Z'),
});

/** A PARENT_TASK: never on Everyone or My board, only on Parents. */
const PARENT_TASK = task({
  _id: 't-parent',
  name: 'Send Poppy’s discharge instructions',
  dueAt: new Date('2026-07-14T15:00:00.000Z'),
  audience: 'PARENT_TASK',
  assignedTo: 'parent-hartmann',
  companionId: 'companion-poppy',
});

const STAFF_TASKS: Task[] = [OVERDUE_MINE, TODAY_OTHER, LATER_MINE];
const ALL_TASKS: Task[] = [...STAFF_TASKS, PARENT_TASK];

const getScopePill = (canvasElement: HTMLElement) =>
  within(canvasElement).getByRole('group', { name: 'Task board scope' });

const getTaskRows = (canvasElement: HTMLElement): HTMLElement[] =>
  Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-testid^="phone-task-"]'));

const meta = {
  title: 'Appointments/Calendar/PhoneTaskDayList',
  component: PhoneTaskDayList,
  // A 375px phone. Pinned as a GLOBAL: `parameters.viewport.defaultViewport` was
  // removed in Storybook 10 and is inert, so the old spelling renders desktop
  // markup under a name that promises a phone.
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The tasks planner below 768px: a time grid cannot shrink, so the phone gets a ' +
          'thumb-checkable day list bucketed into Overdue / Today / Later this week.\n\n' +
          'The **scope filter** is the part no static render reaches. `scope` is component-local ' +
          'state, seeded to `everyone` and never lifted, so a story that only mounts the component ' +
          'draws one of its three boards and the other two have never been seen. The segments are ' +
          'not cosmetic either - each is backed by a real field, `audience` for Parents and ' +
          '`assignedTo` for My board, and the parents board is DISJOINT from the other two rather ' +
          'than a subset of them. A parent task is invisible on Everyone, which is the sort of ' +
          'rule that reads as a bug the first time a receptionist hits it.\n\n' +
          'Because the filter runs before the bucketing, it can also empty the list on its own: ' +
          'switching to Parents on a day with no parent tasks produces "No tasks due in this ' +
          'window." with the day itself unchanged. That empty branch and the boards behind the ' +
          'other two segments are what these stories draw.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    tasks: ALL_TASKS,
    currentDate: ANCHOR,
    setCurrentDate: fn(),
    canEditTasks: true,
    currentUserId: ME,
    now: NOW,
    resolveDisplayName: (memberId?: string) => MEMBER_NAMES[memberId ?? ''] ?? '',
    companionNameById: {
      'companion-bruno': 'Bruno',
      'companion-poppy': 'Poppy',
    },
    onToggleTask: fn(),
    onViewTask: fn(),
  },
  decorators: [
    (Story) => (
      <div className="h-[720px] w-full bg-[var(--screen)]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PhoneTaskDayList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Everyone: Story = {
  name: 'Everyone (default scope)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // `everyone` is the seeded scope, and it means every EMPLOYEE task - the parent
    // task in the fixture is not counted, not merely not listed.
    const everyone = within(getScopePill(canvasElement)).getByRole('button', { name: 'Everyone' });
    await expect(everyone).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas.getByRole('heading', { level: 2 })).toHaveTextContent('Tasks (3)');
    await expect(getTaskRows(canvasElement)).toHaveLength(3);

    /* All three buckets at once, each heading carrying its own count. Only non-empty
       buckets render, so this is also the only arrangement that proves the ordering
       overdue -> today -> later rather than insertion order. */
    await expect(canvas.getByText('Overdue · 1')).toBeInTheDocument();
    await expect(canvas.getByText('Today · 1')).toBeInTheDocument();
    await expect(canvas.getByText('Later this week · 1')).toBeInTheDocument();

    /* The overdue subtitle is three derived parts joined, and every one of them can be
       wrong independently: the due time is formatted in the preferred zone (09:00
       Berlin from 07:00 UTC), the lateness is floored to whole hours, and the assignee
       collapses to "you" rather than repeating the signed-in vet's own name. */
    await expect(canvas.getByText('Due 09:00 · 2 hr overdue · you')).toBeInTheDocument();
    await expect(canvas.getByText('Due 16:00 · Dr. Ama Osei')).toBeInTheDocument();

    await expect(canvas.queryByText('Send Poppy’s discharge instructions')).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The board as it mounts. Three buckets, one row each, and the overdue row carries the ' +
          'danger left-edge and red subtitle that the other two do not.',
      },
    },
  },
};

export const MyBoard: Story = {
  name: 'My board (scope switched)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const pill = within(getScopePill(canvasElement));

    await userEvent.click(pill.getByRole('button', { name: 'My board' }));

    // The pressed state moves with the selection - the pill is the only indication
    // that the list has been narrowed, so it has to be right.
    await expect(pill.getByRole('button', { name: 'My board' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(pill.getByRole('button', { name: 'Everyone' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );

    /* Osei's task is gone and the header count follows it down: the count is derived
       from the SCOPED list, not the prop, so a filter that failed to reach the header
       would show "Tasks (3)" over two rows. */
    await expect(canvas.getByRole('heading', { level: 2 })).toHaveTextContent('Tasks (2)');
    await expect(getTaskRows(canvasElement)).toHaveLength(2);
    await expect(canvas.queryByText('Restock consult 2 sharps bin')).toBeNull();
    await expect(canvas.getByText('Chase Bruno’s haematology result')).toBeInTheDocument();
    await expect(canvas.getByText('Post-op call, Juno')).toBeInTheDocument();

    // The Today bucket emptied out, so its heading is gone rather than showing "· 0".
    await expect(canvas.queryByText('Today · 0')).toBeNull();
    await expect(canvas.getByText('Overdue · 1')).toBeInTheDocument();
    await expect(canvas.getByText('Later this week · 1')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Narrowed to the signed-in vet by `assignedTo`. The middle bucket disappears entirely ' +
          'rather than rendering an empty heading, which is why the group list is built from ' +
          'non-empty buckets rather than from a fixed three.',
      },
    },
  },
};

export const Parents: Story = {
  name: 'Parents (disjoint board)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const pill = within(getScopePill(canvasElement));

    await userEvent.click(pill.getByRole('button', { name: 'Parents' }));

    await expect(canvas.getByRole('heading', { level: 2 })).toHaveTextContent('Tasks (1)');
    const rows = getTaskRows(canvasElement);
    await expect(rows).toHaveLength(1);
    await expect(canvas.getByText('Send Poppy’s discharge instructions')).toBeInTheDocument();

    /* Everything from the other two boards is gone - Parents is a different audience,
       not a narrower slice of the same one. The companion initial is still resolved
       from `companionNameById`, so the row keeps its "P" avatar. */
    await expect(canvas.queryByText('Chase Bruno’s haematology result')).toBeNull();
    await expect(canvas.getByTitle('Poppy')).toHaveTextContent('P');
    await expect(canvas.getByText('Today · 1')).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The parent-facing board. `audience === PARENT_TASK` is the whole rule, so this list and ' +
          'the two staff lists never share a row - a point worth seeing rather than reading, ' +
          'because the segmented control reads like three filters over one set.',
      },
    },
  },
};

export const FilteredToEmpty: Story = {
  name: 'Filtered to empty',
  args: { tasks: STAFF_TASKS },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const pill = within(getScopePill(canvasElement));

    // Three staff tasks on the day, none of them parent-facing.
    await expect(getTaskRows(canvasElement)).toHaveLength(3);

    await userEvent.click(pill.getByRole('button', { name: 'Parents' }));

    await expect(canvas.getByText('No tasks due in this window.')).toBeInTheDocument();
    await expect(getTaskRows(canvasElement)).toHaveLength(0);
    await expect(canvas.getByRole('heading', { level: 2 })).toHaveTextContent('Tasks (0)');

    /* The day navigation and the scope pill survive the empty state - without them the
       screen would be a dead end, and the way out of this particular emptiness is the
       filter, not a different day. */
    await expect(pill.getByRole('button', { name: 'Everyone' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Next day' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Today' })).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story:
          'The empty branch, reached the way a user actually reaches it: a real day with real ' +
          'tasks on it, filtered to a segment that holds none. The copy says "in this window" ' +
          'rather than "no tasks" because the list is bounded on both ends - a settled task from ' +
          'last week and anything past the six-day horizon are dropped as well, and neither is a ' +
          'reason to think the day is clear.',
      },
    },
  },
};
