import { useState } from 'react';
import type { ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import DropdownRenderer from './DropdownRenderer';

type RendererProps = ComponentProps<typeof DropdownRenderer>;
type ChoiceField = RendererProps['field'];

/**
 * Controlled wrapper. The renderer keeps no state - it is handed a `value` and an
 * `onChange`, so a frozen value would produce controls that visibly refuse every
 * click. The harness holds the answer and still forwards to `args.onChange`, so a
 * play function can assert the emitted value AND that it came back down into the
 * control.
 */
const Harness = (args: RendererProps) => {
  const [value, setValue] = useState<unknown>(args.value);
  return (
    <div data-testid="renderer-host" className="w-full max-w-[380px] bg-[var(--screen)] p-4">
      <DropdownRenderer
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

const host = (canvasElement: HTMLElement): HTMLElement =>
  within(canvasElement).getByTestId('renderer-host');

const BCS_OPTIONS = [
  { label: 'Under (1-3)', value: 'under' },
  { label: 'Ideal (4-5)', value: 'ideal' },
  { label: 'Over (6-9)', value: 'over' },
];

const SELECT_FIELD: ChoiceField = {
  id: 'body_condition',
  type: 'dropdown',
  label: 'Body condition score',
  options: BCS_OPTIONS,
  defaultValue: 'ideal',
};

const RADIO_FIELD: ChoiceField = {
  id: 'temperament',
  type: 'radio',
  label: 'Temperament',
  options: [
    { label: 'Relaxed', value: 'relaxed' },
    { label: 'Nervous', value: 'nervous' },
    { label: 'Aggressive', value: 'aggressive' },
  ],
};

const CHECKBOX_FIELD: ChoiceField = {
  id: 'observed_signs',
  type: 'checkbox',
  label: 'Observed signs',
  multiple: true,
  options: [
    { label: 'Lameness', value: 'lameness' },
    { label: 'Swelling', value: 'swelling' },
    { label: 'Vomiting', value: 'vomiting' },
  ],
};

const meta = {
  title: 'Forms/DropdownRenderer',
  component: DropdownRenderer,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The runtime side of every choice field. `runtimeComponentMap` sends three field types ' +
          'here - `dropdown`, `radio` and `checkbox` - and the component re-branches internally, ' +
          'so despite the name a `radio` field draws a native input list and nothing resembling a ' +
          'select.\n\n' +
          '**Three controls, one null branch, two read-only sources.** A field with no options ' +
          'renders nothing at all: no label, no empty select, no warning - the question simply ' +
          'vanishes from the form. Read-only comes either from the `readOnly` prop (the preview ' +
          'drawer) or from `meta.readonly` on the field (inventory- and task-block-owned values), ' +
          'and the two are OR-ed.\n\n' +
          '**Both group controls are groups, without a `fieldset`.** The field label stays a ' +
          'plain `div` so the layout is unchanged, but it now names a `role="radiogroup"` / ' +
          '`role="group"` wrapper via `aria-labelledby`, so the question is announced once for ' +
          'the group instead of only inside each option. The composed `aria-label` on every ' +
          'input - "<field label>: <option label>" - is still there. Radios also share a `name` ' +
          '(the field id), so exclusivity is real - but two renderers mounted for the same field ' +
          'id would silently join one radio group.\n\n' +
          '**Read-only is not enforced the same way in all three.** Checkbox and radio inputs get ' +
          '`disabled`; the select does not - `isReadOnly` only guards the `onChange` call, so a ' +
          'preview select still opens, still visibly moves, and just never reports. That is drawn ' +
          'below.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    field: SELECT_FIELD,
    value: undefined,
    onChange: fn(),
  },
  render: (args) => <Harness {...args} />,
} satisfies Meta<typeof DropdownRenderer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Select: Story = {
  name: 'Select (falls back to defaultValue)',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    /* No answer has been given, so the control shows `defaultValue`. The stored
       value is `ideal` and the trigger names the matching option's LABEL, which
       is the round trip worth pinning: LabelDropdown resolves a default by value
       OR by label, so a schema storing either shape still shows a selection. */
    const trigger = canvas.getByRole('button', { name: 'Body condition score: Ideal (4-5)' });
    await expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(trigger);
    // The panel portals to document.body, so it is outside canvasElement.
    const panel = within(globalThis.document.body);
    const over = await panel.findByRole('button', { name: 'Over (6-9)' });
    await userEvent.click(over);

    // The renderer unwraps the option and emits the VALUE, not the option object.
    await expect(args.onChange).toHaveBeenLastCalledWith('over');
    await waitFor(async () => {
      await expect(
        canvas.getByRole('button', { name: 'Body condition score: Over (6-9)' })
      ).toBeInTheDocument();
    });
  },
};

export const RadioGroup: Story = {
  name: 'Single choice',
  args: { field: RADIO_FIELD, value: 'relaxed' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    const radios = canvas.getAllByRole('radio');
    await expect(radios).toHaveLength(3);

    /* Exclusivity is carried by the shared `name`, which is the field id. Drop it
       and all three become independently checkable while still LOOKING like a
       radio group - the visual is identical, the behaviour is not. */
    for (const radio of radios) {
      await expect(radio).toHaveAttribute('name', 'temperament');
    }

    /* The question is announced for the group, not only inside each option. It
       is a role="radiogroup" named by the visible label rather than a fieldset,
       because a fieldset/legend would change the layout the label div owns. The
       per-input names stay: shortening those to the option label alone would
       leave anyone landing on a single radio hearing "Relaxed" with no idea
       what is being asked. */
    await expect(canvas.getByRole('radiogroup', { name: 'Temperament' })).toContainElement(
      radios[0]
    );
    await expect(canvas.getByRole('radio', { name: 'Temperament: Relaxed' })).toBeChecked();
    await expect(canvas.getByRole('radio', { name: 'Temperament: Nervous' })).not.toBeChecked();

    await userEvent.click(canvas.getByRole('radio', { name: 'Temperament: Aggressive' }));
    await expect(args.onChange).toHaveBeenLastCalledWith('aggressive');
    await expect(canvas.getByRole('radio', { name: 'Temperament: Aggressive' })).toBeChecked();
    await expect(canvas.getByRole('radio', { name: 'Temperament: Relaxed' })).not.toBeChecked();
  },
};

export const CheckboxGroupFromAScalar: Story = {
  name: 'Multiple choice given a single stored value',
  args: { field: CHECKBOX_FIELD, value: 'lameness' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    // Same grouping as the radio branch, as a plain role="group" named by the
    // visible question - so the set is announced once, not once per option.
    await expect(canvas.getByRole('group', { name: 'Observed signs' })).toBeInTheDocument();

    /* The branch this component exists to handle. A checkbox field can be handed
       a bare string - a field switched from single to multiple choice after
       answers were saved, or a template default written as a scalar - and it is
       wrapped into a one-element selection rather than being read as an
       iterable of characters. */
    await expect(canvas.getByRole('checkbox', { name: 'Observed signs: Lameness' })).toBeChecked();
    await expect(
      canvas.getByRole('checkbox', { name: 'Observed signs: Swelling' })
    ).not.toBeChecked();

    await userEvent.click(canvas.getByRole('checkbox', { name: 'Observed signs: Swelling' }));
    // And the first thing it emits is an ARRAY, so the scalar never survives a
    // single interaction - the shape repairs itself on first touch.
    await expect(args.onChange).toHaveBeenLastCalledWith(['lameness', 'swelling']);

    await userEvent.click(canvas.getByRole('checkbox', { name: 'Observed signs: Lameness' }));
    await expect(args.onChange).toHaveBeenLastCalledWith(['swelling']);
    await expect(
      canvas.getByRole('checkbox', { name: 'Observed signs: Lameness' })
    ).not.toBeChecked();
  },
};

export const ReadOnlyFromTheField: Story = {
  name: 'Read-only via meta.readonly',
  args: {
    field: { ...CHECKBOX_FIELD, meta: { readonly: true } },
    value: ['lameness'],
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    /* `meta.readonly` is the second source of truth for read-only, used by
       inventory- and task-block-owned fields, and it locks the control without
       the caller passing `readOnly` at all. */
    const lameness = canvas.getByRole('checkbox', { name: 'Observed signs: Lameness' });
    await expect(lameness).toBeDisabled();
    await expect(lameness).toBeChecked();

    const swelling = canvas.getByRole('checkbox', { name: 'Observed signs: Swelling' });
    await userEvent.click(swelling, { pointerEventsCheck: 0 });
    await expect(args.onChange).not.toHaveBeenCalled();
    await expect(swelling).not.toBeChecked();
  },
};

export const ReadOnlySelectIsLocked: Story = {
  name: 'A read-only select does not open',
  args: { field: SELECT_FIELD, value: 'ideal', readOnly: true },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'Body condition score: Ideal (4-5)' });

    /* Guarding only `onSelect` was not enough here. LabelDropdown holds its own
       selected label on purpose - so a click always moves it even when a
       controlled parent never echoes the value back - which meant a read-only
       select opened, accepted a click and displayed an answer the record did not
       contain, while onChange never fired. The checkbox and radio branches
       already disabled their inputs; the select now matches. */
    await expect(trigger).toBeDisabled();

    await userEvent.click(trigger, { pointerEventsCheck: 0 });
    await expect(
      within(globalThis.document.body).queryByRole('button', { name: 'Over (6-9)' })
    ).toBeNull();
    await expect(args.onChange).not.toHaveBeenCalled();
    // And it still shows the real answer.
    await expect(
      canvas.getByRole('button', { name: 'Body condition score: Ideal (4-5)' })
    ).toBeInTheDocument();
  },
};

export const NoOptions: Story = {
  name: 'A field with no options renders nothing',
  args: { field: { ...SELECT_FIELD, options: [], defaultValue: undefined } },
  play: async ({ canvasElement }) => {
    /* Not an empty select, not a label with a disabled control - nothing. The
       builder happily saves a choice field with zero options, and this is where
       that question disappears. Counting children is the only way to catch it:
       every positive assertion about "the form rendered" still passes. */
    await expect(host(canvasElement).childElementCount).toBe(0);
    await expect(within(canvasElement).queryByText('Body condition score')).not.toBeInTheDocument();
  },
};

export const Phone: Story = {
  name: 'Phone (375)',
  args: { field: CHECKBOX_FIELD, value: ['lameness'] },
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );

    /* The box measures 20px, not the 16px `size-4` asks for. `globals.css` styles
       `input[type='checkbox']` outside any cascade layer, and an unlayered rule
       beats every Tailwind utility however specific - so the class on this input
       is dead code. Worth knowing before anyone "fixes" the target size by
       editing the utility, which will change nothing. */
    const box = canvas.getByRole('checkbox', { name: 'Observed signs: Lameness' });
    const boxRect = box.getBoundingClientRect();
    await expect(Math.round(boxRect.width)).toBe(20);
    await expect(Math.round(boxRect.height)).toBe(20);

    /* Either way it is far under 44px, and the row around it does not make up the
       difference: the label is `inline-flex` with no vertical padding, so its
       height is the text line and the rows sit on an 8px gap. On the surface
       where these forms are actually filled in - a pet parent on a phone - that
       is the whole target. */
    const row = box.closest('label') as HTMLElement;
    await expect(Math.round(row.getBoundingClientRect().height)).toBeLessThan(44);
  },
};
