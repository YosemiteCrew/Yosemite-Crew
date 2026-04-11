import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import Delete from './Delete';

const meta = {
  title: 'Primitives/Buttons/Delete',
  component: Delete,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Destructive action button — red background, white text. ' +
          'Use only for irreversible actions such as deleting a record. ' +
          'Always pair with a confirmation step.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    size: { control: 'radio', options: ['default', 'large'] },
    isDisabled: { control: 'boolean' },
  },
  args: {
    text: 'Delete account',
    isDisabled: false,
    size: 'default',
    onClick: fn(),
  },
} satisfies Meta<typeof Delete>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Large: Story = { args: { size: 'large', text: 'Delete all records' } };
export const Disabled: Story = { args: { isDisabled: true } };

export const AllSizes: Story = {
  name: 'All sizes',
  render: () => (
    <div className="flex flex-col gap-3 items-start">
      <Delete text="Delete (default)" size="default" onClick={fn()} />
      <Delete text="Delete (large)" size="large" onClick={fn()} />
    </div>
  ),
};
