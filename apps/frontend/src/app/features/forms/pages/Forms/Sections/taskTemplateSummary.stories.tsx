import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';

import type { FormField } from '@/app/features/forms/types/forms';
import {
  TASK_CATEGORY_FIELD_OPTIONS,
  TASK_RECURRENCE_FIELD_OPTIONS,
  TASK_REMINDER_FIELD_OPTIONS,
} from '@/app/features/forms/types/forms';
import { TaskTemplateSummary } from './taskTemplateSummary';

type BlockSpec = {
  id: string;
  /** Authored task title. Omit entirely to leave the block without a name field. */
  name?: string;
  /** Title authored as a placeholder only - `taskBlockValue` falls back to it. */
  namePlaceholder?: string;
  /** Older library blocks were authored without `taskBlockKey` on the title field. */
  keyedName?: boolean;
  category?: string;
  recurrence?: string;
  reminder?: string;
  durationDays?: string;
  instructions?: string;
  /** Same content authored under the pre-rename `description` block key. */
  legacyInstructions?: string;
};

/**
 * One task block in the shape the summary reads: every value lives on
 * `defaultValue` (or `placeholder`), and the summary finds each field by its
 * `meta.taskBlockKey` rather than by position. Fields are added only when the
 * spec asks for them, because "the author never filled this in" and "the field
 * is missing from the block" are different branches in the summary.
 */
const taskBlock = (spec: BlockSpec): FormField => {
  const fields: FormField[] = [];

  if (spec.name !== undefined || spec.namePlaceholder !== undefined) {
    fields.push({
      id: `${spec.id}_name`,
      type: 'input',
      label: 'Task title',
      defaultValue: spec.name,
      placeholder: spec.namePlaceholder,
      meta: spec.keyedName === false ? {} : { taskBlockKey: 'name' },
    });
  }
  if (spec.category !== undefined) {
    fields.push({
      id: `${spec.id}_category`,
      type: 'dropdown',
      label: 'Category',
      options: TASK_CATEGORY_FIELD_OPTIONS,
      defaultValue: spec.category,
      meta: { taskBlockKey: 'category' },
    });
  }
  if (spec.recurrence !== undefined) {
    fields.push({
      id: `${spec.id}_recurrence`,
      type: 'dropdown',
      label: 'Repeat',
      options: TASK_RECURRENCE_FIELD_OPTIONS,
      defaultValue: spec.recurrence,
      meta: { taskBlockKey: 'recurrence.type' },
    });
  }
  if (spec.reminder !== undefined) {
    fields.push({
      id: `${spec.id}_reminder`,
      type: 'dropdown',
      label: 'Reminder',
      options: TASK_REMINDER_FIELD_OPTIONS,
      defaultValue: spec.reminder,
      meta: { taskBlockKey: 'reminderOffsetMinutes' },
    });
  }
  if (spec.durationDays !== undefined) {
    fields.push({
      id: `${spec.id}_duration`,
      type: 'number',
      label: 'Duration (days)',
      defaultValue: spec.durationDays,
      meta: { taskBlockKey: 'durationDays' },
    });
  }
  if (spec.instructions !== undefined) {
    fields.push({
      id: `${spec.id}_notes`,
      type: 'textarea',
      label: 'Instructions',
      defaultValue: spec.instructions,
      meta: { taskBlockKey: 'additionalNotes' },
    });
  }
  if (spec.legacyInstructions !== undefined) {
    fields.push({
      id: `${spec.id}_description`,
      type: 'textarea',
      label: 'Instructions',
      defaultValue: spec.legacyInstructions,
      meta: { taskBlockKey: 'description' },
    });
  }

  return { id: spec.id, type: 'group', label: spec.name ?? 'Task', fields };
};

/** The task group wrapper - `meta.taskGroup` is what the summary looks for. */
const taskGroup = (fields: FormField[]): FormField => ({
  id: 'task_blocks',
  type: 'group',
  label: 'Schedule tasks',
  meta: { taskGroup: true },
  fields,
});

const schemaWith = (...blocks: BlockSpec[]): FormField[] => [taskGroup(blocks.map(taskBlock))];

/** Text of the caption line under a task title, whitespace-normalised. */
const metaLine = (item: HTMLElement): string =>
  (item.children[1]?.textContent ?? '').replace(/\s+/g, ' ').trim();

const meta = {
  title: 'Forms/TaskTemplateSummary',
  component: TaskTemplateSummary,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Read-only recap of the task blocks authored in a Task Template, shown on the form ' +
          'detail panel and in the Add Form review step. It reads the block by `meta.taskBlockKey` ' +
          'rather than by field order, so a block authored by an older builder still summarises. ' +
          'Every block collapses to two lines: the title (or `Task N` when the title was never ' +
          'keyed) and a middot-joined caption of category, repeat, reminder and duration, with ' +
          'the last two dropped when the author left them empty.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    schema: schemaWith({
      id: 'task-vitals',
      name: 'Record vitals',
      category: 'CARE',
      recurrence: 'EVERY_6_HOURS',
      reminder: '15',
      durationDays: '5',
    }),
  },
} satisfies Meta<typeof TaskTemplateSummary>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Every segment filled',
  args: {
    schema: schemaWith(
      {
        id: 'task-vitals',
        name: 'Record vitals',
        category: 'CARE',
        recurrence: 'EVERY_6_HOURS',
        reminder: '15',
        durationDays: '5',
      },
      {
        id: 'task-analgesia',
        name: 'Administer analgesia',
        category: 'MEDICATION',
        recurrence: 'DAILY',
        reminder: 'NONE',
        durationDays: '3',
      }
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const items = canvas.getAllByRole('listitem');
    // A list, not a stack of divs: the block count is announced, not counted by eye.
    await expect(items).toHaveLength(2);

    /* Raw enum values are what the schema stores; the caption must show the option
       LABELS in category-repeat-reminder-duration order. A regression here reads as
       "CARE · EVERY_6_HOURS" on a screen a vet nurse is meant to skim. */
    await expect(metaLine(items[0])).toBe('Care · Every 6 hours · 15 minutes before · 5 days');
    await expect(canvas.queryByText(/EVERY_6_HOURS/)).toBeNull();

    /* "No reminder" is a real option value, not an absent one, so it is printed
       rather than skipped - the author sees the choice they made. */
    await expect(metaLine(items[1])).toBe('Medication · Daily · No reminder · 3 days');
  },
};

export const Empty: Story = {
  name: 'Nothing authored yet',
  args: {
    schema: [
      /* A decoy: a group that is NOT the task group, holding a child group. If the
         summary ever picks the first group in the schema instead of the one flagged
         `meta.taskGroup`, these consent fields render as phantom tasks. */
      {
        id: 'consent',
        type: 'group',
        label: 'Consent',
        fields: [taskBlock({ id: 'decoy', name: 'Owner acknowledgement', category: 'ADMIN' })],
      },
      // The shape a fresh Task Template ships with: the group exists, empty.
      taskGroup([]),
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('No tasks added yet.')).toBeInTheDocument();
    // No empty <ul> left behind - a list announcing "0 items" is worse than prose.
    await expect(canvas.queryByRole('list')).toBeNull();
    await expect(canvas.queryByText('Owner acknowledgement')).toBeNull();
  },
};

export const MinimalBlock: Story = {
  name: 'Name and category only',
  args: { schema: schemaWith({ id: 'task-walk', name: 'Walk outside', category: 'CARE' }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const [item] = canvas.getAllByRole('listitem');

    /* Reminder and duration are dropped when unset, but the category/repeat pair is
       joined unconditionally - so a block with no repeat field at all ends on a
       dangling middot. Pinned deliberately: this is the current rendering, and the
       assertion is what will catch it changing (see the notes on this story). */
    await expect(metaLine(item)).toBe('Care ·');
    await expect(canvas.queryByText(/day/)).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A block the author only half-filled. The trailing middot is what the component ' +
          'currently renders: the category and repeat segments are joined before either is known ' +
          'to exist, while the reminder and duration segments are guarded.',
      },
    },
  },
};

export const DurationWording: Story = {
  name: 'One day is singular',
  args: {
    schema: schemaWith(
      {
        id: 'task-fast',
        name: 'Withhold food',
        category: 'DIET',
        recurrence: 'ONCE',
        durationDays: '1',
      },
      {
        id: 'task-abx',
        name: 'Oral antibiotics',
        category: 'MEDICATION',
        recurrence: 'EVERY_12_HOURS',
        durationDays: '7',
      }
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const items = canvas.getAllByRole('listitem');
    // The pluralisation is a string compare against '1', so it breaks the moment the
    // duration arrives as a number instead of the authored string.
    await expect(metaLine(items[0])).toBe('Diet · Does not repeat · 1 day');
    await expect(metaLine(items[1])).toBe('Medication · Every 12 hours · 7 days');
    await expect(canvas.queryByText(/1 days/)).toBeNull();
  },
};

export const Instructions: Story = {
  name: 'Instructions, including the legacy key',
  args: {
    schema: schemaWith(
      {
        id: 'task-vitals',
        name: 'Record vitals',
        category: 'CARE',
        recurrence: 'EVERY_6_HOURS',
        instructions: 'Temperature, pulse and respiration. Log in the inpatient chart.',
      },
      {
        id: 'task-old',
        name: 'Turn patient',
        category: 'CARE',
        recurrence: 'EVERY_2_HOURS',
        legacyInstructions: 'Alternate sides. Check the bedding is dry each time.',
      }
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const items = canvas.getAllByRole('listitem');

    // Instructions are a third line, not appended to the caption - otherwise a long
    // note swallows the schedule the caption exists to show.
    await expect(items[0].childElementCount).toBe(3);
    await expect(items[0].children[2]).toHaveTextContent(
      'Temperature, pulse and respiration. Log in the inpatient chart.'
    );

    /* Blocks authored before the rename stored the note under `description`; the
       helper falls back to it, so those templates do not silently lose their notes. */
    await expect(items[1].childElementCount).toBe(3);
    await expect(items[1].children[2]).toHaveTextContent('Alternate sides.');

    /* EVERY_2_HOURS is not in the repeat option list, so the raw value is echoed
       rather than blanked - a template pointing at a retired option still reads. */
    await expect(metaLine(items[1])).toBe('Care · EVERY_2_HOURS');
  },
};

export const UnnamedBlocks: Story = {
  name: 'Falls back to Task N',
  args: {
    schema: [
      taskGroup([
        // No title field at all.
        taskBlock({ id: 'block-a', category: 'PROCEDURE', recurrence: 'ONCE' }),
        /* Not a group: a stray field parked in the task group must not be summarised,
           and must not consume a number - "Task 3" for the second visible block would
           tell the author they had lost one. */
        {
          id: 'stray_note',
          type: 'input',
          label: 'Internal note',
          defaultValue: 'Not a task block',
        },
        // Title authored by an older builder, without `taskBlockKey`.
        taskBlock({
          id: 'block-b',
          name: 'Hidden from the summary',
          keyedName: false,
          category: 'DIAGNOSTIC',
          recurrence: 'DAILY',
        }),
        // Title left as a placeholder - still a better label than "Task 3".
        taskBlock({
          id: 'block-c',
          namePlaceholder: 'Check surgical site',
          category: 'CARE',
          recurrence: 'DAILY',
        }),
      ]),
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const items = canvas.getAllByRole('listitem');
    await expect(items).toHaveLength(3);

    await expect(items[0].children[0]).toHaveTextContent('Task 1');
    // Numbering counts task blocks, not schema children: the stray input sits between
    // these two and must not push this one to "Task 3".
    await expect(items[1].children[0]).toHaveTextContent('Task 2');
    await expect(items[2].children[0]).toHaveTextContent('Check surgical site');

    // An unkeyed title is unreadable to the summary, so it must not leak either.
    await expect(canvas.queryByText('Hidden from the summary')).toBeNull();
    await expect(canvas.queryByText('Not a task block')).toBeNull();
  },
};

export const Phone: Story = {
  name: 'Phone - long instructions',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  args: {
    schema: schemaWith({
      id: 'task-discharge',
      name: 'Discharge instructions call',
      category: 'COMMUNICATION',
      recurrence: 'DAILY',
      reminder: '1440',
      durationDays: '14',
      instructions:
        'Call the pet parent every morning for the first fortnight, confirm the wound is dry ' +
        'and that the collar is still on, and record the answers against the discharge note ' +
        'before the end of the shift.',
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const [item] = canvas.getAllByRole('listitem');
    /* The caption and the instructions are both long, unclamped text at 375px. If
       either ever picks up a nowrap, the card scrolls sideways inside a panel that
       has no horizontal scrollbar and the tail is simply unreachable. */
    await expect(item.scrollWidth).toBeLessThanOrEqual(item.clientWidth);
    await expect(metaLine(item)).toBe('Communication · Daily · 1 day before · 14 days');
  },
};
