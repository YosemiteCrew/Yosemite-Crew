import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';

import TurnoverAnalytics from '@/app/features/inventory/components/TurnoverAnalytics';
import { useDashboardAnalytics } from '@/app/features/dashboard/hooks/useDashboardAnalytics';
import useIsPhone from '@/app/ui/layout/PhoneShell/useIsPhone';
import {
  InventoryItem,
  InventoryTurnoverItem,
} from '@/app/features/inventory/pages/Inventory/types';

jest.mock('@/app/features/dashboard/hooks/useDashboardAnalytics', () => ({
  useDashboardAnalytics: jest.fn(),
}));

jest.mock('@/app/ui/layout/PhoneShell/useIsPhone', () => ({
  __esModule: true,
  default: jest.fn(() => false),
}));

const mockAnalytics = useDashboardAnalytics as jest.Mock;
const mockIsPhone = useIsPhone as jest.Mock;

const makeItem = (o: Partial<Record<string, unknown>>): InventoryItem =>
  ({
    id: o.id ?? 'i1',
    currency: o.currency ?? 'EUR',
    basicInfo: {
      name: o.name ?? 'Carprofen 100 mg',
      category: 'Medicine',
      subCategory: (o.subCategory as string) ?? 'NSAID',
      department: 'Pharmacy',
      description: '',
      status: 'Active',
    },
    classification: { form: (o.form as string) ?? 'Tablet' },
    pricing: { purchaseCost: (o.purchaseCost as string) ?? '2' },
    vendor: { supplierName: '', brand: '', vendor: '', license: '', paymentTerms: '' },
    stock: {
      current: (o.current as string) ?? '12',
      allocated: '0',
      available: '0',
      reorderLevel: (o.reorderLevel as string) ?? '40',
      reorderQuantity: '0',
      stockLocation: 'Pharmacy',
      abcClass: o.abcClass as string,
    },
    batch: { batch: '', manufactureDate: '', expiryDate: '' },
    batches: [],
  }) as unknown as InventoryItem;

const carprofen = makeItem({
  id: 'carprofen',
  name: 'Carprofen 100 mg',
  abcClass: 'Class A',
  current: '12',
  reorderLevel: '40',
});
const swabs = makeItem({
  id: 'swabs',
  name: 'Cotton Swabs',
  subCategory: 'Cotton',
  form: 'Swab',
  abcClass: 'Class C',
  current: '80',
  reorderLevel: '20',
  purchaseCost: '1',
});

const turnover: InventoryTurnoverItem[] = [
  {
    itemId: 'carprofen',
    name: 'Carprofen 100 mg',
    beginningInventory: 0,
    endingInventory: 0,
    turnsPerYear: 11.4,
    daysOnShelf: 32,
  },
  {
    itemId: 'swabs',
    name: 'Cotton Swabs',
    beginningInventory: 0,
    endingInventory: 0,
    turnsPerYear: 1.3,
    daysOnShelf: 90,
  },
];

const analyticsValue = (over: Partial<{ turnsPerYear: number; trend: unknown[] }> = {}) => ({
  inventoryTurnover: {
    turnsPerYear: over.turnsPerYear ?? 6.4,
    restockCycleDays: 0,
    targetTurnsPerYear: 0,
    trend: over.trend ?? [
      { month: 'Jan', year: 2026, turnover: 5 },
      { month: 'Jan', year: 2025, turnover: 4 },
      { month: 'Jul', year: 2026, turnover: 6 },
    ],
  },
});

const renderComponent = (props: Partial<React.ComponentProps<typeof TurnoverAnalytics>> = {}) => {
  const setActiveView = jest.fn();
  const onReorder = jest.fn();
  const onViewHistory = jest.fn();
  render(
    <TurnoverAnalytics
      turnover={props.turnover ?? turnover}
      inventory={props.inventory ?? [carprofen, swabs]}
      setActiveView={props.setActiveView ?? setActiveView}
      onReorder={props.onReorder ?? onReorder}
      onViewHistory={props.onViewHistory ?? onViewHistory}
    />
  );
  return { setActiveView, onReorder, onViewHistory };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockAnalytics.mockReturnValue(analyticsValue());
  mockIsPhone.mockReturnValue(false);
});

describe('TurnoverAnalytics', () => {
  it('renders KPIs bound to real data', () => {
    renderComponent();
    expect(screen.getByText('6.4×')).toBeInTheDocument(); // annual turnover
    expect(screen.getByText('€104')).toBeInTheDocument(); // 12*2 + 80*1 = 104
    expect(screen.getByText('61')).toBeInTheDocument(); // avg days (32+90)/2 rounded
    expect(screen.queryByText('year to date')).not.toBeInTheDocument();
  });

  it('shows the year-over-year delta when both years have data', () => {
    renderComponent();
    // current avg (5,6)=5.5, previous (4) → +1.5 vs 2025
    const delta = screen.getByText(/\+1\.5 vs 2025/);
    expect(delta).toBeInTheDocument();
    // A RISE is good news and reads as success.
    expect(delta.closest('span')).toHaveClass('text-[var(--success-text)]');
  });

  it('renders the month chart bars', () => {
    renderComponent();
    expect(screen.getByText('Turnover by month')).toBeInTheDocument();
    expect(screen.getByText('Jan')).toBeInTheDocument();
    expect(screen.getByText('Jul')).toBeInTheDocument();
  });

  it('renders ABC rows and the default (low-stock) product panel', () => {
    renderComponent();
    expect(screen.getByText('ABC classification')).toBeInTheDocument();
    expect(screen.getByText('Weekly review')).toBeInTheDocument();
    expect(screen.getByText('Quarterly · trim')).toBeInTheDocument();

    const panel = screen.getByTestId('product-panel');
    expect(within(panel).getByText('Carprofen 100 mg')).toBeInTheDocument();
    expect(within(panel).getByText('LOW STOCK')).toBeInTheDocument();
    expect(within(panel).getByText('Class A · NSAID · tablets')).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: /Reorder 68/ })).toBeInTheDocument();
  });

  it('selects a product when its ABC class row is clicked', () => {
    renderComponent();
    const classCRow = screen.getByText('Quarterly · trim').closest('button');
    expect(classCRow).not.toBeNull();
    fireEvent.click(classCRow as HTMLButtonElement);
    // Class C representative is Cotton Swabs (not low stock)
    const panel = screen.getByTestId('product-panel');
    expect(within(panel).getByText('Cotton Swabs')).toBeInTheDocument();
    expect(within(panel).queryByText('LOW STOCK')).not.toBeInTheDocument();
  });

  it('wires the segmented control back to view switching', () => {
    const { setActiveView } = renderComponent();
    fireEvent.click(screen.getByRole('tab', { name: 'Stock' }));
    expect(setActiveView).toHaveBeenCalledWith('inventory');
    fireEvent.click(screen.getByRole('tab', { name: 'Orders' }));
    expect(setActiveView).toHaveBeenCalledWith('turnover');
  });

  it('reorders the selected product', () => {
    const { onReorder } = renderComponent();
    fireEvent.click(screen.getByRole('button', { name: /Reorder 68/ }));
    expect(onReorder).toHaveBeenCalledWith(carprofen);
  });

  it('opens the history of the selected product from the panel footer', () => {
    const { onViewHistory } = renderComponent();
    const panel = screen.getByTestId('product-panel');
    fireEvent.click(within(panel).getByRole('button', { name: 'History' }));
    expect(onViewHistory).toHaveBeenCalledWith(carprofen);
  });

  it('renders the ABC column header row', () => {
    renderComponent();
    expect(screen.getByText('Share of value')).toBeInTheDocument();
    expect(screen.getByText('Policy')).toBeInTheDocument();
  });

  it('renders a compact product card on phone instead of the panel', () => {
    mockIsPhone.mockReturnValue(true);
    const { onReorder } = renderComponent();
    expect(screen.queryByTestId('product-panel')).not.toBeInTheDocument();
    const card = screen.getByTestId('product-card-phone');
    expect(within(card).getByText('Carprofen 100 mg · 11.4×')).toBeInTheDocument();
    fireEvent.click(within(card).getByRole('button', { name: /Reorder 68/ }));
    expect(onReorder).toHaveBeenCalledWith(carprofen);
  });

  it('renders a not-low-stock product in the phone card', () => {
    mockIsPhone.mockReturnValue(true);
    renderComponent({ inventory: [swabs], turnover });
    const card = screen.getByTestId('product-card-phone');
    expect(within(card).getByText(/Cotton Swabs/)).toBeInTheDocument();
    // Not low stock → the "below reorder point" qualifier is absent.
    expect(within(card).queryByText(/below/)).not.toBeInTheDocument();
  });

  it('shows a downward delta when the previous year was higher', () => {
    mockAnalytics.mockReturnValue(
      analyticsValue({
        trend: [
          { month: 'Jan', year: 2026, turnover: 3 },
          { month: 'Jan', year: 2025, turnover: 8 },
        ],
      })
    );
    renderComponent();
    const delta = screen.getByText(/-5\.0 vs 2025/);
    expect(delta).toBeInTheDocument();
    // A FALL in turnover was painted success-green regardless of direction, so
    // the colour said "good" while the number said the opposite. Asserting the
    // value alone passes either way - the class is the thing under test.
    expect(delta.closest('span')).toHaveClass('text-[var(--danger-text)]');
    expect(delta.closest('span')).not.toHaveClass('text-[var(--success-text)]');
  });

  it('selects the low-stock representative when the Class A row is clicked', () => {
    renderComponent();
    const classARow = screen.getByText('Weekly review').closest('button');
    fireEvent.click(classARow as HTMLButtonElement);
    const panel = screen.getByTestId('product-panel');
    expect(within(panel).getByText('Carprofen 100 mg')).toBeInTheDocument();
    expect(within(panel).getByText('LOW STOCK')).toBeInTheDocument();
  });

  it('hides the suggested order and uses a bare Reorder label without a reorder point', () => {
    const noReorder = makeItem({
      id: 'nr',
      name: 'No Reorder',
      abcClass: 'Class A',
      current: '10',
      reorderLevel: '0',
    });
    renderComponent({ inventory: [noReorder], turnover: [] });
    const panel = screen.getByTestId('product-panel');
    expect(within(panel).getByRole('button', { name: 'Reorder' })).toBeInTheDocument();
    expect(within(panel).queryByText(/Suggested order/)).not.toBeInTheDocument();
    expect(within(panel).queryByText('LOW STOCK')).not.toBeInTheDocument();
  });

  it('degrades every metric when there is no data', () => {
    mockAnalytics.mockReturnValue(analyticsValue({ turnsPerYear: 0, trend: [] }));
    renderComponent({ inventory: [], turnover: [] });
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Not enough history yet')).toBeInTheDocument();
    expect(screen.getByText('No ABC-classified products yet')).toBeInTheDocument();
    expect(screen.queryByTestId('product-panel')).not.toBeInTheDocument();
    expect(screen.getByText('year to date')).toBeInTheDocument();
  });
});
