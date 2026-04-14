import type { Meta, StoryObj } from '@storybook/react';
import YosemiteLoader from './YosemiteLoader';

const meta = {
  title: 'Overlays/YosemiteLoader',
  component: YosemiteLoader,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Branded loader. Three variants: `inline` for in-context loading, ' +
          '`fullscreen` for page-level loading, `fullscreen-translucent` for overlay loading ' +
          'over existing content.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['inline', 'fullscreen', 'fullscreen-translucent'] },
    size: { control: 'number' },
    label: { control: 'text' },
  },
  args: {
    variant: 'inline',
    size: 80,
  },
} satisfies Meta<typeof YosemiteLoader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Inline: Story = {
  args: { variant: 'inline' },
};

export const InlineWithLabel: Story = {
  name: 'Inline with label',
  args: { variant: 'inline', label: 'Loading appointments…' },
};

export const InlineSmall: Story = {
  name: 'Inline / small (40px)',
  args: { variant: 'inline', size: 40 },
};
