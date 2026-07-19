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
          'Three sizes match the design frames: `sm` (5px 13px / 11.5px, settings and phone controls), ' +
          '`md` (5px 14px / 12px, dashboard, specialities and chat) and `lg` (6px 15px / 12.5px, main tab controls). ' +
          'Pass `fullWidth` for equal-width segments that span their container, as in the chat sidebar.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    disabled: { control: 'boolean' },
    size: { control: 'radio', options: ['sm', 'md', 'lg'] },
    fullWidth: { control: 'boolean' },
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

export const Medium: Story = { name: 'Size md', args: { size: 'md' } };
export const Large: Story = { name: 'Size lg', args: { size: 'lg' } };

export const FullWidth: Story = {
  name: 'Full width',
  args: { size: 'md', fullWidth: true },
  decorators: [
    (StoryFn) => (
      <div style={{ width: 330 }}>
        <StoryFn />
      </div>
    ),
  ],
};

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
