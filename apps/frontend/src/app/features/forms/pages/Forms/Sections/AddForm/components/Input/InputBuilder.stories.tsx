import { useState } from 'react';
import type { ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import InputBuilder from './InputBuilder';

type BuilderProps = ComponentProps<typeof InputBuilder>;
type BuilderField = BuilderProps['field'];

/**
 * Controlled wrapper. `InputBuilder` holds no state: it renders `field` and emits a
 * whole replacement field on every keystroke. A story that passed a frozen object
 * would render editors that visibly refuse every character, so the harness keeps the
 * field and still forwards to `args.onChange` - which is what lets a play function
 * assert the emitted shape AND the round trip back into the box.
 */
const Harness = (args: BuilderProps) => {
  const [field, setField] = useState<BuilderField>(args.field);
  return (
    <div data-testid="builder-host" className="w-full max-w-[420px] bg-[var(--screen)] p-4">
      <InputBuilder
        {...args}
        field={field}
        onChange={(next) => {
          setField(next as BuilderField);
          args.onChange(next);
        }}
      />
    </div>
  );
};

/** The builder root - the flex column that holds the editor pair. */
const builderRoot = (canvasElement: HTMLElement): HTMLElement =>
  within(canvasElement).getByTestId('builder-host').firstElementChild as HTMLElement;

/** A hand-authored text field, the shape `fieldFactory.input` produces in Build.tsx. */
const TEXT_FIELD: BuilderField = {
  id: 'presenting_complaint',
  type: 'input',
  label: 'Presenting complaint',
  placeholder: 'Limping on the left hind',
};

/**
 * The Quantity row of the shipped prescription block (`types/forms.ts`): a `number`
 * field whose authored placeholder is prose. That combination is the trap this
 * component walks into, see the "Number field editor" story.
 */
const NUMBER_FIELD: BuilderField = {
  id: 'rx_1_qty',
  type: 'number',
  label: 'Quantity',
  placeholder: 'Units to dispense',
};

/**
 * An inventory-sourced medicine attribute. `Build.tsx#readonlyField` normally writes
 * `defaultValue` and `placeholder` to the same string; this one carries the placeholder
 * only, which is the branch that proves the `defaultValue ?? placeholder` ladder.
 */
const INVENTORY_READONLY: BuilderField = {
  id: 'rx_1_med_1_strength',
  type: 'input',
  label: 'Strength',
  placeholder: '500',
  meta: { readonly: true, inventoryItemId: 'inv-amox-500', prescriptionField: 'strength' },
};

/** A task block's title leaf, locked. `defaultValue: ''` is exactly what Build.tsx seeds. */
const TASK_BLOCK_READONLY: BuilderField = {
  id: 'task_1_name',
  type: 'input',
  label: 'Task title',
  placeholder: 'Eg.: Record vitals',
  defaultValue: '',
  meta: { readonly: true, taskBlockKey: 'name' },
};

/** A canonical template leaf: `canonicalFieldToFormField` stamps `meta.templateDefault`. */
const TEMPLATE_DEFAULT_FIELD: BuilderField = {
  id: 'vitals_temperature',
  type: 'input',
  label: 'Temperature',
  placeholder: '',
  required: true,
  defaultValue: '38.5',
  meta: { templateDefault: true },
};

/** Inventory-backed, editable, and carrying a NUMBER default rather than a string. */
const NUMERIC_DEFAULT_FIELD: BuilderField = {
  id: 'rx_1_med_1_qty',
  type: 'number',
  label: 'Quantity',
  placeholder: '',
  defaultValue: 14,
  meta: { inventoryItemId: 'inv-amox-500', prescriptionField: 'qty' },
};

const meta = {
  title: 'Forms/InputBuilder',
  component: InputBuilder,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The authoring side of a text or number field: the two boxes a template author sees ' +
          'after dropping an Input row onto the builder canvas. It had no story, so none of its ' +
          'three layouts had ever been drawn against the real `FormInput` - the unit tests replace ' +
          '`FormInput` with a bare `<input>`, which is precisely where the number-input trap below ' +
          'hides.\n\n' +
          '**One component, three layouts, selected by `field.meta` alone.**\n\n' +
          '`meta.readonly` wins first and swaps the pair for two locked boxes. Their captions then ' +
          'branch again on `meta.taskBlockKey`: a task block leaf reads "Fixed setting" / "Fixed ' +
          'value", everything else reads "Label (from inventory)" / "Value (from inventory)". So a ' +
          'medicine attribute and a task setting are the same code path wearing different words.\n\n' +
          'Failing that, any of `meta.inventoryItemId`, `meta.taskBlockKey` or `meta.templateDefault` ' +
          'switches to the default-value editor: the label stops being editable and becomes static ' +
          'text, and the single box writes `field.defaultValue`. The author of an inventory-sourced ' +
          'row cannot rename it, which is the point.\n\n' +
          'Otherwise it is the plain pair, "Label" and "Placeholder", writing `field.label` and ' +
          '`field.placeholder`. Those two handlers sit next to each other and look identical, so ' +
          'the round-trip story below asserts each one leaves the other property alone.\n\n' +
          'Both non-readonly layouts type the value box off `field.type`, and that is where a real ' +
          'field loses data: see "Number field editor".',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    field: TEXT_FIELD,
    onChange: fn(),
  },
  render: (args) => <Harness {...args} />,
} satisfies Meta<typeof InputBuilder>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TextField: Story = {
  name: 'Text field editor',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    const labelBox = canvas.getByRole('textbox', { name: 'Label' });
    const placeholderBox = canvas.getByRole('textbox', { name: 'Placeholder' });
    await expect(labelBox).toHaveValue('Presenting complaint');
    await expect(placeholderBox).toHaveValue('Limping on the left hind');

    // Geometry, because the row height and the gutter are the only thing keeping the
    // two editors apart and neither is asserted anywhere else.
    await expect(labelBox.getBoundingClientRect().height).toBe(44);
    await expect(getComputedStyle(builderRoot(canvasElement)).rowGap).toBe('12px');

    /* The wiring guard. Both handlers spread the whole field and overwrite one key,
       and the boxes are adjacent and identical looking. If they were swapped, typing
       a label would silently rewrite the placeholder and the UI would still look
       alive - so each edit is asserted to leave the OTHER property untouched. */
    await userEvent.clear(labelBox);
    await userEvent.type(labelBox, 'Chief complaint');
    await expect(args.onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: 'presenting_complaint',
        label: 'Chief complaint',
        placeholder: 'Limping on the left hind',
      })
    );
    await expect(labelBox).toHaveValue('Chief complaint');

    await userEvent.clear(placeholderBox);
    await userEvent.type(placeholderBox, 'Left hind lameness');
    await expect(args.onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        label: 'Chief complaint',
        placeholder: 'Left hind lameness',
      })
    );
    await expect(placeholderBox).toHaveValue('Left hind lameness');
  },
  parameters: {
    docs: {
      description: {
        story:
          'The layout an author gets for a field they created themselves. Nothing in `meta`, so ' +
          'both the label and the placeholder are theirs to edit.',
      },
    },
  },
};

export const NumberField: Story = {
  name: 'Number field editor',
  args: { field: NUMBER_FIELD },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The label editor is always text. Only the value box follows `field.type`.
    await expect(canvas.getByRole('textbox', { name: 'Label' })).toHaveValue('Quantity');

    const placeholderBox = canvas.getByRole('spinbutton', { name: 'Placeholder' });
    await expect(canvas.queryByRole('textbox', { name: 'Placeholder' })).toBeNull();

    /* The authored placeholder for this exact field, in the shipped prescription
       block, is the prose "Units to dispense". The editor is `type="number"`, so the
       browser refuses to display it and the box comes up blank. The author sees an
       empty Placeholder, and anything they type to fill it overwrites the prose that
       is still sitting in the schema. Read `.value` directly because jest-dom coerces
       number-input values. */
    await expect((placeholderBox as HTMLInputElement).value).toBe('');
  },
  parameters: {
    docs: {
      description: {
        story:
          'A `number` field types its value box as `number`, which is right for a numeric ' +
          'placeholder like "3" and wrong for the prose placeholders real templates carry. The ' +
          'unit tests stub `FormInput` out for a plain `<input>` and so never saw this.',
      },
    },
  },
};

export const InventoryReadOnly: Story = {
  name: 'Read-only inventory field',
  args: { field: INVENTORY_READONLY },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    const labelBox = canvas.getByRole('textbox', { name: 'Label (from inventory)' });
    const valueBox = canvas.getByRole('textbox', { name: 'Value (from inventory)' });
    await expect(labelBox).toHaveValue('Strength');
    await expect(labelBox).toHaveAttribute('readonly');
    await expect(valueBox).toHaveAttribute('readonly');

    // No `defaultValue` on this field, so the value box falls through to the
    // placeholder. That ladder is the only reason legacy inventory rows show anything.
    await expect(valueBox).toHaveValue('500');

    // The editable pair must not be reachable: renaming an inventory-sourced field
    // would detach it from the item it mirrors.
    await expect(canvas.queryByRole('textbox', { name: 'Label' })).toBeNull();
    await expect(canvas.queryByRole('textbox', { name: 'Placeholder' })).toBeNull();

    /* Locked in fact, not just in styling. There is no `onChange` wired on this
       branch at all, so a `readonly` attribute that went missing would leave a box
       that swallows edits without ever telling the parent. */
    await userEvent.type(valueBox, '750');
    await expect(valueBox).toHaveValue('500');
    await expect(args.onChange).not.toHaveBeenCalled();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A medicine attribute pulled from inventory. The captions say where the value came from, ' +
          'and both boxes are inert.',
      },
    },
  },
};

export const TaskBlockReadOnly: Story = {
  name: 'Read-only task block field',
  args: { field: TASK_BLOCK_READONLY },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Same branch as the inventory pair, different words. `meta.taskBlockKey` is the
    // only thing separating them, so the inventory captions must be absent.
    await expect(canvas.getByRole('textbox', { name: 'Fixed setting' })).toHaveValue('Task title');
    await expect(canvas.queryByRole('textbox', { name: 'Label (from inventory)' })).toBeNull();
    await expect(canvas.queryByRole('textbox', { name: 'Value (from inventory)' })).toBeNull();

    /* `defaultValue` is the empty string here, which is what Build.tsx seeds a fresh
       task block with. `??` only falls through on null/undefined, so the empty default
       beats the placeholder and the author is shown a blank Fixed value rather than
       "Eg.: Record vitals". Worth pinning: swapping `??` for `||` would change what a
       reviewer sees on every unauthored task block. */
    await expect(canvas.getByRole('textbox', { name: 'Fixed value' })).toHaveValue('');
    await expect(canvas.queryByDisplayValue('Eg.: Record vitals')).toBeNull();
  },
  parameters: {
    docs: {
      description: {
        story:
          'A task block leaf. Its values are authored through the dedicated TaskBlockCard, so the ' +
          'generic builder row only reports them.',
      },
    },
  },
};

export const TemplateDefaultValue: Story = {
  name: 'Template default value editor',
  args: { field: TEMPLATE_DEFAULT_FIELD },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    // One box, not two: the field name is fixed by the canonical template.
    const boxes = canvas.getAllByRole('textbox');
    await expect(boxes).toHaveLength(1);
    const defaultBox = canvas.getByRole('textbox', {
      name: 'Default value (prefilled in workspace)',
    });
    await expect(defaultBox).toHaveValue('38.5');

    /* The field name is a styled `div`, so it carries no heading semantics and a
       screen reader gets it as loose text next to an unrelated box caption. Pinned
       rather than fixed - changing it is a design decision, not a story's. */
    await expect(canvas.getByText('Temperature')).toBeInTheDocument();
    await expect(canvas.queryByRole('heading', { name: 'Temperature' })).toBeNull();

    // The one property this layout may write is `defaultValue`; the label must survive.
    await userEvent.clear(defaultBox);
    await userEvent.type(defaultBox, '39.1');
    await expect(args.onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ label: 'Temperature', defaultValue: '39.1' })
    );
    await expect(defaultBox).toHaveValue('39.1');
  },
  parameters: {
    docs: {
      description: {
        story:
          'What an author edits on a canonical (SOAP, Vitals, Discharge) template field: the value ' +
          'the workspace should open with. `meta.inventoryItemId` and a non-locked `meta.taskBlockKey` ' +
          'reach the same layout.',
      },
    },
  },
};

export const NumericDefaultDropped: Story = {
  name: 'Numeric default is not shown',
  args: { field: NUMERIC_DEFAULT_FIELD },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('Quantity')).toBeInTheDocument();
    const defaultBox = canvas.getByRole('spinbutton', {
      name: 'Default value (prefilled in workspace)',
    });

    /* `defaultValueText` is guarded by `typeof defaultValue === 'string'`, so the
       number 14 sitting in the schema is not echoed into the editor. The author reads
       an empty box, concludes there is no default, and the first character they type
       replaces 14 outright. Nothing warns them. */
    await expect((defaultBox as HTMLInputElement).value).toBe('');
    await expect(args.onChange).not.toHaveBeenCalled();

    await userEvent.type(defaultBox, '20');
    // And what comes back out is the STRING '20', so the schema changes type on edit.
    await expect(args.onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ defaultValue: '20' })
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same layout, handed a numeric `defaultValue`. `FormField.defaultValue` is typed ' +
          '`any` and the editor only renders strings, so a numeric default is invisible here and ' +
          'silently rewritten as a string the moment anyone touches the box.',
      },
    },
  },
};
