import type { Meta, StoryObj } from '@storybook/react';
import GlassTooltip from './GlassTooltip';

const meta = {
  title: 'Primitives/GlassTooltip',
  component: GlassTooltip,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Portal-based tooltip with viewport-aware positioning. ' +
          'Triggers on hover and focus. Supports four placement directions.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    side: { control: 'select', options: ['top', 'right', 'bottom', 'left'] },
    content: { control: 'text' },
  },
  args: {
    content: 'Helpful tooltip text',
    side: 'top',
  },
} satisfies Meta<typeof GlassTooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

const TriggerButton = ({ children }: { children: React.ReactNode }) => (
  <button
    type="button"
    className="px-6 py-3 border border-card-border rounded-2xl text-body-4 text-text-primary"
  >
    {children}
  </button>
);

export const Top: Story = {
  args: { side: 'top', content: 'Appears above' },
  render: (args) => (
    <GlassTooltip {...args}>
      <TriggerButton>Hover me</TriggerButton>
    </GlassTooltip>
  ),
};

export const Bottom: Story = {
  args: { side: 'bottom', content: 'Appears below' },
  render: (args) => (
    <GlassTooltip {...args}>
      <TriggerButton>Hover me</TriggerButton>
    </GlassTooltip>
  ),
};

export const Left: Story = {
  args: { side: 'left', content: 'Appears left' },
  render: (args) => (
    <GlassTooltip {...args}>
      <TriggerButton>Hover me</TriggerButton>
    </GlassTooltip>
  ),
};

export const Right: Story = {
  args: { side: 'right', content: 'Appears right' },
  render: (args) => (
    <GlassTooltip {...args}>
      <TriggerButton>Hover me</TriggerButton>
    </GlassTooltip>
  ),
};

export const AllSides: Story = {
  name: 'All placements',
  render: () => (
    <div className="grid grid-cols-2 gap-8 place-items-center w-72">
      {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
        <GlassTooltip key={side} content={`Tooltip on ${side}`} side={side}>
          <TriggerButton>{side}</TriggerButton>
        </GlassTooltip>
      ))}
    </div>
  ),
};
