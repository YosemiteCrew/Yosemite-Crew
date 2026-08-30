import { useState } from 'react';
import type { ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import type { FormField } from '@/app/features/forms/types/forms';
import DateBuilder from './DateBuilder';

type BuilderProps = ComponentProps<typeof DateBuilder>;
type DateFormField = BuilderProps['field'];

/**
 * Controlled wrapper. `DateBuilder` holds no state - the box is controlled from
 * `field`, and a story that passed a frozen `field` would render an input that
 * silently swallows every keystroke, hiding the wiring these stories exist to
 * check. The harness owns the field and still forwards to `args.onChange`, so a
 * play function can assert the emitted field object.
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

/**
 * A date field mid-edit: it already carries the id, type and flags an edit must not
 * drop, plus a `placeholder` left behind by the box this editor used to offer.
 */
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
          '**One box, not two.** This editor offers a Label and nothing else, the same shape as ' +
          '`BooleanBuilder`. It used to offer a Placeholder underneath, copied from ' +
          '`InputBuilder`, and that box was dead copy: `DateRenderer` never forwards ' +
          '`field.placeholder`, `FormInput` takes no `placeholder` prop, `buildPreviewValues` ' +
          'skips the placeholder fallback for `date` on purpose, and a native ' +
          '`<input type="date">` ignores the attribute regardless. Authors typed a hint that ' +
          'went nowhere. `Only a Label is offered` is the story that keeps it gone.\n\n' +
          '**It emits the whole field, not the edited string.** `onChange({ ...field, label })` ' +
          'is what keeps `id`, `type`, `required`, `order` and `meta` attached. Losing the spread ' +
          'in a refactor is invisible in the editor and only shows up at save time as a schema ' +
          'row that no longer matches its stored answers. The spread is also why dropping the ' +
          'Placeholder box destroyed no data - a `placeholder` already stored on a date field ' +
          'rides through an edit untouched, as `A label edit carries the rest of the field` pins.',
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

    /* One control, and exactly one. It is a plain `text` input even though the
       field is a date - the author is naming the field here, not answering it, so
       a `type="date"` creeping in would trap the label behind a date picker. */
    await expect(boxes).toHaveLength(1);
    await expect(boxes[0]).toHaveAttribute('type', 'text');

    const label = canvas.getByRole('textbox', { name: 'Label' });
    await expect(label).toBe(boxes[0]);
    await expect(label).toHaveValue('');
  },
};

export const OnlyALabelIsOffered: Story = {
  name: 'Only a Label is offered',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('textbox', { name: 'Label' })).toHaveValue('Vaccination due');

    /* No Placeholder box, even though this field carries one. Nothing downstream
       can paint it - the renderer does not forward it, FormInput has no such prop,
       and a date input ignores the attribute - so asking the author for it was a
       promise the runtime never kept. A copy-paste from `InputBuilder` is exactly
       how it would come back, and it would look perfectly correct on screen. */
    await expect(canvas.queryByRole('textbox', { name: 'Placeholder' })).toBeNull();
    await expect(canvas.getAllByRole('textbox')).toHaveLength(1);
  },
};

export const LabelEditCarriesTheField: Story = {
  name: 'A label edit carries the rest of the field',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const label = canvas.getByRole('textbox', { name: 'Label' });

    await userEvent.clear(label);
    await userEvent.type(label, 'Booster due');

    /* The editor hands back a complete field, not a string. `id`, `type` and the
       schema flags all have to survive a rename - and so does the `placeholder`
       stored before the box was removed, which is why dropping that box was a
       change to what is *asked for*, not to what is kept. */
    await expect(args.onChange).toHaveBeenLastCalledWith({
      id: 'vaccination_due',
      type: 'date',
      label: 'Booster due',
      placeholder: 'DD/MM/YYYY',
      required: true,
      order: 2,
      meta: { templateDefault: true },
    });

    await expect(label).toHaveValue('Booster due');
  },
};
