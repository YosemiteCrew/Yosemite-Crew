import type { Meta, StoryObj } from '@storybook/react';
import Card from './Card';

const meta = {
  title: 'Primitives/Card',
  component: Card,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Surface container with three variants. Use `default` or `bordered` for primary content cards, ' +
          '`subtle` for secondary/nested surfaces.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['default', 'bordered', 'subtle'] },
  },
  args: {
    variant: 'default',
    children: 'Card content goes here.',
    className: 'p-6',
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Bordered: Story = { args: { variant: 'bordered' } };
export const Subtle: Story = { args: { variant: 'subtle' } };

export const AllVariants: Story = {
  name: 'All variants',
  render: () => (
    <div className="flex flex-col gap-4 w-80">
      {(['default', 'bordered', 'subtle'] as const).map((v) => (
        <Card key={v} variant={v} className="p-6">
          <p className="text-body-4 text-text-secondary">{v}</p>
          <p className="text-body-3 text-text-primary mt-1">Card surface</p>
        </Card>
      ))}
    </div>
  ),
};
