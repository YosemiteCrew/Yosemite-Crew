import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import RevenueLeadersStat from '@/app/ui/widgets/Stats/RevenueLeadersStat';
import CardHeader from '@/app/ui/cards/CardHeader/CardHeader';

jest.mock('@/app/hooks/useBilling', () => ({
  useCurrencyForPrimaryOrg: () => 'USD',
}));

jest.mock('@/app/features/dashboard/hooks/useDashboardAnalytics', () => ({
  mapDashboardDurationOption: (value: string) => value,
  useDashboardAnalytics: jest.fn(),
}));

jest.mock('@/app/ui/cards/CardHeader/CardHeader', () => ({
  __esModule: true,
  default: jest.fn(({ title }: any) => <div data-testid="card-header">{title}</div>),
}));

import { useDashboardAnalytics } from '@/app/features/dashboard/hooks/useDashboardAnalytics';

const baseAnalytics = {
  durationOptions: { revenueLeaders: ['Last week'] },
  revenueLeaders: [],
  emptyState: { revenueLeaders: false },
};

describe('RevenueLeadersStat', () => {
  beforeEach(() => {
    (useDashboardAnalytics as jest.Mock).mockReturnValue(baseAnalytics);
  });

  it('renders revenue tiles when data is present', () => {
    (useDashboardAnalytics as jest.Mock).mockReturnValue({
      ...baseAnalytics,
      revenueLeaders: [
        { label: 'Alice', revenue: 500 },
        { label: 'Bob', revenue: 300 },
        { label: 'Carol', revenue: 100 },
      ],
      emptyState: { revenueLeaders: false },
    });

    render(<RevenueLeadersStat />);

    expect(screen.getByTestId('card-header')).toHaveTextContent('Revenue leaders');
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(CardHeader).toHaveBeenCalled();
  });

  it('renders empty state when no revenue data', () => {
    (useDashboardAnalytics as jest.Mock).mockReturnValue({
      ...baseAnalytics,
      emptyState: { revenueLeaders: true },
    });

    render(<RevenueLeadersStat />);

    expect(screen.getByTestId('card-header')).toHaveTextContent('Revenue leaders');
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });
});
