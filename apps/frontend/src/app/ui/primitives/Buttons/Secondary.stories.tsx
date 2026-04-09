import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import Secondary from './Secondary';

const meta = {
  title: 'Primitives/Buttons/Secondary',
  component: Secondary,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Outlined secondary button. Use for cancel, alternative, or lower-priority actions alongside Primary.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    size: { control: 'radio', options: ['default', 'large'] },
    isDisabled: { control: 'boolean' },
    href: { control: 'text' },
  },
  args: {
    text: 'Cancel',
    isDisabled: false,
    size: 'default',
    onClick: fn(),
  },
} satisfies Meta<typeof Secondary>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Large: Story = { args: { size: 'large', text: 'Learn more' } };
export const Disabled: Story = { args: { isDisabled: true } };
export const AsLink: Story = {
  name: 'As navigation link',
  args: { href: '/help', text: 'View docs' },
};
