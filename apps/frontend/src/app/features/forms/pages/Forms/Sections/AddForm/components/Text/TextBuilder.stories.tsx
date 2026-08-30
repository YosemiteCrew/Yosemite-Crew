import { useState } from 'react';
import type { ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import type { FormField } from '@/app/features/forms/types/forms';
import TextBuilder from './TextBuilder';

type TextareaField = FormField & { type: 'textarea' };

/** An author-owned row: both the label and the placeholder are theirs to edit. */
const PLAIN_FIELD: TextareaField = {
  id: 'history',
  type: 'textarea',
  label: 'History',
  placeholder: 'Free text, up to a paragraph',
};

/**
 * Copied from `defaultTaskBlockFields` in Build.tsx, meta and all. The caption
 * and placeholder belong to the TaskBlockCard, not to the author, which is
 * exactly why this field must not offer a Label input.
 */
const TASK_BLOCK_FIELD: TextareaField = {
  id: 'task_1_additionalNotes',
  type: 'textarea',
  label: 'Instructions (optional)',
  placeholder: 'Add default instructions for this task',
  meta: { taskBlockKey: 'additionalNotes' },
};

/** The shape `canonicalFieldToFormField` produces: `meta.templateDefault` only. */
const CANONICAL_FIELD: TextareaField = {
  id: 'subjective',
  type: 'textarea',
  label: 'Subjective',
  defaultValue: 'Owner reports reduced appetite since Friday.',
  meta: { templateDefault: true },
};

/** A prescription row generated from an inventory item, which arrives unlabelled. */
const INVENTORY_FIELD: TextareaField = {
  id: 'med_1_directions',
  type: 'textarea',
  label: '',
  meta: { inventoryItemId: 'inv-amoxicillin-250' },
};

/**
 * `TextBuilder` is fully controlled: it renders `field.label` / `field.placeholder`
 * straight out of the prop and reports the whole field back. Handed a frozen prop
 * it would refuse every keystroke, so the harness holds the field and still
 * forwards to `args.onChange` - a play function can then assert the emitted field
 * after typing a real string rather than one character at a time.
 */
const Harness = (args: ComponentProps<typeof TextBuilder>) => {
  const [field, setField] = useState<TextareaField>(args.field);
  return (
    <div className="w-full max-w-[470px]">
      <TextBuilder
        {...args}
        field={field}
        onChange={(next) => {
          setField(next as TextareaField);
          args.onChange(next);
        }}
      />
    </div>
  );
};

const meta = {
  title: 'Forms/TextBuilder',
  component: TextBuilder,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The settings row for a `textarea` field in the form builder. It is two editors sharing ' +
          'one component, and which one you get is decided entirely by `field.meta`.\n\n' +
          '`isTemplateValueField` is true when ANY of `meta.inventoryItemId`, `meta.taskBlockKey` ' +
          'or `meta.templateDefault` is set - three separate producers (the prescription builder, ' +
          'the task block card, and `canonicalFieldToFormField` for SOAP/Vitals/Discharge). Each ' +
          'clause has its own story below, because they are ORed together and losing one would ' +
          'only break that one producer.\n\n' +
          '**The branch decides which key the edit writes to, and that is the part that breaks ' +
          'silently.** The plain branch writes `label` and `placeholder`; the template branch ' +
          'writes `defaultValue`, which is what the workspace prefills from and what ' +
          '`taskTemplateSummary` reads back. A template field routed through the wrong branch ' +
          'would look fine in the builder, save without complaint, and quietly prefill nothing.\n\n' +
          'The template branch also drops the Label input entirely: a canonical field is named by ' +
          'the template, and a task block key is the contract `lib/forms.ts` serialises against. ' +
          'It prints the name as static text instead, falling back to "Field" when the producer ' +
          'supplied no label at all.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    field: PLAIN_FIELD,
    onChange: fn(),
  },
  render: (args) => <Harness {...args} />,
} satisfies Meta<typeof TextBuilder>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Plain field: label and placeholder',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const label = canvas.getByRole('textbox', { name: 'Label' });
    const placeholder = canvas.getByRole('textbox', { name: 'Placeholder' });

    await expect(label).toHaveValue('History');
    await expect(placeholder).toHaveValue('Free text, up to a paragraph');

    /* The template branch must be unreachable from here. Nothing in this row
       prefills a workspace, so offering a default value would author a key the
       plain path never reads back. */
    await expect(
      canvas.queryByRole('textbox', { name: 'Default value (prefilled in workspace)' })
    ).toBeNull();

    /* FormDesc floors itself at 72px and grows with `rows`; the builder pins both
       ends to 120 with `!`. The row is therefore the same height whether the
       placeholder is one word or twenty. If either override stops winning, the
       settings panel starts reflowing under the author as they type. */
    await expect(Math.round(placeholder.getBoundingClientRect().height)).toBe(120);

    await userEvent.type(placeholder, '!');
    await expect(args.onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        label: 'History',
        placeholder: 'Free text, up to a paragraph!',
      })
    );
    // The whole field goes back, not a patch - and nothing invented `defaultValue`
    // on a field the runtime would never read it from.
    await expect(args.onChange).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ defaultValue: expect.anything() })
    );
  },
};

export const TaskBlockField: Story = {
  name: 'Task block field: the caption is fixed',
  args: { field: TASK_BLOCK_FIELD },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    // Static text, not an input. Renaming a task block caption here would not
    // rename anything downstream - `taskBlockKey` is what the serialiser matches.
    await expect(canvas.getByText('Instructions (optional)').tagName).toBe('DIV');
    await expect(canvas.queryByRole('textbox', { name: 'Label' })).toBeNull();

    const controls = canvas.getAllByRole('textbox');
    await expect(controls).toHaveLength(1);
    await expect(controls[0]).toHaveAccessibleName('Default value (prefilled in workspace)');

    await userEvent.type(controls[0], 'Weigh before dosing');
    /* The edit lands on `defaultValue`. The authored `placeholder` is carried
       through untouched: the two are different keys with different readers, and
       writing the answer into `placeholder` is precisely the silent failure this
       branch exists to prevent. */
    await expect(args.onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        defaultValue: 'Weigh before dosing',
        placeholder: 'Add default instructions for this task',
        label: 'Instructions (optional)',
      })
    );
  },
};

export const CanonicalTemplateField: Story = {
  name: 'Canonical field: the default value is prefilled',
  args: { field: CANONICAL_FIELD },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // `meta.templateDefault` alone takes the template branch - no inventory item,
    // no task block key. This is the SOAP / Vitals / Discharge path.
    const control = canvas.getByRole('textbox', {
      name: 'Default value (prefilled in workspace)',
    });
    await expect(control).toHaveValue('Owner reports reduced appetite since Friday.');
    await expect(canvas.queryByRole('textbox', { name: 'Label' })).toBeNull();
    await expect(canvas.getByText('Subjective')).toBeInTheDocument();

    // Same pinned box as the plain branch: a long default does not stretch the row.
    await expect(Math.round(control.getBoundingClientRect().height)).toBe(120);
  },
};

export const InventoryFieldWithoutALabel: Story = {
  name: 'Inventory field with no label',
  args: { field: INVENTORY_FIELD },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* `meta.inventoryItemId` is the third clause of the OR, and the one whose
       producer does not always supply a label. The heading is the only thing
       naming this row, so an empty label falls back to "Field" rather than
       rendering an unlabelled gap above the editor. */
    await expect(canvas.getByText('Field')).toBeInTheDocument();
    await expect(canvas.queryByRole('textbox', { name: 'Label' })).toBeNull();
    await expect(
      canvas.getByRole('textbox', { name: 'Default value (prefilled in workspace)' })
    ).toHaveValue('');
  },
};

export const Phone: Story = {
  name: 'Phone: the two editors stay stacked',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const label = canvas.getByRole('textbox', { name: 'Label' });
    const placeholder = canvas.getByRole('textbox', { name: 'Placeholder' });

    /* The builder next door pairs its Repeat / Reminder controls with
       `sm:grid-cols-2`, a viewport media query inside container-sized panes. The
       same mistake here would put a 44px input beside a 120px textarea at 375px.
       Assert the relation, not the classes: the label sits fully above the
       placeholder. */
    await expect(label.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      placeholder.getBoundingClientRect().top
    );
    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );
  },
};
