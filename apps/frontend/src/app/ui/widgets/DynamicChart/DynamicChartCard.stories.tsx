import type { Meta, StoryObj } from '@storybook/react';

import type { ChartKey } from './chartAxis';
import DynamicChartCard from './DynamicChartCard';

const APPOINTMENT_KEYS: ChartKey[] = [
  { name: 'Completed', color: 'var(--cta)' },
  { name: 'Cancelled', color: 'var(--divider)' },
];

const REVENUE_KEYS: ChartKey[] = [{ name: 'Revenue', color: 'var(--blue)' }];

const APPOINTMENTS = [
  { month: 'Mon', Completed: 18, Cancelled: 3 },
  { month: 'Tue', Completed: 24, Cancelled: 1 },
  { month: 'Wed', Completed: 21, Cancelled: 5 },
  { month: 'Thu', Completed: 27, Cancelled: 2 },
  { month: 'Fri', Completed: 30, Cancelled: 4 },
  { month: 'Sat', Completed: 12, Cancelled: 2 },
  { month: 'Sun', Completed: 6, Cancelled: 0 },
];

const REVENUE = [
  { month: 'Jan', Revenue: 12400 },
  { month: 'Feb', Revenue: 14850 },
  { month: 'Mar', Revenue: 11200 },
  { month: 'Apr', Revenue: 17600 },
  { month: 'May', Revenue: 19050 },
  { month: 'Jun', Revenue: 16300 },
];

const PRODUCTS = [
  { month: 'Amoxicillin 250mg', Turnover: 9.4 },
  { month: 'Meloxicam oral suspension', Turnover: 7.1 },
  { month: 'Feline trivalent vaccine', Turnover: 5.8 },
  { month: 'Sterile gauze pads', Turnover: 3.2 },
];

const meta = {
  title: 'Widgets/DynamicChartCard',
  component: DynamicChartCard,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The shared chart card behind every dashboard and report graph: a `--screen` card with a ' +
          'hairline border, an optional header (its own `headerContent`, or the built-in right-aligned ' +
          'legend) and a lazily loaded recharts canvas. recharts lives behind one `next/dynamic` ' +
          'boundary at the canvas, so it stays out of the initial bundle; while that chunk loads the ' +
          'card shows a pulsing `--inset` block of the same height, which is why the card never ' +
          'changes size between loading and loaded.',
      },
    },
  },
  argTypes: {
    type: { control: 'radio', options: ['bar', 'line'] },
    isEmpty: { control: 'boolean' },
    hideYAxis: { control: 'boolean' },
    hideKeys: { control: 'boolean' },
    chartHeight: { control: 'number' },
  },
  args: {
    data: APPOINTMENTS,
    keys: APPOINTMENT_KEYS,
    type: 'bar',
    isEmpty: false,
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 620 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DynamicChartCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const StackedBars: Story = {
  name: 'Stacked bars',
  parameters: {
    docs: {
      description: {
        story:
          'The default: series stacked on a shared `stackId`, a dashed horizontal grid and the legend ' +
          'right-aligned above the plot rather than centred, which is what keeps a card title and its ' +
          'legend on one line.',
      },
    },
  },
};

export const Sparkline: Story = {
  name: 'Sparkline (no Y axis)',
  args: { hideYAxis: true, barSize: 14, chartHeight: 150, hideKeys: true },
  parameters: {
    docs: {
      description: {
        story:
          'The compact form the dashboard stat cards use. `hideYAxis` drops both the axis and the grid, ' +
          '`hideKeys` suppresses the legend so the caller can put its own header above, and the height ' +
          'comes down to 150px.',
      },
    },
  },
};

export const Line: Story = {
  name: 'Line, with axis labels',
  args: {
    data: REVENUE,
    keys: REVENUE_KEYS,
    type: 'line',
    yAxisLabel: 'Revenue',
    xAxisLabel: 'Month',
    yTickFormatter: (value: number) => `$${(value / 1000).toFixed(0)}k`,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Trend series with both axis labels set. Naming an axis widens the chart margin on that side ' +
          'so the rotated Y label has somewhere to sit, and `yTickFormatter` is what keeps currency ' +
          'ticks from running into the plot.',
      },
    },
  },
};

export const HorizontalBars: Story = {
  name: 'Horizontal bars (long labels)',
  args: {
    data: PRODUCTS,
    keys: [{ name: 'Turnover', color: 'var(--blue)' }],
    layout: 'vertical',
    chartHeight: 200,
    barSize: 12,
  },
  parameters: {
    docs: {
      description: {
        story:
          'The per-product report layout. In `vertical` layout the category axis moves to the left and ' +
          'its ticks are drawn tilted at -30 degrees in a fixed 100px gutter - the overflow case worth ' +
          'watching, since product names are long and the gutter does not grow.',
      },
    },
  },
};

export const Empty: Story = {
  name: 'No data',
  args: { data: [], isEmpty: true },
  parameters: {
    docs: {
      description: {
        story:
          'When the period has nothing to plot the card keeps its shell and legend and swaps the canvas ' +
          'for the shared three-bar glyph, so a dashboard of empty cards still reads as a grid instead ' +
          'of collapsing.',
      },
    },
  },
};
