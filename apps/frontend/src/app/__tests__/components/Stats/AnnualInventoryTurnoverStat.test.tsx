import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import AnnualInventoryTurnoverStat from '@/app/ui/widgets/Stats/AnnualInventoryTurnoverStat';
import { useDashboardAnalytics } from '@/app/features/dashboard/hooks/useDashboardAnalytics';

jest.mock('@/app/ui/cards/CardHeader/CardHeader', () => ({
  __esModule: true,
  default: ({ title }: any) => <div data-testid="card-header">{title}</div>,
}));

jest.mock('@/app/features/dashboard/hooks/useDashboardAnalytics', () => ({
  useDashboardAnalytics: jest.fn(),
}));

describe('AnnualInventoryTurnoverStat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders turnover numbers and date range labels', () => {
    (useDashboardAnalytics as jest.Mock).mockReturnValue({
      durationOptions: { annualInventoryTurnover: ['Last 1 year'] },
      inventoryTurnover: {
        turnsPerYear: 6.4,
        targetTurnsPerYear: 8,
        restockCycleDays: 45,
        trend: [
          { month: 'Jan', year: 2025, turnover: 4 },
          { month: 'Dec', year: 2025, turnover: 6.4 },
        ],
      },
    });

    const { container } = render(<AnnualInventoryTurnoverStat />);

    expect(screen.getByTestId('card-header')).toHaveTextContent('Annual inventory turnover');
    expect(screen.getByText('6.4 turns / year')).toBeInTheDocument();
    expect(screen.getByText('Restock every 45 days')).toBeInTheDocument();
    expect(screen.getByText('Jan 2025')).toBeInTheDocument();
    expect(screen.getByText('Dec 2025')).toBeInTheDocument();

    const filled = Array.from(container.querySelectorAll('div')).filter((node) =>
      (node as HTMLDivElement).className.includes('bg-[#F28A2E]')
    );
    expect(filled).toHaveLength(5);
  });

  it('clamps negative values and handles empty trend', () => {
    (useDashboardAnalytics as jest.Mock).mockReturnValue({
      durationOptions: { annualInventoryTurnover: ['Last 1 year'] },
      inventoryTurnover: {
        turnsPerYear: -1,
        targetTurnsPerYear: -3,
        restockCycleDays: -2,
        trend: [],
      },
    });

    render(<AnnualInventoryTurnoverStat />);

    expect(screen.getByText('0.0 turns / year')).toBeInTheDocument();
    expect(screen.getByText('Restock every 0 days')).toBeInTheDocument();
    expect(screen.getByText('Start')).toBeInTheDocument();
    expect(screen.getByText('End')).toBeInTheDocument();
  });
});
