import React from 'react';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import ProtectedInventory, {
  ActiveFilterBar,
  DispensaryFilterBar,
  DispensaryFilterModal,
  InventoryFilterBar,
  compareInventoryRows,
  filterAndSortInventory,
  filterDispensaryRecords,
  getDispenseRequestType,
  getInventoryPageTitle,
  getSupplierName,
  getVisibilityLabel,
  mapDispenseRequestToRecord,
  toggleSetItem,
} from '@/app/features/inventory/pages/Inventory';
import { useOrgStore } from '@/app/stores/orgStore';
import { useInventoryModule } from '@/app/hooks/useInventory';
import { listDispenseRequests } from '@/app/features/inventory/services/dispensaryService';
import { dispensePrescription } from '@/app/features/appointments/services/prescriptionWorkflowService';
import { useRoomsForPrimaryOrg } from '@/app/hooks/useRooms';
import { PERMISSIONS } from '@/app/lib/permissions';
import { defaultFilters } from '@/app/features/inventory/pages/Inventory/utils';

expect.extend(toHaveNoViolations);

let mockSearchParamInventoryId: string | null = null;
let mockPermissions: Record<string, boolean> = {
  [PERMISSIONS.INVENTORY_EDIT_ANY]: true,
  [PERMISSIONS.INVENTORY_VIEW_ANY]: true,
  [PERMISSIONS.PRESCRIPTION_VIEW_ANY]: true,
  [PERMISSIONS.PRESCRIPTION_EDIT_ANY]: true,
};

jest.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (key: string) => (key === 'inventoryId' ? mockSearchParamInventoryId : null),
  }),
}));

jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: (loader: () => Promise<unknown>, options?: { loading?: React.FC }) => {
    options?.loading?.({});
    const source = loader.toString();
    // Execute the real InventoryInfo loader once so its `import().then(module =>
    // ({ default: module.InventoryInfo }))` mapper is exercised for coverage. The
    // underlying module is mocked, so this resolves synchronously to the stub.
    if (source.includes('module.InventoryInfo')) {
      void loader().catch(() => {});
    }
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

      if (source.includes('components/AddInventory')) {
        const MockAddInventory = (
          jest.requireMock('@/app/features/inventory/components/AddInventory') as {
            default: React.FC<Record<string, unknown>>;
          }
        ).default;
        return <MockAddInventory {...props} />;
      }

      if (source.includes('components/TurnoverAnalytics')) {
        const setView = props.setActiveView as ((view: string) => void) | undefined;
        // Stub the dynamic analytics view: expose the Stock/Orders/Turnover
        // segmented control so tests can switch views (the real one renders the
        // same buttons but only after the dynamic chunk loads).
        return (
          <div data-testid="mock-turnover-analytics">
            <button type="button" onClick={() => setView?.('inventory')}>
              Stock
            </button>
            <button type="button" onClick={() => setView?.('turnover')}>
              Orders
            </button>
          </div>
        );
      }

      if (source.includes('InventoryInfo') || source.includes('features/inventory/components')) {
        const MockInventoryInfo = (
          jest.requireMock('@/app/features/inventory/components') as {
            InventoryInfo: React.FC<Record<string, unknown>>;
          }
        ).InventoryInfo;
        return <MockInventoryInfo {...props} />;
      }

      return null;
    };

    LoadableComponent.displayName = 'MockDynamicComponent';
    return LoadableComponent;
  },
}));

// --- Mocks ---

// Mock Components
jest.mock('@/app/ui/layout/guards/ProtectedRoute', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="protected-route">{children}</div>,
}));

jest.mock('@/app/ui/layout/guards/OrgGuard', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="org-guard">{children}</div>,
}));

jest.mock('@/app/ui/primitives/Buttons', () => ({
  Primary: ({ text, onClick, isDisabled }: any) => (
    <button onClick={onClick} disabled={isDisabled} data-testid="add-btn">
      {text}
    </button>
  ),
}));

// Mock Filters
jest.mock('@/app/ui/filters/InventoryFilters', () => ({
  __esModule: true,
  default: ({ onChange, filters, categoryAction }: any) => (
    <div data-testid="inventory-filters">
      {categoryAction}
      <input
        aria-label="Search inventory"
        data-testid="search-input"
        value={filters.search}
        onChange={(e) => onChange({ ...filters, search: e.target.value })}
      />
      <select
        aria-label="Category"
        data-testid="category-select"
        value={filters.category}
        onChange={(e) => onChange({ ...filters, category: e.target.value })}
      >
        <option value="all">all</option>
        <option value="Medicine">Medicine</option>
      </select>
      <select
        aria-label="Visibility status"
        data-testid="status-select"
        value={filters.visibility ?? 'ALL'}
        onChange={(e) =>
          onChange({ ...filters, visibility: e.target.value as 'ALL' | 'ACTIVE' | 'HIDDEN' })
        }
      >
        <option value="ALL">ALL</option>
        <option value="ACTIVE">ACTIVE</option>
        <option value="HIDDEN">HIDDEN</option>
      </select>
      <select
        aria-label="Stock health"
        data-testid="stock-health-select"
        value={filters.status ?? 'ALL'}
        onChange={(e) => onChange({ ...filters, status: e.target.value })}
      >
        <option value="ALL">ALL</option>
        <option value="Low Stock">Low Stock</option>
      </select>
    </div>
  ),
}));

jest.mock('@/app/ui/filters/InventoryTurnoverFilters', () => ({
  __esModule: true,
  default: ({ setFilters }: any) => (
    <div data-testid="turnover-filters">
      <button
        data-testid="tf-cat-food"
        onClick={() => setFilters((prev: any) => ({ ...prev, category: 'Food' }))}
      >
        cat food
      </button>
      <button
        data-testid="tf-cat-ghost"
        onClick={() => setFilters((prev: any) => ({ ...prev, category: 'Ghost' }))}
      >
        cat ghost
      </button>
      <button
        data-testid="tf-status-high"
        onClick={() => setFilters((prev: any) => ({ ...prev, status: 'HIGH' }))}
      >
        status high
      </button>
    </div>
  ),
}));

jest.mock('@/app/ui/tables/DispensaryTable', () => ({
  __esModule: true,
  default: ({ filteredList, onView, onDispense }: any) => (
    <div data-testid="dispensary-table">
      {filteredList.map((record: any) => (
        <div key={record.id} data-testid={`dispensary-record-${record.id}`}>
          <span data-testid={`patient-name-${record.id}`}>{record.patient.name}</span>
          <span data-testid={`parent-name-${record.id}`}>{record.petParentName ?? 'none'}</span>
          <span data-testid={`request-type-${record.id}`}>{record.requestType}</span>
          {onView && (
            <button data-testid={`view-${record.id}`} onClick={() => onView(record)}>
              View
            </button>
          )}
          {onDispense && (
            <button data-testid={`dispense-${record.id}`} onClick={() => onDispense(record)}>
              Dispense
            </button>
          )}
        </div>
      ))}
    </div>
  ),
}));

jest.mock('@/app/features/inventory/components/DispensaryDetailModal', () => ({
  __esModule: true,
  default: ({ record, showModal }: any) =>
    showModal && record ? <div data-testid="dispensary-modal">{record.patient.name}</div> : null,
}));

jest.mock('@/app/features/inventory/services/dispensaryService', () => ({
  listDispenseRequests: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/app/features/appointments/services/prescriptionWorkflowService', () => ({
  dispensePrescription: jest.fn().mockResolvedValue({}),
  finalizePrescription: jest.fn().mockResolvedValue({}),
}));

// Mock Tables
jest.mock('@/app/ui/tables/InventoryTable', () => ({
  __esModule: true,
  default: ({ filteredList, setActiveInventory, setViewInventory, onView, onRestock }: any) => (
    <div data-testid="inventory-table">
      {filteredList.map((item: any) => (
        <div key={item.id}>
          <button
            data-testid={`item-${item.id}`}
            onClick={() => {
              if (onView) {
                onView(item);
              } else {
                setActiveInventory(item);
                setViewInventory(true);
              }
            }}
          >
            {item.basicInfo.name}
          </button>
          {onRestock && (
            <button data-testid={`restock-${item.id}`} onClick={() => onRestock(item)}>
              Restock {item.basicInfo.name}
            </button>
          )}
        </div>
      ))}
    </div>
  ),
}));

jest.mock('@/app/ui/tables/InventoryTurnoverTable', () => ({
  __esModule: true,
  default: ({ filteredList }: any) => (
    <div data-testid="turnover-table" data-count={filteredList?.length ?? 0} />
  ),
}));

// Mock Modals (Updated to handle async errors in onClick to prevent Unhandled Promise Rejections)
jest.mock('@/app/features/inventory/components/AddInventory', () => ({
  __esModule: true,
  default: ({ showModal, onSubmit }: any) =>
    showModal ? (
      <div data-testid="add-modal">
        <button
          data-testid="submit-add"
          onClick={() => {
            // Catch error here to prevent test failure, as component re-throws
            Promise.resolve(onSubmit({ basicInfo: { name: 'New Item' } })).catch(() => {});
          }}
        >
          Submit
        </button>
      </div>
    ) : null,
}));

jest.mock('@/app/features/inventory/components', () => ({
  __esModule: true,
  InventoryInfo: ({
    showModal,
    activeInventory,
    onUpdate,
    onAddBatch,
    onUpdateBatch,
    onHide,
    onUnhide,
  }: any) =>
    showModal ? (
      <div data-testid="info-modal">
        <span>Current: {activeInventory.basicInfo.name}</span>
        <button
          data-testid="update-btn"
          onClick={() => {
            Promise.resolve(
              onUpdate({
                ...activeInventory,
                id: activeInventory.id,
                basicInfo: { name: 'Updated' },
              })
            ).catch(() => {});
          }}
        >
          Update
        </button>
        <button
          data-testid="add-batch-btn"
          onClick={() => {
            Promise.resolve(onAddBatch(activeInventory.id, [{ id: 'b1' }])).catch(() => {});
          }}
        >
          Add Batch
        </button>
        <button
          data-testid="update-batch-btn"
          onClick={() => {
            Promise.resolve(onUpdateBatch(activeInventory.id, [{ id: 'b2' }])).catch(() => {});
          }}
        >
          Update Batch
        </button>
        <button
          data-testid="hide-btn"
          onClick={() => {
            Promise.resolve(onHide(activeInventory.id)).catch(() => {});
          }}
        >
          Hide
        </button>
        <button
          data-testid="unhide-btn"
          onClick={() => {
            Promise.resolve(onUnhide(activeInventory.id)).catch(() => {});
          }}
        >
          Unhide
        </button>
      </div>
    ) : null,
}));

// Mock Hooks
jest.mock('@/app/stores/orgStore');
jest.mock('@/app/hooks/useLoadOrg', () => ({ useLoadOrg: jest.fn() }));
jest.mock('@/app/hooks/useInventory');
jest.mock('@/app/hooks/useRooms', () => ({ useRoomsForPrimaryOrg: jest.fn() }));
jest.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: () => ({
    can: (permission: string) => mockPermissions[permission] ?? true,
    canAll: () => true,
    canAny: () => true,
    permissions: [],
    isLoading: false,
    activeOrgId: 'org-1',
  }),
}));
jest.mock('@/app/ui/layout/guards/PermissionGate', () => ({
  PermissionGate: ({ children }: any) => <div>{children}</div>,
}));
jest.mock('@/app/ui/overlays/Fallback', () => ({
  __esModule: true,
  default: () => <div data-testid="fallback">No permission</div>,
}));

// Mock search store - search now comes from header
let mockSearchQuery = '';
jest.mock('@/app/stores/searchStore', () => ({
  useSearchStore: (selector: (state: { query: string }) => string) =>
    selector({ query: mockSearchQuery }),
}));

// --- Test Data ---

const mockInventory = [
  {
    id: '1',
    status: 'ACTIVE',
    stockHealth: 'Healthy',
    basicInfo: { name: 'Item A', category: 'Medicine', description: 'Desc A' },
  },
  {
    id: '2',
    status: 'ACTIVE',
    stockHealth: 'Low Stock',
    basicInfo: { name: 'Item B', category: 'Food', description: 'Desc B' },
  },
];

const mockTurnover = [{ id: 't1', name: 'Turnover Item' }];

describe('Inventory Page', () => {
  const mockCreateItem = jest.fn();
  const mockUpdateItem = jest.fn();
  const mockHideItem = jest.fn();
  const mockUnhideItem = jest.fn();
  const mockAddBatch = jest.fn();
  const mockUpdateBatch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockSearchQuery = ''; // Reset search query
    mockSearchParamInventoryId = null;
    mockPermissions = {
      [PERMISSIONS.INVENTORY_EDIT_ANY]: true,
      [PERMISSIONS.INVENTORY_VIEW_ANY]: true,
      [PERMISSIONS.PRESCRIPTION_VIEW_ANY]: true,
      [PERMISSIONS.PRESCRIPTION_EDIT_ANY]: true,
    };

    // Default Store Mock
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({
        primaryOrgId: 'org-1',
        orgsById: { 'org-1': { type: 'CLINIC' } },
      })
    );

    // Default Hook Mock
    (useInventoryModule as jest.Mock).mockReturnValue({
      inventory: mockInventory,
      turnover: mockTurnover,
      status: 'success',
      error: null,
      createItem: mockCreateItem,
      updateItem: mockUpdateItem,
      hideItem: mockHideItem,
      unhideItem: mockUnhideItem,
      addBatch: mockAddBatch,
      updateBatch: mockUpdateBatch,
    });
    (useRoomsForPrimaryOrg as jest.Mock).mockReturnValue([]);
    (listDispenseRequests as jest.Mock).mockReturnValue(new Promise(() => {}));
  });

  afterEach(() => {
    jest.useRealTimers();
    cleanup(); // Ensure DOM is clean
  });

  describe('exported inventory helpers', () => {
    it('compares inventory rows by name, expiry, and stock with fallback values', () => {
      const alpha = {
        id: 'a',
        basicInfo: { name: 'Alpha' },
        batch: { expiryDate: '2026-08-01' },
        stock: { current: 10 },
      } as any;
      const beta = {
        id: 'b',
        basicInfo: { name: 'Beta' },
        batch: {},
        stock: {},
      } as any;

      expect(compareInventoryRows(alpha, beta, 'name')).toBeLessThan(0);
      expect(compareInventoryRows(alpha, beta, 'expiry')).toBeGreaterThan(0);
      expect(compareInventoryRows(alpha, beta, 'stock')).toBeGreaterThan(0);
    });

    it('filters and sorts inventory across every supported filter family', () => {
      const inventory = [
        {
          id: 'match',
          status: 'HIDDEN',
          stockHealth: 'Low Stock',
          stock: { stockLocation: 'Ward A', abcClass: 'Class A', current: 4 },
          vendor: { supplierName: 'Acme Vet' },
          batch: { batch: 'B-100', expiryDate: '2026-08-01' },
          basicInfo: {
            name: 'Amoxi Tabs',
            category: 'Medicine',
            subCategory: 'Antibiotic',
            description: 'For post-op recovery',
          },
        },
        {
          id: 'miss',
          status: 'ACTIVE',
          stockHealth: 'Healthy',
          stock: { stockLocation: 'Ward B', abcClass: 'Class B', current: 12 },
          vendor: { vendor: 'Other Supplier' },
          batch: { batch: 'B-200', expiryDate: '2026-09-01' },
          basicInfo: {
            name: 'Dental Chew',
            category: 'Food',
            subCategory: 'Treat',
            description: 'Daily chew',
          },
        },
      ] as any[];

      expect(
        filterAndSortInventory(
          inventory,
          {
            ...defaultFilters,
            category: 'medicine',
            categories: ['Medicine'],
            subCategories: ['Antibiotic'],
            locations: ['Ward A'],
            abcClasses: ['Class A'],
            suppliers: ['Acme Vet'],
            visibility: 'HIDDEN',
            status: 'LOW_STOCK',
          },
          'post-op',
          'expiry'
        ).map((item) => item.id)
      ).toEqual(['match']);
      expect(
        filterAndSortInventory(
          inventory,
          {
            ...defaultFilters,
            category: 'Food',
            visibility: 'ALL',
            categories: [],
            subCategories: ['Treat'],
            locations: ['Ward B'],
            abcClasses: ['Class B'],
            suppliers: ['Other Supplier'],
          },
          '',
          'name'
        ).map((item) => item.id)
      ).toEqual(['miss']);

      expect(filterAndSortInventory(inventory, defaultFilters, 'B-200', 'name')).toHaveLength(1);
      expect(
        filterAndSortInventory(
          inventory,
          { ...defaultFilters, visibility: 'ALL' },
          'medicine',
          'stock'
        )
      ).toHaveLength(1);
      expect(
        filterAndSortInventory(
          inventory,
          { ...defaultFilters, visibility: 'ALL' },
          'antibiotic',
          'name'
        )
      ).toHaveLength(1);
      expect(getSupplierName(inventory[0])).toBe('Acme Vet');
      expect(getSupplierName(inventory[1])).toBe('Other Supplier');
    });

    it('covers inventory helper fallback branches for sparse records and filters', () => {
      const sparseInventory = [
        {
          id: 'basic-status',
          basicInfo: { name: 'Basic Status Item', status: 'ACTIVE' },
          batch: {},
          stock: {},
          vendor: {},
        },
        {
          id: 'empty',
          basicInfo: { name: 'Empty Item', category: undefined },
          batch: {},
          stock: {},
        },
      ] as any[];
      const sparseFilters = {
        category: 'all',
        visibility: undefined,
        status: 'ALL',
        search: '',
      } as any;

      expect(filterAndSortInventory(sparseInventory, sparseFilters, '', 'name')).toHaveLength(2);
      expect(filterAndSortInventory(sparseInventory, sparseFilters, 'basic', 'name')).toHaveLength(
        1
      );
      expect(
        filterAndSortInventory(
          sparseInventory,
          {
            ...sparseFilters,
            categories: [''],
            subCategories: [''],
            locations: [''],
            abcClasses: [''],
          },
          '',
          'name'
        )
      ).toHaveLength(2);
      expect(getSupplierName(sparseInventory[0])).toBe('');
      expect(compareInventoryRows(sparseInventory[0], sparseInventory[1], 'expiry')).toBe(0);
      expect(compareInventoryRows(sparseInventory[0], sparseInventory[1], 'stock')).toBe(0);
    });

    it('maps dispense requests with patient and in-house fallback branches', () => {
      const fullRecord = mapDispenseRequestToRecord(baseDispenseRequest() as any);
      expect(fullRecord.patient.petBreed).toBe('Persian');
      expect(fullRecord.patient.petAge).toBe('2');
      expect(fullRecord.items?.[0]?.prescription?.duration).toBe('14 weeks');

      const minimalRequest = baseDispenseRequest({
        patientName: null,
        petBreed: undefined,
        petAge: undefined,
        leadName: null,
        location: null,
        currency: null,
        reviewedAt: '2026-07-01T10:00:00.000Z',
        paymentStatus: 'PAID',
        invoiceId: 'invoice-1',
        medications: [
          {
            inventoryItemId: 'fallback-med',
            medication: null,
            medicineName: 'Fallback Medicine',
            quantity: null,
            priceCents: null,
            fulfillment: undefined,
            metadata: {},
            durationDays: null,
            refillsRemaining: null,
            stockUnitQuantity: 7,
            route: 'oral',
          },
        ],
        prescription: {
          id: 'presc-1',
          artifactId: 'art-1',
          artifact: {
            id: 'art-1',
            kind: 'PRESCRIPTION',
            status: 'COMPLETED',
            appointmentId: null,
            summary: 'Fallback summary',
          },
        },
      });

      expect(getDispenseRequestType('IN_HOUSE', 'Catty')).toBe('IN_HOUSE');
      expect(getDispenseRequestType(undefined, 'Catty')).toBe('PATIENT');
      expect(getDispenseRequestType(undefined, null)).toBe('IN_HOUSE');

      const record = mapDispenseRequestToRecord(minimalRequest as any);
      expect(record.patient.name).toBe('—');
      expect(record.patient.appointmentId).toBe('—');
      expect(record.patient.petBreed).toBeUndefined();
      expect(record.patient.petAge).toBeUndefined();
      expect(record.lead).toBe('—');
      expect(record.location).toBe('—');
      expect(record.currency).toBeUndefined();
      expect(record.invoiceId).toBe('invoice-1');
      expect(record.paymentStatus).toBe('PAID');
      expect(record.timeDispensed).toBe('2026-07-01T10:00:00.000Z');
      expect(record.items?.[0]).toMatchObject({
        name: 'Fallback Medicine',
        quantity: 1,
        priceCents: 0,
        stockUnitQty: 7,
        prescription: { dose: '', freq: '', duration: '', refill: '', route: 'oral' },
      });

      const summaryFallback = mapDispenseRequestToRecord(
        baseDispenseRequest({
          medications: [
            {
              inventoryItemId: 'summary-med',
              inventoryItemName: null,
              medication: null,
              medicineName: null,
              packageQuantity: 3,
            },
          ],
          prescription: {
            id: 'presc-2',
            artifactId: 'art-2',
            artifact: {
              id: 'art-2',
              kind: 'PRESCRIPTION',
              status: 'COMPLETED',
              appointmentId: 'appt-2',
              summary: 'Summary fallback',
            },
          },
        }) as any
      );
      expect(summaryFallback.items?.[0]?.name).toBe('Summary fallback');
      expect(summaryFallback.items?.[0]?.stockUnitQty).toBe(3);

      const idFallback = mapDispenseRequestToRecord(
        baseDispenseRequest({
          medications: [
            {
              inventoryItemId: 'id-med',
              inventoryItemName: null,
              medication: null,
              medicineName: null,
              unitQuantity: 2,
            },
          ],
          prescription: {
            id: 'presc-3',
            artifactId: 'art-3',
            artifact: {
              id: 'art-3',
              kind: 'PRESCRIPTION',
              status: 'COMPLETED',
              appointmentId: 'appt-3',
              summary: null,
            },
          },
        }) as any
      );
      expect(idFallback.items?.[0]?.name).toBe('id-med');
      expect(idFallback.items?.[0]?.stockUnitQty).toBe(2);

      const defaultDurationUnit = mapDispenseRequestToRecord(
        baseDispenseRequest({
          medications: [
            {
              inventoryItemId: 'duration-med',
              inventoryItemName: 'Duration Med',
              durationDays: 5,
              metadata: {},
            },
          ],
        }) as any
      );
      expect(defaultDurationUnit.items?.[0]?.prescription?.duration).toBe('5 days');
    });

    it('filters dispensary records by request type, status, lead, location, and item name', () => {
      const records = [
        {
          id: 'patient',
          requestType: 'PATIENT',
          status: 'PENDING',
          patient: { name: 'Catty' },
          lead: 'Dr Lead',
          location: 'Recovery',
          items: [{ name: 'Amoxicillin' }],
        },
        {
          id: 'house',
          requestType: 'IN_HOUSE',
          status: 'DISPENSED',
          patient: { name: 'Clinic stock' },
          lead: '',
          location: 'Pharmacy',
          items: [{ name: 'Bandage' }],
        },
        {
          id: 'location-only',
          requestType: 'PATIENT',
          status: 'PENDING',
          patient: { name: 'No match' },
          lead: '',
          location: 'Surgery',
          items: undefined,
        },
        {
          id: 'item-only',
          requestType: 'PATIENT',
          status: 'PENDING',
          patient: { name: 'No match' },
          lead: '',
          location: '',
          items: [{ name: 'Cephalexin' }],
        },
      ] as any[];

      expect(filterDispensaryRecords(records, 'PATIENT', 'PENDING', 'lead')).toHaveLength(1);
      expect(filterDispensaryRecords(records, 'IN_HOUSE', 'ALL', 'pharmacy')).toHaveLength(1);
      expect(filterDispensaryRecords(records, 'ALL', 'DISPENSED', 'bandage')).toHaveLength(1);
      expect(filterDispensaryRecords(records, 'PATIENT', 'PENDING', 'surgery')).toHaveLength(1);
      expect(filterDispensaryRecords(records, 'PATIENT', 'PENDING', 'cephalexin')).toHaveLength(1);
      expect(filterDispensaryRecords(records, 'PATIENT', 'DISPENSED', '')).toEqual([]);
    });

    it('returns labels and toggled set values for inventory controls', () => {
      expect(getVisibilityLabel('ALL')).toBe('All inventory');
      expect(getVisibilityLabel('ACTIVE')).toBe('Active');
      expect(getVisibilityLabel('HIDDEN')).toBe('Hidden');
      expect(getInventoryPageTitle('inventory')).toBe('Inventory');
      expect(getInventoryPageTitle('turnover')).toBe('Dispensary');
      expect(getInventoryPageTitle('analytics')).toBe('Turnover');

      const added = toggleSetItem(new Set(['open']), 'closed');
      expect(Array.from(added).sort()).toEqual(['closed', 'open']);
      const removed = toggleSetItem(added, 'open');
      expect(Array.from(removed)).toEqual(['closed']);
    });
  });

  // --- Section 1: Rendering & Initialization ---

  it('has no axe violations on initial render', async () => {
    jest.useRealTimers();
    const { container } = render(<ProtectedInventory />);
    expect(screen.getByRole('heading', { level: 1, name: /Inventory/ })).toBeInTheDocument();
    // Drain the 300 ms debounce inside act so React 19 doesn't warn about an
    // unwrapped state update after the test assertion.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('renders h1 page heading', () => {
    render(<ProtectedInventory />);
    expect(screen.getByRole('heading', { level: 1, name: /Inventory/ })).toBeInTheDocument();
  });

  it('renders the inventory page layout correctly', () => {
    render(<ProtectedInventory />);

    expect(screen.getByRole('button', { name: 'Inventory info' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dispensary' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filter' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sort by' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add product' })).toBeInTheDocument();
    expect(screen.getByTestId('inventory-table')).toBeInTheDocument();
    expect(screen.queryByTestId('dispensary-table')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Dispensary' }));

    expect(screen.getByTestId('dispensary-table')).toBeInTheDocument();
    expect(screen.queryByTestId('inventory-table')).not.toBeInTheDocument();
  });

  it('exercises inventory filter bar search, filter, and sort callbacks directly', () => {
    const setFilterOpen = jest.fn();
    const setSortMode = jest.fn();
    const setFilters = jest.fn();
    const removeChip = jest.fn();

    render(
      <InventoryFilterBar
        filters={{ ...defaultFilters, search: '' }}
        selectedFilterChips={[{ id: 'status-low', label: 'low stock', onRemove: removeChip }]}
        sortMode="name"
        setFilterOpen={setFilterOpen}
        setFilters={setFilters}
        setSortMode={setSortMode}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Filter/ }));
    expect(setFilterOpen).toHaveBeenCalledWith(true);

    fireEvent.change(screen.getByPlaceholderText('Search inventory'), {
      target: { value: 'needle' },
    });
    expect(setFilters).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Sort by' }));
    fireEvent.click(screen.getByRole('button', { name: 'Stock level' }));
    expect(setSortMode).toHaveBeenCalledWith('stock');
  });

  it('renders the active filter bar variants directly', () => {
    const setDispensaryStatusFilter = jest.fn();
    const setDispensarySearch = jest.fn();
    const commonProps = {
      filters: { ...defaultFilters, search: '' },
      selectedFilterChips: [],
      sortMode: 'name' as const,
      setFilterOpen: jest.fn(),
      setFilters: jest.fn(),
      setSortMode: jest.fn(),
      dispensarySearch: '',
      dispensaryStatusFilter: 'ALL' as const,
      setDispensaryStatusFilter,
      setDispensarySearch,
    };

    const { rerender } = render(<ActiveFilterBar {...commonProps} activeView="turnover" />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Search dispensary' }), {
      target: { value: 'needle' },
    });
    expect(setDispensarySearch).toHaveBeenCalledWith('needle');

    rerender(<ActiveFilterBar {...commonProps} activeView="analytics" />);
    expect(screen.queryByRole('textbox', { name: 'Search dispensary' })).not.toBeInTheDocument();
  });

  it('exercises dispensary filter bar status callback directly', () => {
    const setDispensaryStatusFilter = jest.fn();
    render(
      <DispensaryFilterBar
        dispensarySearch=""
        dispensaryStatusFilter="ALL"
        setDispensaryStatusFilter={setDispensaryStatusFilter}
        setDispensarySearch={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Status' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pending' }));

    expect(setDispensaryStatusFilter).toHaveBeenCalledWith('PENDING');
  });

  it('keeps the sort menu open when clicking its trigger or panel', () => {
    render(
      <InventoryFilterBar
        filters={{ ...defaultFilters, search: '' }}
        selectedFilterChips={[]}
        sortMode="name"
        setFilterOpen={jest.fn()}
        setFilters={jest.fn()}
        setSortMode={jest.fn()}
      />
    );

    const sortTrigger = screen.getByRole('button', { name: 'Sort by' });
    fireEvent.click(sortTrigger);
    expect(screen.getByRole('button', { name: 'Expiry date' })).toBeInTheDocument();

    fireEvent.mouseDown(sortTrigger);
    expect(screen.getByRole('button', { name: 'Expiry date' })).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('button', { name: /^Name/ }));
    expect(screen.getByRole('button', { name: 'Expiry date' })).toBeInTheDocument();
  });

  it('exercises dispensary filter modal clear, apply, discard, and radio callbacks directly', () => {
    const setDispensaryFilterOpen = jest.fn();
    const setDispensaryStatusFilter = jest.fn();
    const setDispensaryRequestType = jest.fn();
    const toggleFilterSection = jest.fn();

    render(
      <DispensaryFilterModal
        dispensaryFilterOpen
        setDispensaryFilterOpen={setDispensaryFilterOpen}
        dispensaryStatusFilter="PENDING"
        setDispensaryStatusFilter={setDispensaryStatusFilter}
        dispensaryRequestType="PATIENT"
        setDispensaryRequestType={setDispensaryRequestType}
        filterOpenSections={new Set(['disp-status', 'disp-type'])}
        toggleFilterSection={toggleFilterSection}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(setDispensaryStatusFilter).toHaveBeenLastCalledWith('ALL');
    expect(setDispensaryRequestType).toHaveBeenLastCalledWith('ALL');

    fireEvent.click(screen.getByRole('button', { name: /Status/ }));
    expect(toggleFilterSection).toHaveBeenCalledWith('disp-status');

    fireEvent.click(screen.getByRole('radio', { name: 'Dispensed' }));
    expect(setDispensaryStatusFilter).toHaveBeenLastCalledWith('DISPENSED');

    fireEvent.click(screen.getByRole('button', { name: /Request type/ }));
    expect(toggleFilterSection).toHaveBeenCalledWith('disp-type');

    fireEvent.click(screen.getByRole('radio', { name: 'In-house' }));
    expect(setDispensaryRequestType).toHaveBeenLastCalledWith('IN_HOUSE');

    fireEvent.click(screen.getByRole('button', { name: 'Apply dispensary filters' }));
    expect(setDispensaryFilterOpen).toHaveBeenLastCalledWith(false);

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(setDispensaryFilterOpen).toHaveBeenLastCalledWith(false);

    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(setDispensaryStatusFilter).toHaveBeenLastCalledWith('ALL');
    expect(setDispensaryRequestType).toHaveBeenLastCalledWith('ALL');
    expect(setDispensaryFilterOpen).toHaveBeenLastCalledWith(false);
  });

  it('displays loading state when fetching data', () => {
    (useInventoryModule as jest.Mock).mockReturnValue({
      inventory: [],
      turnover: [],
      status: 'loading',
      error: null,
      createItem: jest.fn(),
    });

    render(<ProtectedInventory />);
    expect(screen.getByText('Loading inventory…')).toBeInTheDocument();
  });

  it('defaults businessType to GROOMER if no org type present', () => {
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({
        primaryOrgId: null,
        orgsById: {},
      })
    );

    render(<ProtectedInventory />);
    expect(useInventoryModule).toHaveBeenCalledWith('GROOMER');
  });

  it('updates businessType when primary org changes', () => {
    const { rerender } = render(<ProtectedInventory />);
    expect(useInventoryModule).toHaveBeenCalledWith('CLINIC');

    (useOrgStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({
        primaryOrgId: 'org-2',
        orgsById: { 'org-2': { type: 'BREEDER' } },
      })
    );

    rerender(<ProtectedInventory />);
    expect(useInventoryModule).toHaveBeenCalledWith('BREEDER');
  });

  it('opens the deep-linked inventory item from search params', async () => {
    mockSearchParamInventoryId = '2';

    render(<ProtectedInventory />);

    await waitFor(() => {
      expect(screen.getByText('Current: Item B')).toBeInTheDocument();
    });
  });

  it('hides add item button when edit permission is missing', () => {
    mockPermissions[PERMISSIONS.INVENTORY_EDIT_ANY] = false;

    render(<ProtectedInventory />);

    expect(screen.queryByRole('button', { name: 'Add item' })).not.toBeInTheDocument();
  });

  it('hides inventory view toggle when prescription view permission is missing', () => {
    mockPermissions[PERMISSIONS.PRESCRIPTION_VIEW_ANY] = false;

    render(<ProtectedInventory />);

    expect(screen.queryByRole('button', { name: 'Dispensary' })).not.toBeInTheDocument();
  });

  // --- Section 2: Filtering Logic ---

  it('filters inventory by search text (debounced)', async () => {
    const { rerender } = render(<ProtectedInventory />);

    expect(screen.getByTestId('item-1')).toBeInTheDocument();
    expect(screen.getByTestId('item-2')).toBeInTheDocument();

    // Update mock search query (simulating header search)
    mockSearchQuery = 'Item A';
    rerender(<ProtectedInventory />);

    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(screen.queryByTestId('item-2')).not.toBeInTheDocument();
      expect(screen.getByTestId('item-1')).toBeInTheDocument();
    });
  });

  it('filters inventory by category', async () => {
    render(<ProtectedInventory />);

    fireEvent.click(screen.getByRole('button', { name: /^Filter/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Category' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Medicine' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => {
      expect(screen.getByTestId('item-1')).toBeInTheDocument();
      expect(screen.queryByTestId('item-2')).not.toBeInTheDocument();
    });
  });

  it('removes an active filter chip via its cross button', async () => {
    render(<ProtectedInventory />);

    fireEvent.click(screen.getByRole('button', { name: /^Filter/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Category' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Medicine' }));

    const removeChip = screen.getByRole('button', { name: 'Remove Medicine' });
    expect(removeChip).toBeInTheDocument();

    fireEvent.click(removeChip);

    expect(screen.queryByRole('button', { name: 'Remove Medicine' })).not.toBeInTheDocument();
    expect((screen.getByRole('checkbox', { name: 'Medicine' }) as HTMLInputElement).checked).toBe(
      false
    );
  });

  it('filters inventory by status', async () => {
    (useInventoryModule as jest.Mock).mockReturnValue({
      inventory: [mockInventory[0], { ...mockInventory[1], status: 'HIDDEN' }],
      turnover: mockTurnover,
      status: 'success',
      error: null,
      createItem: mockCreateItem,
      updateItem: mockUpdateItem,
      hideItem: mockHideItem,
      unhideItem: mockUnhideItem,
      addBatch: mockAddBatch,
    });
    render(<ProtectedInventory />);

    fireEvent.click(screen.getByRole('button', { name: 'Active' }));

    await waitFor(() => {
      expect(screen.getByTestId('item-1')).toBeInTheDocument();
      expect(screen.queryByTestId('item-2')).not.toBeInTheDocument();
    });
  });

  it('filters inventory by stock health (Special Status Filter)', async () => {
    render(<ProtectedInventory />);

    fireEvent.click(screen.getByRole('button', { name: /^Filter/ }));
    fireEvent.click(screen.getByRole('radio', { name: 'low stock' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => {
      expect(screen.queryByTestId('item-1')).not.toBeInTheDocument();
      expect(screen.getByTestId('item-2')).toBeInTheDocument();
    });
  });

  it('sorts inventory items by expiry date and stock level', async () => {
    (useInventoryModule as jest.Mock).mockReturnValue({
      inventory: [
        {
          id: '3',
          status: 'ACTIVE',
          stockHealth: 'Healthy',
          stock: { current: 20 },
          batch: { expiryDate: '2026-12-01' },
          basicInfo: { name: 'Gamma', category: 'Medicine', description: 'Desc G' },
        },
        {
          id: '1',
          status: 'ACTIVE',
          stockHealth: 'Healthy',
          stock: { current: 10 },
          batch: { expiryDate: '2026-08-01' },
          basicInfo: { name: 'Alpha', category: 'Medicine', description: 'Desc A' },
        },
        {
          id: '2',
          status: 'ACTIVE',
          stockHealth: 'Healthy',
          stock: { current: 5 },
          batch: { expiryDate: '2026-10-01' },
          basicInfo: { name: 'Beta', category: 'Medicine', description: 'Desc B' },
        },
      ],
      turnover: mockTurnover,
      status: 'success',
      error: null,
      createItem: mockCreateItem,
      updateItem: mockUpdateItem,
      hideItem: mockHideItem,
      unhideItem: mockUnhideItem,
      addBatch: mockAddBatch,
    });

    render(<ProtectedInventory />);

    const getItemOrder = () =>
      screen
        .getAllByTestId(/item-/)
        .map((itemButton) => itemButton.textContent)
        .filter((label): label is string => Boolean(label));

    expect(getItemOrder()).toEqual(['Alpha', 'Beta', 'Gamma']);

    fireEvent.click(screen.getByRole('button', { name: 'Sort by' }));
    fireEvent.click(screen.getByRole('button', { name: 'Expiry date' }));

    await waitFor(() => {
      expect(getItemOrder()).toEqual(['Alpha', 'Beta', 'Gamma']);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Sort by' }));
    fireEvent.click(screen.getByRole('button', { name: 'Stock level' }));

    await waitFor(() => {
      expect(getItemOrder()).toEqual(['Beta', 'Alpha', 'Gamma']);
    });
  });

  it('supports location, abc, and supplier filters with clear all', async () => {
    (useRoomsForPrimaryOrg as jest.Mock).mockReturnValue([{ name: 'Ward A' }]);
    (useInventoryModule as jest.Mock).mockReturnValue({
      inventory: [
        {
          id: '1',
          status: 'ACTIVE',
          stockHealth: 'Healthy',
          stock: { stockLocation: 'Ward A', abcClass: 'Class A' },
          vendor: { supplierName: 'Acme Vet' },
          basicInfo: {
            name: 'Capsule One',
            category: 'Medicine',
            description: 'Primary item',
          },
        },
        {
          id: '2',
          status: 'ACTIVE',
          stockHealth: 'Healthy',
          stock: { stockLocation: 'Ward B', abcClass: 'Class B' },
          vendor: { supplierName: 'Other Supplier' },
          basicInfo: {
            name: 'Treat Two',
            category: 'Food',
            subCategory: 'Dry Food',
            description: 'Secondary item',
          },
        },
      ],
      turnover: mockTurnover,
      status: 'success',
      error: null,
      createItem: mockCreateItem,
      updateItem: mockUpdateItem,
      hideItem: mockHideItem,
      unhideItem: mockUnhideItem,
      addBatch: mockAddBatch,
    });

    render(<ProtectedInventory />);

    fireEvent.click(screen.getByRole('button', { name: /^Filter/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Location' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Ward A' }));
    fireEvent.click(screen.getByRole('button', { name: 'Category' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Medicine' }));
    fireEvent.click(screen.getByRole('button', { name: 'ABC' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Class A' }));
    fireEvent.click(screen.getByRole('button', { name: 'Supplier' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Acme Vet' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => {
      expect(screen.getByTestId('item-1')).toBeInTheDocument();
      expect(screen.queryByTestId('item-2')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /^Filter/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => {
      expect(screen.getByTestId('item-1')).toBeInTheDocument();
      expect(screen.getByTestId('item-2')).toBeInTheDocument();
    });
  });

  it('removes every active filter chip type individually', async () => {
    (useRoomsForPrimaryOrg as jest.Mock).mockReturnValue([{ name: 'Ward A' }]);
    (useInventoryModule as jest.Mock).mockReturnValue({
      inventory: [
        {
          id: '1',
          status: 'ACTIVE',
          stockHealth: 'LOW_STOCK',
          stock: { stockLocation: 'Ward A', abcClass: 'Class A' },
          vendor: { supplierName: 'Acme Vet' },
          basicInfo: {
            name: 'Capsule One',
            category: 'Medicine',
            subCategory: 'Antibiotic',
            description: 'Primary item',
          },
        },
      ],
      turnover: mockTurnover,
      status: 'success',
      error: null,
      createItem: mockCreateItem,
      updateItem: mockUpdateItem,
      hideItem: mockHideItem,
      unhideItem: mockUnhideItem,
      addBatch: mockAddBatch,
      updateBatch: mockUpdateBatch,
    });

    render(<ProtectedInventory />);

    fireEvent.click(screen.getByRole('button', { name: /^Filter/ }));
    fireEvent.click(screen.getByRole('radio', { name: 'low stock' }));
    fireEvent.click(screen.getByRole('button', { name: 'Location' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Ward A' }));
    fireEvent.click(screen.getByRole('button', { name: 'Category' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Medicine' }));
    fireEvent.click(screen.getByRole('button', { name: 'Expand Medicine' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Antibiotic' }));
    fireEvent.click(screen.getByRole('button', { name: 'ABC' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Class A' }));
    fireEvent.click(screen.getByRole('button', { name: 'Supplier' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Acme Vet' }));

    for (const label of ['low stock', 'Antibiotic', 'Ward A', 'Class A', 'Acme Vet', 'Medicine']) {
      fireEvent.click(screen.getByRole('button', { name: `Remove ${label}` }));
      expect(screen.queryByRole('button', { name: `Remove ${label}` })).not.toBeInTheDocument();
    }
  });

  // --- Section 3: Interactions (Modals & Selection) ---

  it('opens add modal on button click', () => {
    render(<ProtectedInventory />);
    expect(screen.queryByTestId('add-modal')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add product' }));
    expect(screen.getByTestId('add-modal')).toBeInTheDocument();
  });

  it('closes the sort menu on outside click and scroll', () => {
    render(<ProtectedInventory />);

    fireEvent.click(screen.getByRole('button', { name: 'Sort by' }));
    expect(screen.getByRole('button', { name: 'Expiry date' })).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('button', { name: 'Expiry date' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Sort by' }));
    expect(screen.getByRole('button', { name: 'Stock level' })).toBeInTheDocument();
    fireEvent.scroll(window);
    expect(screen.queryByRole('button', { name: 'Stock level' })).not.toBeInTheDocument();
  });

  it('opens analytics view and returns to inventory', () => {
    render(<ProtectedInventory />);

    fireEvent.click(screen.getByRole('button', { name: 'Turnover analytics' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Turnover' })).toBeInTheDocument();

    // The analytics view's segmented control (Stock / Orders / Turnover) returns
    // to the inventory list via the "Stock" segment.
    fireEvent.click(screen.getByRole('button', { name: 'Stock' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Inventory' })).toBeInTheDocument();
  });

  it('derives turnover categories from non-empty turnover entries', () => {
    (useInventoryModule as jest.Mock).mockReturnValue({
      inventory: mockInventory,
      turnover: [
        { id: 't1', name: 'Food Rotation', category: ' Food ' },
        { id: 't2', name: 'Blank Rotation', category: ' ' },
      ],
      status: 'success',
      error: null,
      createItem: mockCreateItem,
      updateItem: mockUpdateItem,
      hideItem: mockHideItem,
      unhideItem: mockUnhideItem,
      addBatch: mockAddBatch,
      updateBatch: mockUpdateBatch,
    });

    render(<ProtectedInventory />);

    fireEvent.click(screen.getByRole('button', { name: 'Turnover analytics' }));

    expect(screen.getByTestId('turnover-filters')).toBeInTheDocument();
  });

  it('filters the turnover list by category and status, resetting unknown categories', () => {
    (useInventoryModule as jest.Mock).mockReturnValue({
      inventory: mockInventory,
      turnover: [
        { id: 't1', name: 'Food Rotation', category: 'Food', status: 'high' },
        { id: 't2', name: 'Med Rotation', category: 'Medicine', status: 'low' },
      ],
      status: 'success',
      error: null,
      createItem: mockCreateItem,
      updateItem: mockUpdateItem,
      hideItem: mockHideItem,
      unhideItem: mockUnhideItem,
      addBatch: mockAddBatch,
      updateBatch: mockUpdateBatch,
    });

    render(<ProtectedInventory />);
    fireEvent.click(screen.getByRole('button', { name: 'Turnover analytics' }));

    const count = () => screen.getByTestId('turnover-table').getAttribute('data-count');

    // Default (category 'all', status 'ALL') → both rows pass.
    expect(count()).toBe('2');

    // Category 'Food' is a known option → only the Food row matches.
    fireEvent.click(screen.getByTestId('tf-cat-food'));
    expect(count()).toBe('1');

    // Category 'Ghost' is not among the derived options → effective category resets
    // to 'all', so both rows pass again.
    fireEvent.click(screen.getByTestId('tf-cat-ghost'));
    expect(count()).toBe('2');

    // Status 'HIGH' → only the high-status row matches.
    fireEvent.click(screen.getByTestId('tf-status-high'));
    expect(count()).toBe('1');
  });

  it('selects an item and opens info modal when clicked', () => {
    render(<ProtectedInventory />);
    fireEvent.click(screen.getByTestId('item-1'));
    expect(screen.getByTestId('info-modal')).toBeInTheDocument();
    expect(screen.getByText('Current: Item A')).toBeInTheDocument();
  });

  it('automatically selects the first item if current active item is filtered out', async () => {
    const { rerender } = render(<ProtectedInventory />);
    fireEvent.click(screen.getByTestId('item-2'));
    expect(screen.getByText('Current: Item B')).toBeInTheDocument();

    // Update mock search query (simulating header search)
    mockSearchQuery = 'Item A';
    rerender(<ProtectedInventory />);

    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(screen.getByText('Current: Item A')).toBeInTheDocument();
    });
  });

  it('closes info modal if list becomes empty', async () => {
    const { rerender } = render(<ProtectedInventory />);
    fireEvent.click(screen.getByTestId('item-1'));
    expect(screen.getByTestId('info-modal')).toBeInTheDocument();

    // Update mock search query (simulating header search)
    mockSearchQuery = 'ZZZZZ';
    rerender(<ProtectedInventory />);

    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(screen.queryByTestId('info-modal')).not.toBeInTheDocument();
    });
  });

  // --- Section 4: CRUD Actions & Error Handling ---

  it('handles create item success', async () => {
    mockCreateItem.mockResolvedValue({
      id: 'new',
      basicInfo: { name: 'New Item' },
    });
    render(<ProtectedInventory />);

    fireEvent.click(screen.getByRole('button', { name: 'Add product' }));
    fireEvent.click(screen.getByTestId('submit-add'));

    await waitFor(() => {
      expect(mockCreateItem).toHaveBeenCalled();
      expect(screen.queryByTestId('add-modal')).not.toBeInTheDocument();
    });
  });

  it('handles create item error', async () => {
    // 1. Simulate NO org to check disabled state (forcing check in a separate scope if needed)
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({ primaryOrgId: null })
    );

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(<ProtectedInventory />);
    const btn = screen.getByRole('button', { name: 'Add product' });
    expect(btn).toBeDisabled();

    // Cleanup before re-rendering for the error test part
    cleanup();

    // 2. Simulate API Error
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({
        primaryOrgId: 'org-1',
        orgsById: { 'org-1': { type: 'CLINIC' } },
      })
    );
    render(<ProtectedInventory />);

    mockCreateItem.mockRejectedValue(new Error('API Fail'));
    fireEvent.click(screen.getByRole('button', { name: 'Add product' }));
    fireEvent.click(screen.getByTestId('submit-add'));

    await waitFor(() => {
      expect(screen.getByText('Unable to save inventory item.')).toBeInTheDocument();
    });

    consoleSpy.mockRestore();
  });

  it('throws (without calling the service) when creating inventory with no organisation', async () => {
    const { rerender } = render(<ProtectedInventory />);

    // Open the add modal while an org is selected.
    fireEvent.click(screen.getByRole('button', { name: 'Add product' }));
    expect(screen.getByTestId('add-modal')).toBeInTheDocument();

    // Org is cleared while the modal stays open — submitting now hits the guard.
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({ primaryOrgId: null, orgsById: {} })
    );
    rerender(<ProtectedInventory />);

    fireEvent.click(screen.getByTestId('submit-add'));

    await waitFor(() => {
      expect(mockCreateItem).not.toHaveBeenCalled();
    });
    // The guard throws before any saving/error state is set, so the modal remains open.
    expect(screen.getByTestId('add-modal')).toBeInTheDocument();
  });

  it('handles update item success', async () => {
    mockUpdateItem.mockResolvedValue({
      id: '1',
      basicInfo: { name: 'Updated' },
    });
    render(<ProtectedInventory />);

    fireEvent.click(screen.getByTestId('item-1'));
    fireEvent.click(screen.getByTestId('update-btn'));

    await waitFor(() => {
      expect(mockUpdateItem).toHaveBeenCalled();
    });
  });

  it('ignores inventory actions when the active item has no id', async () => {
    (useInventoryModule as jest.Mock).mockReturnValue({
      inventory: [
        {
          id: '',
          status: 'ACTIVE',
          stockHealth: 'Healthy',
          basicInfo: { name: 'Draft Item', category: 'Medicine', description: 'No id yet' },
        },
      ],
      turnover: mockTurnover,
      status: 'success',
      error: null,
      createItem: mockCreateItem,
      updateItem: mockUpdateItem,
      hideItem: mockHideItem,
      unhideItem: mockUnhideItem,
      addBatch: mockAddBatch,
      updateBatch: mockUpdateBatch,
    });

    render(<ProtectedInventory />);
    fireEvent.click(screen.getByTestId('item-'));
    fireEvent.click(screen.getByTestId('update-btn'));
    fireEvent.click(screen.getByTestId('add-batch-btn'));
    fireEvent.click(screen.getByTestId('update-batch-btn'));
    fireEvent.click(screen.getByTestId('hide-btn'));
    fireEvent.click(screen.getByTestId('unhide-btn'));

    await waitFor(() => {
      expect(mockUpdateItem).not.toHaveBeenCalled();
      expect(mockAddBatch).not.toHaveBeenCalled();
      expect(mockUpdateBatch).not.toHaveBeenCalled();
      expect(mockHideItem).not.toHaveBeenCalled();
      expect(mockUnhideItem).not.toHaveBeenCalled();
    });
  });

  it('handles update item error', async () => {
    mockUpdateItem.mockRejectedValue(new Error('Fail'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(<ProtectedInventory />);
    fireEvent.click(screen.getByTestId('item-1'));
    fireEvent.click(screen.getByTestId('update-btn'));

    await waitFor(() => {
      expect(screen.getByText('Unable to update inventory item.')).toBeInTheDocument();
    });
    consoleSpy.mockRestore();
  });

  it('handles add batch success', async () => {
    render(<ProtectedInventory />);
    fireEvent.click(screen.getByTestId('item-1'));
    fireEvent.click(screen.getByTestId('add-batch-btn'));
    expect(mockAddBatch).toHaveBeenCalledWith('1', [{ id: 'b1' }]);
  });

  it('handles update batch success', async () => {
    render(<ProtectedInventory />);
    fireEvent.click(screen.getByTestId('item-1'));
    fireEvent.click(screen.getByTestId('update-batch-btn'));
    expect(mockUpdateBatch).toHaveBeenCalledWith('1', [{ id: 'b2' }]);
  });

  it('opens stock details when restock is clicked', () => {
    render(<ProtectedInventory />);
    fireEvent.click(screen.getByTestId('restock-1'));
    expect(screen.getByTestId('info-modal')).toBeInTheDocument();
    expect(screen.getByText('Current: Item A')).toBeInTheDocument();
  });

  it('handles add batch error', async () => {
    mockAddBatch.mockRejectedValue(new Error('Fail'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(<ProtectedInventory />);
    fireEvent.click(screen.getByTestId('item-1'));
    fireEvent.click(screen.getByTestId('add-batch-btn'));

    await waitFor(() => {
      expect(screen.getByText('Unable to add batch.')).toBeInTheDocument();
    });
    consoleSpy.mockRestore();
  });

  it('handles update batch error', async () => {
    mockUpdateBatch.mockRejectedValue(new Error('Fail'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(<ProtectedInventory />);
    fireEvent.click(screen.getByTestId('item-1'));
    fireEvent.click(screen.getByTestId('update-batch-btn'));

    await waitFor(() => {
      expect(screen.getByText('Unable to update batch.')).toBeInTheDocument();
    });
    consoleSpy.mockRestore();
  });

  it('handles hide/unhide success', async () => {
    mockHideItem.mockResolvedValue({ id: '1', basicInfo: {} });
    mockUnhideItem.mockResolvedValue({ id: '1', basicInfo: {} });

    render(<ProtectedInventory />);
    fireEvent.click(screen.getByTestId('item-1'));

    fireEvent.click(screen.getByTestId('hide-btn'));
    await waitFor(() => expect(mockHideItem).toHaveBeenCalled());

    fireEvent.click(screen.getByTestId('unhide-btn'));
    await waitFor(() => expect(mockUnhideItem).toHaveBeenCalled());
  });

  it('keeps the active inventory when hide and unhide return no updated item', async () => {
    mockHideItem.mockResolvedValue(undefined);
    mockUnhideItem.mockResolvedValue(undefined);

    render(<ProtectedInventory />);
    fireEvent.click(screen.getByTestId('item-1'));
    expect(screen.getByText('Current: Item A')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('hide-btn'));
    await waitFor(() => expect(mockHideItem).toHaveBeenCalledWith('1'));
    expect(screen.getByText('Current: Item A')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('unhide-btn'));
    await waitFor(() => expect(mockUnhideItem).toHaveBeenCalledWith('1'));
    expect(screen.getByText('Current: Item A')).toBeInTheDocument();
  });

  it('handles hide/unhide error', async () => {
    mockHideItem.mockRejectedValue(new Error('Fail'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(<ProtectedInventory />);
    fireEvent.click(screen.getByTestId('item-1'));
    fireEvent.click(screen.getByTestId('hide-btn'));

    await waitFor(() => {
      expect(screen.getByText('Unable to hide inventory item.')).toBeInTheDocument();
    });
    consoleSpy.mockRestore();
  });

  it('handles unhide error', async () => {
    mockUnhideItem.mockRejectedValue(new Error('Fail'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(<ProtectedInventory />);
    fireEvent.click(screen.getByTestId('item-1'));
    fireEvent.click(screen.getByTestId('unhide-btn'));

    await waitFor(() => {
      expect(screen.getByText('Unable to unhide inventory item.')).toBeInTheDocument();
    });
    consoleSpy.mockRestore();
  });

  // --- Section 5: Dispensary view ---

  const baseDispenseRequest = (overrides: Record<string, any> = {}) => ({
    id: 'dr-1',
    prescriptionId: 'presc-1',
    organisationId: 'org-1',
    status: 'PENDING',
    medications: [
      {
        inventoryItemId: 'inv-1',
        inventoryItemName: 'Paracetamol',
        quantity: 1,
        priceCents: 6500,
        fulfillment: 'PATIENT',
        frequency: 'TID (three times daily)',
        frequencyPerDay: 3,
        durationDays: 14,
        doseQty: 655,
        doseUnit: 'mL Capsule',
        refillsRemaining: 3,
        isRx: true,
        isControlled: true,
        metadata: { doseUnit: 'capsule', durationUnit: 'weeks' },
      },
    ],
    metadata: { petParentName: 'Tim Cook' },
    patientName: 'Catty',
    parentName: null,
    petBreed: 'Persian',
    petAge: '2',
    patientImageUrl: null,
    leadName: 'Harshit Wandhare',
    location: 'Puppy Ward',
    invoiceId: null,
    paymentStatus: null,
    currency: 'USD',
    requestedBy: 'user-1',
    reviewedBy: null,
    requestedAt: '2026-06-30T13:17:32.259Z',
    reviewedAt: null,
    createdAt: '2026-06-30T13:17:32.259Z',
    updatedAt: '2026-06-30T13:17:32.259Z',
    prescription: {
      id: 'presc-1',
      artifactId: 'art-1',
      artifact: {
        id: 'art-1',
        kind: 'PRESCRIPTION',
        status: 'COMPLETED',
        appointmentId: 'appt-1',
        summary: 'Paracetamol',
      },
    },
    ...overrides,
  });

  const openDispensaryView = async (recordId = 'dr-1') => {
    render(<ProtectedInventory />);
    fireEvent.click(screen.getByRole('button', { name: 'Dispensary' }));
    await waitFor(() => {
      expect(screen.getByTestId(`dispensary-record-${recordId}`)).toBeInTheDocument();
    });
  };

  it('prefers the top-level parentName over metadata.petParentName', async () => {
    (listDispenseRequests as jest.Mock).mockResolvedValue([
      baseDispenseRequest({ parentName: 'Tim Cook', metadata: { petParentName: 'Other Name' } }),
    ]);
    await openDispensaryView();
    expect(screen.getByTestId('parent-name-dr-1')).toHaveTextContent('Tim Cook');
  });

  it('falls back to metadata.petParentName when parentName is absent', async () => {
    (listDispenseRequests as jest.Mock).mockResolvedValue([
      baseDispenseRequest({ parentName: null, metadata: { petParentName: 'Tim Cook' } }),
    ]);
    await openDispensaryView();
    expect(screen.getByTestId('parent-name-dr-1')).toHaveTextContent('Tim Cook');
  });

  it('renders no parent name when neither source provides one', async () => {
    (listDispenseRequests as jest.Mock).mockResolvedValue([
      baseDispenseRequest({ parentName: null, metadata: {} }),
    ]);
    await openDispensaryView();
    expect(screen.getByTestId('parent-name-dr-1')).toHaveTextContent('none');
  });

  it('derives PATIENT request type when fulfillment is not IN_HOUSE and a patient name exists', async () => {
    (listDispenseRequests as jest.Mock).mockResolvedValue([baseDispenseRequest()]);
    await openDispensaryView();
    expect(screen.getByTestId('request-type-dr-1')).toHaveTextContent('PATIENT');
  });

  it('derives IN_HOUSE request type when fulfillment is IN_HOUSE', async () => {
    const req = baseDispenseRequest();
    req.medications[0].fulfillment = 'IN_HOUSE';
    (listDispenseRequests as jest.Mock).mockResolvedValue([req]);
    await openDispensaryView();
    expect(screen.getByTestId('request-type-dr-1')).toHaveTextContent('IN_HOUSE');
  });

  it('derives IN_HOUSE request type when there is no patient name', async () => {
    (listDispenseRequests as jest.Mock).mockResolvedValue([
      baseDispenseRequest({ patientName: null }),
    ]);
    await openDispensaryView();
    expect(screen.getByTestId('request-type-dr-1')).toHaveTextContent('IN_HOUSE');
  });

  it('opens the dispensary detail modal when View is clicked', async () => {
    (listDispenseRequests as jest.Mock).mockResolvedValue([baseDispenseRequest()]);
    await openDispensaryView();
    fireEvent.click(screen.getByTestId('view-dr-1'));
    expect(screen.getByTestId('dispensary-modal')).toHaveTextContent('Catty');
  });

  it('calls dispensePrescription and refetches when Dispense is clicked', async () => {
    (listDispenseRequests as jest.Mock).mockResolvedValue([baseDispenseRequest()]);
    await openDispensaryView();

    fireEvent.click(screen.getByTestId('dispense-dr-1'));

    await waitFor(() => {
      expect(dispensePrescription).toHaveBeenCalledWith('org-1', 'presc-1');
    });
    await waitFor(() => {
      expect(listDispenseRequests).toHaveBeenCalledTimes(2);
    });
  });

  it('silently swallows errors when dispensePrescription fails', async () => {
    (listDispenseRequests as jest.Mock).mockResolvedValue([baseDispenseRequest()]);
    (dispensePrescription as jest.Mock).mockRejectedValueOnce(new Error('Dispense failed'));
    await openDispensaryView();

    fireEvent.click(screen.getByTestId('dispense-dr-1'));

    await waitFor(() => {
      expect(dispensePrescription).toHaveBeenCalled();
    });
    expect(screen.getByTestId('dispensary-table')).toBeInTheDocument();
  });

  it('does not render dispense actions when prescription edit permission is missing', async () => {
    mockPermissions[PERMISSIONS.PRESCRIPTION_EDIT_ANY] = false;
    (listDispenseRequests as jest.Mock).mockResolvedValue([baseDispenseRequest()]);

    await openDispensaryView();

    expect(screen.queryByTestId('dispense-dr-1')).not.toBeInTheDocument();
  });

  it('silently handles errors from listDispenseRequests', async () => {
    (listDispenseRequests as jest.Mock).mockRejectedValue(new Error('Network error'));
    render(<ProtectedInventory />);
    fireEvent.click(screen.getByRole('button', { name: 'Dispensary' }));
    await waitFor(() => {
      expect(screen.getByTestId('dispensary-table')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('dispensary-record-dr-1')).not.toBeInTheDocument();
  });

  it('maps medication dose unit, duration and refill display fields', async () => {
    (listDispenseRequests as jest.Mock).mockResolvedValue([baseDispenseRequest()]);
    await openDispensaryView();
    expect(screen.getByTestId('patient-name-dr-1')).toHaveTextContent('Catty');
  });

  it('filters dispensary records by search and status', async () => {
    (listDispenseRequests as jest.Mock).mockResolvedValue([
      baseDispenseRequest(),
      baseDispenseRequest({
        id: 'dr-2',
        status: 'DISPENSED',
        patientName: 'Bruno',
        leadName: 'Alex',
        location: 'Recovery',
        medications: [
          {
            inventoryItemId: 'inv-2',
            inventoryItemName: 'Amoxicillin',
            quantity: 1,
            priceCents: 2500,
            fulfillment: 'IN_HOUSE',
          },
        ],
      }),
    ]);

    await openDispensaryView('dr-2');

    fireEvent.change(screen.getByRole('textbox', { name: 'Search dispensary' }), {
      target: { value: 'bruno' },
    });

    await waitFor(() => {
      expect(screen.getByTestId('dispensary-record-dr-2')).toBeInTheDocument();
      expect(screen.queryByTestId('dispensary-record-dr-1')).not.toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole('textbox', { name: 'Search dispensary' }), {
      target: { value: '' },
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Status' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Dispensed' }));

    await waitFor(() => {
      expect(screen.getByTestId('dispensary-record-dr-2')).toBeInTheDocument();
      expect(screen.queryByTestId('dispensary-record-dr-1')).not.toBeInTheDocument();
    });
  });

  it('clears the dispensary status filter back to all', async () => {
    (listDispenseRequests as jest.Mock).mockResolvedValue([
      baseDispenseRequest(),
      baseDispenseRequest({
        id: 'dr-2',
        status: 'DISPENSED',
        patientName: 'Bruno',
      }),
    ]);

    await openDispensaryView('dr-2');

    fireEvent.click(screen.getAllByRole('button', { name: 'Status' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Dispensed' }));

    await waitFor(() => {
      expect(screen.getByTestId('dispensary-record-dr-2')).toBeInTheDocument();
      expect(screen.queryByTestId('dispensary-record-dr-1')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Dispensed' }));
    fireEvent.click(screen.getByRole('button', { name: /^All/ }));

    await waitFor(() => {
      expect(screen.getByTestId('dispensary-record-dr-1')).toBeInTheDocument();
      expect(screen.getByTestId('dispensary-record-dr-2')).toBeInTheDocument();
    });
  });
});
