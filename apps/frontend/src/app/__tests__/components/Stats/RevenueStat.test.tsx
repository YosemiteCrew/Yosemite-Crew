import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import RevenueStat from '@/app/ui/widgets/Stats/RevenueStat';
import CardHeader from '@/app/ui/cards/CardHeader/CardHeader';

jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: () => {
    const MockDynamicChartCard = ({ data, keys }: any) => (
      <div data-testid="chart" data-points={data.length} data-keys={keys.length} />
    );
    MockDynamicChartCard.displayName = 'MockDynamicChartCard';
    return MockDynamicChartCard;
  },
}));

jest.mock('@/app/features/dashboard/hooks/useDashboardAnalytics', () => ({
  mapDashboardDurationOption: (value: string) => value,
  useDashboardAnalytics: () => ({
    charts: {
      revenue: Array.from({ length: 7 }, (_, index) => ({
        month: `M${index + 1}`,
        Revenue: (index + 1) * 100,
      })),
    },
    durationOptions: {
      revenue: ['Last 6 months'],
    },
    emptyState: {
      revenueChart: false,
    },
  }),
}));

jest.mock('@/app/ui/cards/CardHeader/CardHeader', () => ({
  __esModule: true,
  default: jest.fn(({ title }: any) => <div data-testid="card-header">{title}</div>),
}));

describe('RevenueStat', () => {
  it('renders header and chart data', () => {
    render(<RevenueStat />);

    expect(screen.getByTestId('card-header')).toHaveTextContent('Revenue');
    expect(screen.getByTestId('chart')).toHaveAttribute('data-points', '7');
    expect(screen.getByTestId('chart')).toHaveAttribute('data-keys', '1');
    expect(CardHeader).toHaveBeenCalled();
  });
});
