import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import TaskCard from './index';
import type { Task } from '@/app/features/tasks/types/task';

const BASE_TASK: Task = {
  _id: 'task-1',
  organisationId: 'org-1',
  assignedBy: 'Dr. Amelie Roth',
  assignedTo: 'Nurse Jonas Weber',
  audience: 'EMPLOYEE_TASK',
  source: 'CUSTOM',
  category: 'Medication',
  name: 'Administer post-op analgesia',
  description: 'Give 0.2 mg/kg meloxicam SC, then check the incision site.',
  dueAt: new Date('2026-09-14T09:30:00.000Z'),
  status: 'PENDING',
};

const meta = {
  title: 'Cards/TaskCard',
  component: TaskCard,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Card form of a task on the tasks board: name and status pill on top, the quick details ' +
          '(category, instructions), the from/to/due lines, then the round action chips. Which ' +
          'chips appear is derived from the task status and `canEditTasks` — a completed task ' +
          'cannot be rescheduled, so it only offers View.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    canEditTasks: { control: 'boolean' },
  },
  args: {
    item: BASE_TASK,
    canEditTasks: false,
    handleViewTask: fn(),
    handleChangeStatusTask: fn(),
    handleRescheduleTask: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 360 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TaskCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ReadOnly: Story = {
  name: 'Read-only (View only)',
  parameters: {
    docs: {
      description: {
        story:
          'Without `canEditTasks` the card exposes a single action. This is what a member without ' +
          'the task-edit permission sees.',
      },
    },
  },
};

export const Editable: Story = {
  name: 'Editable, pending',
  args: { canEditTasks: true },
  parameters: {
    docs: {
      description: {
        story:
          'A pending task can move status and be rescheduled, so all three chips render and wrap ' +
          'inside the 184px action row.',
      },
    },
  },
};

export const Completed: Story = {
  name: 'Completed',
  args: {
    canEditTasks: true,
    item: {
      ...BASE_TASK,
      _id: 'task-2',
      name: 'Confirm discharge paperwork',
      category: 'Admin',
      description: 'Owner signed the consent form at reception.',
      status: 'COMPLETED',
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'A completed task has no onward transitions and cannot be rescheduled, so both edit ' +
          'chips drop out even with `canEditTasks` on — the pill turns `success`.',
      },
    },
  },
};

export const LongContent: Story = {
  name: 'Long text (clamped)',
  args: {
    canEditTasks: true,
    item: {
      ...BASE_TASK,
      _id: 'task-3',
      name: 'Recheck the surgical site and confirm the drain is patent before the evening round',
      category: 'Post-operative monitoring and wound care',
      description:
        'Palpate around the drain, record any discharge in the chart, flush with sterile saline if the line is sluggish, and page the duty surgeon if the swelling has increased since this morning.',
      status: 'IN_PROGRESS',
    },
    assignedByLabel: 'Dr. Amelie Roth-Bergmann (Head of Surgery)',
    assignedToLabel: 'Nurse Jonas Weber-Lindqvist',
  },
  parameters: {
    docs: {
      description: {
        story:
          'The overflow case. Detail values are `line-clamp-1`, but the title, from and to lines ' +
          'are not — this story is the guard against a long name pushing the status pill off the ' +
          'card.',
      },
    },
  },
};
