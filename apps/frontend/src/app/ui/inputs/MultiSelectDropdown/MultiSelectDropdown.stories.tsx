import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import MultiSelectDropdown from './index';

const SPECIES_OPTIONS = [
  { label: 'Dog', value: 'dog' },
  { label: 'Cat', value: 'cat' },
  { label: 'Rabbit', value: 'rabbit' },
  { label: 'Bird', value: 'bird' },
  { label: 'Horse', value: 'horse' },
  { label: 'Reptile', value: 'reptile' },
];

const meta = {
  title: 'Inputs/MultiSelectDropdown',
  component: MultiSelectDropdown,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Multi-select dropdown with chip/pill display for selected items. ' +
          'Options already selected are excluded from the dropdown list. ' +
          'Individual chips can be removed independently.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    searchable: { control: 'boolean' },
    error: { control: 'text' },
  },
  args: {
    placeholder: 'Species',
    value: [],
    options: SPECIES_OPTIONS,
    onChange: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MultiSelectDropdown>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const WithSelections: Story = {
  args: { value: ['dog', 'cat'] },
  parameters: {
    docs: {
      description: { story: 'Pre-selected values shown as removable chips below the input.' },
    },
  },
};

export const WithError: Story = {
  args: { error: 'Please select at least one species.' },
};

export const NoSearch: Story = {
  args: { searchable: false },
};
