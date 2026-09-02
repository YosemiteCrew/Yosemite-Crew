import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import RevenueStat from '@/app/ui/widgets/Stats/RevenueStat';
import CardHeader from '@/app/ui/cards/CardHeader/CardHeader';
import { useDashboardAnalytics } from '@/app/features/dashboard/hooks/useDashboardAnalytics';
import { useCurrencyForPrimaryOrg } from '@/app/hooks/useBilling';

jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: () => {
    const MockDynamicChartCard = ({ data, keys, yTickFormatter, compactMonthAxis }: any) => (
      <div
        data-testid="chart"
        data-points={data.length}
        data-keys={keys.length}
        data-colors={keys.map((key: { color: string }) => key.color).join(',')}
        data-tick={yTickFormatter ? yTickFormatter(1234) : ''}
        data-compact={String(compactMonthAxis)}
      />
    );
    MockDynamicChartCard.displayName = 'MockDynamicChartCard';
    return MockDynamicChartCard;
  },
}));

const mockAnalytics = {
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
};

jest.mock('@/app/features/dashboard/hooks/useDashboardAnalytics', () => ({
  mapDashboardDurationOption: (value: string) => value,
  useDashboardAnalytics: jest.fn(),
}));

jest.mock('@/app/hooks/useBilling', () => ({
  useCurrencyForPrimaryOrg: jest.fn(),
}));

jest.mock('@/app/lib/money', () => ({
  formatMoney: (value: number, currency: string) => `${currency} ${value}`,
  recordCurrency: (record: { currency?: string | null } | null | undefined, fallback: string) =>
    record?.currency ?? fallback,
  formatMoneyPrecise: (amount: number, currency: string) =>
    `${currency} ${Number(amount).toFixed(2)}`,
  sharedCurrency: (records: ReadonlyArray<{ currency?: string | null }>, fallback: string) => {
    let shared: string | null = null;
    for (const record of records) {
      const own = record.currency;
      if (typeof own !== 'string' || !own.trim()) continue;
      if (shared === null) shared = own.trim();
      else if (shared !== own.trim()) return fallback;
    }
    return shared ?? fallback;
  },
}));

jest.mock('@/app/ui/cards/CardHeader/CardHeader', () => ({
  __esModule: true,
  default: jest.fn(({ title, options, onSelect }: any) => (
    <div data-testid="card-header">
      {title}
      <button type="button" onClick={() => onSelect(options[0])}>
        select
      </button>
    </div>
  )),
}));

describe('RevenueStat', () => {
  beforeEach(() => {
    (useDashboardAnalytics as jest.Mock).mockReturnValue(mockAnalytics);
    (useCurrencyForPrimaryOrg as jest.Mock).mockReturnValue('USD');
  });

  it('renders header and chart data', () => {
    render(<RevenueStat />);

    expect(screen.getByTestId('card-header')).toHaveTextContent('Revenue');
    expect(screen.getByTestId('chart')).toHaveAttribute('data-points', '7');
    expect(screen.getByTestId('chart')).toHaveAttribute('data-keys', '1');
    expect(screen.getByTestId('chart')).toHaveAttribute('data-colors', 'var(--blue)');
    expect(CardHeader).toHaveBeenCalled();
  });

  it('formats the y-axis tick using the primary org currency', () => {
    (useCurrencyForPrimaryOrg as jest.Mock).mockReturnValue('EUR');
    render(<RevenueStat />);
    expect(screen.getByTestId('chart')).toHaveAttribute('data-tick', 'EUR 1234');
  });

  it('triggers onSelect from CardHeader', () => {
    render(<RevenueStat />);
    screen.getByText('select').click();
    expect(screen.getByTestId('card-header')).toHaveTextContent('Revenue');
  });

  it('corrects selectedDuration when not present in durationOptions', () => {
    (useDashboardAnalytics as jest.Mock).mockReturnValue({
      ...mockAnalytics,
      durationOptions: { revenue: ['Last month'] },
    });
    render(<RevenueStat />);
    expect(screen.getByTestId('chart')).toHaveAttribute('data-compact', 'true');
  });

  it('falls back to "Last week" when durationOptions is empty', () => {
    (useDashboardAnalytics as jest.Mock).mockReturnValue({
      ...mockAnalytics,
      durationOptions: { revenue: [] },
    });
    render(<RevenueStat />);
    expect(screen.getByTestId('chart')).toHaveAttribute('data-compact', 'false');
  });
});
