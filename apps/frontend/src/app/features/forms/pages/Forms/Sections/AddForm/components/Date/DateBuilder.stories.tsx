import { useState } from 'react';
import type { ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import type { FormField } from '@/app/features/forms/types/forms';
import DateBuilder from './DateBuilder';

type BuilderProps = ComponentProps<typeof DateBuilder>;
type DateFormField = BuilderProps['field'];

/**
 * Controlled wrapper. `DateBuilder` holds no state - both boxes are controlled
 * from `field`, and a story that passed a frozen `field` would render two inputs
 * that silently swallow every keystroke, hiding the wiring these stories exist
 * to check. The harness owns the field and still forwards to `args.onChange`, so
 * a play function can assert the emitted field object.
 */
const Harness = (args: BuilderProps) => {
  const [field, setField] = useState<DateFormField>(args.field);
  return (
    <div data-testid="builder-host" className="max-w-[420px]">
      <DateBuilder
        field={field}
        onChange={(next) => {
          setField(next as DateFormField);
          args.onChange(next);
        }}
      />
    </div>
  );
};

/** A date field mid-edit: it already carries the id, type and flags an edit must not drop. */
const VACCINATION_DUE: FormField & { type: 'date' } = {
  id: 'vaccination_due',
  type: 'date',
  label: 'Vaccination due',
  placeholder: 'DD/MM/YYYY',
  required: true,
  order: 2,
  meta: { templateDefault: true },
};

const meta = {
  title: 'Forms/DateBuilder',
  component: DateBuilder,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The authoring side of a date field - the `date` entry in `builderComponentMap`, drawn ' +
          'in the right-hand editor when a date row is selected on the builder canvas.\n\n' +
          '**Two boxes, not one.** `BooleanBuilder` deliberately offers only a Label; this editor ' +
          'adds a Placeholder, the same shape as `InputBuilder`. The two controls look identical ' +
          'and sit one above the other, so a copy-paste that pointed both at `label` would look ' +
          'perfectly correct on screen and only surface later as an author who cannot set a ' +
          'placeholder. `Each box writes its own key` is the story that catches that.\n\n' +
          '**It emits the whole field, not the edited string.** `onChange({ ...field, label })` ' +
          'is what keeps `id`, `type`, `required`, `order` and `meta` attached. Losing the spread ' +
          'in a refactor is invisible in the editor and only shows up at save time as a schema ' +
          'row that no longer matches its stored answers.\n\n' +
          '**The Placeholder it collects is currently dead copy.** `DateRenderer` never forwards ' +
          '`field.placeholder`, and `FormInput` takes no `placeholder` prop at all, so whatever ' +
          'an author types here never reaches the runtime control. See the `Empty, awaiting a ' +
          'date` story on `DateRenderer`, which pins that.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    field: VACCINATION_DUE,
    onChange: fn(),
  },
  render: (args) => <Harness {...args} />,
} satisfies Meta<typeof DateBuilder>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  name: 'A field with nothing set yet',
  args: { field: { id: 'new_date', type: 'date', label: '' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const boxes = canvas.getAllByRole('textbox');

    /* Two controls, and exactly two. Both are plain `text` inputs even though the
       field is a date - the author is naming the field here, not answering it, so
       a `type="date"` creeping in would trap the label behind a date picker. */
    await expect(boxes).toHaveLength(2);
    for (const box of boxes) await expect(box).toHaveAttribute('type', 'text');

    const label = canvas.getByRole('textbox', { name: 'Label' });
    const placeholder = canvas.getByRole('textbox', { name: 'Placeholder' });
    /* Distinct elements with distinct accessible names. FormInput derives both the
       visible <label for> and the aria-label from `inlabel`, so if the two boxes
       were given the same `inlabel` these queries would collapse onto one node. */
    await expect(label).not.toBe(placeholder);
    await expect(label).toHaveValue('');
    await expect(placeholder).toHaveValue('');
  },
};

export const Populated: Story = {
  name: 'An existing label and placeholder',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('textbox', { name: 'Label' })).toHaveValue('Vaccination due');
    await expect(canvas.getByRole('textbox', { name: 'Placeholder' })).toHaveValue('DD/MM/YYYY');
  },
};

export const EachBoxWritesItsOwnKey: Story = {
  name: 'Each box writes its own key',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const label = canvas.getByRole('textbox', { name: 'Label' });
    const placeholder = canvas.getByRole('textbox', { name: 'Placeholder' });

    await userEvent.clear(label);
    await userEvent.type(label, 'Booster due');

    /* The editor hands back a complete field, not a string. `id`, `type` and the
       schema flags all have to survive a rename, and the placeholder the author
       set earlier must not be clobbered by an edit to the box above it. */
    await expect(args.onChange).toHaveBeenLastCalledWith({
      id: 'vaccination_due',
      type: 'date',
      label: 'Booster due',
      placeholder: 'DD/MM/YYYY',
      required: true,
      order: 2,
      meta: { templateDefault: true },
    });

    await userEvent.clear(placeholder);
    await userEvent.type(placeholder, 'YYYY-MM-DD');

    /* ...and the mirror image: the lower box writes `placeholder` and leaves the
       label just typed alone. Both handlers spread the same `field` and differ by
       one key, which is exactly the pair a copy-paste gets wrong. */
    await expect(args.onChange).toHaveBeenLastCalledWith({
      id: 'vaccination_due',
      type: 'date',
      label: 'Booster due',
      placeholder: 'YYYY-MM-DD',
      required: true,
      order: 2,
      meta: { templateDefault: true },
    });

    // Both edits round-trip back into the boxes rather than one overwriting the other.
    await expect(label).toHaveValue('Booster due');
    await expect(placeholder).toHaveValue('YYYY-MM-DD');
  },
};
