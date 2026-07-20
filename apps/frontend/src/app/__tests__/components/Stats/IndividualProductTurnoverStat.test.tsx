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

const barsIn = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('div')).filter(
    (node) => (node as HTMLDivElement).style.width
  ) as HTMLDivElement[];

describe('IndividualProductTurnoverStat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders empty state when no products are available', () => {
    (useDashboardAnalytics as jest.Mock).mockReturnValue({
      durationOptions: { individualProductTurnover: ['Last 1 year'] },
      productTurnover: [],
      inventoryTurnover: { turnsPerYear: 0, targetTurnsPerYear: 0 },
      emptyState: { individualProductTurnover: true },
    });

    render(<IndividualProductTurnoverStat />);

    expect(screen.getByTestId('card-header')).toHaveTextContent('Product turnover');
    expect(screen.getByText('No data available')).toBeInTheDocument();
    expect(screen.queryByText(/Turned over/)).not.toBeInTheDocument();
  });

  it('renders top six products with proportional widths', () => {
    (useDashboardAnalytics as jest.Mock).mockReturnValue({
      durationOptions: { individualProductTurnover: ['Last 1 year'] },
      emptyState: { individualProductTurnover: false },
      inventoryTurnover: { turnsPerYear: 5.7, targetTurnsPerYear: 4.2 },
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

    const bars = barsIn(container);
    expect(bars).toHaveLength(6);
    expect(bars[0].style.width).toBe('100%');
    expect(bars[1].style.width).toBe('50%');
    // The design's three bar colours cycle down the rows.
    expect(bars[0].style.background).toBe('var(--cta)');
    expect(bars[1].style.background).toBe('var(--blue)');
    expect(bars[2].style.background).toBe('var(--divider)');
    expect(bars[3].style.background).toBe('var(--cta)');
  });

  it('renders the turnover insight chip against the clinic average', () => {
    (useDashboardAnalytics as jest.Mock).mockReturnValue({
      durationOptions: { individualProductTurnover: ['Last 1 year'] },
      emptyState: { individualProductTurnover: false },
      inventoryTurnover: { turnsPerYear: 3.1, targetTurnsPerYear: 4.2 },
      productTurnover: [{ itemId: '1', name: 'A', turnover: 10 }],
    });

    render(<IndividualProductTurnoverStat />);

    expect(
      screen.getByText('Turned over 3.1× this year · below the 4.2 clinic average')
    ).toBeInTheDocument();
  });

  it('renders zero-width bars when every product has no turnover', () => {
    // Products that exist but were never dispensed clamp to turnover 0, so
    // maxValue is 0 while emptyState stays false (it only tracks list length).
    (useDashboardAnalytics as jest.Mock).mockReturnValue({
      durationOptions: { individualProductTurnover: ['Last 1 year'] },
      emptyState: { individualProductTurnover: false },
      inventoryTurnover: { turnsPerYear: 0, targetTurnsPerYear: 0 },
      productTurnover: [
        { itemId: '1', name: 'A', turnover: 0 },
        { itemId: '2', name: 'B', turnover: 0 },
      ],
    });

    const { container } = render(<IndividualProductTurnoverStat />);

    expect(screen.queryByText('No data available')).not.toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();

    const bars = barsIn(container);
    expect(bars).toHaveLength(2);
    expect(bars[0].style.width).toBe('0%');
    expect(bars[1].style.width).toBe('0%');
  });
});
