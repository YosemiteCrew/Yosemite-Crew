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
  useDashboardAnalytics: () => ({
    durationOptions: {
      revenueLeaders: ['Last week'],
    },
    revenueLeaders: [],
  }),
}));

jest.mock('@/app/ui/cards/CardHeader/CardHeader', () => ({
  __esModule: true,
  default: jest.fn(({ title }: any) => <div data-testid="card-header">{title}</div>),
}));

describe('RevenueLeadersStat', () => {
  it('renders revenue tiles', () => {
    render(<RevenueLeadersStat />);

    expect(screen.getByTestId('card-header')).toHaveTextContent('Revenue leaders');
    expect(screen.getAllByText('$0')).toHaveLength(3);
    expect(screen.getAllByText('No data')).toHaveLength(3);
    expect(CardHeader).toHaveBeenCalled();
  });
});
