import React from 'react';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import InventoryPhoneCatalog, {
  InventoryPhoneCard,
  InventoryPhoneFilterPills,
} from '@/app/features/inventory/pages/Inventory/InventoryPhoneCatalog';
import {
  buildInventoryPhoneMeta,
  formatExpiryShort,
  getPhoneUnitAbbrev,
} from '@/app/features/inventory/pages/Inventory/InventoryPhoneCatalog.utils';
import { defaultFilters } from '@/app/features/inventory/pages/Inventory/utils';
import {
  InventoryFiltersState,
  InventoryItem,
} from '@/app/features/inventory/pages/Inventory/types';

expect.extend(toHaveNoViolations);

type ItemOverrides = {
  id?: string;
  name?: string;
  category?: string;
  skuCode?: string;
  sku?: string;
  status?: 'ACTIVE' | 'HIDDEN';
  stockHealth?: InventoryItem['stockHealth'];
  current?: string;
  reorderLevel?: string;
  stockLocation?: string;
  purchaseCost?: string;
  selling?: string;
  expiryDate?: string;
  currency?: string;
};

const makeItem = (o: ItemOverrides = {}): InventoryItem =>
  ({
    id: o.id ?? 'i1',
    currency: o.currency ?? 'EUR',
    status: o.status ?? 'ACTIVE',
    stockHealth: o.stockHealth,
    sku: o.sku,
    basicInfo: {
      name: o.name ?? 'Carprofen 50 mg',
      category: o.category ?? 'Pharmacy',
      subCategory: 'NSAID',
      department: '',
      description: '',
      status: 'ACTIVE',
      skuCode: o.skuCode,
    },
    classification: {},
    pricing: { purchaseCost: o.purchaseCost ?? '', selling: o.selling ?? '' },
    vendor: { supplierName: '', brand: '', vendor: '', license: '', paymentTerms: '' },
    stock: {
      current: o.current ?? '',
      allocated: '',
      available: '',
      reorderLevel: o.reorderLevel ?? '',
      reorderQuantity: '',
      stockLocation: o.stockLocation ?? '',
    },
    batch: {
      batch: '',
      manufactureDate: '',
      expiryDate: o.expiryDate ?? '',
    },
  }) as InventoryItem;

const lowItem = makeItem({
  id: 'low',
  name: 'Carprofen 50 mg',
  skuCode: 'MED-0271',
  stockHealth: 'LOW_STOCK',
  current: '6',
  reorderLevel: '20',
  stockLocation: 'Shelf B2',
  purchaseCost: '0.85',
  selling: '1.68',
  expiryDate: '2027-03-15',
});

describe('InventoryPhoneCatalog helpers', () => {
  it('formatExpiryShort handles ISO, dd/mm/yyyy, empty and invalid dates', () => {
    expect(formatExpiryShort('2028-01-15')).toBe('01/2028');
    expect(formatExpiryShort('15/06/2027')).toBe('06/2027');
    expect(formatExpiryShort('')).toBe('');
    expect(formatExpiryShort(undefined)).toBe('');
    expect(formatExpiryShort('aa/bb/cccc')).toBe('');
    expect(formatExpiryShort('not-a-date')).toBe('');
  });

  it('getPhoneUnitAbbrev infers box vs unit from the item name', () => {
    expect(getPhoneUnitAbbrev(makeItem({ name: 'Nitrile gloves · box 100' }))).toBe('bx');
    expect(getPhoneUnitAbbrev(makeItem({ name: 'Carprofen 50 mg' }))).toBe('u');
  });

  it('buildInventoryPhoneMeta derives the low-stock card fields', () => {
    const meta = buildInventoryPhoneMeta(lowItem);
    expect(meta.statusLabel).toBe('Low stock');
    expect(meta.isLow).toBe(true);
    expect(meta.restockEligible).toBe(true);
    expect(meta.code).toBe('MED-0271');
    expect(meta.onHandText).toBe('6 u');
    expect(meta.onHandAccent).toBe('warn');
    expect(meta.reorderText).toBe('reorder at 20');
    expect(meta.locationText).toBe('Shelf B2');
    expect(meta.expiryText).toBe('exp 03/2027');
    expect(meta.expiryDanger).toBe(false);
    // Pins the margin to formatPercentValue, the same formatter the desktop
    // table and the inventory detail panel use. The phone card used to round to
    // a whole number, so this item read "49%" here and "49.4%" one breakpoint
    // up, and a 0.4% margin read "0%".
    expect(meta.priceText).toBe('€1.68 · 49.4%');
  });

  it('buildInventoryPhoneMeta marks expired items danger and shows cost-only pricing', () => {
    const expired = makeItem({
      id: 'exp',
      name: 'Amoxicillin 250 mg',
      stockHealth: 'EXPIRED',
      current: '24',
      purchaseCost: '0.42',
      selling: '',
      expiryDate: '2020-05-01',
    });
    const meta = buildInventoryPhoneMeta(expired);
    expect(meta.isExpired).toBe(true);
    expect(meta.expiryDanger).toBe(true);
    expect(meta.onHandAccent).toBe('danger');
    expect(meta.restockEligible).toBe(false);
    expect(meta.priceText).toBe('€0.42 cost');
  });

  it('buildInventoryPhoneMeta treats out-of-stock as restockable and healthy as ink', () => {
    const out = buildInventoryPhoneMeta(makeItem({ stockHealth: 'OUT_OF_STOCK', current: '0' }));
    expect(out.isOutOfStock).toBe(true);
    expect(out.restockEligible).toBe(true);
    expect(out.onHandAccent).toBe('danger');

    const healthy = buildInventoryPhoneMeta(makeItem({ stockHealth: 'HEALTHY', current: '38' }));
    expect(healthy.statusLabel).toBe('In stock');
    expect(healthy.onHandAccent).toBe('ink');
    expect(healthy.restockEligible).toBe(false);
    expect(healthy.reorderText).toBeNull();
  });

  it('buildInventoryPhoneMeta shows a bare selling price when the margin cannot be computed', () => {
    const noCost = makeItem({ stockHealth: 'HEALTHY', selling: '2.00' });
    // A missing unit cost makes the margin incomputable, so only the price shows.
    (noCost.pricing as { purchaseCost?: string }).purchaseCost = undefined;
    expect(buildInventoryPhoneMeta(noCost).priceText).toBe('€2');
  });

  it('buildInventoryPhoneMeta falls back to derived health and omits missing facts', () => {
    // No explicit stockHealth: derives EXPIRED from a past batch expiry.
    const derived = buildInventoryPhoneMeta(
      makeItem({ stockHealth: undefined, current: '', expiryDate: '2019-01-01' })
    );
    expect(derived.statusLabel).toBe('Expired');
    expect(derived.onHandText).toBeNull();
    expect(derived.locationText).toBeNull();
    expect(derived.expiryText).toBe('exp 01/2019');
    expect(derived.priceText).toBeNull();
    expect(derived.code).toBeNull();
  });
});

describe('InventoryPhoneCard', () => {
  it('renders the name, code, status pill and fact line, and opens the record on tap', () => {
    const onView = jest.fn();
    render(<InventoryPhoneCard item={lowItem} onView={onView} />);

    expect(screen.getByText('Carprofen 50 mg')).toBeInTheDocument();
    expect(screen.getByText(/MED-0271/)).toBeInTheDocument();
    expect(screen.getByText('Low stock')).toBeInTheDocument();
    expect(screen.getByText('6 u')).toBeInTheDocument();
    expect(screen.getByText('reorder at 20')).toBeInTheDocument();
    expect(screen.getByText('€1.68 · 49.4%')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'View Carprofen 50 mg' }));
    expect(onView).toHaveBeenCalledWith(lowItem);
  });

  it('shows the Restock CTA only for eligible items when the user can edit', () => {
    const onRestock = jest.fn();
    const onView = jest.fn();
    const { rerender } = render(
      <InventoryPhoneCard item={lowItem} onView={onView} onRestock={onRestock} canRestock />
    );

    const restock = screen.getByRole('button', { name: 'Restock Carprofen 50 mg' });
    fireEvent.click(restock);
    expect(onRestock).toHaveBeenCalledWith(lowItem);
    // Restock is a sibling of the view trigger, so it never opens the record.
    expect(onView).not.toHaveBeenCalled();

    // No edit permission → no CTA even for a low-stock item.
    rerender(<InventoryPhoneCard item={lowItem} onView={onView} onRestock={onRestock} />);
    expect(
      screen.queryByRole('button', { name: 'Restock Carprofen 50 mg' })
    ).not.toBeInTheDocument();

    // Healthy item → not eligible even with edit permission.
    const healthy = makeItem({ id: 'h', name: 'Nobivac Rabies 1 ml', stockHealth: 'HEALTHY' });
    rerender(
      <InventoryPhoneCard item={healthy} onView={onView} onRestock={onRestock} canRestock />
    );
    expect(
      screen.queryByRole('button', { name: 'Restock Nobivac Rabies 1 ml' })
    ).not.toBeInTheDocument();
  });

  it('renders an expired card with the danger accent and no Restock CTA', () => {
    const expired = makeItem({
      id: 'exp',
      name: 'Amoxicillin 250 mg',
      stockHealth: 'EXPIRED',
      current: '24',
      expiryDate: '2020-05-01',
    });
    render(
      <InventoryPhoneCard item={expired} onView={jest.fn()} onRestock={jest.fn()} canRestock />
    );
    expect(screen.getByText('Expired')).toBeInTheDocument();
    expect(screen.getByText('exp 05/2020')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Restock Amoxicillin 250 mg' })
    ).not.toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <InventoryPhoneCard item={lowItem} onView={jest.fn()} onRestock={jest.fn()} canRestock />
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('InventoryPhoneFilterPills', () => {
  const renderPills = (
    filters: InventoryFiltersState,
    handlers: {
      setFilters?: jest.Mock;
      toggleCategoryFilter?: jest.Mock;
    } = {}
  ) => {
    const setFilters = handlers.setFilters ?? jest.fn();
    const toggleCategoryFilter = handlers.toggleCategoryFilter ?? jest.fn();
    render(
      <InventoryPhoneFilterPills
        filters={filters}
        setFilters={setFilters}
        categoryOptions={['Pharmacy', 'Vaccines']}
        toggleCategoryFilter={toggleCategoryFilter}
        lowStockCount={3}
      />
    );
    return { setFilters, toggleCategoryFilter };
  };

  it('marks All active with no category and no low-stock filter, and clears on click', () => {
    const { setFilters } = renderPills({ ...defaultFilters, categories: [], status: 'ALL' });
    const all = screen.getByRole('button', { name: 'All' });
    expect(all).toHaveClass('font-bold');
    fireEvent.click(all);
    expect(setFilters).toHaveBeenCalled();
    // Low chip shows the count and is not pressed.
    expect(screen.getByRole('button', { name: 'Low (3)' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('toggles the low-stock filter and reflects the pressed state', () => {
    const { setFilters } = renderPills({ ...defaultFilters, status: 'LOW_STOCK' });
    const low = screen.getByRole('button', { name: 'Low (3)' });
    expect(low).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'All' })).not.toHaveClass('font-bold');
    fireEvent.click(low);
    expect(setFilters).toHaveBeenCalled();
  });

  /**
   * The Low pill's selected state used to be `shadow-[0_1px_3px_var(--sh08)]` and
   * nothing else: border, fill, ink and weight were pinned to the cancelled
   * tokens in BOTH states, so the only filter that changes what the list contains
   * gave a near-invisible confirmation while the pills either side of it swapped
   * colour completely. It now inverts - solid `--status-cancelled-text` fill,
   * `--screen` ink, bold - the same currency `idlePill` -> `activePill` uses.
   */
  it('gives the Low pill a filled, inverted selected state, not a shadow alone', () => {
    renderPills({ ...defaultFilters, status: 'LOW_STOCK' });
    const active = screen.getByRole('button', { name: 'Low (3)' });
    expect(active).toHaveClass('bg-[var(--status-cancelled-text)]');
    expect(active).toHaveClass('text-[var(--screen)]');
    expect(active).toHaveClass('font-bold');
    cleanup();

    renderPills({ ...defaultFilters, status: 'ALL' });
    const idle = screen.getByRole('button', { name: 'Low (3)' });
    // The idle pill keeps the soft cancelled tint; it must not carry the fill or
    // the weight that now mark the pill as on.
    expect(idle).toHaveClass('bg-[var(--status-cancelled-bg)]');
    expect(idle).toHaveClass('font-semibold');
    expect(idle).not.toHaveClass('bg-[var(--status-cancelled-text)]');
    expect(idle).not.toHaveClass('font-bold');
  });

  it('marks a selected category active and toggles categories', () => {
    const { toggleCategoryFilter } = renderPills({
      ...defaultFilters,
      categories: ['Pharmacy'],
    });
    expect(screen.getByRole('button', { name: 'Pharmacy' })).toHaveClass('font-bold');
    fireEvent.click(screen.getByRole('button', { name: 'Vaccines' }));
    expect(toggleCategoryFilter).toHaveBeenCalledWith('Vaccines');
  });

  it('produces the correct next-filter state from the All and Low updaters', () => {
    const setFilters = jest.fn();
    renderPills(
      { ...defaultFilters, categories: ['Pharmacy'], status: 'LOW_STOCK' },
      { setFilters }
    );

    // "All" clears categories and the low-stock status.
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    const allUpdater = setFilters.mock.calls[0][0] as (
      s: InventoryFiltersState
    ) => InventoryFiltersState;
    expect(
      allUpdater({ ...defaultFilters, categories: ['Pharmacy'], status: 'LOW_STOCK' })
    ).toEqual(expect.objectContaining({ categories: [], category: 'all', status: 'ALL' }));

    // "Low" flips the status both ways.
    fireEvent.click(screen.getByRole('button', { name: 'Low (3)' }));
    const lowUpdater = setFilters.mock.calls[1][0] as (
      s: InventoryFiltersState
    ) => InventoryFiltersState;
    expect(lowUpdater({ ...defaultFilters, status: 'LOW_STOCK' }).status).toBe('ALL');
    expect(lowUpdater({ ...defaultFilters, status: 'ALL' }).status).toBe('LOW_STOCK');
  });
});

describe('InventoryPhoneCatalog', () => {
  const baseProps = {
    filters: defaultFilters,
    setFilters: jest.fn(),
    categoryOptions: ['Pharmacy'],
    toggleCategoryFilter: jest.fn(),
    lowStockCount: 1,
    onView: jest.fn(),
    onRestock: jest.fn(),
    canRestock: true,
  };

  it('renders the filter pills and a card per item', () => {
    render(
      <InventoryPhoneCatalog
        {...baseProps}
        filteredInventory={[
          lowItem,
          makeItem({ id: 'h', name: 'Surolan', stockHealth: 'HEALTHY' }),
        ]}
      />
    );
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View Carprofen 50 mg' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View Surolan' })).toBeInTheDocument();
  });

  it('shows the loading state before any item resolves', () => {
    render(<InventoryPhoneCatalog {...baseProps} filteredInventory={[]} loading />);
    expect(screen.getByText('Loading inventory…')).toBeInTheDocument();
  });

  it('shows the empty state when there are no items', () => {
    render(<InventoryPhoneCatalog {...baseProps} filteredInventory={[]} />);
    // Same derived copy as the inventory table; this surface used to hardcode
    // the table's older sentence and drifted when the table changed.
    expect(screen.getByText('No items yet')).toBeInTheDocument();
  });
});
