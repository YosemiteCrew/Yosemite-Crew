import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import LabelDropdown from './LabelDropdown';

const STATUS_OPTIONS = [
  { label: 'Active', value: 'active' },
  { label: 'Pending', value: 'pending' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
];

const meta = {
  title: 'Inputs/LabelDropdown',
  component: LabelDropdown,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Floating-label dropdown backed by `{label, value}` options. Used for status pickers ' +
          'and other typed selects. Supports optional inline search.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    searchable: { control: 'boolean' },
    error: { control: 'text' },
  },
  args: {
    placeholder: 'Status',
    options: STATUS_OPTIONS,
    onSelect: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LabelDropdown>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithDefault: Story = { args: { defaultOption: 'active' } };
export const NoSearch: Story = { args: { searchable: false } };
export const WithError: Story = { args: { error: 'Status is required.' } };
