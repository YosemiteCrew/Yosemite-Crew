import {
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
import { defaultFilters } from '@/app/features/inventory/pages/Inventory/utils';

describe('Inventory page helpers', () => {
  const inventoryItems = [
    {
      id: 'a',
      status: 'ACTIVE',
      stockHealth: 'Low Stock',
      basicInfo: {
        name: 'Alpha',
        category: 'Medicine',
        subCategory: 'Tablet',
        description: 'Daily tablet',
      },
      batch: { batch: 'LOT-1', expiryDate: '2026-03-10' },
      stock: { current: 3, stockLocation: 'Ward A', abcClass: 'Class A' },
      vendor: { supplierName: 'Acme Vet' },
    },
    {
      id: 'b',
      status: 'HIDDEN',
      stockHealth: 'Healthy',
      basicInfo: {
        name: 'Beta',
        category: 'Food',
        subCategory: 'Dry Food',
        description: 'Crunchy meal',
      },
      batch: { batch: 'LOT-2', expiryDate: '2026-06-10' },
      stock: { current: 10, stockLocation: 'Ward B', abcClass: 'Class B' },
      vendor: { vendor: 'Backup Supplier' },
    },
  ] as any[];

  const baseDispenseRequest = {
    id: 'dr-1',
    prescriptionId: 'prescription-1',
    status: 'PENDING',
    medications: [
      {
        inventoryItemId: 'inv-1',
        inventoryItemName: 'Amoxicillin',
        quantity: 2,
        priceCents: 5000,
        fulfillment: 'PATIENT',
        metadata: { doseUnit: 'tablet', durationUnit: 'weeks' },
        dosage: '1',
        frequency: 'BID',
        durationDays: 14,
        refillsRemaining: 1,
        stockUnitQuantity: 30,
      },
    ],
    metadata: { petParentName: 'Owner From Metadata' },
    patientName: 'Milo',
    parentName: null,
    patientImageUrl: null,
    petBreed: 'Beagle',
    petAge: '3',
    leadName: 'Dr Test',
    location: 'Treatment',
    invoiceId: 'invoice-1',
    paymentStatus: 'PAID',
    currency: 'USD',
    requestedAt: '2026-01-01T00:00:00.000Z',
    reviewedAt: '2026-01-02T00:00:00.000Z',
    prescription: {
      artifact: {
        appointmentId: 'appointment-1',
        summary: 'Default Summary',
      },
    },
  } as any;

  it('compares inventory rows by name, expiry, and stock', () => {
    expect(
      compareInventoryRows(inventoryItems[0] as any, inventoryItems[1] as any, 'name')
    ).toBeLessThan(0);
    expect(
      compareInventoryRows(inventoryItems[0] as any, inventoryItems[1] as any, 'expiry')
    ).toBeLessThan(0);
    expect(
      compareInventoryRows(inventoryItems[0] as any, inventoryItems[1] as any, 'stock')
    ).toBeLessThan(0);
  });

  it('resolves supplier names from supplierName, vendor, or empty values', () => {
    expect(getSupplierName(inventoryItems[0] as any)).toBe('Acme Vet');
    expect(getSupplierName(inventoryItems[1] as any)).toBe('Backup Supplier');
    expect(getSupplierName({ vendor: {} } as any)).toBe('');
  });

  it('filters and sorts inventory using search, status, category, locations, abc classes, and suppliers', () => {
    const filtered = filterAndSortInventory(
      inventoryItems as any,
      {
        ...defaultFilters,
        visibility: 'ACTIVE',
        status: 'LOW_STOCK',
        categories: ['Medicine'],
        locations: ['Ward A'],
        abcClasses: ['Class A'],
        suppliers: ['Acme Vet'],
      },
      'tablet',
      'stock'
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('a');
  });

  it('includes single selected category and sub-category matches even when category is not in categories array', () => {
    const filtered = filterAndSortInventory(
      inventoryItems as any,
      {
        ...defaultFilters,
        visibility: 'ALL',
        category: 'food',
        subCategories: ['Dry Food'],
      },
      'crunchy',
      'name'
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('b');
  });

  it('derives dispense request type from fulfillment and patient name', () => {
    expect(getDispenseRequestType('IN_HOUSE', 'Milo')).toBe('IN_HOUSE');
    expect(getDispenseRequestType('PATIENT', 'Milo')).toBe('PATIENT');
    expect(getDispenseRequestType(undefined, null)).toBe('IN_HOUSE');
  });

  it('maps dispense API requests into dispensary records with fallbacks', () => {
    const record = mapDispenseRequestToRecord({
      ...baseDispenseRequest,
      parentName: 'Top Level Owner',
      medications: [
        baseDispenseRequest.medications[0],
        {
          inventoryItemId: 'inv-2',
          medicineName: 'Fallback Medicine',
          quantity: 1,
          priceCents: 2500,
          doseUnit: 'capsule',
          durationDays: null,
          refillsRemaining: null,
        },
      ],
    });
    const firstItem = record.items?.[0];
    const secondItem = record.items?.[1];

    expect(record.petParentName).toBe('Top Level Owner');
    expect(record.amountCents).toBe(7500);
    expect(firstItem?.doseUnit).toBe('tablet');
    expect(firstItem?.prescription?.duration).toBe('14 weeks');
    expect(secondItem?.name).toBe('Fallback Medicine');
    expect(secondItem?.prescription?.duration).toBe('');
  });

  it('filters dispensary records by request type, status, and multi-field search', () => {
    const records = [
      {
        id: '1',
        requestType: 'PATIENT',
        status: 'PENDING',
        patient: { name: 'Milo' },
        lead: 'Dr Test',
        location: 'Treatment',
        items: [{ name: 'Amoxicillin' }],
      },
      {
        id: '2',
        requestType: 'IN_HOUSE',
        status: 'DISPENSED',
        patient: { name: 'Bella' },
        lead: 'Dr Other',
        location: 'Ward',
        items: [{ name: 'Vitamin' }],
      },
    ] as any[];

    expect(filterDispensaryRecords(records, 'PATIENT', 'ALL', 'milo')).toHaveLength(1);
    expect(filterDispensaryRecords(records, 'ALL', 'DISPENSED', 'vitamin')).toHaveLength(1);
    expect(filterDispensaryRecords(records, 'PATIENT', 'PENDING', 'treatment')).toHaveLength(1);
  });

  it('returns labels and titles for inventory view variants', () => {
    expect(getVisibilityLabel('ALL')).toBe('All inventory');
    expect(getVisibilityLabel('ACTIVE')).toBe('Active');
    expect(getVisibilityLabel('HIDDEN')).toBe('Hidden');
    expect(getInventoryPageTitle('inventory' as any)).toBe('Inventory');
    expect(getInventoryPageTitle('turnover' as any)).toBe('Dispensary');
    expect(getInventoryPageTitle('analytics' as any)).toBe('Turnover');
  });

  it('toggles set membership immutably', () => {
    const start = new Set(['alpha']);
    const added = toggleSetItem(start, 'beta');
    const removed = toggleSetItem(added, 'alpha');

    expect(start.has('beta')).toBe(false);
    expect(added.has('alpha')).toBe(true);
    expect(added.has('beta')).toBe(true);
    expect(removed.has('alpha')).toBe(false);
    expect(removed.has('beta')).toBe(true);
  });
});
