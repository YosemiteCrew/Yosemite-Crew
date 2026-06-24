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

/**
 * Map an inventory item to a prescription row. Shared by the Treatment step (when
 * adding an in-house medication) and the Invoice step (when a billed drug needs a
 * linked prescription) so both surfaces produce identical, interlinked rows.
 *
 * Prescribing fields (dosage/route/frequency) are pre-filled from the inventory
 * item's classification where available; when they are absent the row is left
 * incomplete on purpose so the workspace's finalize gate flags it.
 */
export const inventoryToPrescriptionItem = (item: InventoryItem): Omit<PrescriptionItem, 'id'> => {
  const classification = item.classification ?? {};
  return {
    medicineName: item.basicInfo.name,
    dosage: joinNonEmpty(classification.strength, classification.dosageForm ?? classification.form),
    route: classification.administration,
    frequency: classification.frequency,
    fulfillment: 'IN_HOUSE' as const,
    inventoryItemId: item.id,
    inventoryBatchId: item.batch?._id,
    priceCents: toCents(item.pricing.selling),
    stockQty: getAvailableStock(item),
    lowStock: isLowStock(item),
  };
};
