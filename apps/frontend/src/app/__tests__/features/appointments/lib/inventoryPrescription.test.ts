import {
  backfillPrescriptionFromInventory,
  getPrescriptionSaveErrors,
  inventoryToPrescriptionItem,
  validatePrescriptionItem,
} from '@/app/features/appointments/lib/inventoryPrescription';
import type { InventoryItem } from '@/app/features/inventory/pages/Inventory/types';
import type { PrescriptionItem } from '@/app/features/appointments/types/workspace';

const buildInventoryItem = (overrides: Partial<InventoryItem> = {}): InventoryItem =>
  ({
    id: 'inv-1',
    sku: 'PC-0234',
    basicInfo: { name: 'Paracetamol', brand: 'Calpol', category: 'Medicine' },
    classification: {
      genericName: 'Paracetamol 650',
      strength: '650',
      unitofMeasure: 'mg',
      form: 'Tablet',
      dosageForm: 'Tablet',
      administration: 'Oral',
      controlledSubstance: 'true',
      prescriptionRequired: 'true',
      drugSchedule: 'Schedule III',
    },
    pricing: { selling: '60' },
    vendor: {},
    stock: { reorderLevel: '50' },
    batch: { _id: 'batch-1' },
    ...overrides,
  }) as unknown as InventoryItem;

describe('inventoryToPrescriptionItem', () => {
  it('maps inventory display fields, strength unit and flags', () => {
    const result = inventoryToPrescriptionItem(buildInventoryItem());
    expect(result).toMatchObject({
      medicineName: 'Paracetamol',
      brand: 'Calpol',
      genericName: 'Paracetamol 650',
      sku: 'PC-0234',
      strength: '650',
      strengthUnit: 'mg',
      dosageForm: 'Tablet',
      doseUnit: 'tablet',
      route: 'Oral',
      fulfillment: 'IN_HOUSE',
      inventoryItemId: 'inv-1',
      inventoryBatchId: 'batch-1',
      controlledSubstance: true,
      prescriptionRequired: true,
      drugSchedule: 'Schedule III',
    });
    expect(result.priceCents).toBe(6000);
  });

  it('leaves controlled/prescription flags undefined when not set', () => {
    const item = buildInventoryItem({
      classification: { strength: '5', unitofMeasure: 'mL', form: 'Liquid' },
    });
    const result = inventoryToPrescriptionItem(item);
    expect(result.controlledSubstance).toBeUndefined();
    expect(result.prescriptionRequired).toBeUndefined();
    expect(result.doseUnit).toBe('mL');
  });
});

describe('validatePrescriptionItem', () => {
  it('returns no errors for valid values', () => {
    expect(validatePrescriptionItem({ durationDays: '5', qty: '14', refill: '2' })).toEqual({});
  });

  it('flags non-numeric and out-of-range values', () => {
    const errors = validatePrescriptionItem({
      durationDays: 'abc',
      qty: '1.5',
      refill: '20',
    });
    expect(errors.durationDays).toBe('Enter a number');
    expect(errors.qty).toBe('Whole number');
    expect(errors.refill).toBe('Max 12');
  });

  it('flags non-positive numbers', () => {
    const errors = validatePrescriptionItem({ durationDays: '0', qty: '0' });
    expect(errors.durationDays).toBe('Must be > 0');
    expect(errors.qty).toBe('Must be > 0');
  });
});

describe('getPrescriptionSaveErrors', () => {
  const complete: PrescriptionItem = {
    id: 'rx-1',
    medicineName: 'Paracetamol',
    frequency: 'BID (twice daily)',
    durationDays: '5',
    durationUnit: 'days',
    qty: '14',
    route: 'Oral',
    dosageForm: 'Tablet',
    fulfillment: 'IN_HOUSE',
  };

  it('returns no errors for a complete row', () => {
    expect(getPrescriptionSaveErrors(complete)).toEqual([]);
  });

  it('reports every missing required field for a bare row', () => {
    const errors = getPrescriptionSaveErrors({
      id: 'rx-min',
      medicineName: 'Minimal',
      fulfillment: 'IN_HOUSE',
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('frequency');
    expect(errors[0]).toContain('duration');
    expect(errors[0]).toContain('quantity to dispense');
    expect(errors[0]).toContain('route');
    expect(errors[0]).toContain('form');
  });

  it('does not require an explicit duration unit (defaults to days)', () => {
    expect(getPrescriptionSaveErrors({ ...complete, durationUnit: undefined })).toEqual([]);
  });

  it('blocks save on a bad number format and names the field', () => {
    const errors = getPrescriptionSaveErrors({ ...complete, qty: '2.5' });
    expect(errors.some((message) => message.includes('quantity'))).toBe(true);
    expect(errors.some((message) => message.includes('whole number'))).toBe(true);
  });

  it('does not flag valid numeric fields', () => {
    expect(
      getPrescriptionSaveErrors({ ...complete, durationDays: '12', qty: '2', refill: '2' })
    ).toEqual([]);
  });
});

describe('backfillPrescriptionFromInventory', () => {
  const saved: PrescriptionItem = {
    id: 'rx-1',
    medicineName: 'Paracetamol',
    frequency: 'BID (twice daily)',
    qty: '14',
    fulfillment: 'PRESCRIPTION_ONLY',
    inventoryItemId: 'inv-1',
  };

  it('fills missing inventory fields but keeps saved values', () => {
    const result = backfillPrescriptionFromInventory(saved, () => buildInventoryItem());
    // Saved clinician value wins.
    expect(result.frequency).toBe('BID (twice daily)');
    expect(result.qty).toBe('14');
    // Gaps filled from inventory.
    expect(result.brand).toBe('Calpol');
    expect(result.strength).toBe('650');
    expect(result.strengthUnit).toBe('mg');
    expect(result.route).toBe('Oral');
    expect(result.controlledSubstance).toBe(true);
    expect(result.priceCents).toBe(6000);
  });

  it('returns the item unchanged when inventory cannot be resolved', () => {
    const result = backfillPrescriptionFromInventory(saved, () => undefined);
    expect(result).toBe(saved);
  });

  it('always refreshes stock health from inventory', () => {
    const stale: PrescriptionItem = { ...saved, stockQty: 999, lowStock: false };
    const result = backfillPrescriptionFromInventory(stale, () =>
      buildInventoryItem({
        stock: { current: '10', allocated: '0', reorderLevel: '50' },
      } as never)
    );
    // Live on-hand (10) replaces the stale saved snapshot, and 10 <= reorderLevel 50 → low stock.
    expect(result.stockQty).toBe(10);
    expect(result.lowStock).toBe(true);
  });
});
