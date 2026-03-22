import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import OverviewPage from '../../../../features/overview/pages/OverviewPage';
import { useOverviewStats } from '../../../../features/overview/hooks/useOverviewStats';

// 1. Mock the custom hook to control the data flow
jest.mock('../../../../features/overview/hooks/useOverviewStats', () => ({
  useOverviewStats: jest.fn(),
}));

// 2. Mock the child components to isolate the test to just the OverviewPage layout
jest.mock('../../../../features/overview/components/OverviewHero', () => {
  return function MockOverviewHero() {
    return <div data-testid="mock-hero" />;
  };
});

// We capture the props in the mock to assert that OverviewPage is passing them down correctly
jest.mock('../../../../features/overview/components/CommunityStats', () => {
  return function MockCommunityStats(props: any) {
    return (
      <div
        data-testid="mock-community-stats"
        data-isloading={props.isLoading}
        data-chartlength={props.combinedChart?.length}
      />
    );
  };
});

jest.mock('../../../../features/overview/components/WhyWeDoThis', () => {
  return function MockWhyWeDoThis() {
    return <div data-testid="mock-why-we-do-this" />;
  };
});

jest.mock('@/app/ui/widgets/Footer/Footer', () => {
  return function MockFooter() {
    return <footer data-testid="mock-footer" />;
  };
});

describe('OverviewPage Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('1. renders all structural sections and passes the loading state', () => {
    // Simulate the hook returning its initial loading state
    (useOverviewStats as jest.Mock).mockReturnValue({
      combinedChart: [],
      isLoading: true,
    });

    render(<OverviewPage />);

    // Assert that all child components are rendered in the document
    expect(screen.getByTestId('mock-hero')).toBeInTheDocument();
    expect(screen.getByTestId('mock-why-we-do-this')).toBeInTheDocument();
    expect(screen.getByTestId('mock-footer')).toBeInTheDocument();

    // Assert that CommunityStats received the correct loading props
    const statsComponent = screen.getByTestId('mock-community-stats');
    expect(statsComponent).toBeInTheDocument();
    expect(statsComponent).toHaveAttribute('data-isloading', 'true');
    expect(statsComponent).toHaveAttribute('data-chartlength', '0');
  });

  it('2. passes populated chart data to CommunityStats when loading completes', () => {
    // Simulate the hook successfully returning data
    const mockChartData = [
      { month: 'Mar 15', Stars: 100 },
      { month: 'Mar 16', Stars: 110 },
    ];

    (useOverviewStats as jest.Mock).mockReturnValue({
      combinedChart: mockChartData,
      isLoading: false,
    });

    render(<OverviewPage />);

    // Assert that CommunityStats received the updated data props
    const statsComponent = screen.getByTestId('mock-community-stats');
    expect(statsComponent).toHaveAttribute('data-isloading', 'false');
    expect(statsComponent).toHaveAttribute('data-chartlength', '2');
  });
});
