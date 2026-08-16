import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import StatCardShell from './StatCardShell';

const DURATIONS = ['Last week', 'Last month', 'Last 6 months', 'Last 1 year'] as const;

const TREND = [
  { month: 'Mar', turnover: 3.1 },
  { month: 'Apr', turnover: 4.4 },
  { month: 'May', turnover: 3.8 },
  { month: 'Jun', turnover: 5.2 },
  { month: 'Jul', turnover: 4.9 },
  { month: 'Aug', turnover: 2.4 },
];

const MAX_TURNOVER = TREND.reduce((max, point) => Math.max(max, point.turnover), 0);

/**
 * The bar body the inventory stats render inside the shell. Kept in the story
 * rather than imported because the real stat components (`InventoryStat` and
 * friends) read `useDashboardAnalytics`, which fetches.
 */
const TurnoverBars = () => (
  <div className="flex h-30 flex-1 items-end gap-2.5 px-1">
    {TREND.map((point, index) => {
      const isPartial = index === TREND.length - 1;
      const isPeak = point.turnover === MAX_TURNOVER;
      return (
        <div
          key={point.month}
          className="flex h-full flex-1 flex-col items-center justify-end gap-1"
        >
          <div
            className="w-full max-w-[34px]"
            style={{
              height: `${(point.turnover / MAX_TURNOVER) * 100}%`,
              background: isPartial ? 'var(--divider)' : 'var(--cta)',
              opacity: isPartial || isPeak ? 1 : 0.85,
              borderRadius: '5px 5px 2px 2px',
            }}
          />
          <span className="text-[10px] text-[var(--ink-faint)]">{point.month}</span>
        </div>
      );
    })}
  </div>
);

const meta = {
  title: 'Widgets/Stats/StatCardShell',
  component: StatCardShell,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The card every dashboard stat is drawn inside: a `CardHeader` with the duration pill ' +
          'above an 18px-radius `--screen` surface. It owns the shared "no data" state, so an ' +
          'empty inventory card and an empty revenue card cannot drift apart.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    isEmpty: { control: 'boolean' },
    selected: { control: 'select', options: DURATIONS },
  },
  args: {
    title: 'Annual inventory turnover',
    options: DURATIONS,
    selected: 'Last 1 year',
    isEmpty: false,
    onSelect: fn(),
    children: <TurnoverBars />,
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 420 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StatCardShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'With a chart body',
};

export const Empty: Story = {
  name: 'No data',
  args: { isEmpty: true },
  parameters: {
    docs: {
      description: {
        story:
          'When `isEmpty` is set the shell swaps `children` for the shared placeholder — three ' +
          '`--divider` bars over "No data available" — so the card keeps its height instead of ' +
          'collapsing the dashboard grid.',
      },
    },
  },
};

export const CustomHeight: Story = {
  name: 'Leaderboard body (custom height)',
  args: {
    title: 'Revenue leaders',
    selected: 'Last month',
    cardClassName: 'gap-3',
    children: (
      <div className="flex flex-col gap-3">
        {[
          { label: 'Dr. Amelie Roth', value: '€12,480' },
          { label: 'Dr. Tomas Lindqvist', value: '€9,120' },
          { label: 'Dr. Priya Nair', value: '€7,640' },
        ].map((row) => (
          <div key={row.label} className="flex items-center justify-between">
            <span className="text-[13px] text-[var(--ink-body)]">{row.label}</span>
            <span className="text-[13px] font-bold text-[var(--ink)]">{row.value}</span>
          </div>
        ))}
      </div>
    ),
  },
  parameters: {
    docs: {
      description: {
        story:
          '`cardClassName` replaces the default `min-h-75 gap-2.5` surface classes, for the cards ' +
          'that hold a list rather than a fixed-height chart. Everything else — header, radius, ' +
          'hairline, shadow, empty state — stays shared.',
      },
    },
  },
};
