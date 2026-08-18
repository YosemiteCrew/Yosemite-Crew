import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent } from 'storybook/test';
import MultiSelectDropdown from './index';

const SPECIES_OPTIONS = [
  { label: 'Canine', value: 'dog' },
  { label: 'Feline', value: 'cat' },
  { label: 'Rabbit', value: 'rabbit' },
  { label: 'Bird', value: 'bird' },
  { label: 'Equine', value: 'horse' },
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
