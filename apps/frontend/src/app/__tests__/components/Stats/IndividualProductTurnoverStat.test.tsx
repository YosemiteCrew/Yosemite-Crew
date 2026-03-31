import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import IndividualProductTurnoverStat from '@/app/ui/widgets/Stats/IndividualProductTurnoverStat';
import { useDashboardAnalytics } from '@/app/features/dashboard/hooks/useDashboardAnalytics';

jest.mock('@/app/ui/cards/CardHeader/CardHeader', () => ({
  __esModule: true,
  default: ({ title }: any) => <div data-testid="card-header">{title}</div>,
}));

jest.mock('@/app/features/dashboard/hooks/useDashboardAnalytics', () => ({
  useDashboardAnalytics: jest.fn(),
}));

describe('IndividualProductTurnoverStat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders fallback message when no products are available', () => {
    (useDashboardAnalytics as jest.Mock).mockReturnValue({
      durationOptions: { individualProductTurnover: ['Last 1 year'] },
      productTurnover: [],
    });

    render(<IndividualProductTurnoverStat />);

    expect(screen.getByTestId('card-header')).toHaveTextContent('Individual product turnover');
    expect(screen.getByText('No product turnover data.')).toBeInTheDocument();
  });

  it('renders top six products with proportional widths', () => {
    (useDashboardAnalytics as jest.Mock).mockReturnValue({
      durationOptions: { individualProductTurnover: ['Last 1 year'] },
      productTurnover: [
        { itemId: '1', name: 'A', turnover: 10 },
        { itemId: '2', name: 'B', turnover: 5 },
        { itemId: '3', name: 'C', turnover: 2 },
        { itemId: '4', name: 'D', turnover: 1 },
        { itemId: '5', name: 'E', turnover: 4 },
        { itemId: '6', name: 'F', turnover: 3 },
        { itemId: '7', name: 'G', turnover: 9 },
      ],
    });

    const { container } = render(<IndividualProductTurnoverStat />);

    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('F')).toBeInTheDocument();
    expect(screen.queryByText('G')).not.toBeInTheDocument();

    const bars = container.querySelectorAll('.h-full.bg-text-primary.rounded-full');
    expect((bars[0] as HTMLElement).style.width).toBe('100%');
    expect((bars[1] as HTMLElement).style.width).toBe('50%');
  });
});
