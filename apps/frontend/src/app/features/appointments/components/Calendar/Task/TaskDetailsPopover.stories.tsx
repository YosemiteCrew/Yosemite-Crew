import { useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, within } from 'storybook/test';
import type { Task } from '@/app/features/tasks/types/task';

import { TaskDetailsPopover } from './TaskSlot';

const TEAM: Record<string, string> = {
  'member-1': 'Dr. Elena Marsh',
  'member-2': 'Tom Reyes',
};

const task = (over: Partial<Task> = {}): Task =>
  ({
    _id: 'task-1',
    name: 'Recheck sutures',
    status: 'PENDING',
    audience: 'EMPLOYEE_TASK',
    category: 'Post-op',
    assignedBy: 'member-1',
    assignedTo: 'member-2',
    dueAt: new Date(2026, 7, 17, 9, 30),
    ...over,
  }) as unknown as Task;

/**
 * The real popover is a `<dialog open>` positioned by absolute px against the hovered
 * chip. In a story it is pinned into a normal box so it can be read, but it keeps its
 * own 304px width, which is the width its layout has to survive.
 */
const Harness = ({
  task: taskProp,
  canEditTasks,
  onView,
  onChangeStatus,
  onReschedule,
  onDismiss,
}: {
  task: Task;
  canEditTasks: boolean;
  onView: () => void;
  onChangeStatus: () => void;
  onReschedule: () => void;
  onDismiss: () => void;
}) => {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  return (
    <div className="relative min-h-[360px] p-6">
      <TaskDetailsPopover
        task={taskProp}
        popoverId="task-popover"
        titleId="task-popover-title"
        dialogRef={dialogRef}
        style={{ position: 'static' }}
        canEditTasks={canEditTasks}
        getDisplayName={(id) => (id ? (TEAM[id] ?? '-') : '-')}
        onView={onView}
        onChangeStatus={onChangeStatus}
        onReschedule={onReschedule}
        onDismiss={onDismiss}
        clearCloseTimer={() => {}}
        schedulePopoverClose={() => {}}
      />
    </div>
  );
};

const meta = {
  title: 'Appointments/Calendar/TaskDetailsPopover',
  component: Harness,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The task chip popover, and the clearest example on this branch of why an ' +
          'interaction-gated surface needs a story.\n\n' +
          'It mounts only while a chip is hovered or focused, and it was not exported, so no story ' +
          'could draw it even in principle. It shipped with its From/To/Category block declared as ' +
          '`grid-cols-[auto,minmax(0,1fr)]` - a comma where CSS grid needs a track separator. The ' +
          'browser rejects that declaration outright and drops it, so the element fell back to one ' +
          'implicit column and all six children stacked: every value dropped under its own label, ' +
          'and the block grew about 60px inside a popover whose flip math assumes a fixed 304x248 ' +
          'box.\n\n' +
          'Nothing could have caught it earlier. It is a valid class name, so Tailwind emitted it; ' +
          'tsc, eslint and jsdom all just saw a string. It only misbehaves in a real browser, on a ' +
          'surface nothing rendered. The component is exported now, the template uses an underscore, ' +
          'and a repo-wide test scans every shipped file for the same mistake.\n\n' +
          'The stories assert the grid resolves to two columns rather than trusting that it looks ' +
          'right, since the failure mode is a silently dropped declaration.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    task: task(),
    canEditTasks: true,
    onView: fn(),
    onChangeStatus: fn(),
    onReschedule: fn(),
    onDismiss: fn(),
  },
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const label = canvas.getByText('From');
    const grid = label.parentElement as HTMLElement;
    // The bug was a dropped declaration, so assert the computed template really has
    // two tracks. "6 children in 1 column" is what a comma produces.
    const tracks = getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/);
    await expect(tracks).toHaveLength(2);
    await expect(grid.children).toHaveLength(6);
  },
  parameters: {
    docs: {
      story: 'Three label/value pairs in two columns, values right-aligned against their labels.',
    },
  },
};

export const LongValues: Story = {
  name: 'Long names and category',
  args: {
    task: task({
      name: 'Recheck sutures and review the post-operative analgesia plan',
      category: 'Post-operative recheck and analgesia review',
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const grid = canvas.getByText('Category').parentElement as HTMLElement;
    await expect(getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/)).toHaveLength(2);
  },
  parameters: {
    docs: {
      story:
        'The value column is `minmax(0,1fr)` with `truncate`, so long values ellipsise instead of ' +
        'widening the popover. Without the `minmax(0,...)` the track would refuse to shrink below ' +
        'its content and push the panel past its 304px.',
    },
  },
};

export const ParentTask: Story = {
  name: 'Pet-parent task',
  args: { task: task({ audience: 'PARENT_TASK', name: 'Send discharge notes' }) },
};

export const Completed: Story = {
  args: { task: task({ status: 'COMPLETED', name: 'Bandage change' }) },
  parameters: {
    docs: { story: 'A completed task: the status chip changes tone and the actions narrow.' },
  },
};

export const ReadOnly: Story = {
  name: 'Read-only (no edit permission)',
  args: { canEditTasks: false },
  parameters: {
    docs: {
      story:
        'Without edit permission the change-status and reschedule actions are gone rather than ' +
        'dimmed, so the footer must not collapse or leave a stray divider.',
    },
  },
};

export const UnassignedTask: Story = {
  name: 'Unassigned (dashes)',
  args: { task: task({ assignedBy: undefined, assignedTo: undefined, category: undefined }) },
  parameters: {
    docs: {
      story:
        'Every value falls back to a dash. This is the case where a one-column collapse is hardest ' +
        'to spot by eye, because the values are short enough to look deliberate.',
    },
  },
};
