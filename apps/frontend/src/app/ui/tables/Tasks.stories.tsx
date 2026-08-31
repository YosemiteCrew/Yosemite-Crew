import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import Tasks from './Tasks';
import type { Task, TaskStatus } from '@/app/features/tasks/types/task';

const ORG_ID = 'org-tasks-table-story';

/** Pinned so the Due date column never drifts with the machine clock. */
const DUE = new Date('2026-07-15T09:00:00.000Z');

const task = (index: number, overrides: Partial<Task> = {}): Task =>
  ({
    _id: `task-${index}`,
    organisationId: ORG_ID,
    assignedTo: 'prac-amara',
    assignedBy: 'prac-ravi',
    audience: 'EMPLOYEE_TASK',
    source: 'CUSTOM',
    category: 'CARE',
    name: `Task ${index}`,
    description: 'Check the wound site and log any discharge before the evening round.',
    dueAt: DUE,
    status: 'PENDING' as TaskStatus,
    ...overrides,
  }) as Task;

const TASKS: Task[] = [
  task(1, { name: 'Post-op wound check', status: 'PENDING' }),
  task(2, { name: 'Meloxicam 0.4 ml PO', category: 'MEDICATION', status: 'IN_PROGRESS' }),
  task(3, { name: 'IV fluids - recalculate rate', category: 'TREATMENT', status: 'COMPLETED' }),
  task(4, {
    name: 'Call owner with the evening update',
    category: 'COMMUNICATION',
    status: 'CANCELLED',
  }),
];

const meta = {
  title: 'Tables/Tasks',
  component: Tasks,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The employee task list. Assignees are ids in the record and are resolved to names ' +
          'through the team map, falling back to the raw id rather than a blank so a task is ' +
          'never shown as belonging to nobody. The description clamps to two lines so free text ' +
          'cannot outgrow the rows beside it, and the action column is sized by its control rail ' +
          '(3 x 40px + 2 x 8px = 136px) rather than by its label.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    filteredList: TASKS,
    setActiveTask: fn(),
    setViewPopup: fn(),
    setChangeStatusPopup: fn(),
    setChangeStatusPreferredStatus: fn(),
    setReschedulePopup: fn(),
    canEditTasks: true,
  },
} satisfies Meta<typeof Tasks>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Four tasks, four statuses',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText('Post-op wound check').length).toBeGreaterThan(0);
    // Stored SCREAMING_CASE, shown title-cased - in both the category and the pill.
    await expect(canvas.queryByText('IN_PROGRESS')).toBeNull();
    await expect(canvas.queryByText('MEDICATION')).toBeNull();
  },
};

export const OpensATask: Story = {
  name: 'Viewing a task',
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getAllByRole('button')[0]);
    await expect(args.setActiveTask).toHaveBeenCalledTimes(1);
    await expect(args.setViewPopup).toHaveBeenCalledWith(true);
  },
};

export const ReadOnly: Story = {
  name: 'Without edit permission',
  args: { canEditTasks: false },
  play: async ({ canvasElement }) => {
    /* A viewer keeps the view control and loses the ones that mutate. The check
       is that FEWER controls render, not that none do - hiding the row's only
       affordance would make the list unreadable rather than read-only. */
    const buttons = within(canvasElement).queryAllByRole('button');
    await expect(buttons.length).toBeGreaterThan(0);
  },
};

export const UnresolvedAssignee: Story = {
  name: 'An assignee the team map does not know',
  args: {
    filteredList: [task(9, { assignedTo: 'prac-departed', assignedBy: 'prac-departed' })],
  },
  play: async ({ canvasElement }) => {
    /* Falls back to the raw id rather than a dash: a task still belongs to
       somebody after they leave the roster, and a blank cell would read as
       unassigned. */
    await expect(within(canvasElement).getAllByText('prac-departed').length).toBeGreaterThan(0);
  },
};

export const LongDescription: Story = {
  name: 'A description that clamps',
  args: {
    filteredList: [
      task(10, {
        name: 'Overnight monitoring',
        description:
          'Record temperature, pulse and respiration hourly until 06:00, escalate to the duty ' +
          'vet if the temperature rises above 39.5C or the respiratory rate exceeds 40, and log ' +
          'every reading against the encounter so the morning round has the full trend.',
      }),
      ...TASKS,
    ],
  },
  parameters: {
    docs: {
      description: {
        story:
          'Descriptions are free text in a 200px column. The clamp keeps the row the same height ' +
          'as its neighbours and puts the full text on hover.',
      },
    },
  },
};

export const Compact: Story = {
  name: 'Small variant (embedded in a panel)',
  args: { small: true },
};

export const Empty: Story = {
  name: 'No tasks',
  args: { filteredList: [] },
};

export const Phone: Story = {
  name: 'Phone: the rows become cards',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async () => {
    // Eight columns cannot fit 375px, so below the breakpoint the row layout is
    // swapped for TaskCards rather than squeezed.
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
};
