import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import CommunityStats from '../../../../features/overview/components/CommunityStats';

// ==========================================
// 1. MOCK SETUP
// ==========================================

// We mock the DynamicChartCard to easily inspect the transformed data it receives
jest.mock('@/app/ui/widgets/DynamicChart/DynamicChartCard', () => {
  return function MockDynamicChartCard({ data, keys }: any) {
    return (
      <div data-testid="mock-dynamic-chart">
        <div data-testid="chart-data">{JSON.stringify(data)}</div>
        <div data-testid="chart-keys">{JSON.stringify(keys)}</div>
      </div>
    );
  };
});

// ==========================================
// 2. MOCK DATA
// ==========================================

const mockCombinedChartData = [
  {
    month: 'Mar 8',
    'Self Hosters (Unique)': 10,
    'Self Hosters (Cumulative)': 100,
    'Builders (Unique)': 5,
    'Builders (Cumulative)': 50,
    Stars: 42,
  },
  {
    month: 'Mar 9',
    'Self Hosters (Unique)': 15,
    'Self Hosters (Cumulative)': 115,
    'Builders (Unique)': 8,
    'Builders (Cumulative)': 58,
    Stars: 45,
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
    render(<CommunityStats combinedChart={[]} isLoading={true} />);

    expect(screen.getByText('Loading Repository Data...')).toBeInTheDocument();

    // Ensure charts are NOT rendered
    expect(screen.queryByTestId('mock-dynamic-chart')).not.toBeInTheDocument();
  });

  it('2. renders default "Unique" data correctly', () => {
    render(<CommunityStats combinedChart={mockCombinedChartData} isLoading={false} />);

    // Assert Toggle Buttons
    const uniqueBtn = screen.getByText('Unique');
    const cumulativeBtn = screen.getByText('Cumulative');

    expect(uniqueBtn).toHaveClass('Active');
    expect(cumulativeBtn).not.toHaveClass('Active');

    // Assert Charts Rendered (1 for Traffic, 1 for Stars)
    const charts = screen.getAllByTestId('mock-dynamic-chart');
    expect(charts).toHaveLength(2);

    // Extract transformed data passed to the charts
    const chartDataJson = screen.getAllByTestId('chart-data')[0].textContent;
    const chartData = JSON.parse(chartDataJson as unknown as string);

    // Verify mapping logic for 'Unique'
    expect(chartData[0]['Self Hosters']).toBe(10); // Should be 'Self Hosters (Unique)'
    expect(chartData[0]['Builders']).toBe(5); // Should be 'Builders (Unique)'

    // Verify Stars mapped to 'Github Stars'
    expect(chartData[0]['Github Stars']).toBe(42);
    expect(chartData[1]['Github Stars']).toBe(45);
  });

  it('3. updates data correctly when "Cumulative" is clicked', () => {
    render(<CommunityStats combinedChart={mockCombinedChartData} isLoading={false} />);

    const uniqueBtn = screen.getByText('Unique');
    const cumulativeBtn = screen.getByText('Cumulative');

    // Click Cumulative
    fireEvent.click(cumulativeBtn);

    // Verify Active Class swapped
    expect(cumulativeBtn).toHaveClass('Active');
    expect(uniqueBtn).not.toHaveClass('Active');

    // Extract transformed data passed to the charts after click
    const chartDataJson = screen.getAllByTestId('chart-data')[0].textContent;
    const chartData = JSON.parse(chartDataJson as unknown as string);

    // Verify mapping logic swapped to 'Cumulative'
    expect(chartData[0]['Self Hosters']).toBe(100); // Should be 'Self Hosters (Cumulative)'
    expect(chartData[0]['Builders']).toBe(50); // Should be 'Builders (Cumulative)'

    // Github Stars should remain unaffected
    expect(chartData[0]['Github Stars']).toBe(42);
  });

  it('4. updates data correctly when clicking back to "Unique"', () => {
    render(<CommunityStats combinedChart={mockCombinedChartData} isLoading={false} />);

    const uniqueBtn = screen.getByText('Unique');
    const cumulativeBtn = screen.getByText('Cumulative');

    // Toggle to Cumulative, then back to Unique
    fireEvent.click(cumulativeBtn);
    fireEvent.click(uniqueBtn);

    // Verify Active Class swapped back
    expect(uniqueBtn).toHaveClass('Active');
    expect(cumulativeBtn).not.toHaveClass('Active');

    // Extract transformed data passed to the charts after clicking back
    const chartDataJson = screen.getAllByTestId('chart-data')[0].textContent;
    const chartData = JSON.parse(chartDataJson as unknown as string);

    // Verify mapping logic swapped back to 'Unique'
    expect(chartData[0]['Self Hosters']).toBe(10);
    expect(chartData[0]['Builders']).toBe(5);
  });
});
