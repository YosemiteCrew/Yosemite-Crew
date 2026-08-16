import { type ComponentProps, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { userEvent, within } from 'storybook/test';
import DynamicSelect, { type Option } from './DynamicSelect';

const SPECIES: Option[] = [
  { value: 'dog', label: 'Dog' },
  { value: 'cat', label: 'Cat' },
  { value: 'horse', label: 'Horse' },
  { value: 'rabbit', label: 'Rabbit' },
  { value: 'bird', label: 'Bird' },
  { value: 'reptile', label: 'Reptile' },
];

/**
 * Controlled wrapper: the component takes `value`/`onChange`, so every story
 * holds the selection in local state rather than freezing it in args.
 */
const ControlledSelect = (args: ComponentProps<typeof DynamicSelect>) => {
  const [value, setValue] = useState(args.value);
  return <DynamicSelect {...args} value={value} onChange={setValue} />;
};

const meta = {
  title: 'Widgets/DynamicSelect',
  component: DynamicSelect,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Form-height select with an optional inline type-to-filter. The closed toggle is a 60px transparent field ' +
          '(1px `--notibg` border, radius 16); opening it squares off the bottom corners, switches the border to ' +
          '`--blue-text` and drops a flush `--color-surface-card` menu underneath. When `searchable` is on, the ' +
          'toggle label is replaced by a text input while open and the current label becomes its placeholder.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    searchable: { control: 'boolean' },
    placeholder: { control: 'text' },
    error: { control: 'text' },
  },
  args: {
    options: SPECIES,
    value: '',
    placeholder: 'Select species',
    inname: 'species',
    searchable: true,
    onChange: () => {},
  },
  decorators: [
    (StoryFn) => (
      <div style={{ maxWidth: 420, paddingBottom: 220 }}>
        <StoryFn />
      </div>
    ),
  ],
  render: (args) => <ControlledSelect {...args} />,
} satisfies Meta<typeof DynamicSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Nothing chosen yet — the toggle shows the placeholder in `--color-select-ink-muted`. */
export const Placeholder: Story = {};

/** A value is set, so the toggle shows that option's label. */
export const Selected: Story = { args: { value: 'horse' } };

/**
 * Open menu. The toggle's bottom corners square off against the flush panel,
 * and the leading row re-offers the placeholder as a "clear" choice.
 */
export const Open: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Select species' }));
  },
};

/** Validation message, rendered under the field once the form has been submitted. */
export const WithError: Story = {
  args: { error: 'Select a species to continue' },
};

/** No options at all — the menu shows the "No options available" disabled row. */
export const NoOptions: Story = {
  args: { options: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Select species' }));
  },
};
