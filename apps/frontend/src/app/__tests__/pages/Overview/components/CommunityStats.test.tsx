import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import CommunityStats from '../../../../features/overview/components/CommunityStats';

// ==========================================
// 1. MOCK SETUP
// ==========================================

// Mock the DynamicChartCard to easily inspect the transformed data and props it receives
jest.mock('@/app/ui/widgets/DynamicChart/DynamicChartCard', () => {
  return function MockDynamicChartCard({ data, keys, yAxisWidth }: any) {
    return (
      <div data-testid="mock-dynamic-chart">
        <div data-testid="chart-data">{JSON.stringify(data)}</div>
        <div data-testid="chart-keys">{JSON.stringify(keys)}</div>
        <div data-testid="chart-yaxis">{yAxisWidth}</div>
      </div>
    );
  };
});

// ==========================================
// 2. MOCK DATA
// ==========================================

const mockTrafficChart = [
  {
    month: 'Mar 8',
    'Self Hosters (Unique)': 10,
    'Self Hosters (Cumulative)': 100,
    'Builders (Unique)': 5,
    'Builders (Cumulative)': 50,
  },
];

const mockStarsChart = [
  {
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

    // Verify mapping logic for 'Unique'
    expect(chartData[0]['Self Hosters']).toBe(10); // Should be 'Self Hosters (Unique)'
    expect(chartData[0]['Builders']).toBe(5); // Should be 'Builders (Unique)'

    // Verify yAxisWidth default
    expect(screen.getByTestId('chart-yaxis').textContent).toBe('40');
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

    // Verify mapping logic swapped to 'Cumulative'
    expect(chartData[0]['Self Hosters']).toBe(100); // Should be 'Self Hosters (Cumulative)'
    expect(chartData[0]['Builders']).toBe(50); // Should be 'Builders (Cumulative)'
  });

  it('4. updates data correctly when "Stars" is clicked', () => {
    render(
      <CommunityStats
        trafficChart={mockTrafficChart}
        starsChart={mockStarsChart}
        isLoading={false}
      />
    );

    const starsBtn = screen.getByText('Stars');

    // Click Stars
    fireEvent.click(starsBtn);

    // Verify Active Class swapped
    expect(starsBtn).toHaveClass('Active');
    expect(screen.getByText('Unique')).not.toHaveClass('Active');

    // Extract transformed data passed to the chart after click
    const chartDataJson = screen.getByTestId('chart-data').textContent;
    const chartData = JSON.parse(chartDataJson as unknown as string);

    // Verify data swapped entirely to starsChart
    expect(chartData[0]['Github Stars']).toBe(2099);

    // Verify yAxisWidth expanded for larger numbers
    expect(screen.getByTestId('chart-yaxis').textContent).toBe('45');
  });

  it('5. verifies chart keys always contain all three labels', () => {
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
