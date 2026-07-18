import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import CardHeader from './CardHeader';

const meta = {
  title: 'Cards/CardHeader',
  component: CardHeader,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Section header with a title and a hairline period-filter pill (11px / semibold / --ink-muted, 10px chevron) matching the responsive dashboard design.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    title: 'Explore',
    options: ['Last week', 'Last month', 'Last 6 months'],
    onSelect: fn(),
  },
} satisfies Meta<typeof CardHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LongTitle: Story = {
  name: 'Long title (wraps beside pill)',
  args: { title: 'Appointment leaders by clinician' },
};

export const Controlled: Story = {
  args: { selected: 'Last month' },
};
