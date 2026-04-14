import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import Dropdown from './Dropdown';

const SPECIALTY_OPTIONS = [
  { label: 'General Practice', value: 'general' },
  { label: 'Cardiology', value: 'cardiology' },
  { label: 'Dermatology', value: 'dermatology' },
  { label: 'Neurology', value: 'neurology' },
  { label: 'Orthopedics', value: 'orthopedics' },
  { label: 'Ophthalmology', value: 'ophthalmology' },
];

const meta = {
  title: 'Inputs/Dropdown',
  component: Dropdown,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Floating-label select dropdown. Supports plain string options, `{label, value}` objects, ' +
          'country lists, and breed lists. Optional search filter.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    search: { control: 'boolean' },
    disabled: { control: 'boolean' },
    type: { control: 'select', options: ['general', 'country', undefined] },
    error: { control: 'text' },
  },
  args: {
    placeholder: 'Speciality',
    value: '',
    options: SPECIALTY_OPTIONS,
    onChange: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Dropdown>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithValue: Story = {
  args: { value: 'cardiology' },
  parameters: {
    docs: { description: { story: 'Selected value displayed with floating label active.' } },
  },
};

export const WithSearch: Story = {
  name: 'With search filter',
  args: { search: true },
};

export const WithError: Story = {
  args: { error: 'Please select a speciality.' },
};

export const Disabled: Story = {
  args: { disabled: true, value: 'general' },
};

export const CountryPicker: Story = {
  name: 'Country picker',
  args: { type: 'country', placeholder: 'Country', value: '', search: true },
  parameters: {
    docs: { description: { story: 'Built-in country list with flag emoji labels.' } },
  },
};
