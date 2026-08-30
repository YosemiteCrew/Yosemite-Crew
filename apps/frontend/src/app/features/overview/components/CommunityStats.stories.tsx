import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import CommunityStats from './CommunityStats';
import type { StarsDataPoint, TrafficDataPoint } from '../hooks/useOverviewStats';
/* The header pills, the legend row and the Prev/Next footer are all class-only
   markup whose rules live in Overview.css, and only OverviewPage imports that
   file. Without this import every story renders unstyled block divs - which
   still passes any text assertion, so it fails silently. */
import '../pages/Overview.css';

/* Mirrors the label useOverviewStats builds for each daily row ("Feb 1"), so the
   fixture cannot drift from the real shape. */
const dayLabel = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

const traffic = (
  dateKey: string,
  uniqueClones: number,
  cumulativeClones: number,
  uniqueBuilders: number,
  cumulativeBuilders: number
): TrafficDataPoint => ({
  dateKey,
  month: dayLabel.format(new Date(`${dateKey}T00:00:00.000Z`)),
  'Repository clones (unique)': uniqueClones,
  'Repository clones (cumulative)': cumulativeClones,
  'Builders (Unique)': uniqueBuilders,
  'Builders (Cumulative)': cumulativeBuilders,
});

const stars = (dateKey: string, month: string, count: number): StarsDataPoint => ({
  dateKey,
  month,
  'Github Stars': count,
});

/* Three months across two calendar years, deliberately. The Prev/Next footer only
   appears when more than one period exists, and "period" means MONTH under Daily
   but YEAR under Monthly - a fixture confined to one year renders the footer in
   one granularity and hides it in the other. The unique columns stay in single
   digits while the cumulative ones run into the hundreds, so a story can tell
   which pair of keys the view toggle actually read. */
const FEBRUARY = [
  traffic('2026-02-01', 8, 410, 3, 60),
  traffic('2026-02-02', 12, 422, 2, 62),
  traffic('2026-02-03', 6, 428, 5, 67),
  traffic('2026-02-04', 10, 438, 4, 71),
];

const TRAFFIC: TrafficDataPoint[] = [
  traffic('2025-12-01', 4, 210, 2, 30),
  traffic('2025-12-02', 6, 216, 1, 31),
  traffic('2025-12-03', 3, 219, 3, 34),
  traffic('2026-01-05', 7, 320, 2, 48),
  traffic('2026-01-06', 5, 325, 4, 52),
  traffic('2026-01-07', 9, 334, 1, 53),
  ...FEBRUARY,
];

/* Stars arrive already bucketed by month with a full ISO dateKey, and the label
   only repeats the year when it changes - both straight out of useOverviewStats. */
const STARS: StarsDataPoint[] = [
  stars('2025-11-01T00:00:00.000Z', "Nov '25", 40),
  stars('2025-12-01T00:00:00.000Z', 'Dec', 52),
  stars('2026-01-01T00:00:00.000Z', "Jan '26", 61),
  stars('2026-02-01T00:00:00.000Z', 'Feb', 78),
  stars('2026-03-01T00:00:00.000Z', 'Mar', 90),
];

/* recharts hoists tick TEXT out of the `.recharts-xAxis` group and into its own
   z-index layer, so `.recharts-xAxis text` matches nothing and a query written that
   way returns an empty list forever - which reads as "no ticks" rather than as a bad
   selector. `.recharts-xAxis-tick-labels` is the group the labels actually land in. */
const xTicks = (canvasElement: HTMLElement) =>
  [
    ...canvasElement.querySelectorAll(
      '.recharts-xAxis-tick-labels .recharts-cartesian-axis-tick-value'
    ),
  ].map((tick) => tick.textContent?.trim() ?? '');

const yTickValues = (canvasElement: HTMLElement) =>
  [
    ...canvasElement.querySelectorAll(
      '.recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value'
    ),
  ]
    .map((tick) => Number(tick.textContent?.trim()))
    .filter((value) => Number.isFinite(value));

const navLabel = (canvasElement: HTMLElement) =>
  canvasElement.querySelector('.ChartNavigationLabel')?.textContent;

/* recharts is behind a next/dynamic ssr:false boundary AND a ResponsiveContainer,
   so the SVG arrives a tick or two after the story mounts and has zero width until
   the container has measured. Asserting on ticks before both have happened reads an
   empty chart and calls it a pass. */
const waitForChart = async (canvasElement: HTMLElement) => {
  await waitFor(() => expect(canvasElement.querySelector('.recharts-surface')).not.toBeNull());
  await waitFor(() =>
    expect(
      (canvasElement.querySelector('.recharts-wrapper') as HTMLElement).getBoundingClientRect()
        .width
    ).toBeGreaterThan(0)
  );
};

const meta = {
  title: 'Marketing/CommunityStats',
  component: CommunityStats,
  parameters: {
    layout: 'padded',
    surface: 'marketing',
    docs: {
      description: {
        component:
          'The open-source community chart on the public Overview page. Three views (Unique, ' +
          'Cumulative, Stars) cross with a granularity that is not the same set for each: traffic ' +
          'offers Daily/Monthly, Stars offers Monthly/Yearly, and switching view renormalises ' +
          'granularity when the current one does not exist in the new view. The Prev/Next footer ' +
          'pages through whichever period the pair implies - months under Daily, years under ' +
          'Monthly - and is dropped entirely when there is only one period, or when Stars is ' +
          'shown Yearly and every year is already on screen.',
      },
    },
  },
  tags: ['autodocs'],
  args: {
    trafficChart: TRAFFIC,
    starsChart: STARS,
    isLoading: false,
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 900 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CommunityStats>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Unique clones, day by day',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitForChart(canvasElement);

    /* Daily traffic plots against a numeric `dayNumber` axis with explicit ticks, so
       every label is a bare day of the month. Drop xAxisDataKey/xAxisTicks and the
       axis falls back to the `month` category ("Feb 1", "Feb 2"): still a plausible
       looking chart, which is why this is asserted rather than eyeballed. */
    await waitFor(() => {
      const ticks = xTicks(canvasElement);
      expect(ticks.length).toBeGreaterThan(1);
      expect(ticks.every((tick) => /^\d+$/.test(tick))).toBe(true);
      expect(ticks[0]).toBe('1');
      expect(ticks.at(-1)).toBe('4');
    });

    // Under Daily the footer names the month in full, and it opens on the latest
    // month, so Next has nowhere left to go.
    expect(navLabel(canvasElement)).toBe('February 2026');
    expect(canvas.getByRole('button', { name: 'Show next period' })).toBeDisabled();
    expect(canvas.getByRole('button', { name: 'Show previous period' })).toBeEnabled();

    // Unique reads the (unique) columns - single digits per day. The cumulative
    // columns on the same rows are in the hundreds, so this pins which pair was read.
    expect(Math.max(...yTickValues(canvasElement))).toBeLessThan(100);

    /* At laptop width ChartCardTopRow is a three-column grid, so the period toggle
       and the view toggle share a row. Without Overview.css they are plain block
       divs and stack at every width - this is what proves the stylesheet loaded. */
    const period = canvasElement.querySelector('.PeriodToggle') as HTMLElement;
    const view = canvasElement.querySelector('.DataToggle') as HTMLElement;
    expect(
      Math.abs(period.getBoundingClientRect().top - view.getBoundingClientRect().top)
    ).toBeLessThan(2);
  },
};

export const NavigatesMonths: Story = {
  name: 'Stepping back through months',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitForChart(canvasElement);
    const prev = canvas.getByRole('button', { name: 'Show previous period' });

    await userEvent.click(prev);
    await waitFor(() => expect(navLabel(canvasElement)).toBe('January 2026'));
    // The series has to re-filter, not just the caption: January's rows are the 5th
    // to the 7th, so the day axis moves with the heading.
    await waitFor(() => expect(xTicks(canvasElement)).toEqual(['5', '6', '7']));

    await userEvent.click(prev);
    await waitFor(() => expect(navLabel(canvasElement)).toBe('December 2025'));
    // Earliest month in the fixture: Prev locks, Next opens back up. Both ends are
    // disabled by index, never by hiding the button, so the footer never reflows.
    expect(prev).toBeDisabled();
    expect(canvas.getByRole('button', { name: 'Show next period' })).toBeEnabled();
  },
};

export const CumulativeMonthly: Story = {
  name: 'Cumulative, aggregated by month',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitForChart(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: 'Cumulative' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Monthly' }));

    // Monthly buckets the daily rows and labels each bucket from the first row in it,
    // and the footer swaps the full month heading for a bare year.
    await waitFor(() => expect(xTicks(canvasElement)).toEqual(["Jan '26", "Feb '26"]));
    expect(navLabel(canvasElement)).toBe('2026');

    /* The view toggle genuinely swaps which columns are summed. Bucketed cumulative
       clones clear a thousand; the unique columns over the same two months total 57.
       Two line charts of the same shape are indistinguishable without this. */
    await waitFor(() => expect(Math.max(...yTickValues(canvasElement))).toBeGreaterThan(1000));

    // A year with a single month still charts - one bucket, one tick.
    await userEvent.click(canvas.getByRole('button', { name: 'Show previous period' }));
    await waitFor(() => expect(xTicks(canvasElement)).toEqual(["Dec '25"]));
  },
};

export const StarsMonthly: Story = {
  name: 'Stars, navigating by year',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitForChart(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: 'Stars' }));

    /* Stars has no Daily bucket, so switching view has to renormalise granularity in
       the same update. If it did not, the lit pill and the data would disagree: the
       render falls back to Monthly while the toggle still says Daily. */
    await waitFor(() => expect(canvas.queryByRole('button', { name: 'Daily' })).toBeNull());
    expect(canvas.getByRole('button', { name: 'Yearly' })).toBeInTheDocument();
    expect(canvas.getByRole('button', { name: 'Monthly' }).className).toContain('Active');

    // Monthly stars are paged a year at a time, latest year first.
    expect(navLabel(canvasElement)).toBe('2026');
    await waitFor(() => expect(xTicks(canvasElement)).toHaveLength(3));

    await userEvent.click(canvas.getByRole('button', { name: 'Show previous period' }));
    await waitFor(() => expect(navLabel(canvasElement)).toBe('2025'));
    // 2025 carries two months of stars against 2026's three, so the series shortens
    // with the label rather than the caption moving on its own.
    await waitFor(() => expect(xTicks(canvasElement)).toHaveLength(2));
    expect(canvas.getByRole('button', { name: 'Show previous period' })).toBeDisabled();
  },
};

export const StarsYearly: Story = {
  name: 'Stars by year: navigation suppressed',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitForChart(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: 'Stars' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Yearly' }));

    // Yearly collapses each year to its last reading, so every year is on screen at
    // once and there is nothing to page through.
    await waitFor(() => expect(xTicks(canvasElement)).toEqual(['2025', '2026']));
    // The footer is removed, not rendered with two permanently dead buttons.
    expect(canvasElement.querySelector('.ChartNavigation')).toBeNull();
    expect(canvas.queryByRole('button', { name: 'Show previous period' })).toBeNull();
    expect(canvas.queryByRole('button', { name: 'Show next period' })).toBeNull();
  },
};

export const SinglePeriod: Story = {
  name: 'One month of data: no footer',
  args: { trafficChart: FEBRUARY, starsChart: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitForChart(canvasElement);
    // buildNavigationConfig bails at one period. Rendering the footer here would
    // offer two buttons that can never do anything.
    expect(canvasElement.querySelector('.ChartNavigation')).toBeNull();
    expect(canvas.getByRole('button', { name: 'Unique' }).className).toContain('Active');
  },
};

export const Empty: Story = {
  name: 'No repository data yet',
  args: { trafficChart: [], starsChart: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    /* The card is never given `isEmpty`, so an empty fixture still draws bare axes
       rather than the "No data available" state. What matters is that the toggles
       survive it - they are the only way to reach a view that does have data. */
    await waitFor(() => expect(canvasElement.querySelector('.recharts-surface')).not.toBeNull());
    expect(xTicks(canvasElement)).toHaveLength(0);
    expect(canvasElement.querySelector('.ChartNavigation')).toBeNull();
    expect(canvas.getByRole('button', { name: 'Stars' })).toBeInTheDocument();
  },
};

export const Loading: Story = {
  name: 'Loading',
  args: { isLoading: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText('Loading Repository Data…')).toBeInTheDocument();
    // isLoading returns before any of the chart chrome is built, so nothing is
    // mounted behind the message - no half-built toggles, no recharts chunk.
    expect(canvas.queryByRole('button', { name: 'Unique' })).toBeNull();
    expect(canvasElement.querySelector('.CommunityStatsContainer')).toBeNull();
  },
};

export const Phone: Story = {
  name: 'Phone: the header stacks',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: {
    docs: {
      description: {
        story:
          'Below 768 ChartCardTopRow drops to a single column: the period toggle, the legend and ' +
          'the view toggle stack instead of splitting 375px three ways, and both pill groups go ' +
          'full width up to 320px. Deliberately no play function - the layout hangs off a viewport ' +
          'media query, and the viewport preset is applied by the Storybook manager, so a headless ' +
          'run of `iframe.html` still renders this at the harness width and any geometry assertion ' +
          'here would be measuring the desktop grid while claiming to prove the phone one.',
      },
    },
  },
};
