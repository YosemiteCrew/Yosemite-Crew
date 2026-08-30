import { useState } from 'react';
import type { ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import type { FormField } from '@/app/features/forms/types/forms';
import BooleanBuilder from './BooleanBuilder';

type BuilderProps = ComponentProps<typeof BooleanBuilder>;
type BooleanFormField = BuilderProps['field'];

/**
 * Controlled wrapper. `BooleanBuilder` holds no state - it renders `field.label`
 * into a controlled `FormInput` and hands the whole rewritten field back up. A
 * story that passed a frozen `field` would render a box that silently refuses
 * every keystroke, so the harness owns the field and still forwards to
 * `args.onChange`, which lets a play function assert the emitted field object.
 */
const Harness = (args: BuilderProps) => {
  const [field, setField] = useState<BooleanFormField>(args.field);
  return (
    <div data-testid="builder-host" className="max-w-[420px]">
      <BooleanBuilder
        field={field}
        onChange={(next) => {
          setField(next as BooleanFormField);
          args.onChange(next);
        }}
      />
    </div>
  );
};

/** A field mid-edit in the builder: it already carries id, type and flags the label edit must not drop. */
const FASTED: FormField & { type: 'boolean' } = {
  id: 'fasted_before_visit',
  type: 'boolean',
  label: 'Fasted before the visit',
  required: true,
  order: 3,
  meta: { templateDefault: true },
};

const meta = {
  title: 'Forms/BooleanBuilder',
  component: BooleanBuilder,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The authoring side of a yes/no field - what the right-hand editor shows when a ' +
          '`boolean` row is selected on the builder canvas.\n\n' +
          '**It is deliberately one control.** Its siblings in `builderComponentMap` offer more: ' +
          '`InputBuilder` adds a Placeholder box, `DropdownBuilder` adds an option list. A ' +
          'checkbox has nowhere to put placeholder text, so the label is the only ' +
          'thing an author can set here, and a second box appearing would be a regression rather ' +
          'than a feature.\n\n' +
          '**It emits the whole field, not the label.** `onChange({ ...field, label })` is what ' +
          'keeps `id`, `type`, `required`, `order` and `meta` attached; spreading is easy to lose ' +
          'in a refactor and the loss is invisible in the editor - it only shows up later as a ' +
          'schema row that no longer validates or no longer matches its saved answers.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    field: FASTED,
    onChange: fn(),
  },
  render: (args) => <Harness {...args} />,
} satisfies Meta<typeof BooleanBuilder>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyLabel: Story = {
  name: 'A field with no label yet',
  args: { field: { id: 'new_boolean', type: 'boolean', label: '' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const label = canvas.getByRole('textbox', { name: 'Label' });
    await expect(label).toHaveValue('');
    /* One control, and only one. A boolean field has no placeholder to set, so
       unlike DateBuilder/InputBuilder this editor must not grow a second box. */
    await expect(canvas.getAllByRole('textbox')).toHaveLength(1);
  },
};

export const PopulatedLabel: Story = {
  name: 'An existing label',
  play: async ({ canvasElement }) => {
    const label = within(canvasElement).getByRole('textbox', { name: 'Label' });
    await expect(label).toHaveValue('Fasted before the visit');
  },
};

export const RenamesTheField: Story = {
  name: 'Renaming keeps the rest of the field',
  play: async ({ args, canvasElement }) => {
    const label = within(canvasElement).getByRole('textbox', { name: 'Label' });
    await userEvent.clear(label);
    await userEvent.type(label, 'Fasted');

    /* The editor hands back a complete field, not a string: id, type and the
       flags the schema depends on all have to survive a rename. Dropping the
       spread would still look correct on screen and only break at save time. */
    await expect(args.onChange).toHaveBeenLastCalledWith({
      id: 'fasted_before_visit',
      type: 'boolean',
      label: 'Fasted',
      required: true,
      order: 3,
      meta: { templateDefault: true },
    });
    // ...and the new label is what the box now shows, so the edit round-trips.
    await expect(label).toHaveValue('Fasted');
  },
};
