import React from 'react';
import { render, screen, within } from '@testing-library/react';
import InventoryTurnoverTable from '@/app/ui/tables/InventoryTurnoverTable';
import { getInventoryTurnoverStatusStyle } from '@/app/ui/tables/tableUtils';
import { InventoryTurnoverItem } from '@/app/features/inventory/pages/Inventory/types';

// --- Mocks ---

// NOTE: Not mocking GenericTable. Integration test with real table component.

// Mock InventoryTurnoverCard for Mobile View
jest.mock('@/app/ui/cards/InventoryTurnoverCard', () => ({
  __esModule: true,
  default: ({ item }: any) => (
    <div data-testid="turnover-card">
      <span>{item.name}</span>
      <span>{item.status}</span>
    </div>
  ),
}));

// --- Test Data ---

const mockInventoryItems: InventoryTurnoverItem[] = [
  {
    name: 'Vaccines',
    category: 'Medical',
    beginningInventory: 100,
    endingInventory: 20,
    averageInventory: 60,
    totalPurchases: 200,
    turnsPerYear: 3.3,
    daysOnShelf: 110,
    status: 'Excellent',
  },
  {
    name: 'Dog Food',
    category: 'Retail',
    beginningInventory: 50,
    endingInventory: 5,
    avgInventory: 27.5,
    totalPurchased: 100, // <--- First "100"
    turnsPerYear: 3.6,
    daysOnShelf: 100, // <--- Second "100"
    status: 'Low',
  },
  {
    name: 'Cat Toys',
    category: 'Retail',
    beginningInventory: 10,
    endingInventory: 10,
    turnsPerYear: 0,
    daysOnShelf: 365,
    status: undefined,
  },
] as any;

describe('InventoryTurnoverTable Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Helper Function Tests (getStatusStyle) ---

  describe('getStatusStyle', () => {
    it('returns correct style for excellent', () => {
      expect(getInventoryTurnoverStatusStyle('Excellent')).toEqual({
        color: 'var(--color-pill-success-text)',
        backgroundColor: 'var(--color-pill-success-bg)',
        borderColor: 'var(--color-pill-success-border)',
      });
    });
    it('returns correct style for low', () => {
      expect(getInventoryTurnoverStatusStyle('Low')).toEqual({
        color: 'var(--color-pill-warning-text)',
        backgroundColor: 'var(--color-pill-warning-bg)',
        borderColor: 'var(--color-pill-warning-border)',
      });
    });
    it('returns correct style for moderate', () => {
      expect(getInventoryTurnoverStatusStyle('Moderate')).toEqual({
        color: 'var(--color-pill-progress-text)',
        backgroundColor: 'var(--color-pill-progress-bg)',
        borderColor: 'var(--color-pill-progress-border)',
      });
    });
    it('returns correct style for out of stock', () => {
      expect(getInventoryTurnoverStatusStyle('Out of stock')).toEqual({
        color: 'var(--color-pill-warning-text)',
        backgroundColor: 'var(--color-pill-warning-bg)',
        borderColor: 'var(--color-pill-warning-border)',
      });
    });
    it('returns correct style for healthy', () => {
      expect(getInventoryTurnoverStatusStyle('Healthy')).toEqual({
        color: 'var(--color-pill-success-text)',
        backgroundColor: 'var(--color-pill-success-bg)',
        borderColor: 'var(--color-pill-success-border)',
      });
    });
    it('returns default style for unknown', () => {
      expect(getInventoryTurnoverStatusStyle('Unknown')).toEqual({
        color: 'var(--color-pill-neutral-text)',
        backgroundColor: 'var(--color-pill-neutral-bg)',
        borderColor: 'var(--color-pill-neutral-border)',
      });
    });
    it('handles undefined status gracefully', () => {
      expect(getInventoryTurnoverStatusStyle()).toEqual({
        color: 'var(--color-pill-neutral-text)',
        backgroundColor: 'var(--color-pill-neutral-bg)',
        borderColor: 'var(--color-pill-neutral-border)',
      });
    });
  });

  // --- 2. Desktop View (GenericTable) ---

  it('renders table with correct data (Desktop View)', () => {
    const { container } = render(<InventoryTurnoverTable filteredList={mockInventoryItems} />);

    // Scope to desktop view container
    const desktopView = container.querySelector(String.raw`.hidden.xl\:flex`);
    expect(desktopView).toBeInTheDocument();

    // Query rows within desktop view. getAllByRole('row') includes header row.
    const rows = within(desktopView as HTMLElement).getAllByRole('row');
    // 1 Header + 3 Data rows = 4 rows total
    expect(rows).toHaveLength(4);

    // -- Row 1 (Vaccines) --
    const row1 = rows[1];
    expect(within(row1).getByText('Vaccines')).toBeInTheDocument();
    expect(within(row1).getByText('Medical')).toBeInTheDocument();
    expect(within(row1).getByText('60')).toBeInTheDocument(); // averageInventory
    expect(within(row1).getByText('200')).toBeInTheDocument(); // totalPurchases
    expect(within(row1).getByText('Excellent')).toBeInTheDocument();

    // -- Row 2 (Dog Food) --
    const row2 = rows[2];
    expect(within(row2).getByText('Dog Food')).toBeInTheDocument();
    expect(within(row2).getByText('27.5')).toBeInTheDocument(); // avgInventory fallback

    // FIX: "100" appears twice (totalPurchased and daysOnShelf)
    // We expect 2 instances within this row
    const hundreds = within(row2).getAllByText('100');
    expect(hundreds).toHaveLength(2);

    // -- Row 3 (Cat Toys - Defaults) --
    const row3 = rows[3];
    expect(within(row3).getByText('Cat Toys')).toBeInTheDocument();
    const zeros = within(row3).getAllByText('0');
    expect(zeros.length).toBeGreaterThanOrEqual(2); // Avg + Total defaults
    expect(within(row3).getByText('—')).toBeInTheDocument(); // Status fallback
  });

  /* Every column here is sized by its HEADER, not its figures: the values are short
     integers and the labels are long. Measured on deployed dev at the width where the
     colgroup actually binds (viewport 1300, table at its min-width), five of the nine
     headers were ellipsised - "Beginning inventory" by 34.5px, "Ending inventory" by
     23.1, "Avg inventory" by 20.0, "Total purchases" by 15.7 and "Days on shelf" by
     15.9, with "Turns/Year" on 1px of slack. jsdom has no font metrics, so this pins
     the widths measured in a real browser: the th carries 22px of padding, so the
     column must be the label's rendered text width + 22, and these floors carry ~8px
     of margin on top of that. */
  it('gives every column enough width for its own header label', () => {
    // Rendered width of each label at 10.5px/700 with 1.05px tracking, from the browser.
    const TEXT_PX: Record<string, number> = {
      'Item name': 68,
      Category: 65,
      'Beginning inventory': 142,
      'Ending inventory': 121,
      'Avg inventory': 98,
      'Total purchases': 114,
      'Turns/Year': 77,
      'Days on shelf': 94,
      Status: 44,
    };
    const TH_PADDING = 22;

    const { container } = render(<InventoryTurnoverTable filteredList={mockInventoryItems} />);
    const desktopView = container.querySelector(String.raw`.hidden.xl\:flex`) as HTMLElement;
    const cols = [...desktopView.querySelectorAll('colgroup col')];
    const labels = [...desktopView.querySelectorAll('th')].map(
      (th) => th.textContent?.trim() ?? ''
    );

    expect(cols).toHaveLength(labels.length);

    labels.forEach((label, index) => {
      const declared = Number.parseInt((cols[index] as HTMLElement).style.width, 10);
      expect(declared).toBeGreaterThanOrEqual(TEXT_PX[label] + TH_PADDING);
    });
  });

  // --- 3. Mobile View (Cards) ---

  it('renders InventoryTurnoverCard components (Mobile View)', () => {
    render(<InventoryTurnoverTable filteredList={mockInventoryItems} />);

    // Cards are mocked with a distinct test-id, so finding them is reliable
    const cards = screen.getAllByTestId('turnover-card');
    expect(cards).toHaveLength(3);

    // Check first card content
    expect(within(cards[0]).getByText('Vaccines')).toBeInTheDocument();
  });

  // --- 4. Empty State ---

  it('renders without crashing when list is empty', () => {
    const { container } = render(<InventoryTurnoverTable filteredList={[]} />);

    // The GenericTable renders headers even if empty
    // Mobile view doesn't render cards
    const desktopView = container.querySelector(String.raw`.hidden.xl\:flex`);
    expect(desktopView).toBeInTheDocument();

    expect(screen.queryByTestId('turnover-card')).not.toBeInTheDocument();
  });
});
