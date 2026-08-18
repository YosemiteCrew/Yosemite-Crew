import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
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
          'empty inventory card and an empty revenue card cannot drift apart.\n\n' +
          'The duration pill is a trigger, and its panel had never been drawn **in this context**. ' +
          '`CardHeader` renders the listbox behind an internal `open` flag that no `StatCardShell` ' +
          'prop reaches, so every stat-card story showed a closed pill. That is not the same gap as ' +
          "`Cards/CardHeader`'s own stories: what is unique here is where the panel lands. It is " +
          '`absolute top-[120%] right-0` inside the header row, and the header row sits **above** ' +
          'the card surface rather than inside it - so the panel opens over the top edge of an ' +
          '18px-radius `--screen` box carrying two shadows, at `z-10`, with no stacking context of ' +
          'its own to hold it there. Every dashboard stat inherits that overlap, and none of them ' +
          'had a snapshot of it.\n\n' +
          'The panel takes its width from its longest option (`min-w-full` plus `whitespace-nowrap`) ' +
          'rather than from the pill, so it grows leftwards from the right-aligned edge and crosses ' +
          'the card beneath. The stories open it and assert the options are there, since an empty ' +
          'panel would satisfy `aria-expanded` on its own.',
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

/** The pill's accessible name carries the current selection, so match loosely. */
const openDurationPanel = async (canvasElement: HTMLElement, title: string) => {
  const canvas = within(canvasElement);
  await userEvent.click(
    canvas.getByRole('button', { name: new RegExp(`Filter ${title} by time period`, 'i') })
  );
  return canvas.getByLabelText(`Filter ${title} by time period`);
};

export const DurationPanelOpen: Story = {
  name: 'Duration panel open',
  play: async ({ canvasElement }) => {
    const panel = await openDurationPanel(canvasElement, 'Annual inventory turnover');
    // Assert the panel has its four options, not merely that the pill toggled.
    await expect(within(panel).getAllByRole('button')).toHaveLength(4);
    await expect(within(panel).getByRole('button', { name: 'Last 1 year' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(within(panel).getByRole('button', { name: 'Last week' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'The panel hanging over the card. It is a `bg-neutral-0` sheet with a `--card-border` ' +
          'hairline and a two-layer shadow, dropped at `top-[120%] right-0` from the pill — so it ' +
          'covers the top-right corner of the chart body underneath, including its rounded edge. ' +
          'The selected period is marked only by `aria-pressed`; there is no check mark, so the ' +
          'current row has to read as current on colour alone.',
      },
    },
  },
};

export const DurationPanelOverEmptyCard: Story = {
  name: 'Duration panel over the empty state',
  args: { isEmpty: true },
  play: async ({ canvasElement }) => {
    const panel = await openDurationPanel(canvasElement, 'Annual inventory turnover');
    await expect(within(panel).getAllByRole('button')).toHaveLength(4);
  },
  parameters: {
    docs: {
      description: {
        story:
          'The same panel over the shared placeholder rather than a chart. Worth drawing separately: ' +
          'the empty state is centred `--ink-faint` on the bare `--screen` surface, so the panel has ' +
          'nothing but a flat background behind it and its hairline is the only thing separating the ' +
          'two — the case where a too-faint border disappears.',
      },
    },
  },
};

export const DurationPanelOnCustomBody: Story = {
  name: 'Duration panel over a list body',
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
  play: async ({ canvasElement }) => {
    const panel = await openDurationPanel(canvasElement, 'Revenue leaders');
    await expect(within(panel).getAllByRole('button')).toHaveLength(4);
    await expect(within(panel).getByRole('button', { name: 'Last month' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'A shorter title and a list body. The panel is sized by its longest option rather than by ' +
          'the pill, so shrinking the title does not shrink the panel — it just moves the pill left ' +
          'and leaves the sheet hanging over the first leaderboard row.',
      },
    },
  },
};
