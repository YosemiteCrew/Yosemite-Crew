import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import CommunityStats from '../../../../features/overview/components/CommunityStats';

// Captures the latest props handed to the chart so tests can assert on the axis
// config and invoke the formatter callbacks the component builds.
const mockChartProps: { current: any } = { current: null };

jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: () => {
    const MockDynamicChartCard = (props: any) => {
      mockChartProps.current = props;
      const {
        data,
        keys,
        yAxisWidth,
        chartHeight,
        compactMonthAxis,
        headerContent,
        footerContent,
      } = props;
      return (
        <div data-testid="mock-dynamic-chart">
          <div data-testid="chart-header">{headerContent}</div>
          <div data-testid="chart-data">{JSON.stringify(data)}</div>
          <div data-testid="chart-keys">{JSON.stringify(keys)}</div>
          <div data-testid="chart-yaxis">{yAxisWidth}</div>
          <div data-testid="chart-height">{chartHeight}</div>
          <div data-testid="chart-compact-axis">{String(compactMonthAxis)}</div>
          <div data-testid="chart-footer">{footerContent}</div>
        </div>
      );
    };
    MockDynamicChartCard.displayName = 'MockDynamicChartCard';
    return MockDynamicChartCard;
  },
}));

const readChartData = () =>
  JSON.parse(screen.getByTestId('chart-data').textContent as unknown as string);

// ==========================================
// 1. MOCK SETUP
// ==========================================

// ==========================================
// 2. MOCK DATA
// ==========================================

const mockTrafficChart = [
  {
    dateKey: '2026-02-27',
    month: 'Feb 27',
    'Self Hosters (Unique)': 4,
    'Self Hosters (Cumulative)': 40,
    'Builders (Unique)': 2,
    'Builders (Cumulative)': 20,
  },
  {
    dateKey: '2026-03-08',
    month: 'Mar 8',
    'Self Hosters (Unique)': 10,
    'Self Hosters (Cumulative)': 100,
    'Builders (Unique)': 5,
    'Builders (Cumulative)': 50,
  },
  {
    dateKey: '2026-03-09',
    month: 'Mar 9',
    'Self Hosters (Unique)': 8,
    'Self Hosters (Cumulative)': 90,
    'Builders (Unique)': 3,
    'Builders (Cumulative)': 53,
  },
  {
    dateKey: '2026-04-01',
    month: 'Apr 1',
    'Self Hosters (Unique)': 6,
    'Self Hosters (Cumulative)': 70,
    'Builders (Unique)': 2,
    'Builders (Cumulative)': 55,
  },
  {
    dateKey: '2026-04-02',
    month: 'Apr 2',
    'Self Hosters (Unique)': 7,
    'Self Hosters (Cumulative)': 80,
    'Builders (Unique)': 4,
    'Builders (Cumulative)': 59,
  },
  {
    dateKey: '2025-12-31',
    month: 'Dec 31',
    'Self Hosters (Unique)': 3,
    'Self Hosters (Cumulative)': 35,
    'Builders (Unique)': 1,
    'Builders (Cumulative)': 18,
  },
];

const mockStarsChart = [
  {
    dateKey: '2025-12-01T00:00:00.000Z',
    month: "Dec '25",
    'Github Stars': 500,
  },
  {
    dateKey: '2026-01-01T00:00:00.000Z',
    month: "Jan '26",
    'Github Stars': 900,
  },
  {
    dateKey: '2026-03-01T00:00:00.000Z',
    month: 'Mar 2026',
    'Github Stars': 2099,
  },
];

// ==========================================
// 3. TEST SUITE
// ==========================================

describe('CommunityStats Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('1. renders the loading state correctly', () => {
    render(<CommunityStats trafficChart={[]} starsChart={[]} isLoading={true} />);

    expect(screen.getByText('Loading Repository Data…')).toBeInTheDocument();

    // Ensure chart is NOT rendered
    expect(screen.queryByTestId('mock-dynamic-chart')).not.toBeInTheDocument();
  });

  it('2. renders default "Unique" traffic data correctly', () => {
    render(
      <CommunityStats
        trafficChart={mockTrafficChart}
        starsChart={mockStarsChart}
        isLoading={false}
      />
    );

    // Assert Toggle Buttons
    const uniqueBtn = screen.getByText('Unique');
    const cumulativeBtn = screen.getByText('Cumulative');
    const starsBtn = screen.getByText('Stars');

    expect(uniqueBtn).toHaveClass('Active');
    expect(cumulativeBtn).not.toHaveClass('Active');
    expect(starsBtn).not.toHaveClass('Active');

    // Extract transformed data passed to the chart
    const chartDataJson = screen.getByTestId('chart-data').textContent;
    const chartData = JSON.parse(chartDataJson as unknown as string);

    // Verify default daily view only shows the latest month
    expect(chartData).toEqual([
      { month: 'Apr 1', dayNumber: 1, 'Self Hosters': 6, Builders: 2 },
      { month: 'Apr 2', dayNumber: 2, 'Self Hosters': 7, Builders: 4 },
    ]);
    expect(screen.getByText('April 2026')).toBeInTheDocument();

    // Verify yAxisWidth default
    expect(screen.getByTestId('chart-yaxis').textContent).toBe('40');
    expect(screen.getByTestId('chart-height').textContent).toBe('320');
    expect(screen.getByTestId('chart-compact-axis').textContent).toBe('true');
  });

  it('3. updates data correctly when "Cumulative" is clicked', () => {
    render(
      <CommunityStats
        trafficChart={mockTrafficChart}
        starsChart={mockStarsChart}
        isLoading={false}
      />
    );

    const cumulativeBtn = screen.getByText('Cumulative');

    // Click Cumulative
    fireEvent.click(cumulativeBtn);

    // Verify Active Class swapped
    expect(cumulativeBtn).toHaveClass('Active');
    expect(screen.getByText('Unique')).not.toHaveClass('Active');

    // Extract transformed data passed to the chart after click
    const chartDataJson = screen.getByTestId('chart-data').textContent;
    const chartData = JSON.parse(chartDataJson as unknown as string);

    // Verify mapping logic swapped to the latest month's cumulative values
    expect(chartData).toEqual([
      { month: 'Apr 1', dayNumber: 1, 'Self Hosters': 70, Builders: 55 },
      { month: 'Apr 2', dayNumber: 2, 'Self Hosters': 80, Builders: 59 },
    ]);
  });

  it('4. aggregates traffic correctly when "Monthly" is clicked', () => {
    render(
      <CommunityStats
        trafficChart={mockTrafficChart}
        starsChart={mockStarsChart}
        isLoading={false}
      />
    );

    fireEvent.click(screen.getByText('Monthly'));

    const chartDataJson = screen.getByTestId('chart-data').textContent;
    const chartData = JSON.parse(chartDataJson as unknown as string);

    expect(chartData).toEqual([
      { month: "Feb '26", 'Self Hosters': 4, Builders: 2 },
      { month: "Mar '26", 'Self Hosters': 18, Builders: 8 },
      { month: "Apr '26", 'Self Hosters': 13, Builders: 6 },
    ]);
    expect(screen.getByText('2026')).toBeInTheDocument();
    expect(screen.getByTestId('chart-compact-axis').textContent).toBe('false');
  });

  it('5. navigates to the previous month in daily traffic view', () => {
    render(
      <CommunityStats
        trafficChart={mockTrafficChart}
        starsChart={mockStarsChart}
        isLoading={false}
      />
    );

    fireEvent.click(screen.getByLabelText('Show previous period'));
    const chartDataJson = screen.getByTestId('chart-data').textContent;
    const chartData = JSON.parse(chartDataJson as unknown as string);

    expect(chartData).toEqual([
      { month: 'Mar 8', dayNumber: 8, 'Self Hosters': 10, Builders: 5 },
      { month: 'Mar 9', dayNumber: 9, 'Self Hosters': 8, Builders: 3 },
    ]);
    expect(screen.getByText('March 2026')).toBeInTheDocument();
  });

  it('6. updates data correctly when "Stars" is clicked', () => {
    render(
      <CommunityStats
        trafficChart={mockTrafficChart}
        starsChart={mockStarsChart}
        isLoading={false}
      />
    );

    const starsBtn = screen.getByText('Stars');

    fireEvent.click(starsBtn);

    expect(starsBtn).toHaveClass('Active');
    expect(screen.getByText('Monthly')).toHaveClass('Active');
    expect(screen.getByText('2026')).toBeInTheDocument();

    const chartDataJson = screen.getByTestId('chart-data').textContent;
    const chartData = JSON.parse(chartDataJson as unknown as string);

    expect(chartData).toEqual([
      {
        month: "Jan '26",
        'Github Stars': 900,
      },
      {
        month: 'Mar 2026',
        'Github Stars': 2099,
      },
    ]);
    expect(screen.getByTestId('chart-yaxis').textContent).toBe('45');
    expect(screen.getByTestId('chart-compact-axis').textContent).toBe('true');
  });

  it('7. aggregates stars correctly when "Yearly" is clicked', () => {
    render(
      <CommunityStats
        trafficChart={mockTrafficChart}
        starsChart={mockStarsChart}
        isLoading={false}
      />
    );

    fireEvent.click(screen.getByText('Stars'));
    fireEvent.click(screen.getByText('Yearly'));

    const chartDataJson = screen.getByTestId('chart-data').textContent;
    const chartData = JSON.parse(chartDataJson as unknown as string);

    expect(chartData).toEqual([
      { month: '2025', 'Github Stars': 500 },
      { month: '2026', 'Github Stars': 2099 },
    ]);
  });

  it('8. lets monthly traffic navigate across years', () => {
    render(
      <CommunityStats
        trafficChart={mockTrafficChart}
        starsChart={mockStarsChart}
        isLoading={false}
      />
    );

    fireEvent.click(screen.getByText('Monthly'));
    fireEvent.click(screen.getByLabelText('Show previous period'));

    const chartDataJson = screen.getByTestId('chart-data').textContent;
    const chartData = JSON.parse(chartDataJson as unknown as string);

    expect(chartData).toEqual([{ month: "Dec '25", 'Self Hosters': 3, Builders: 1 }]);
    expect(screen.getByText('2025')).toBeInTheDocument();
  });

  it('9. preserves the selected month when switching between cumulative and unique', () => {
    render(
      <CommunityStats
        trafficChart={mockTrafficChart}
        starsChart={mockStarsChart}
        isLoading={false}
      />
    );

    fireEvent.click(screen.getByLabelText('Show previous period'));
    fireEvent.click(screen.getByText('Cumulative'));

    expect(screen.getByText('March 2026')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Unique'));

    const chartDataJson = screen.getByTestId('chart-data').textContent;
    const chartData = JSON.parse(chartDataJson as unknown as string);

    expect(screen.getByText('March 2026')).toBeInTheDocument();
    expect(chartData).toEqual([
      { month: 'Mar 8', dayNumber: 8, 'Self Hosters': 10, Builders: 5 },
      { month: 'Mar 9', dayNumber: 9, 'Self Hosters': 8, Builders: 3 },
    ]);
  });

  it('10. verifies chart keys always contain all three labels', () => {
    render(
      <CommunityStats
        trafficChart={mockTrafficChart}
        starsChart={mockStarsChart}
        isLoading={false}
      />
    );

    // Extract keys passed to the chart
    const chartKeysJson = screen.getByTestId('chart-keys').textContent;
    const chartKeys = JSON.parse(chartKeysJson as unknown as string);

    // Verify all three labels are permanently passed to the legend
    expect(chartKeys).toEqual([
      { name: 'Self Hosters', color: 'var(--color-badge-blue-bg)' },
      { name: 'Builders', color: 'var(--success)' },
      { name: 'Github Stars', color: 'var(--color-warning-600)' },
    ]);
  });

  it('11. aggregates cumulative traffic by month, carrying the latest running totals', () => {
    render(
      <CommunityStats
        trafficChart={mockTrafficChart}
        starsChart={mockStarsChart}
        isLoading={false}
      />
    );

    fireEvent.click(screen.getByText('Monthly'));
    fireEvent.click(screen.getByText('Cumulative'));

    expect(screen.getByText('Cumulative')).toHaveClass('Active');
    expect(screen.getByText('Monthly')).toHaveClass('Active');

    // Self Hosters sum within the month, Builders take the month's last cumulative value
    expect(readChartData()).toEqual([
      { month: "Feb '26", 'Self Hosters': 40, Builders: 20 },
      { month: "Mar '26", 'Self Hosters': 190, Builders: 53 },
      { month: "Apr '26", 'Self Hosters': 150, Builders: 59 },
    ]);
  });

  it('12. renders an empty chart with no navigation when there is no traffic data', () => {
    render(<CommunityStats trafficChart={[]} starsChart={[]} isLoading={false} />);

    expect(readChartData()).toEqual([]);
    expect(screen.getByTestId('chart-yaxis').textContent).toBe('40');
    expect(screen.queryByLabelText('Show previous period')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Show next period')).not.toBeInTheDocument();
    expect(screen.getByTestId('chart-footer')).toBeEmptyDOMElement();
    // no period could be resolved, so no axis config is derived
    expect(mockChartProps.current.xAxisTicks).toBeUndefined();
  });

  it('13. hides navigation when only a single period is available', () => {
    render(
      <CommunityStats
        trafficChart={[
          {
            dateKey: '2026-04-01',
            month: 'Apr 1',
            'Self Hosters (Unique)': 6,
            'Self Hosters (Cumulative)': 70,
            'Builders (Unique)': 2,
            'Builders (Cumulative)': 55,
          },
        ]}
        starsChart={[]}
        isLoading={false}
      />
    );

    expect(readChartData()).toEqual([
      { month: 'Apr 1', dayNumber: 1, 'Self Hosters': 6, Builders: 2 },
    ]);
    expect(screen.queryByLabelText('Show previous period')).not.toBeInTheDocument();
    expect(screen.getByTestId('chart-footer')).toBeEmptyDOMElement();
  });

  it('14. navigates forward again with the next control', () => {
    render(
      <CommunityStats
        trafficChart={mockTrafficChart}
        starsChart={mockStarsChart}
        isLoading={false}
      />
    );

    // April is the latest month, so Next starts disabled
    expect(screen.getByLabelText('Show next period')).toBeDisabled();

    fireEvent.click(screen.getByLabelText('Show previous period'));
    expect(screen.getByText('March 2026')).toBeInTheDocument();
    expect(screen.getByLabelText('Show next period')).toBeEnabled();

    fireEvent.click(screen.getByLabelText('Show next period'));

    expect(screen.getByText('April 2026')).toBeInTheDocument();
    expect(readChartData()).toEqual([
      { month: 'Apr 1', dayNumber: 1, 'Self Hosters': 6, Builders: 2 },
      { month: 'Apr 2', dayNumber: 2, 'Self Hosters': 7, Builders: 4 },
    ]);
  });

  it('15. disables previous on the earliest period', () => {
    render(
      <CommunityStats
        trafficChart={mockTrafficChart}
        starsChart={mockStarsChart}
        isLoading={false}
      />
    );

    fireEvent.click(screen.getByText('Monthly'));
    fireEvent.click(screen.getByLabelText('Show previous period'));

    expect(screen.getByText('2025')).toBeInTheDocument();
    expect(screen.getByLabelText('Show previous period')).toBeDisabled();
    expect(screen.getByLabelText('Show next period')).toBeEnabled();
  });

  it('16. resets granularity to Monthly when leaving the yearly stars view for Unique', () => {
    render(
      <CommunityStats
        trafficChart={mockTrafficChart}
        starsChart={mockStarsChart}
        isLoading={false}
      />
    );

    fireEvent.click(screen.getByText('Stars'));
    fireEvent.click(screen.getByText('Yearly'));
    expect(screen.getByText('Yearly')).toHaveClass('Active');

    fireEvent.click(screen.getByText('Unique'));

    // Yearly is not a traffic option, so it falls back to Monthly and clears the period
    expect(screen.getByText('Unique')).toHaveClass('Active');
    expect(screen.getByText('Monthly')).toHaveClass('Active');
    expect(screen.queryByText('Yearly')).not.toBeInTheDocument();
    expect(screen.getByText('2026')).toBeInTheDocument();
    expect(readChartData()).toEqual([
      { month: "Feb '26", 'Self Hosters': 4, Builders: 2 },
      { month: "Mar '26", 'Self Hosters': 18, Builders: 8 },
      { month: "Apr '26", 'Self Hosters': 13, Builders: 6 },
    ]);
  });

  it('17. resets granularity to Monthly when leaving the yearly stars view for Cumulative', () => {
    render(
      <CommunityStats
        trafficChart={mockTrafficChart}
        starsChart={mockStarsChart}
        isLoading={false}
      />
    );

    fireEvent.click(screen.getByText('Stars'));
    fireEvent.click(screen.getByText('Yearly'));
    fireEvent.click(screen.getByText('Cumulative'));

    expect(screen.getByText('Cumulative')).toHaveClass('Active');
    expect(screen.getByText('Monthly')).toHaveClass('Active');
    expect(screen.getByText('2026')).toBeInTheDocument();
    expect(readChartData()).toEqual([
      { month: "Feb '26", 'Self Hosters': 40, Builders: 20 },
      { month: "Mar '26", 'Self Hosters': 190, Builders: 53 },
      { month: "Apr '26", 'Self Hosters': 150, Builders: 59 },
    ]);
  });

  it('18. keeps the stars granularity when switching between stars and monthly traffic', () => {
    render(
      <CommunityStats
        trafficChart={mockTrafficChart}
        starsChart={mockStarsChart}
        isLoading={false}
      />
    );

    fireEvent.click(screen.getByText('Monthly'));
    fireEvent.click(screen.getByText('Stars'));

    // Monthly is valid for both views, so it survives the switch untouched
    expect(screen.getByText('Monthly')).toHaveClass('Active');
    expect(screen.getByText('Stars')).toHaveClass('Active');
    expect(screen.getByText('2026')).toBeInTheDocument();
  });

  it('19. builds the daily axis config and tooltip label formatter', () => {
    render(
      <CommunityStats
        trafficChart={mockTrafficChart}
        starsChart={mockStarsChart}
        isLoading={false}
      />
    );

    const {
      xAxisDataKey,
      xAxisType,
      xAxisTicks,
      xAxisDomain,
      xTickFormatter,
      tooltipLabelFormatter,
    } = mockChartProps.current;

    expect(xAxisDataKey).toBe('dayNumber');
    expect(xAxisType).toBe('number');
    expect(xAxisTicks).toEqual([1, 2]);
    expect(xAxisDomain).toEqual([1, 2]);
    expect(xTickFormatter(2)).toBe('2');

    // prefers the month label carried on the hovered payload
    expect(tooltipLabelFormatter(1, [{ payload: { month: 'Apr 1' } }])).toBe('Apr 1');
    // falls back to the raw label when recharts passes no payload
    expect(tooltipLabelFormatter(2, undefined)).toBe('2');
    expect(tooltipLabelFormatter(2, [])).toBe('2');
  });

  it('20. drops the daily axis config outside the daily granularity', () => {
    render(
      <CommunityStats
        trafficChart={mockTrafficChart}
        starsChart={mockStarsChart}
        isLoading={false}
      />
    );

    fireEvent.click(screen.getByText('Monthly'));

    expect(mockChartProps.current.xAxisDataKey).toBeUndefined();
    expect(mockChartProps.current.xAxisType).toBeUndefined();
    expect(mockChartProps.current.xAxisTicks).toBeUndefined();
    expect(mockChartProps.current.tooltipLabelFormatter).toBeUndefined();
  });

  it('21. de-duplicates day ticks when a day is reported more than once', () => {
    render(
      <CommunityStats
        trafficChart={[
          {
            dateKey: '2026-04-01',
            month: 'Apr 1',
            'Self Hosters (Unique)': 6,
            'Self Hosters (Cumulative)': 70,
            'Builders (Unique)': 2,
            'Builders (Cumulative)': 55,
          },
          {
            dateKey: '2026-04-01',
            month: 'Apr 1',
            'Self Hosters (Unique)': 1,
            'Self Hosters (Cumulative)': 71,
            'Builders (Unique)': 1,
            'Builders (Cumulative)': 56,
          },
          {
            dateKey: '2026-04-03',
            month: 'Apr 3',
            'Self Hosters (Unique)': 9,
            'Self Hosters (Cumulative)': 80,
            'Builders (Unique)': 3,
            'Builders (Cumulative)': 59,
          },
        ]}
        starsChart={[]}
        isLoading={false}
      />
    );

    expect(mockChartProps.current.xAxisTicks).toEqual([1, 3]);
    expect(mockChartProps.current.xAxisDomain).toEqual([1, 3]);
  });

  it('22. resolves the latest period when the selected one disappears from new props', () => {
    const { rerender } = render(
      <CommunityStats
        trafficChart={mockTrafficChart}
        starsChart={mockStarsChart}
        isLoading={false}
      />
    );

    fireEvent.click(screen.getByLabelText('Show previous period'));
    expect(screen.getByText('March 2026')).toBeInTheDocument();

    // March drops out of the refreshed dataset entirely
    rerender(
      <CommunityStats
        trafficChart={mockTrafficChart.filter((point) => !point.dateKey.startsWith('2026-03'))}
        starsChart={mockStarsChart}
        isLoading={false}
      />
    );

    expect(screen.getByText('April 2026')).toBeInTheDocument();
  });
});
