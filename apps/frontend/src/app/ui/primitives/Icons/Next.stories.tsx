import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import Next from './Next';
import Back from './Back';

const meta = {
  title: 'Primitives/Icons/Next',
  component: Next,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Chevron-right icon button. Used for forward navigation or next item in paginated lists.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: { disabled: { control: 'boolean' } },
  args: { onClick: fn(), disabled: false },
} satisfies Meta<typeof Next>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Disabled: Story = { args: { disabled: true } };

export const PaginationBar: Story = {
  name: 'Pagination bar (Back + Next)',
  render: () => (
    <div className="flex items-center gap-3">
      <Back onClick={fn()} />
      <span className="text-body-4 text-text-primary">Showing 10 of 47</span>
      <Next onClick={fn()} />
    </div>
  ),
};
