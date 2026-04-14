import type { Meta, StoryObj } from '@storybook/react';
import Stack from './Stack';

const meta = {
  title: 'Primitives/Stack',
  component: Stack,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Flexbox layout primitive. `gap` accepts a number (multiplied by 4px) or a CSS string. ' +
          'All standard `div` props pass through.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    direction: { control: 'radio', options: ['row', 'column'] },
    gap: { control: 'number' },
    align: { control: 'select', options: ['start', 'center', 'end', 'stretch'] },
    justify: {
      control: 'select',
      options: ['start', 'center', 'end', 'between', 'around', 'evenly'],
    },
    wrap: { control: 'boolean' },
  },
  args: {
    direction: 'column',
    gap: 3,
    align: 'start',
    justify: 'start',
  },
} satisfies Meta<typeof Stack>;

export default meta;
type Story = StoryObj<typeof meta>;

const Box = ({ label }: { label: string }) => (
  <div className="bg-card-bg border border-card-border rounded-xl px-4 py-2 text-body-4 text-text-secondary">
    {label}
  </div>
);

export const Column: Story = {
  args: { direction: 'column', gap: 3 },
  render: (args) => (
    <Stack {...args}>
      <Box label="Item 1" />
      <Box label="Item 2" />
      <Box label="Item 3" />
    </Stack>
  ),
};

export const Row: Story = {
  args: { direction: 'row', gap: 3, align: 'center' },
  render: (args) => (
    <Stack {...args}>
      <Box label="Item 1" />
      <Box label="Item 2" />
      <Box label="Item 3" />
    </Stack>
  ),
};

export const RowSpaceBetween: Story = {
  name: 'Row / space-between',
  args: { direction: 'row', justify: 'between', align: 'center', gap: 2 },
  render: (args) => (
    <div className="w-96">
      <Stack {...args}>
        <Box label="Left" />
        <Box label="Right" />
      </Stack>
    </div>
  ),
};
