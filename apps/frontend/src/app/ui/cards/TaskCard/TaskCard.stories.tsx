import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
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

/** GlassTooltip binds mouseenter/focusin to its own wrapper span, not the button. */
const wrapperFor = (canvasElement: HTMLElement, accessibleName: string) =>
  within(canvasElement)
    .getByRole('button', { name: accessibleName })
    .closest('.glass-tooltip') as HTMLElement;

/** Hovers an action chip's tooltip wrapper and returns the portalled bubble. */
const hoverChip = async (canvasElement: HTMLElement, accessibleName: string) => {
  await userEvent.hover(wrapperFor(canvasElement, accessibleName));
  return within(document.body).findByRole('tooltip');
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
          'cannot be rescheduled, so it only offers View.\n\n' +
          'The action rail carries three `GlassTooltip` bubbles, and none of them had ever been ' +
          'rendered. Each is built on `mouseenter`/`focusin` and then `createPortal`ed to ' +
          '`document.body`, so it is not a descendant of this card in the DOM and no resting ' +
          'snapshot - here or in Chromatic - contains a single one of them. They are also the only ' +
          'place the chips are named in words: the glyphs are an eye, a sync arrow and a calendar, ' +
          'and the labels ("View task", "Change status", "Reschedule") live nowhere on screen until ' +
          'a pointer lands on the chip.\n\n' +
          'They are `side="bottom"` bubbles, which matters on a board: the cards are 50% wide and ' +
          'stack, so a bubble that opened upwards would cover the card above rather than the empty ' +
          'space below. The hover stories assert the opened bubble has its text and its bottom ' +
          'placement, not merely that a hover happened - a bubble that mounted empty would satisfy ' +
          'the weaker check.',
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

export const ActionTooltips: Story = {
  name: 'Action tooltips (all three)',
  args: { canEditTasks: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // A pending, editable task is the only state where all three chips exist.
    await expect(canvas.getAllByRole('button')).toHaveLength(3);

    const expectations: Array<[string, string]> = [
      ['View task Administer post-op analgesia', 'View task'],
      ['Change status for Administer post-op analgesia', 'Change status'],
      ['Reschedule Administer post-op analgesia', 'Reschedule'],
    ];

    for (const [accessibleName, label] of expectations) {
      const wrapper = wrapperFor(canvasElement, accessibleName);
      await userEvent.hover(wrapper);
      const bubble = await within(document.body).findByRole('tooltip');
      await expect(bubble).toHaveTextContent(label);
      /* side="bottom" - the bubble hangs under the chip so it cannot cover the
         card stacked above this one on the board. Read the INLINE transform: a
         laid-out element resolves any transform to a `matrix(...)`, so a
         computed-style check cannot tell the two placements apart. */
      await expect(bubble.style.transform).toMatch(/^translate\(-50%, 0(px)?\)$/);
      // Exactly one live portal at a time - two would stack on document.body.
      await expect(within(document.body).getAllByRole('tooltip')).toHaveLength(1);

      /* Unhover explicitly. `userEvent.hover` from the direct API starts from a
         fresh pointer position each call, so it never emits the `mouseleave`
         that closes the previous bubble - without this the portals accumulate. */
      await userEvent.unhover(wrapper);
      await waitFor(async () => {
        await expect(within(document.body).queryByRole('tooltip')).toBeNull();
      });
    }
  },
  parameters: {
    docs: {
      description: {
        story:
          'Every label on the rail, opened and dismissed in turn. The chip `aria-label`s carry the ' +
          'task name ("Reschedule Administer post-op analgesia") while the bubbles carry the bare ' +
          'verb, so the visible wording cannot be read off the resting markup at all. Each bubble ' +
          'must also be gone before the next opens - they are absolutely positioned siblings on ' +
          '`document.body` and would otherwise overlap rather than replace each other.',
      },
    },
  },
};

export const ReadOnlyTooltip: Story = {
  name: 'Read-only tooltip',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Without canEditTasks the rail is one chip, so this bubble is the only
    // wording a member without permission ever sees.
    await expect(canvas.getAllByRole('button')).toHaveLength(1);

    const bubble = await hoverChip(canvasElement, 'View task Administer post-op analgesia');
    await expect(bubble).toHaveTextContent('View task');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The single-chip rail with its bubble open. Worth its own story because the lone eye ' +
          'glyph is otherwise unlabelled on screen, and this is the state most members of a ' +
          'practice actually see.',
      },
    },
  },
};

export const CompletedTooltip: Story = {
  name: 'Completed task tooltip',
  args: {
    canEditTasks: true,
    item: {
      ...BASE_TASK,
      _id: 'task-4',
      name: 'Confirm discharge paperwork',
      status: 'COMPLETED',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Terminal status drops both edit chips even with the permission on.
    await expect(canvas.getAllByRole('button')).toHaveLength(1);
    await expect(canvas.queryByRole('button', { name: /^Change status/ })).toBeNull();

    const bubble = await hoverChip(canvasElement, 'View task Confirm discharge paperwork');
    await expect(bubble).toHaveTextContent('View task');
  },
  parameters: {
    docs: {
      description: {
        story:
          'A completed task with full permission. The rail collapses to the same single chip as the ' +
          'read-only case, which is the check that `canShowTaskStatusChangeAction` and ' +
          '`canRescheduleTask` both refuse a terminal status rather than only one of them doing so.',
      },
    },
  },
};
