import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import CommunityStats from '../../../../features/overview/components/CommunityStats';
import DynamicChartCard from '@/app/ui/widgets/DynamicChart/DynamicChartCard';

// Mock the DynamicChartCard to prevent Recharts/Canvas rendering errors in JSDOM
// and to easily intercept and verify the props being passed to it.
jest.mock('@/app/ui/widgets/DynamicChart/DynamicChartCard', () => ({
  __esModule: true,
  default: jest.fn(() => <div data-testid="mock-dynamic-chart" />),
}));

describe('CommunityStats Component', () => {
  // Mock data representing the structure from useOverviewStats hook
  const mockCombinedChart = [
    {
      month: 'Mar 15',
      'Self Hosters (Unique)': 10,
      'Self Hosters (Cumulative)': 100,
      'Builders (Unique)': 5,
      'Builders (Cumulative)': 50,
      Stars: 200,
    },
    {
      month: 'Mar 16',
      'Self Hosters (Unique)': 15,
      'Self Hosters (Cumulative)': 115,
      'Builders (Unique)': 2,
      'Builders (Cumulative)': 52,
      Stars: 205,
    },
  ];

  beforeEach(() => {
    // Clear mock calls between tests to ensure a clean slate
    jest.clearAllMocks();
  });

  it('1. renders the loading state when isLoading is true', () => {
    render(<CommunityStats combinedChart={[]} isLoading={true} />);

    expect(screen.getByText('Loading Repository Data...')).toBeInTheDocument();

    // Ensure charts are NOT rendered
    expect(screen.queryByText('15-Day Repository Traffic')).not.toBeInTheDocument();
  });

  it('2. renders the main UI and defaults to "Unique" data view', () => {
    render(<CommunityStats combinedChart={mockCombinedChart} isLoading={false} />);
    // Verify the "Unique" button has the 'Active' class
    const uniqueButton = screen.getByRole('button', { name: 'Unique' });
    expect(uniqueButton).toHaveClass('Active');

    // Extract the props passed to the FIRST instance of DynamicChartCard (Traffic chart)
    const trafficChartProps = (DynamicChartCard as jest.Mock).mock.calls[0][0];

    // Assert that the data was mapped specifically using the (Unique) values
    expect(trafficChartProps.data).toEqual([
      { month: 'Mar 15', 'Self Hosters': 10, Builders: 5 },
      { month: 'Mar 16', 'Self Hosters': 15, Builders: 2 },
    ]);
  });

  it('3. updates the chart data mapping when the "Cumulative" toggle is clicked', () => {
    render(<CommunityStats combinedChart={mockCombinedChart} isLoading={false} />);

    const cumulativeButton = screen.getByRole('button', { name: 'Cumulative' });
    const uniqueButton = screen.getByRole('button', { name: 'Unique' });

    // Click the Cumulative toggle
    fireEvent.click(cumulativeButton);

    // Verify classes updated
    expect(cumulativeButton).toHaveClass('Active');
    expect(uniqueButton).not.toHaveClass('Active');

    // The component re-renders. DynamicChartCard will be called again.
    // We grab the most recent call's props for the Traffic chart (index 2 because 0,1 were from the initial render)
    const updatedTrafficChartProps = (DynamicChartCard as jest.Mock).mock.calls[2][0];

    // Assert that the data is now mapped using the (Cumulative) values
    expect(updatedTrafficChartProps.data).toEqual([
      { month: 'Mar 15', 'Self Hosters': 100, Builders: 50 },
      { month: 'Mar 16', 'Self Hosters': 115, Builders: 52 },
    ]);
  });

  it('4. updates data mapping back to "Unique" when toggled back', () => {
    render(<CommunityStats combinedChart={mockCombinedChart} isLoading={false} />);

    const cumulativeButton = screen.getByRole('button', { name: 'Cumulative' });
    const uniqueButton = screen.getByRole('button', { name: 'Unique' });

    // Click Cumulative first
    fireEvent.click(cumulativeButton);

    // Clear mocks to easily grab the next render's props
    jest.clearAllMocks();

    // Click back to Unique
    fireEvent.click(uniqueButton);

    // Verify classes reverted
    expect(uniqueButton).toHaveClass('Active');

    const revertedTrafficChartProps = (DynamicChartCard as jest.Mock).mock.calls[0][0];

    // Assert data mapped back to Unique
    expect(revertedTrafficChartProps.data).toEqual([
      { month: 'Mar 15', 'Self Hosters': 10, Builders: 5 },
      { month: 'Mar 16', 'Self Hosters': 15, Builders: 2 },
    ]);
  });
});
