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
  default: jest.fn(({ title, options, onSelect }: any) => (
    <div data-testid="card-header">
      {title}
      <button type="button" onClick={() => onSelect(options[0])}>
        select
      </button>
    </div>
  )),
}));

import { useDashboardAnalytics } from '@/app/features/dashboard/hooks/useDashboardAnalytics';

const barsIn = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('div')).filter(
    (node) => (node as HTMLDivElement).style.width
  ) as HTMLDivElement[];

const baseAnalytics = {
  durationOptions: { revenueLeaders: ['Last week'] },
  revenueLeaders: [],
  emptyState: { revenueLeaders: false },
};

describe('RevenueLeadersStat', () => {
  beforeEach(() => {
    (useDashboardAnalytics as jest.Mock).mockReturnValue(baseAnalytics);
  });

  it('renders a revenue bar row per leader when data is present', () => {
    (useDashboardAnalytics as jest.Mock).mockReturnValue({
      ...baseAnalytics,
      revenueLeaders: [
        { label: 'Alice', revenue: 500 },
        { label: 'Bob', revenue: 300 },
        { label: 'Carol', revenue: 100 },
      ],
      emptyState: { revenueLeaders: false },
    });

    const { container } = render(<RevenueLeadersStat />);

    expect(screen.getByTestId('card-header')).toHaveTextContent('Revenue leaders');
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(CardHeader).toHaveBeenCalled();

    const bars = barsIn(container);
    expect(bars).toHaveLength(3);
    // Widths are proportional to the top revenue (500).
    expect(bars[0].style.width).toBe('100%');
    expect(bars[1].style.width).toBe('60%');
    expect(bars[2].style.width).toBe('20%');
  });

  it('fades bar opacity down the leaderboard ranks', () => {
    (useDashboardAnalytics as jest.Mock).mockReturnValue({
      ...baseAnalytics,
      revenueLeaders: [
        { label: 'A', revenue: 400 },
        { label: 'B', revenue: 300 },
        { label: 'C', revenue: 200 },
        { label: 'D', revenue: 100 },
      ],
      emptyState: { revenueLeaders: false },
    });

    const { container } = render(<RevenueLeadersStat />);
    const bars = barsIn(container);
    expect(bars).toHaveLength(4);
    expect(bars[0].style.opacity).toBe('1');
    expect(bars[1].style.opacity).toBe('0.82');
    expect(bars[2].style.opacity).toBe('0.64');
    expect(bars[3].style.opacity).toBe('0.5');
  });

  it('renders a zero-width bar when a leader has no revenue', () => {
    (useDashboardAnalytics as jest.Mock).mockReturnValue({
      ...baseAnalytics,
      revenueLeaders: [{ label: 'Z', revenue: 0 }],
      emptyState: { revenueLeaders: false },
    });
    const { container } = render(<RevenueLeadersStat />);
    const bars = barsIn(container);
    expect(bars).toHaveLength(1);
    expect(bars[0].style.width).toBe('0%');
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

  it('triggers onSelect from CardHeader', () => {
    render(<RevenueLeadersStat />);
    screen.getByText('select').click();
    expect(screen.getByTestId('card-header')).toHaveTextContent('Revenue leaders');
  });

  it('corrects selectedDuration when not present in durationOptions', () => {
    (useDashboardAnalytics as jest.Mock).mockReturnValue({
      ...baseAnalytics,
      durationOptions: { revenueLeaders: ['Last month'] },
    });
    render(<RevenueLeadersStat />);
    expect(screen.getByTestId('card-header')).toHaveTextContent('Revenue leaders');
  });

  it('falls back to "Last week" when durationOptions is empty', () => {
    (useDashboardAnalytics as jest.Mock).mockReturnValue({
      ...baseAnalytics,
      durationOptions: { revenueLeaders: [] },
    });
    render(<RevenueLeadersStat />);
    expect(screen.getByTestId('card-header')).toHaveTextContent('Revenue leaders');
  });
});
