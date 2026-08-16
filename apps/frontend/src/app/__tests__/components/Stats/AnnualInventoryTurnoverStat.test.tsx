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

const barsIn = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('div')).filter(
    (node) => (node as HTMLDivElement).style.height
  ) as HTMLDivElement[];

describe('AnnualInventoryTurnoverStat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders a monthly turnover bar for each trend point with proportional heights', () => {
    (useDashboardAnalytics as jest.Mock).mockReturnValue({
      durationOptions: { annualInventoryTurnover: ['Last 1 year'] },
      emptyState: { annualInventoryTurnover: false },
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
    expect(screen.getByText('Jan')).toBeInTheDocument();
    expect(screen.getByText('Dec')).toBeInTheDocument();

    const bars = barsIn(container);
    expect(bars).toHaveLength(2);
    // Heights are proportional to the max turnover (6.4).
    expect(bars[0].style.height).toBe('62.5%');
    expect(bars[1].style.height).toBe('100%');
    // The final (partial) month is drawn with the muted divider fill.
    expect(bars[1].style.background).toBe('var(--divider)');
  });

  it('draws the peak month at full opacity when it is not the final bar', () => {
    (useDashboardAnalytics as jest.Mock).mockReturnValue({
      durationOptions: { annualInventoryTurnover: ['Last 1 year'] },
      emptyState: { annualInventoryTurnover: false },
      inventoryTurnover: {
        turnsPerYear: 10,
        targetTurnsPerYear: 12,
        restockCycleDays: 30,
        trend: [
          { month: 'Jan', year: 2026, turnover: 4 },
          { month: 'Jun', year: 2026, turnover: 10 },
          { month: 'Jul', year: 2026, turnover: 3 },
        ],
      },
    });

    const { container } = render(<AnnualInventoryTurnoverStat />);
    const bars = barsIn(container);
    expect(bars).toHaveLength(3);
    // Non-peak, non-final month is the muted cta fill.
    expect(bars[0].style.opacity).toBe('0.85');
    expect(bars[0].style.background).toBe('var(--cta)');
    // The peak month (not the final bar) is drawn at full opacity in cta.
    expect(bars[1].style.opacity).toBe('1');
    expect(bars[1].style.background).toBe('var(--cta)');
    // The final (partial) month still uses the divider fill.
    expect(bars[2].style.background).toBe('var(--divider)');
  });

  it('renders zero-height bars when every month has no turnover', () => {
    (useDashboardAnalytics as jest.Mock).mockReturnValue({
      durationOptions: { annualInventoryTurnover: ['Last 1 year'] },
      emptyState: { annualInventoryTurnover: false },
      inventoryTurnover: {
        turnsPerYear: 0,
        targetTurnsPerYear: 0,
        restockCycleDays: 0,
        trend: [
          { month: 'Jan', year: 2026, turnover: 0 },
          { month: 'Feb', year: 2026, turnover: 0 },
        ],
      },
    });

    const { container } = render(<AnnualInventoryTurnoverStat />);
    const bars = barsIn(container);
    expect(bars).toHaveLength(2);
    expect(bars[0].style.height).toBe('0%');
    expect(bars[1].style.height).toBe('0%');
  });

  it('renders the empty state placeholder when there is no turnover data', () => {
    (useDashboardAnalytics as jest.Mock).mockReturnValue({
      durationOptions: { annualInventoryTurnover: ['Last 1 year'] },
      emptyState: { annualInventoryTurnover: true },
      inventoryTurnover: {
        turnsPerYear: 0,
        targetTurnsPerYear: 0,
        restockCycleDays: 0,
        trend: [],
      },
    });

    const { container } = render(<AnnualInventoryTurnoverStat />);

    expect(screen.getByText('No data available')).toBeInTheDocument();
    expect(barsIn(container)).toHaveLength(0);
  });

  it('renders the card with no bars when the trend is empty but data is not flagged empty', () => {
    (useDashboardAnalytics as jest.Mock).mockReturnValue({
      durationOptions: { annualInventoryTurnover: ['Last 1 year'] },
      emptyState: { annualInventoryTurnover: false },
      inventoryTurnover: {
        turnsPerYear: 0,
        targetTurnsPerYear: 0,
        restockCycleDays: 0,
        trend: [],
      },
    });

    const { container } = render(<AnnualInventoryTurnoverStat />);

    expect(screen.getByTestId('card-header')).toHaveTextContent('Annual inventory turnover');
    expect(screen.queryByText('No data available')).not.toBeInTheDocument();
    expect(barsIn(container)).toHaveLength(0);
  });
});
