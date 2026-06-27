import type { InventoryItem } from '@/app/features/inventory/pages/Inventory/types';
import { getAvailableStock } from '@/app/features/inventory/pages/Inventory/utils';
import type { PrescriptionItem } from '@/app/features/appointments/types/workspace';

const toCents = (value: string | number | undefined): number | undefined => {
  if (value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : undefined;
};

const isLowStock = (item: InventoryItem) => {
  const available = getAvailableStock(item);
  const reorderLevel = Number(item.stock.reorderLevel);
  if (available === undefined || !Number.isFinite(reorderLevel)) return false;
  return available <= reorderLevel;
};

const joinNonEmpty = (...parts: Array<string | undefined>): string | undefined => {
  const joined = parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(' ');
  return joined || undefined;
};

const cleanString = (value?: string | string[]): string | undefined => {
  const first = Array.isArray(value) ? value.find(Boolean) : value;
  const trimmed = first?.trim();
  return trimmed || undefined;
};

const isTruthyFlag = (value?: string): boolean | undefined => {
  const trimmed = value?.trim().toLowerCase();
  if (trimmed === undefined || trimmed === '') return undefined;
  return ['true', 'yes', '1'].includes(trimmed);
};

/** Default per-dose unit inferred from the inventory dispensing form (Tablet → tablet, etc.). */
const doseUnitForForm = (form?: string): string | undefined => {
  const normalized = form?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (['tablet', 'capsule', 'wipe', 'kit', 'device', 'food pack'].includes(normalized)) {
    return normalized;
  }
  if (['liquid', 'solution', 'suspension', 'spray'].includes(normalized)) return 'mL';
  if (['ointment', 'cream', 'powder'].includes(normalized)) return 'application';
  return undefined;
};

/**
 * Map an inventory item to a prescription row. Shared by the Treatment step (when
 * adding an in-house medication) and the Invoice step (when a billed drug needs a
 * linked prescription) so both surfaces produce identical, interlinked rows.
 *
 * Prescribing fields (dosage/route/frequency) are pre-filled from the inventory
 * item's classification where available; when they are absent the row is left
 * incomplete on purpose so the workspace's finalize gate flags it.
 */
/**
 * Backfill a hydrated prescription line (from the GET / encounter) with inventory-owned display
 * fields that the saved record may be missing — brand, generic, strength unit, form, route,
 * controlled flag, schedule, price and live stock. The saved/clinician-entered values always win;
 * inventory only fills the gaps. Resolved by `inventoryItemId` (preferred) or SKU.
 */
export const backfillPrescriptionFromInventory = (
  item: PrescriptionItem,
  resolveInventory: (item: PrescriptionItem) => InventoryItem | undefined
): PrescriptionItem => {
  const inv = resolveInventory(item);
  if (!inv) return item;
  const fromInv = inventoryToPrescriptionItem(inv);
  const fill = (current: string | undefined, next: string | undefined): string | undefined =>
    current === undefined || current === '' ? next : current;
  return {
    ...item,
    brand: fill(item.brand, fromInv.brand),
    genericName: fill(item.genericName, fromInv.genericName),
    sku: fill(item.sku, fromInv.sku),
    strength: fill(item.strength, fromInv.strength),
    strengthUnit: fill(item.strengthUnit, fromInv.strengthUnit),
    dosageForm: fill(item.dosageForm, fromInv.dosageForm),
    doseUnit: fill(item.doseUnit, fromInv.doseUnit),
    route: fill(item.route, fromInv.route),
    drugSchedule: fill(item.drugSchedule, fromInv.drugSchedule),
    controlledSubstance: item.controlledSubstance ?? fromInv.controlledSubstance,
    prescriptionRequired: item.prescriptionRequired ?? fromInv.prescriptionRequired,
    priceCents: item.priceCents ?? fromInv.priceCents,
    // Stock health is always live from inventory — never trust a stale saved snapshot.
    stockQty: fromInv.stockQty ?? item.stockQty,
    lowStock: fromInv.lowStock ?? item.lowStock,
  };
};

/** Frequency vocabulary (controlled) shared by the editor and the print label. */
export const FREQUENCY_OPTIONS = [
  'SID (once daily)',
  'BID (twice daily)',
  'TID (three times daily)',
  'QID (four times daily)',
  'Every 4 hours',
  'Every 6 hours',
  'Every 8 hours',
  'Every 12 hours',
  'As needed (PRN)',
  'Before meals',
  'After meals',
  'Once weekly',
];

/** Duration units offered for the duration field. */
export const DURATION_UNIT_OPTIONS = ['days', 'weeks', 'months'];

/** Per-dose units offered when inventory cannot infer one from the form. */
export const DOSE_UNIT_OPTIONS = [
  'tablet',
  'capsule',
  'mL',
  'mg',
  'drop',
  'application',
  'sachet',
  'unit',
];

const POSITIVE_NUMBER = /^\d+(\.\d+)?$/;
const NON_NEGATIVE_INTEGER = /^\d+$/;

/**
 * Validate the clinician-editable prescribing fields. Inventory-owned fields (form, route,
 * strength) are not validated here — they are sourced from the catalog. Returns a map of
 * field → message so the card can surface inline errors and the finalize gate can block.
 */
export const validatePrescriptionItem = (
  item: Pick<PrescriptionItem, 'durationDays' | 'qty' | 'refill'>
): Partial<Record<'durationDays' | 'qty' | 'refill', string>> => {
  const errors: Partial<Record<'durationDays' | 'qty' | 'refill', string>> = {};
  const duration = item.durationDays?.trim();
  if (duration && !POSITIVE_NUMBER.test(duration)) {
    errors.durationDays = 'Enter a number';
  } else if (duration && Number(duration) <= 0) {
    errors.durationDays = 'Must be > 0';
  }
  const qty = item.qty?.trim();
  if (qty && !NON_NEGATIVE_INTEGER.test(qty)) {
    errors.qty = 'Whole number';
  } else if (qty && Number(qty) <= 0) {
    errors.qty = 'Must be > 0';
  }
  const refill = item.refill?.trim();
  if (refill && !NON_NEGATIVE_INTEGER.test(refill)) {
    errors.refill = 'Whole number';
  } else if (refill && Number(refill) > 12) {
    errors.refill = 'Max 12';
  }
  return errors;
};

/**
 * The duration unit shown on the card when none is set (display + save default). A row with a
 * duration value but no explicit unit is treated as "days", so the unit is never a blocking field.
 */
export const DEFAULT_DURATION_UNIT = 'days';

const FIELD_LABELS: Record<'durationDays' | 'qty' | 'refill', string> = {
  durationDays: 'duration',
  qty: 'quantity',
  refill: 'refills',
};

/**
 * Required-field check enforced when SAVING a prescription (stricter than the live inline
 * validator). A prescription must not persist with empty clinical instructions: the clinician
 * must set frequency, duration, quantity, route and form, and every number-format rule from
 * `validatePrescriptionItem` must pass. The duration unit defaults to "days" so it never blocks.
 * Returns an ordered list of human messages; empty means the row is safe to save.
 */
export const getPrescriptionSaveErrors = (item: PrescriptionItem): string[] => {
  const label = item.medicineName?.trim() || 'Medication';
  const missing: string[] = [];
  if (!item.medicineName?.trim()) missing.push('name');
  if (!item.frequency?.trim()) missing.push('frequency');
  if (!item.durationDays?.trim()) missing.push('duration');
  if (!item.qty?.trim()) missing.push('quantity to dispense');
  if (!item.route?.trim()) missing.push('route');
  if (!item.dosageForm?.trim()) missing.push('form');

  const errors: string[] = [];
  if (missing.length > 0) {
    errors.push(`${label}: add ${missing.join(', ')}.`);
  }
  // Surface any number-format errors (non-numeric / out-of-range) as blocking too, naming the field.
  const formatErrors = validatePrescriptionItem(item);
  (Object.keys(formatErrors) as Array<keyof typeof formatErrors>).forEach((field) => {
    const message = formatErrors[field];
    if (message) errors.push(`${label}: ${FIELD_LABELS[field]} — ${message.toLowerCase()}.`);
  });
  return errors;
};

export const inventoryToPrescriptionItem = (item: InventoryItem): Omit<PrescriptionItem, 'id'> => {
  const classification = item.classification ?? {};
  const basicInfo = item.basicInfo ?? { name: '' };
  const strength = cleanString(classification.strength);
  const strengthUnit = cleanString(classification.unitofMeasure);
  const dosageForm = cleanString(classification.dosageForm ?? classification.form);
  const route = cleanString(classification.administration);
  return {
    medicineName: basicInfo.name,
    brand: cleanString(basicInfo.brand ?? classification.brand),
    genericName: cleanString(classification.genericName),
    sku: cleanString(item.sku),
    strength,
    strengthUnit,
    dosageForm,
    dosage: joinNonEmpty(joinNonEmpty(strength, strengthUnit), dosageForm),
    doseUnit: doseUnitForForm(dosageForm),
    route,
    fulfillment: 'IN_HOUSE' as const,
    inventoryItemId: item.id,
    inventoryBatchId: item.batch?._id,
    priceCents: toCents(item.pricing.selling),
    stockQty: getAvailableStock(item),
    lowStock: isLowStock(item),
    controlledSubstance: isTruthyFlag(classification.controlledSubstance),
    prescriptionRequired: isTruthyFlag(classification.prescriptionRequired),
    drugSchedule: cleanString(classification.drugSchedule),
  };
};
