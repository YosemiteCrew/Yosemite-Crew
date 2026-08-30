import { useState } from 'react';
import type { ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import InputRenderer from './InputRenderer';

type RendererProps = ComponentProps<typeof InputRenderer>;
type RendererField = RendererProps['field'];

/**
 * Controlled wrapper. `InputRenderer` keeps no state - it draws `value` and emits the
 * new string - so a frozen prop would render a box that refuses every keystroke. The
 * harness holds the answer and still forwards to `args.onChange`, which lets a play
 * function assert the emitted value AND that it came back down into the input.
 *
 * The state is deliberately seeded straight from `args.value`, undefined included, so
 * the fallback stories below really do reach `InputRenderer` with nothing.
 */
const Harness = (args: RendererProps) => {
  const [value, setValue] = useState(args.value);
  return (
    <div data-testid="renderer-host" className="w-full max-w-[420px] bg-[var(--screen)] p-4">
      <InputRenderer
        {...args}
        value={value}
        onChange={(next) => {
          setValue(next);
          args.onChange(next);
        }}
      />
    </div>
  );
};

/** A hand-authored text field, explicitly optional. See the "required" note below. */
const TEXT_FIELD: RendererField = {
  id: 'presenting_complaint',
  type: 'input',
  label: 'Presenting complaint',
  placeholder: 'Limping on the left hind',
  required: false,
};

const NUMBER_FIELD: RendererField = {
  id: 'weight_kg',
  type: 'number',
  label: 'Weight (kg)',
  placeholder: '12.4',
};

/** An inventory-sourced medicine attribute: locked by its own meta, not by the caller. */
const INVENTORY_LOCKED_FIELD: RendererField = {
  id: 'rx_1_med_1_strength',
  type: 'input',
  label: 'Strength',
  meta: { readonly: true, inventoryItemId: 'inv-amox-500', prescriptionField: 'strength' },
};

/** A template field carrying the value the workspace should open with. */
const SEEDED_FIELD: RendererField = {
  id: 'rx_1_med_1_durationUnit',
  type: 'input',
  label: 'Duration unit',
  defaultValue: 'days',
  meta: { inventoryItemId: 'inv-amox-500', prescriptionField: 'durationUnit' },
};

/** A numeric answer with a non-zero default behind it. The whole point of the `??`. */
const REFILLS_FIELD: RendererField = {
  id: 'rx_1_med_1_refill',
  type: 'number',
  label: 'Refills',
  defaultValue: 3,
  meta: { inventoryItemId: 'inv-amox-500', prescriptionField: 'refill' },
};

const meta = {
  title: 'Forms/InputRenderer',
  component: InputRenderer,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The runtime half of a text or number field: what a pet parent types into, what the ' +
          'Form preview drawer draws inert, and what the appointment workspace mounts for every ' +
          '`input` and `number` leaf of a template. `FormRenderer` maps both of those types onto ' +
          'this one component, so the only difference between a name box and a dose box is the ' +
          '`intype` it computes.\n\n' +
          'It had no story. The unit tests replace `FormInput` with a bare `<input>`, so nothing ' +
          'had ever checked what the real control does with these props.\n\n' +
          '**Two rules carry the whole component.**\n\n' +
          '`isReadOnly` is `readOnly || field.meta.readonly`. The second half is the one that ' +
          'matters: a live, editable form still has to lock the fields that mirror an inventory ' +
          'item, and `FormRenderer` passes `readOnly={false}` for exactly that form. Both halves ' +
          'are drawn below because either one going missing leaves a box that looks identical.\n\n' +
          '`value ?? defaultValue ?? ""` uses nullish coalescing on purpose. `FormRenderer` hands ' +
          'answers through untyped, so a numeric answer of 0 really does arrive as the number 0, ' +
          'and `||` here would throw it away and show the template default instead. Pinned in the ' +
          '"Numeric zero" story.\n\n' +
          'One thing this component does not control: `FormInput` hardcodes `required` on its ' +
          'input, so `field.required: false` is ignored and every runtime text and number field ' +
          'is a required field. Asserted rather than assumed in the first story.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    field: TEXT_FIELD,
    value: '',
    onChange: fn(),
  },
  render: (args) => <Harness {...args} />,
} satisfies Meta<typeof InputRenderer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TextInput: Story = {
  name: 'Empty text input',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    // The field label is the accessible name. There is no other labelling on the
    // control, so a blank `field.label` leaves an unnamed textbox.
    const input = canvas.getByRole('textbox', { name: 'Presenting complaint' });
    await expect(input).toHaveValue('');
    await expect(input).toHaveAttribute('type', 'text');
    await expect(input).not.toHaveAttribute('readonly');

    /* `field.required` is false on this fixture and the control is required anyway,
       because `FormInput` hardcodes the attribute. Every optional question in every
       published form blocks submission. Pinned so the day someone threads `required`
       through, this story is the thing that tells them the behaviour changed. */
    await expect(input).toBeRequired();

    // Both halves of the contract: the plain string went out, and the answer came
    // back down. A renderer that emitted the event object instead would still look
    // alive while typing.
    await userEvent.type(input, 'Left hind lameness');
    await expect(args.onChange).toHaveBeenLastCalledWith('Left hind lameness');
    await expect(input).toHaveValue('Left hind lameness');
  },
  parameters: {
    docs: {
      description: {
        story: 'An unanswered text question, the state every published form opens in.',
      },
    },
  },
};

export const NumberInput: Story = {
  name: 'Number input',
  args: { field: NUMBER_FIELD, value: '12.4' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    /* `field.type` is the only thing separating this from the story above, and it
       changes the ARIA role as well as the keyboard. A field that lost its `number`
       type would still render, still accept text, and quietly widen what a numeric
       answer can contain. Read `.value` directly because jest-dom coerces
       number-input values. */
    const input = canvas.getByRole('spinbutton', { name: 'Weight (kg)' });
    await expect(canvas.queryByRole('textbox', { name: 'Weight (kg)' })).toBeNull();
    await expect((input as HTMLInputElement).value).toBe('12.4');

    // The value still leaves as a string; nothing here parses it.
    await userEvent.type(input, '5');
    await expect(args.onChange).toHaveBeenLastCalledWith('12.45');
  },
  parameters: {
    docs: {
      description: {
        story:
          'A numeric answer. Same component, same props, one different `field.type`. The emitted ' +
          'value is still a string, so whatever consumes it has to parse.',
      },
    },
  },
};

export const ReadOnlyByProp: Story = {
  name: 'Read-only via the readOnly prop',
  args: { field: TEXT_FIELD, value: 'Left hind lameness', readOnly: true },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox', { name: 'Presenting complaint' });

    await expect(input).toHaveAttribute('readonly');

    /* readonly, not disabled: the box stays in the tab order so the answer can be
       read and copied out of a preview. Tabbed rather than focused programmatically,
       because `.focus()` never sets :focus-visible in Chromium. Asserted before the
       typing below, which would otherwise have moved focus onto the box itself. */
    await userEvent.tab();
    await expect(input).toHaveFocus();

    await userEvent.type(input, ' and swelling');
    await expect(input).toHaveValue('Left hind lameness');
    await expect(args.onChange).not.toHaveBeenCalled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'How the Form preview drawer draws a filled answer. `FormRenderer` passes `readOnly` ' +
          'down to every leaf it mounts.',
      },
    },
  },
};

export const ReadOnlyByFieldMeta: Story = {
  name: 'Read-only via field.meta.readonly',
  args: { field: INVENTORY_LOCKED_FIELD, value: '500mg' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox', { name: 'Strength' });

    /* No `readOnly` prop at all on this story: the lock comes entirely from the
       field. This is the live-form case - `FormRenderer` passes `readOnly={false}`
       and the box must still refuse edits, because it mirrors an inventory item that
       nobody fills in by hand. Losing this half of the `||` would leave a fully
       editable, identical looking box. */
    await expect(input).toHaveAttribute('readonly');
    await userEvent.type(input, '750mg');
    await expect(input).toHaveValue('500mg');
    await expect(args.onChange).not.toHaveBeenCalled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'An inventory-sourced attribute inside an otherwise editable form. The field locks ' +
          'itself; the caller is not consulted.',
      },
    },
  },
};

export const DefaultValueFallback: Story = {
  name: 'No answer yet, the default shows',
  args: {
    field: SEEDED_FIELD,
    // `value` is typed `string`, but FormRenderer resolves and forwards it untyped,
    // so an absent answer really can arrive here as undefined.
    value: undefined as unknown as string,
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox', { name: 'Duration unit' });

    // Nothing answered, so the template default is what the workspace opens with.
    await expect(input).toHaveValue('days');

    /* And it is a seed, not a floor. Clearing the box emits '' and the empty string
       must stick, because `??` only falls through on null/undefined. If this ladder
       were written with `||`, deleting the default would snap it straight back and
       the field would be impossible to empty. */
    await userEvent.clear(input);
    await expect(args.onChange).toHaveBeenLastCalledWith('');
    await expect(input).toHaveValue('');
  },
  parameters: {
    docs: {
      description: {
        story:
          "The template's `defaultValue` standing in for an answer nobody has given. In practice " +
          '`FormRenderer` resolves the same ladder before it gets here, so this branch is the ' +
          'safety net for any other caller that mounts the renderer directly.',
      },
    },
  },
};

export const NumericZero: Story = {
  name: 'Numeric zero renders',
  args: {
    field: REFILLS_FIELD,
    // A real answer of zero, arriving as a number for the same untyped reason above.
    value: 0 as unknown as string,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('spinbutton', { name: 'Refills' });

    /* The reason the component uses `??` and not `||`. "No refills" is a real answer
       and it is falsy: with `||` the zero would be discarded, the field would fall
       through to the template default of 3, and a prescription would silently gain
       three refills nobody authorised. */
    await expect((input as HTMLInputElement).value).toBe('0');
    await expect((input as HTMLInputElement).value).not.toBe('3');
  },
  parameters: {
    docs: {
      description: {
        story:
          'Zero is an answer. This is the one story that would break if the fallback ladder were ' +
          'rewritten with `||`, and the failure mode is a prescription changing behind the ' +
          "prescriber's back rather than a visible error.",
      },
    },
  },
};
