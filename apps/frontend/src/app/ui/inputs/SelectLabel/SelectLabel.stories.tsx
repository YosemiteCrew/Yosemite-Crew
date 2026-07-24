import { useState, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import SelectLabel from './index';

const SPECIES_OPTIONS = [
  { label: 'Dog', value: 'dog' },
  { label: 'Cat', value: 'cat' },
  { label: 'Horse', value: 'horse' },
];

const StatefulSelectLabel = (args: ComponentProps<typeof SelectLabel>) => {
  const [active, setActive] = useState(args.activeOption);
  return <SelectLabel {...args} activeOption={active} setOption={setActive} />;
};

const meta = {
  title: 'Inputs/SelectLabel',
  component: SelectLabel,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Labelled single-choice pill group. Pills are full-radius chips (1.5px border, ' +
          '12px caption text) with a blue-tinted active state, matching the design chip pattern. ' +
          'Use `type="coloumn"` to stack the label above wrapping pills.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    title: 'Species',
    options: SPECIES_OPTIONS,
    activeOption: 'dog',
    setOption: () => {},
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
  render: (args) => <StatefulSelectLabel {...args} />,
} satisfies Meta<typeof SelectLabel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Row: Story = {};

export const Column: Story = {
  args: { type: 'coloumn', title: 'Priority' },
  parameters: {
    docs: { story: 'Stacked layout: label above a wrapping row of pills.' },
  },
};
