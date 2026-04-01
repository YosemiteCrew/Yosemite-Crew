import type { Meta, StoryObj } from '@storybook/react';
import Badge from './Badge';

const meta = {
  title: 'Primitives/Badge',
  component: Badge,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Inline label for status, category, or count. Five semantic tones available.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    tone: {
      control: 'select',
      options: ['neutral', 'brand', 'success', 'warning', 'danger'],
    },
  },
  args: {
    tone: 'neutral',
    children: 'Label',
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Neutral: Story = { args: { tone: 'neutral', children: 'Neutral' } };
export const Brand: Story = { args: { tone: 'brand', children: 'Brand' } };
export const Success: Story = { args: { tone: 'success', children: 'Active' } };
export const Warning: Story = { args: { tone: 'warning', children: 'Pending' } };
export const Danger: Story = { args: { tone: 'danger', children: 'Overdue' } };

export const AllTones: Story = {
  name: 'All tones',
  render: () => (
    <div className="flex flex-wrap gap-3 items-center">
      <Badge tone="neutral">Neutral</Badge>
      <Badge tone="brand">Brand</Badge>
      <Badge tone="success">Active</Badge>
      <Badge tone="warning">Pending</Badge>
      <Badge tone="danger">Overdue</Badge>
    </div>
  ),
};
