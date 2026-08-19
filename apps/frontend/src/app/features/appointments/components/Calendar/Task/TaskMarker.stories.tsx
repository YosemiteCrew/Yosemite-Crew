import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import type { Task } from '@/app/features/tasks/types/task';
import { TaskMarker } from './TaskMarker';

const task = (over: Partial<Task> = {}): Task =>
  ({
    _id: 'task-1',
    name: 'Recheck sutures',
    status: 'PENDING',
    audience: 'EMPLOYEE_TASK',
    dueAt: new Date(2026, 7, 17, 9, 30),
    ...over,
  }) as unknown as Task;

/** One hour of grid, so the chip has somewhere to sit. */
const Hour = (Story: React.ComponentType) => (
  <div className="relative w-[240px]" style={{ height: 180, backgroundColor: 'var(--neutral-0)' }}>
    <Story />
  </div>
);

const meta = {
  title: 'Appointments/Calendar/TaskMarker',
  component: TaskMarker,
  decorators: [Hour],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The task chip, and the last piece of the Tasks calendar that did not match the ' +
          'appointment block sitting beside it.\n\n' +
          'It was a 16px radius with a drop shadow, a plain 1px border all round and a 14px ' +
          'title, where the appointment block is a **flat** 12px card over a 1px status outline ' +
          'thickened to a **3px spine** on its leading edge, titled at 12.5px/700. Two objects ' +
          'that mean the same thing, drawn as different things. The radius was also set in two ' +
          'competing places - a `!` utility class and an inline style - so changing either one ' +
          'alone did nothing.\n\n' +
          'It now follows `common/ZoomInMarker.tsx`: 12px flat, the status spine, the 12.5px/700 ' +
          'title and the 11px/400 subtitle. Two things are deliberately kept: the pink glow and ' +
          'dot on a pet-parent task, which is a semantic signal rather than chrome, and the pill ' +
          'shape when zoomed out.\n\n' +
          'The chips are draggable and showed a plain arrow cursor, so they did not read as ' +
          'movable at all. They take `cursor-grab` now, as the appointment blocks already did.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    task: task(),
    layout: { top: 12, laneIndex: 0, laneCount: 1 },
    height: 180,
    isZoomOutMode: false,
    isActive: false,
    popoverId: 'task-popover',
    canDrag: true,
    onView: fn(),
    onOpenPopover: fn(),
    onFocusPopover: fn(),
    onClosePopover: fn(),
    onDragStart: fn(),
    onDragEnd: fn(),
  },
} satisfies Meta<typeof TaskMarker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Pending: Story = {};

export const InProgress: Story = {
  args: { task: task({ name: 'Post-op check', status: 'IN_PROGRESS' }) },
};

export const Completed: Story = {
  args: { task: task({ name: 'Bandage change', status: 'COMPLETED' }) },
  parameters: {
    docs: { story: 'A completed task strikes its title through.' },
  },
};

export const ParentTask: Story = {
  name: 'Pet-parent task',
  args: { task: task({ name: 'Send discharge notes', audience: 'PARENT_TASK' }) },
  parameters: {
    docs: {
      story:
        'The one chip that keeps a shadow. The pink glow and leading dot mark a task owned by ' +
        'the pet parent rather than the practice, which is meaning, not decoration.',
    },
  },
};

export const SideBySide: Story = {
  name: 'Two lanes',
  args: { layout: { top: 12, laneIndex: 0, laneCount: 2 } },
  parameters: {
    docs: {
      story:
        'With more than one task in an hour the chips go compact: tighter padding and centred ' +
        'text. This is where the old 14px title ran out of room first.',
    },
  },
};

export const ZoomedOut: Story = {
  name: 'Zoomed out (lozenge)',
  args: { isZoomOutMode: true },
  parameters: {
    docs: {
      story:
        'At the zoomed-out density the chip is a bare pill with no label, so it keeps its full ' +
        'radius and takes no spine.',
    },
  },
};

export const NotDraggable: Story = {
  name: 'Read-only (no drag)',
  args: { canDrag: false },
};
