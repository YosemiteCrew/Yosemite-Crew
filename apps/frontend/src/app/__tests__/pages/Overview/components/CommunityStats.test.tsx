import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import CommunityStats from '../../../../features/overview/components/CommunityStats';

// ==========================================
// 1. MOCK SETUP
// ==========================================

// Mock the DynamicChartCard to easily inspect the transformed data and props it receives
jest.mock('@/app/ui/widgets/DynamicChart/DynamicChartCard', () => {
  return function MockDynamicChartCard({
    data,
    keys,
    yAxisWidth,
    chartHeight,
    compactMonthAxis,
    headerContent,
    footerContent,
  }: any) {
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
});

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

    expect(screen.getByText('Loading Repository Data...')).toBeInTheDocument();

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

  it('9. verifies chart keys always contain all three labels', () => {
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
      { name: 'Self Hosters', color: '#247AED' },
      { name: 'Builders', color: '#10B981' },
      { name: 'Github Stars', color: '#F68523' },
    ]);
  });
});
