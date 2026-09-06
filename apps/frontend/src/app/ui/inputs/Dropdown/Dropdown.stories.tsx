import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent } from 'storybook/test';
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
          'Labelled 40px select field. Supports plain string options, `{label, value}` objects, ' +
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
    docs: { description: { story: 'Selected value displayed below the static field label.' } },
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

export const Open: Story = {
  name: 'Panel open',
  play: async ({ canvasElement }) => {
    // The panel is the point. It only exists after a click, so nothing in this
    // file rendered it before - and a defect in a surface no story draws stays
    // invisible to Chromatic and to the contrast sweep indefinitely.
    const trigger = canvasElement.querySelector('button');
    await userEvent.click(trigger as HTMLElement);
    // Assert the panel has CONTENT, not just that the trigger flipped
    // aria-expanded - an empty panel would satisfy that and leave this story
    // silently guarding nothing. The panel portals to document.body.
    const panel = document.querySelector('[data-portal-dropdown]');
    await expect(panel).toBeInTheDocument();
    await expect(panel?.querySelectorAll('button').length).toBeGreaterThan(0);
  },
};
