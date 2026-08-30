import { useState } from 'react';
import type { ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import DropdownBuilder from './DropdownBuilder';

type BuilderProps = ComponentProps<typeof DropdownBuilder>;
type BuilderField = BuilderProps['field'];

/**
 * Controlled wrapper. `DropdownBuilder` holds no state - every edit is emitted as
 * a whole replacement `field` and it is the canvas above it that stores the
 * result. A story that passed a frozen `field` would render an editor where
 * "Add option" appears to do nothing, so the harness owns the field and still
 * forwards to `args.onChange` for the assertions.
 */
const Harness = (args: BuilderProps) => {
  const [field, setField] = useState<BuilderField>(args.field);
  return (
    <div data-testid="builder-host" className="w-full max-w-[380px] bg-[var(--screen)] p-4">
      <DropdownBuilder
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

const BCS_OPTIONS = [
  { label: 'Under (1-3)', value: 'under' },
  { label: 'Ideal (4-5)', value: 'ideal' },
  { label: 'Over (6-9)', value: 'over' },
];

const DROPDOWN_FIELD: BuilderField = {
  id: 'body_condition',
  type: 'dropdown',
  label: 'Body condition score',
  options: BCS_OPTIONS,
};

/** A field the task-block editor owns: same control, one extra input. */
const TASK_BLOCK_FIELD: BuilderField = {
  id: 'task_route',
  type: 'dropdown',
  label: 'Route',
  options: [
    { label: 'Oral', value: 'oral' },
    { label: 'Subcutaneous', value: 'subcut' },
  ],
  meta: { taskBlockKey: 'route' },
  defaultValue: 'oral',
};

/** Sourced from the inventory record, so nothing about it is editable here. */
const INVENTORY_FIELD: BuilderField = {
  id: 'inventory_strength',
  type: 'dropdown',
  label: 'Strength',
  options: [
    { label: '50 mg', value: '50mg' },
    { label: '100 mg', value: '100mg' },
  ],
  meta: { readonly: true },
  defaultValue: '50 mg',
};

const FIXED_TASK_FIELD: BuilderField = {
  id: 'task_frequency',
  type: 'dropdown',
  label: 'Frequency',
  options: [{ label: 'Twice daily', value: 'bid' }],
  meta: { readonly: true, taskBlockKey: 'frequency' },
  defaultValue: 'Twice daily',
};

const meta = {
  title: 'Forms/DropdownBuilder',
  component: DropdownBuilder,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The authoring side of every choice field - select, single choice and multiple choice ' +
          'all edit through this one component, which is why nothing in it mentions the field ' +
          'type. It is two components wearing one name.\n\n' +
          '**`meta.readonly` swaps the whole editor for a pair of locked captions.** A field the ' +
          'inventory owns, or a fixed setting inside a task block, renders two read-only inputs ' +
          'and no option list at all - the options still exist in the schema, they simply have no ' +
          'editor. The captions differ between the two ("Label (from inventory)" versus "Fixed ' +
          'setting"), which is the only signal telling an author where the value came from.\n\n' +
          '**`meta.taskBlockKey` adds a third input below the Add button**, "Default value ' +
          '(prefilled in schedule)". It is a free-text box writing to `defaultValue`, so it can ' +
          'hold a string that matches none of the options above it and nothing objects.\n\n' +
          'Two details are worth knowing before editing this file: the option captions are ' +
          'positional ("Dropdown option 0" up), so deleting one renumbers its neighbours, and ' +
          'renaming an option deliberately keeps the original `value` - the React key is that ' +
          'value, so letting it follow the label would remount the input on every keystroke.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    field: DROPDOWN_FIELD,
    onChange: fn(),
  },
  render: (args) => <Harness {...args} />,
} satisfies Meta<typeof DropdownBuilder>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Editable: Story = {
  name: 'Three options',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // One label box plus one box per option, and the option captions are indices
    // starting at zero - so the first choice an author sees is captioned
    // "Dropdown option 0" while the palette calls the field "Option 1".
    await expect(canvas.getAllByRole('textbox')).toHaveLength(4);
    await expect(canvas.getByRole('textbox', { name: 'Label' })).toHaveValue(
      'Body condition score'
    );
    await expect(canvas.getByRole('textbox', { name: 'Dropdown option 0' })).toHaveValue(
      'Under (1-3)'
    );
    await expect(canvas.getByRole('textbox', { name: 'Dropdown option 2' })).toHaveValue(
      'Over (6-9)'
    );

    /* Every delete control is named the same bare glyph, so a screen reader
       hears "✕ button" three times with nothing to tell them apart. This is the
       kind of thing that never shows up visually and never fails a render. */
    const removes = canvas.getAllByRole('button', { name: '✕' });
    await expect(removes).toHaveLength(3);

    const firstOption = canvas.getByRole('textbox', { name: 'Dropdown option 0' });
    const inputBox = firstOption.getBoundingClientRect();
    const removeBox = removes[0].getBoundingClientRect();

    /* The delete button is positioned against the ROW, not against the input, and
       the row starts at the caption. `top-3` therefore lands it over the caption
       band rather than centred on the 44px field it deletes. */
    await expect(removeBox.top).toBeLessThan(inputBox.top);

    // It is inset 16px from the field's right edge (`right-4`).
    await expect(Math.round(inputBox.right - removeBox.right)).toBe(16);

    /* A bare glyph with no padding: 24px of hit area for a destructive control,
       next to a 44px field. That is under the 44px WCAG target-size floor the
       inputs themselves clear. */
    await expect(Math.round(removeBox.height)).toBe(24);
    await expect(Math.round(inputBox.height)).toBe(44);
  },
};

export const NoOptions: Story = {
  name: 'A choice field with nothing to choose',
  args: { field: { ...DROPDOWN_FIELD, options: [] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Only the label survives. The builder is happy to save this, and at runtime
       `DropdownRenderer` returns null for a field with no options - so the
       question disappears from the form entirely rather than rendering empty. */
    await expect(canvas.getAllByRole('textbox')).toHaveLength(1);
    await expect(canvas.queryAllByRole('button', { name: '✕' })).toHaveLength(0);
    await expect(canvas.getByRole('button', { name: '+ Add option' })).toBeInTheDocument();
  },
};

export const AddAndRemove: Story = {
  name: 'Adding and deleting renumbers the captions',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: '+ Add option' }));
    // The new option is named from the CURRENT length, so it is "Option 4" even
    // though the three above it are called "Under", "Ideal" and "Over".
    await expect(args.onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        options: [...BCS_OPTIONS, expect.objectContaining({ label: 'Option 4' })],
      })
    );
    const added = canvas.getByRole('textbox', { name: 'Dropdown option 3' });
    await expect(added).toHaveValue('Option 4');

    // Delete the middle option.
    await userEvent.click(canvas.getAllByRole('button', { name: '✕' })[1]);
    await expect(args.onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        options: [
          { label: 'Under (1-3)', value: 'under' },
          { label: 'Over (6-9)', value: 'over' },
          expect.objectContaining({ label: 'Option 4' }),
        ],
      })
    );

    /* The captions are positions, not identities: "Dropdown option 1" now names
       "Over (6-9)". Anything that referred to an option by its caption - a bug
       report, a test, a screenshot in a support thread - is wrong the moment an
       option above it is deleted. */
    await expect(canvas.getByRole('textbox', { name: 'Dropdown option 1' })).toHaveValue(
      'Over (6-9)'
    );
    await expect(canvas.getAllByRole('textbox')).toHaveLength(4);
  },
};

export const RenamingKeepsTheValue: Story = {
  name: 'Renaming an option keeps its stored value',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const second = canvas.getByRole('textbox', { name: 'Dropdown option 1' });

    await userEvent.clear(second);
    await userEvent.type(second, 'Ideal body condition');

    /* The whole string arrived, which is the assertion. Each keystroke rebuilds
       the options array, and the row's React key is `opt.value` - so if
       `updateOption` ever let the value follow the label, the input would
       remount on every character, drop focus, and only the first letter would
       land. The typed text and the retained focus are the only visible proof
       that the value is being held still. */
    await expect(second).toHaveValue('Ideal body condition');
    await expect(second).toHaveFocus();
    await expect(args.onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        options: [
          { label: 'Under (1-3)', value: 'under' },
          { label: 'Ideal body condition', value: 'ideal' },
          { label: 'Over (6-9)', value: 'over' },
        ],
      })
    );
  },
};

export const TaskBlockDefault: Story = {
  name: 'Task block: the prefill box',
  args: { field: TASK_BLOCK_FIELD },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    const prefill = canvas.getByRole('textbox', {
      name: 'Default value (prefilled in schedule)',
    });
    // It holds the option VALUE, not its label - the field offers "Oral" and
    // "Subcutaneous", the prefill box shows the stored `oral`.
    await expect(prefill).toHaveValue('oral');

    /* It sits BELOW the Add option button rather than with the rest of the
       field's settings, so on a long option list it is separated from the thing
       it applies to by every option row. */
    const addButton = canvas.getByRole('button', { name: '+ Add option' });
    await expect(
      addButton.compareDocumentPosition(prefill) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    await userEvent.clear(prefill);
    await userEvent.type(prefill, 'topical');
    /* Free text, and nothing checks it against the options. A schedule can be
       prefilled with a value the dropdown cannot produce, and the mismatch only
       surfaces when the renderer fails to match it back to an option. */
    await expect(args.onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ defaultValue: 'topical' })
    );
    await expect(canvas.getByRole('textbox', { name: 'Dropdown option 0' })).toHaveValue('Oral');
  },
};

export const ReadOnlyFromInventory: Story = {
  name: 'Locked to an inventory record',
  args: { field: INVENTORY_FIELD },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const label = canvas.getByRole('textbox', { name: 'Label (from inventory)' });
    const value = canvas.getByRole('textbox', { name: 'Value (from inventory)' });
    await expect(label).toHaveValue('Strength');
    await expect(label).toHaveAttribute('readonly');
    await expect(value).toHaveValue('50 mg');
    await expect(value).toHaveAttribute('readonly');

    /* The field still carries two options in the schema and neither is drawn.
       The read-only branch returns before the option list exists, so an author
       looking at this row cannot see what the field will actually offer. */
    await expect(canvas.getAllByRole('textbox')).toHaveLength(2);
    await expect(canvas.queryByRole('button', { name: '+ Add option' })).not.toBeInTheDocument();
    await expect(canvas.queryAllByRole('button', { name: '✕' })).toHaveLength(0);
  },
};

export const ReadOnlyFixedSetting: Story = {
  name: 'Locked as a task-block setting',
  args: { field: FIXED_TASK_FIELD },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    /* Same branch, different captions. `meta.taskBlockKey` is the only thing
       separating "this came from inventory" from "this is fixed by the task
       block", and it is carried entirely by these two strings. */
    await expect(canvas.getByRole('textbox', { name: 'Fixed setting' })).toHaveValue('Frequency');
    await expect(canvas.getByRole('textbox', { name: 'Fixed value' })).toHaveValue('Twice daily');
    await expect(
      canvas.queryByRole('textbox', { name: 'Label (from inventory)' })
    ).not.toBeInTheDocument();
    // The prefill box belongs to the editable branch only.
    await expect(
      canvas.queryByRole('textbox', { name: 'Default value (prefilled in schedule)' })
    ).not.toBeInTheDocument();
  },
};

export const Phone: Story = {
  name: 'Phone (375)',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(globalThis.document.documentElement.scrollWidth).toBeLessThanOrEqual(
      globalThis.window.innerWidth
    );

    /* Nothing about the row is responsive, so at 375 the delete glyph still sits
       16px in from the field edge and still overlaps the caption. It is the
       narrowest place the caption has to survive: "Dropdown option 0" is
       truncated by the label's `truncate`, not wrapped. */
    const input = canvas.getByRole('textbox', { name: 'Dropdown option 0' });
    const remove = canvas.getAllByRole('button', { name: '✕' })[0];
    const inputBox = input.getBoundingClientRect();
    const removeBox = remove.getBoundingClientRect();
    await expect(removeBox.right).toBeLessThan(inputBox.right);
    await expect(removeBox.left).toBeGreaterThan(inputBox.left);
    // The 24px target does not grow on the surface where it matters most.
    await expect(Math.round(removeBox.height)).toBe(24);
  },
};
