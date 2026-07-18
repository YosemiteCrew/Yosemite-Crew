import { type ComponentProps, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import SegmentedPill, { SegmentedPillOption } from './SegmentedPill';

type View = 'calendar' | 'board' | 'list';

const VIEW_OPTIONS: ReadonlyArray<SegmentedPillOption<View>> = [
  { value: 'calendar', label: 'Calendar' },
  { value: 'board', label: 'Board' },
  { value: 'list', label: 'List' },
];

const meta = {
  title: 'Primitives/SegmentedPill',
  component: SegmentedPill<View>,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Neutral raised-pill segmented control. Track is `--band` with a `--hairline` border; the active ' +
          'segment is a raised `--screen` pill (shadow) with bold ink text, inactive segments use `--ink-muted`. ' +
          'Segment padding 6px 14px, 12px text — matches the Calendar / Board / List switch in the design.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    disabled: { control: 'boolean' },
  },
  args: {
    options: VIEW_OPTIONS,
    value: 'calendar',
    ariaLabel: 'Appointments view',
    disabled: false,
    onChange: fn(),
  },
} satisfies Meta<typeof SegmentedPill<View>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Calendar: Story = {};
export const Board: Story = { args: { value: 'board' } };
export const List: Story = { args: { value: 'list' } };
export const Disabled: Story = { args: { disabled: true } };

export const TwoOptions: Story = {
  name: 'Two options',
  args: {
    options: [
      { value: 'calendar', label: 'All' },
      { value: 'board', label: 'Mine' },
    ],
    ariaLabel: 'Scope',
  },
};

const InteractiveSegmentedPill = (args: ComponentProps<typeof SegmentedPill<View>>) => {
  const [value, setValue] = useState<View>('calendar');
  return <SegmentedPill<View> {...args} value={value} onChange={setValue} />;
};

export const Interactive: Story = {
  render: (args) => <InteractiveSegmentedPill {...args} />,
};
