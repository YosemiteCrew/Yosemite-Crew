import { useState } from 'react';
import type { ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import type { FormField } from '@/app/features/forms/types/forms';
import SignatureBuilder from './SignatureBuilder';

type BuilderProps = ComponentProps<typeof SignatureBuilder>;

/**
 * Controlled wrapper. `SignatureBuilder` holds no state - the box is controlled
 * from `field.label` and the rewritten field is handed straight back up. A story
 * that passed a frozen `field` would render a box that silently swallows every
 * keystroke, which is precisely the wiring these stories exist to check. The
 * harness owns the field and still forwards to `args.onChange` so a play
 * function can assert the emitted field object.
 */
const Harness = (args: BuilderProps) => {
  const [field, setField] = useState<FormField>(args.field);
  return (
    <div data-testid="builder-host" className="max-w-[420px]">
      <SignatureBuilder
        field={field}
        onChange={(next) => {
          setField(next);
          args.onChange(next);
        }}
      />
    </div>
  );
};

/** A signature field mid-edit: it already carries the id, type and flags a rename must not drop. */
const CLIENT_SIGNATURE: FormField & { type: 'signature' } = {
  id: 'client_signature',
  type: 'signature',
  label: 'Pet parent signature',
  required: true,
  order: 7,
  meta: { templateDefault: true },
};

const meta = {
  title: 'Forms/SignatureBuilder',
  component: SignatureBuilder,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The authoring side of a signature field - the `signature` entry in the builder map in ' +
          '`Build.tsx`, drawn in the right-hand editor when a signature row is selected on the ' +
          'builder canvas.\n\n' +
          '**One control, and that is the whole surface.** `InputBuilder` adds a Placeholder box ' +
          'and `DropdownBuilder` an option list; a signature has nothing to ' +
          'prompt with and nothing to choose from, so the label is the only thing an author can ' +
          'set. A second box appearing here would be a regression rather than a feature, and the ' +
          '`EmptyLabel` story counts them for that reason.\n\n' +
          '**It emits the whole field, not the edited string.** `onChange({ ...field, label })` ' +
          'is what keeps `id`, `type`, `required`, `order` and `meta` attached. Losing the spread ' +
          'in a refactor looks perfectly correct in the editor and only surfaces at save time, as ' +
          'a schema row that no longer matches its stored answers.\n\n' +
          '**Its `field` prop is the bare `FormField` union**, not the narrowed ' +
          "`FormField & { type: 'signature' }` its siblings declare. Build.tsx casts the " +
          'map entry to `any` anyway, so nothing at either end stops a field of the wrong type ' +
          'reaching this editor - worth knowing before trusting the prop type as a guard.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    field: CLIENT_SIGNATURE,
    onChange: fn(),
  },
  render: (args) => <Harness {...args} />,
} satisfies Meta<typeof SignatureBuilder>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyLabel: Story = {
  name: 'A field with no label yet',
  args: { field: { id: 'new_signature', type: 'signature', label: '' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const label = canvas.getByRole('textbox', { name: 'Label' });

    await expect(label).toHaveValue('');

    /* One control, and only one. A signature field has no placeholder and no
       options, so unlike InputBuilder this editor must never grow a second box -
       an extra input here would be collecting copy that no renderer can show,
       which is exactly why DateBuilder's own Placeholder box was removed. */
    await expect(canvas.getAllByRole('textbox')).toHaveLength(1);

    /* Plain text, not some signature-flavoured input type. The author is naming
       the field here, not signing it. */
    await expect(label).toHaveAttribute('type', 'text');

    /* FormInput derives the visible <label for> and the aria-label from the same
       `inlabel` string, so both have to land or the box is announced by its
       generated id alone. */
    await expect(label).toHaveAccessibleName('Label');
    await expect(canvas.getByText('Label')).toHaveAttribute('for', label.id);

    /* Pinning behaviour that is not this component's: the fixture sets no
       `required`, and the box is a required control anyway because FormInput
       hardcodes the attribute. Every builder box in the editor blocks native
       submission while empty, whatever the field says. */
    await expect(label).toBeRequired();
  },
};

export const PopulatedLabel: Story = {
  name: 'An existing label',
  play: async ({ canvasElement }) => {
    const label = within(canvasElement).getByRole('textbox', { name: 'Label' });
    await expect(label).toHaveValue('Pet parent signature');
  },
};

export const RenamesTheField: Story = {
  name: 'Renaming keeps the rest of the field',
  play: async ({ args, canvasElement }) => {
    const label = within(canvasElement).getByRole('textbox', { name: 'Label' });
    await userEvent.clear(label);
    await userEvent.type(label, 'Owner signature');

    /* The editor hands back a complete field, not a string: id, type and the
       schema flags all have to survive a rename. Dropping the spread would look
       identical on screen and only break once the form is saved and reloaded. */
    await expect(args.onChange).toHaveBeenLastCalledWith({
      id: 'client_signature',
      type: 'signature',
      label: 'Owner signature',
      required: true,
      order: 7,
      meta: { templateDefault: true },
    });

    // ...and the edit round-trips back into the box rather than snapping back.
    await expect(label).toHaveValue('Owner signature');
  },
};
