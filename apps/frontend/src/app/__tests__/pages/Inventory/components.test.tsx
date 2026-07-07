import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  ActiveFilterBar,
  DispensaryFilterBar,
  DispensaryFilterModal,
  InventoryFilterBar,
  InventoryFilterModal,
  InventoryTableContent,
} from '@/app/features/inventory/pages/Inventory';
import { defaultFilters } from '@/app/features/inventory/pages/Inventory/utils';

jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: (loader: () => Promise<unknown>) => {
    const source = loader.toString();
    const LoadableComponent = (props: Record<string, unknown>) => {
      if (source.includes('ui/tables/InventoryTable')) {
        const MockInventoryTable = (
          jest.requireMock('@/app/ui/tables/InventoryTable') as {
            default: React.FC<Record<string, unknown>>;
          }
        ).default;
        return <MockInventoryTable {...props} />;
      }
      if (source.includes('ui/tables/DispensaryTable')) {
        const MockDispensaryTable = (
          jest.requireMock('@/app/ui/tables/DispensaryTable') as {
            default: React.FC<Record<string, unknown>>;
          }
        ).default;
        return <MockDispensaryTable {...props} />;
      }
      if (source.includes('ui/tables/InventoryTurnoverTable')) {
        const MockInventoryTurnoverTable = (
          jest.requireMock('@/app/ui/tables/InventoryTurnoverTable') as {
            default: React.FC<Record<string, unknown>>;
          }
        ).default;
        return <MockInventoryTurnoverTable {...props} />;
      }
      if (source.includes('ui/filters/InventoryTurnoverFilters')) {
        const MockInventoryTurnoverFilters = (
          jest.requireMock('@/app/ui/filters/InventoryTurnoverFilters') as {
            default: React.FC<Record<string, unknown>>;
          }
        ).default;
        return <MockInventoryTurnoverFilters {...props} />;
      }
      return null;
    };

    LoadableComponent.displayName = 'MockDynamicComponent';
    return LoadableComponent;
  },
}));

jest.mock('@/app/ui/filters/Filters', () => ({
  __esModule: true,
  default: ({ activeStatus, setActiveStatus }: any) => (
    <div>
      <button data-testid="filters-status-btn" onClick={() => setActiveStatus('DISPENSED')}>
        Current: {activeStatus}
      </button>
    </div>
  ),
}));

jest.mock('@/app/ui/overlays/Modal', () => ({
  __esModule: true,
  default: ({ showModal, children }: any) =>
    showModal ? <div data-testid="modal-shell">{children}</div> : null,
}));

jest.mock('@/app/ui/tables/InventoryTable', () => ({
  __esModule: true,
  default: ({ filteredList, onView, onRestock }: any) => (
    <div data-testid="inventory-table-mock">
      {filteredList.map((item: any) => (
        <div key={item.id}>
          <button data-testid={`view-item-${item.id}`} onClick={() => onView(item)}>
            View {item.basicInfo.name}
          </button>
          <button data-testid={`restock-item-${item.id}`} onClick={() => onRestock(item)}>
            Restock {item.basicInfo.name}
          </button>
        </div>
      ))}
    </div>
  ),
}));

jest.mock('@/app/ui/tables/InventoryTurnoverTable', () => ({
  __esModule: true,
  default: ({ filteredList }: any) => (
    <div data-testid="turnover-table-mock">Turnover {filteredList.length}</div>
  ),
}));

jest.mock('@/app/ui/filters/InventoryTurnoverFilters', () => ({
  __esModule: true,
  default: ({ list, setFilteredList }: any) => (
    <button data-testid="turnover-filters-mock" onClick={() => setFilteredList(list.slice(0, 1))}>
      Filter turnover
    </button>
  ),
}));

jest.mock('@/app/ui/tables/DispensaryTable', () => ({
  __esModule: true,
  default: ({ filteredList, onView, onDispense }: any) => (
    <div data-testid="dispensary-table-mock">
      {filteredList.map((record: any) => (
        <div key={record.id}>
          <button data-testid={`view-record-${record.id}`} onClick={() => onView(record)}>
            View {record.id}
          </button>
          {onDispense && (
            <button data-testid={`dispense-record-${record.id}`} onClick={() => onDispense(record)}>
              Dispense {record.id}
            </button>
          )}
        </div>
      ))}
    </div>
  ),
}));

describe('Inventory page inner components', () => {
  const inventoryItem = {
    id: 'inv-1',
    basicInfo: { name: 'Alpha' },
  } as any;
  const dispensaryRecord = {
    id: 'dr-1',
    patient: { name: 'Milo' },
  } as any;

  it('handles inventory filter bar actions including sort, search, and filter open', () => {
    const setFilterOpen = jest.fn();
    const setFilters = jest.fn();
    const setSortMode = jest.fn();

    render(
      <InventoryFilterBar
        filters={{ ...defaultFilters, visibility: 'ACTIVE', search: '' }}
        selectedFilterChips={[{ id: '1', label: 'Medicine', onRemove: jest.fn() }]}
        sortMode="name"
        setFilterOpen={setFilterOpen}
        setFilters={setFilters}
        setSortMode={setSortMode}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /^Filter/ }));
    expect(setFilterOpen).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByRole('button', { name: 'Hidden' }));
    expect(setFilters).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Sort by' }));
    fireEvent.click(screen.getByRole('button', { name: 'Stock level' }));
    expect(setSortMode).toHaveBeenCalledWith('stock');

    fireEvent.change(screen.getByRole('textbox', { name: 'Search inventory' }), {
      target: { value: 'alpha' },
    });
    expect(setFilters).toHaveBeenCalled();
  });

  it('handles dispensary filter bar status and search changes', () => {
    const setDispensaryStatusFilter = jest.fn();
    const setDispensarySearch = jest.fn();

    render(
      <DispensaryFilterBar
        dispensarySearch=""
        dispensaryStatusFilter="ALL"
        setDispensaryStatusFilter={setDispensaryStatusFilter}
        setDispensarySearch={setDispensarySearch}
      />
    );

    fireEvent.click(screen.getByTestId('filters-status-btn'));
    expect(setDispensaryStatusFilter).toHaveBeenCalledWith('DISPENSED');

    fireEvent.change(screen.getByRole('textbox', { name: 'Search dispensary' }), {
      target: { value: 'milo' },
    });
    expect(setDispensarySearch).toHaveBeenCalledWith('milo');
  });

  it('renders the correct active filter bar for each view', () => {
    const sharedProps = {
      filters: defaultFilters,
      selectedFilterChips: [],
      sortMode: 'name' as const,
      setFilterOpen: jest.fn(),
      setFilters: jest.fn(),
      setSortMode: jest.fn(),
      dispensarySearch: '',
      dispensaryStatusFilter: 'ALL' as const,
      setDispensaryStatusFilter: jest.fn(),
      setDispensarySearch: jest.fn(),
    };

    const { rerender } = render(<ActiveFilterBar activeView="inventory" {...sharedProps} />);
    expect(screen.getByRole('textbox', { name: 'Search inventory' })).toBeInTheDocument();

    rerender(<ActiveFilterBar activeView="turnover" {...sharedProps} />);
    expect(screen.getByRole('textbox', { name: 'Search dispensary' })).toBeInTheDocument();

    rerender(<ActiveFilterBar activeView="analytics" {...sharedProps} />);
    expect(screen.queryByRole('textbox', { name: 'Search inventory' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Search dispensary' })).not.toBeInTheDocument();
  });

  it('routes inventory table content interactions for analytics, inventory, and dispensary views', () => {
    const setFilteredTurnoverList = jest.fn();
    const setActiveInventory = jest.fn();
    const setViewInventory = jest.fn();
    const setInfoInitialSection = jest.fn();
    const setActiveDispensaryRecord = jest.fn();
    const setDispensaryModalOpen = jest.fn();
    const onRestock = jest.fn();
    const onDispense = jest.fn();

    const { rerender } = render(
      <InventoryTableContent
        activeView="analytics"
        turnover={[{ id: 't1' }, { id: 't2' }] as any}
        setFilteredTurnoverList={setFilteredTurnoverList}
        turnoverCategoryOptions={['Medicine']}
        filteredTurnoverList={[{ id: 't1' }] as any}
        filteredInventory={[inventoryItem]}
        setActiveInventory={setActiveInventory}
        setViewInventory={setViewInventory}
        setInfoInitialSection={setInfoInitialSection}
        filteredDispensaryRecords={[dispensaryRecord]}
        setActiveDispensaryRecord={setActiveDispensaryRecord}
        setDispensaryModalOpen={setDispensaryModalOpen}
        onRestock={onRestock}
        onDispense={onDispense}
      />
    );

    fireEvent.click(screen.getByTestId('turnover-filters-mock'));
    expect(setFilteredTurnoverList).toHaveBeenCalled();

    rerender(
      <InventoryTableContent
        activeView="inventory"
        turnover={[{ id: 't1' }] as any}
        setFilteredTurnoverList={setFilteredTurnoverList}
        turnoverCategoryOptions={['Medicine']}
        filteredTurnoverList={[{ id: 't1' }] as any}
        filteredInventory={[inventoryItem]}
        setActiveInventory={setActiveInventory}
        setViewInventory={setViewInventory}
        setInfoInitialSection={setInfoInitialSection}
        filteredDispensaryRecords={[dispensaryRecord]}
        setActiveDispensaryRecord={setActiveDispensaryRecord}
        setDispensaryModalOpen={setDispensaryModalOpen}
        onRestock={onRestock}
        onDispense={onDispense}
      />
    );

    fireEvent.click(screen.getByTestId('view-item-inv-1'));
    expect(setActiveInventory).toHaveBeenCalledWith(inventoryItem);
    expect(setInfoInitialSection).toHaveBeenCalledWith(undefined);
    expect(setViewInventory).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByTestId('restock-item-inv-1'));
    expect(onRestock).toHaveBeenCalledWith(inventoryItem);

    rerender(
      <InventoryTableContent
        activeView="turnover"
        turnover={[{ id: 't1' }] as any}
        setFilteredTurnoverList={setFilteredTurnoverList}
        turnoverCategoryOptions={['Medicine']}
        filteredTurnoverList={[{ id: 't1' }] as any}
        filteredInventory={[inventoryItem]}
        setActiveInventory={setActiveInventory}
        setViewInventory={setViewInventory}
        setInfoInitialSection={setInfoInitialSection}
        filteredDispensaryRecords={[dispensaryRecord]}
        setActiveDispensaryRecord={setActiveDispensaryRecord}
        setDispensaryModalOpen={setDispensaryModalOpen}
        onRestock={onRestock}
        onDispense={onDispense}
      />
    );

    fireEvent.click(screen.getByTestId('view-record-dr-1'));
    expect(setActiveDispensaryRecord).toHaveBeenCalledWith(dispensaryRecord);
    expect(setDispensaryModalOpen).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByTestId('dispense-record-dr-1'));
    expect(onDispense).toHaveBeenCalledWith(dispensaryRecord);
  });

  it('handles inventory filter modal clear, apply, discard, and nested filter toggles', () => {
    const setFilterOpen = jest.fn();
    const setFilters = jest.fn();
    const toggleListFilter = jest.fn();
    const toggleCategoryFilter = jest.fn();
    const toggleExpandedCategory = jest.fn();
    const toggleFilterSection = jest.fn();

    render(
      <InventoryFilterModal
        filterOpen
        selectedFilterChips={[{ id: 'chip-1', label: 'Medicine', onRemove: jest.fn() }]}
        setFilterOpen={setFilterOpen}
        setFilters={setFilters}
        filterOpenSections={new Set(['stock-status', 'location', 'category', 'abc', 'supplier'])}
        toggleFilterSection={toggleFilterSection}
        filters={{
          ...defaultFilters,
          status: 'LOW_STOCK',
          locations: ['Ward A'],
          categories: ['Medicine'],
          subCategories: ['Tablet'],
          abcClasses: ['Class A'],
          suppliers: ['Acme Vet'],
        }}
        locationFilterOptions={['Ward A']}
        toggleListFilter={toggleListFilter}
        categoryOptions={['Medicine']}
        categorySubcategoryOptions={{ Medicine: ['Tablet'] }}
        expandedCategories={new Set(['Medicine'])}
        toggleCategoryFilter={toggleCategoryFilter}
        toggleExpandedCategory={toggleExpandedCategory}
        supplierFilterOptions={['Acme Vet']}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(setFilters).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(setFilterOpen).toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByRole('button', { name: 'Location 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Category 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'ABC 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Supplier 1' }));
    expect(toggleFilterSection).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Ward A' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Class A' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Acme Vet' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Medicine' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Tablet' }));
    expect(toggleListFilter).toHaveBeenCalled();
    expect(toggleCategoryFilter).toHaveBeenCalledWith('Medicine');

    fireEvent.click(screen.getByRole('button', { name: 'Collapse Medicine' }));
    expect(toggleExpandedCategory).toHaveBeenCalledWith('Medicine');

    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(setFilterOpen).toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(setFilterOpen).toHaveBeenCalledWith(false);
    expect(setFilters).toHaveBeenCalled();
  });

  it('handles dispensary filter modal status, request type, clear-all, apply, and discard', () => {
    const setDispensaryFilterOpen = jest.fn();
    const setDispensaryStatusFilter = jest.fn();
    const setDispensaryRequestType = jest.fn();
    const toggleFilterSection = jest.fn();

    render(
      <DispensaryFilterModal
        dispensaryFilterOpen
        setDispensaryFilterOpen={setDispensaryFilterOpen}
        dispensaryStatusFilter="DISPENSED"
        setDispensaryStatusFilter={setDispensaryStatusFilter}
        dispensaryRequestType="PATIENT"
        setDispensaryRequestType={setDispensaryRequestType}
        filterOpenSections={new Set(['disp-status', 'disp-type'])}
        toggleFilterSection={toggleFilterSection}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(setDispensaryStatusFilter).toHaveBeenCalledWith('ALL');
    expect(setDispensaryRequestType).toHaveBeenCalledWith('ALL');

    fireEvent.click(screen.getByRole('button', { name: 'Status 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Request type 1' }));
    expect(toggleFilterSection).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('radio', { name: 'Pending' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Inhouse' }));
    expect(setDispensaryStatusFilter).toHaveBeenCalledWith('PENDING');
    expect(setDispensaryRequestType).toHaveBeenCalledWith('IN_HOUSE');

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(setDispensaryFilterOpen).toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByRole('button', { name: 'Apply dispensary filters' }));
    expect(setDispensaryFilterOpen).toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(setDispensaryStatusFilter).toHaveBeenCalledWith('ALL');
    expect(setDispensaryRequestType).toHaveBeenCalledWith('ALL');
    expect(setDispensaryFilterOpen).toHaveBeenCalledWith(false);
  });
});
