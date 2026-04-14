import type { Meta, StoryObj } from '@storybook/react';
import Text from './Text';

const ALL_VARIANTS = [
  'display-1',
  'display-2',
  'heading-1',
  'heading-2',
  'heading-3',
  'body-1',
  'body-2',
  'body-3',
  'body-3-emphasis',
  'body-4',
  'body-4-emphasis',
  'label-1',
  'caption-1',
  'caption-2',
] as const;

const meta = {
  title: 'Primitives/Text',
  component: Text,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Polymorphic text primitive. Pass `as` to change the rendered element. ' +
          '`variant` maps to a Tailwind typography utility from the design token scale.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ALL_VARIANTS },
    as: { control: 'select', options: ['span', 'p', 'h1', 'h2', 'h3', 'h4', 'label'] },
  },
  args: {
    variant: 'body-4',
    children: 'The quick brown fox jumps over the lazy dog.',
  },
} satisfies Meta<typeof Text>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AllVariants: Story = {
  name: 'Type scale',
  render: () => (
    <div className="flex flex-col gap-4 w-full max-w-xl">
      {ALL_VARIANTS.map((v) => (
        <div key={v} className="flex items-baseline gap-4">
          <span className="w-40 shrink-0 text-caption-2 text-text-secondary font-mono">{v}</span>
          <Text variant={v}>Yosemite Crew</Text>
        </div>
      ))}
    </div>
  ),
};
