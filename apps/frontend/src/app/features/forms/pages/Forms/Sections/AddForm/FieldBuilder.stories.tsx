import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import type { FormField } from '@/app/features/forms/types/forms';
import { FieldBuilder } from './Build';

/**
 * One canvas row from the form builder: the field's own editable content (an
 * input/checkbox/date/etc, chosen by `field.type`) wrapped in the shared
 * BuilderWrapper chrome (drag handle, reorder arrows, delete). `Build.stories.tsx`
 * in this same directory exercises the full three-pane builder through a real
 * `<Build>`, which renders many of these at once; this file isolates a single
 * row so its own props (drag state, move-up/down availability, deletability)
 * can be reviewed independently.
 */
const fieldBuilderMeta = {
  title: 'Forms/AddForm/FieldBuilder',
  component: FieldBuilder,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
  argTypes: {
    canMoveUp: { control: 'boolean' },
    canMoveDown: { control: 'boolean' },
    draggable: { control: 'boolean' },
    isDragging: { control: 'boolean' },
    contentDeletable: { control: 'boolean' },
  },
  args: {
    field: {
      id: 'presenting_complaint',
      type: 'input',
      label: 'Presenting complaint',
      placeholder: 'Limping on the left hind',
    } satisfies FormField,
    onChange: fn(),
    onDelete: fn(),
    onMoveUp: fn(),
    onMoveDown: fn(),
    canMoveUp: true,
    canMoveDown: true,
    createField: (t: string) => ({ id: `${t}-new`, type: t, label: '' }) as FormField,
    draggable: true,
  },
} satisfies Meta<typeof FieldBuilder>;

export default fieldBuilderMeta;
type FieldBuilderStory = StoryObj<typeof fieldBuilderMeta>;

export const TextInput: FieldBuilderStory = {};

export const Checkbox: FieldBuilderStory = {
  args: {
    field: {
      id: 'observed_signs',
      type: 'checkbox',
      label: 'Observed signs',
      multiple: true,
      options: [
        { label: 'Lameness', value: 'lameness' },
        { label: 'Swelling', value: 'swelling' },
      ],
    } satisfies FormField,
  },
};

export const Signature: FieldBuilderStory = {
  args: {
    field: {
      id: 'owner_signature',
      type: 'signature',
      label: 'Owner signature',
    } satisfies FormField,
  },
};

/** The top row of a group: no move-up target above it. */
export const FirstRow: FieldBuilderStory = {
  name: 'First row (cannot move up)',
  args: { canMoveUp: false },
};

/** The bottom row: no move-down target below it. */
export const LastRow: FieldBuilderStory = {
  name: 'Last row (cannot move down)',
  args: { canMoveDown: false },
};

export const NotDeletable: FieldBuilderStory = {
  name: 'Content not deletable',
  args: { contentDeletable: false },
};

export const EditLabel: FieldBuilderStory = {
  name: 'Editing the label calls onChange',
  render: function EditLabelStory(args) {
    const [field, setField] = useState(args.field);
    return (
      <FieldBuilder
        {...args}
        field={field}
        onChange={(next) => {
          setField(next);
          args.onChange(next);
        }}
      />
    );
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const label = canvas.getByDisplayValue('Presenting complaint');
    await userEvent.clear(label);
    await userEvent.type(label, 'Chief complaint');
    await expect(args.onChange).toHaveBeenCalled();
  },
};
