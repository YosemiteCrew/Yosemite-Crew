/**
 * Pure list, mapping and copy helpers for the Inventory page.
 *
 * They live beside index.tsx rather than inside it because a module that exports
 * both React components and plain values loses per-component Fast Refresh: editing
 * one of these helpers would invalidate the whole page module instead of hot-swapping
 * a single component (react-doctor/only-export-components).
 */
import {
  DispensaryRecord,
  DispensaryStatus,
  InventoryFiltersState,
  InventoryItem,
} from '@/app/features/inventory/pages/Inventory/types';
import { effectiveStockHealthKey } from '@/app/features/inventory/pages/Inventory/utils';
import type { DispenseRequestApi } from '@/app/features/inventory/services/dispensaryService';

export type InventoryView = 'inventory' | 'turnover' | 'analytics';

export type SortMode = 'name' | 'expiry' | 'stock';

export const compareInventoryRows = (
  a: InventoryItem,
  b: InventoryItem,
  sortMode: SortMode
): number => {
  if (sortMode === 'expiry') {
    return String(a.batch.expiryDate ?? '').localeCompare(String(b.batch.expiryDate ?? ''));
  }
  if (sortMode === 'stock') {
    return Number(a.stock.current ?? 0) - Number(b.stock.current ?? 0);
  }
  return a.basicInfo.name.localeCompare(b.basicInfo.name);
};

export const getSupplierName = (item: InventoryItem) =>
  (item.vendor?.supplierName || item.vendor?.vendor || '').trim();

export const filterAndSortInventory = (
  inventory: InventoryItem[],
  filters: InventoryFiltersState,
  debouncedSearch: string,
  sortMode: SortMode
): InventoryItem[] => {
  const normalizedSearch = debouncedSearch.trim().toLowerCase();
  const visibilityFilter = (filters.visibility ?? 'ALL').toUpperCase();
  const stockHealthFilter = filters.status.toUpperCase();
  const selectedCategories = filters.categories ?? [];
  const selectedSubCategories = filters.subCategories ?? [];
  const selectedLocations = filters.locations ?? [];
  const selectedAbcClasses = filters.abcClasses ?? [];
  const selectedSuppliers = filters.suppliers ?? [];
  const selectedCategorySet = new Set(selectedCategories);
  const selectedSubCategorySet = new Set(selectedSubCategories);
  const selectedLocationSet = new Set(selectedLocations);
  const selectedAbcClassSet = new Set(selectedAbcClasses);
  const selectedSupplierSet = new Set(selectedSuppliers);
  const nextFiltered = inventory.filter((item) => {
    const statusKey = (item.status || item.basicInfo.status || '').toUpperCase();
    // Use the same effective (explicit-or-derived) key as the header counts and the
    // table labels, so the low-stock/expired status filter keeps derived rows visible.
    const stockHealthKey = effectiveStockHealthKey(item);
    const categoryMatch =
      (filters.category === 'all' && selectedCategories.length === 0) ||
      selectedCategorySet.has(item.basicInfo.category ?? '') ||
      item.basicInfo.category?.toLowerCase() === filters.category.toLowerCase();
    const subCategoryMatch =
      selectedSubCategories.length === 0 ||
      selectedSubCategorySet.has(item.basicInfo.subCategory ?? '');
    const locationMatch =
      selectedLocations.length === 0 || selectedLocationSet.has(item.stock?.stockLocation ?? '');
    const abcClassMatch =
      selectedAbcClasses.length === 0 || selectedAbcClassSet.has(item.stock?.abcClass ?? '');
    const supplierMatch =
      selectedSuppliers.length === 0 || selectedSupplierSet.has(getSupplierName(item));
    const visibilityMatch = visibilityFilter === 'ALL' || statusKey === visibilityFilter;
    const stockHealthMatch = stockHealthFilter === 'ALL' || stockHealthKey === stockHealthFilter;
    const searchMatch =
      normalizedSearch === '' ||
      item.basicInfo.name.toLowerCase().includes(normalizedSearch) ||
      item.basicInfo.category?.toLowerCase().includes(normalizedSearch) ||
      item.basicInfo.subCategory?.toLowerCase().includes(normalizedSearch) ||
      item.batch?.batch?.toLowerCase().includes(normalizedSearch) ||
      item.basicInfo.description?.toLowerCase().includes(normalizedSearch);
    return (
      categoryMatch &&
      subCategoryMatch &&
      locationMatch &&
      abcClassMatch &&
      supplierMatch &&
      visibilityMatch &&
      stockHealthMatch &&
      searchMatch
    );
  });
  nextFiltered.sort((a, b) => compareInventoryRows(a, b, sortMode));
  return nextFiltered;
};

export const getDispenseRequestType = (
  fulfillment: string | undefined,
  patientName: string | null
): 'IN_HOUSE' | 'PATIENT' => {
  if (fulfillment === 'IN_HOUSE') return 'IN_HOUSE';
  return patientName ? 'PATIENT' : 'IN_HOUSE';
};

export const mapDispenseRequestToRecord = (req: DispenseRequestApi): DispensaryRecord => {
  const firstMed = req.medications[0];
  const requestType = getDispenseRequestType(firstMed?.fulfillment, req.patientName);
  const amountCents = req.medications.reduce((sum, m) => sum + (m.priceCents ?? 0), 0);
  const parentName = typeof req.parentName === 'string' ? req.parentName : undefined;
  const metadataPetParentName =
    typeof req.metadata?.petParentName === 'string' ? req.metadata.petParentName : undefined;
  const petParentName = parentName ?? metadataPetParentName;

  return {
    id: req.id,
    prescriptionId: req.prescriptionId,
    patient: {
      name: req.patientName ?? '—',
      appointmentId: req.prescription.artifact.appointmentId ?? '—',
      imageUrl: req.patientImageUrl ?? undefined,
      petBreed: req.petBreed ?? undefined,
      petAge: req.petAge ?? undefined,
    },
    status: req.status,
    prescriptionItems: req.medications.map((m) => m.inventoryItemId),
    prescriptionCreated: req.requestedAt,
    amountCents,
    currency: req.currency ?? undefined,
    lead: typeof req.leadName === 'string' ? req.leadName : '—',
    petParentName,
    location: req.location ?? '—',
    requestType,
    invoiceId: req.invoiceId ?? undefined,
    paymentStatus: req.paymentStatus ?? undefined,
    // reviewedAt marks when the request was reviewed (dispensed OR marked not
    // dispensed) - only surface it as "Dispensed" when it was actually dispensed,
    // otherwise a "Not dispensed" row wrongly shows a dispensed timestamp (bug #1968).
    timeDispensed: req.status === 'DISPENSED' ? (req.reviewedAt ?? undefined) : undefined,
    items: req.medications.map((m) => {
      const metadataDoseUnit =
        typeof m.metadata?.doseUnit === 'string' ? m.metadata.doseUnit : undefined;
      const medicationDoseUnit = typeof m.doseUnit === 'string' ? m.doseUnit : undefined;
      const doseUnit = metadataDoseUnit ?? medicationDoseUnit;
      const durationUnit =
        typeof m.metadata?.durationUnit === 'string' ? m.metadata.durationUnit : undefined;
      return {
        name:
          m.inventoryItemName ??
          m.medication ??
          m.medicineName ??
          req.prescription.artifact.summary ??
          m.inventoryItemId,
        quantity: m.quantity ?? 1,
        priceCents: m.priceCents ?? 0,
        isRx: m.isRx,
        isControlled: m.isControlled,
        doseQty: m.doseQty,
        doseUnit,
        frequency: m.frequency,
        frequencyPerDay: m.frequencyPerDay,
        durationDays: m.durationDays,
        durationUnit,
        refillsRemaining: m.refillsRemaining,
        stockUnitQty:
          m.stockUnitQty ?? m.stockUnitQuantity ?? m.packageQuantity ?? m.unitQuantity ?? undefined,
        stockUnitType: m.stockUnitType ?? undefined,
        prescription: {
          dose: m.dosage ?? '',
          freq: m.frequency ?? '',
          duration: m.durationDays == null ? '' : `${m.durationDays} ${durationUnit ?? 'days'}`,
          refill: m.refillsRemaining == null ? '' : String(m.refillsRemaining),
          route: m.route ?? '',
        },
      };
    }),
  };
};

export const getVisibilityLabel = (vis: 'ALL' | 'ACTIVE' | 'HIDDEN'): string => {
  if (vis === 'ALL') return 'All inventory';
  if (vis === 'ACTIVE') return 'Active';
  return 'Hidden';
};

export const filterDispensaryRecords = (
  records: DispensaryRecord[],
  statusFilter: DispensaryStatus | 'ALL',
  search: string
) => {
  const normalizedSearch = search.trim().toLowerCase();

  return records.filter((record) => {
    const statusMatch = statusFilter === 'ALL' || record.status === statusFilter;
    const searchMatch =
      normalizedSearch === '' ||
      record.patient.name.toLowerCase().includes(normalizedSearch) ||
      (record.lead || '').toLowerCase().includes(normalizedSearch) ||
      (record.location || '').toLowerCase().includes(normalizedSearch) ||
      (record.items ?? []).some((item) => item.name.toLowerCase().includes(normalizedSearch));

    return statusMatch && searchMatch;
  });
};

export const getInventoryPageTitle = (view: InventoryView): string => {
  if (view === 'turnover') return 'Dispensary';
  if (view === 'analytics') return 'Turnover';
  return 'Inventory';
};

const pluralize = (count: number, singular: string, plural: string) =>
  `${count} ${count === 1 ? singular : plural}`;

export const getInventorySubtitle = (
  view: InventoryView,
  lowStockCount: number,
  expiredCount: number
): string | null => {
  if (view === 'turnover') return 'Prescriptions waiting to be pulled from stock';
  if (view === 'inventory') {
    return `${pluralize(lowStockCount, 'item', 'items')} below reorder point · ${pluralize(
      expiredCount,
      'expired batch',
      'expired batches'
    )}`;
  }
  return null;
};

export const toggleSetItem = (prev: Set<string>, key: string): Set<string> => {
  const next = new Set(prev);
  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
  }
  return next;
};
