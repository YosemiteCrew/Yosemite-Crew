import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent } from 'storybook/test';
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
          'Labelled 40px dropdown backed by `{label, value}` options. Used for status pickers ' +
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
