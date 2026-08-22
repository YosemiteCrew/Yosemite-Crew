import type {
  AppointmentEncounter,
  BillableKind,
  InvoiceLineItem,
  PastInvoice,
  PrescriptionItem,
} from '@/app/features/appointments/types/workspace';
import {
  computePackageBreakdownItem,
  computePackageTotals,
} from '@/app/features/organization/services/catalogCalculations';
import type {
  PackageBreakdownItem,
  PackageRevamp,
  ServiceRevamp,
} from '@/app/features/organization/types/revamp';
import type { InventoryItem } from '@/app/features/inventory/pages/Inventory/types';
import { inventoryToPrescriptionItem } from '@/app/features/appointments/lib/inventoryPrescription';

export type BillableCandidate = Omit<InvoiceLineItem, 'id'> & {
  kind: BillableKind;
  // Present when this candidate is a dispensable drug; used to backfill a linked
  // prescription row when the item is billed without one (the bill/prescription
  // interlink), so clinical details can't be skipped before finalizing.
  prescription?: Omit<PrescriptionItem, 'id'>;
};

/**
 * Axios sets `error.message` to a generic "Request failed with status code N" string, which is
 * meaningless to a clinician. The finance backend always answers a rejected invoice call with a
 * `{ message }` body carrying the real reason (e.g. "Cannot modify a closed invoice" on a 409), so
 * prefer that; fall back to the caller's copy rather than ever dumping the raw axios/status text.
 */
const RAW_AXIOS_MESSAGE = /^request failed with status code \d+$/i;

type ApiErrorBody = { error?: { message?: string }; message?: string };

export const getInvoiceErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null) {
    const data = (error as { response?: { data?: unknown } }).response?.data;
    if (typeof data === 'object' && data !== null) {
      const body = data as ApiErrorBody;
      const message = body.error?.message ?? body.message;
      if (typeof message === 'string' && message.trim()) return message.trim();
    }
  }
  if (error instanceof Error && error.message.trim() && !RAW_AXIOS_MESSAGE.test(error.message)) {
    return error.message;
  }
  return fallback;
};

export const moneyToCents = (amount: number): number => Math.max(0, Math.round(amount * 100));

export const normalizeLineName = (value: string): string => value.trim().toLowerCase();

export const discountCentsFromPercent = (grossCents: number, percent: number): number =>
  Math.min(grossCents, Math.round((grossCents * percent) / 100));

export const toInvoiceCandidate = (
  name: string,
  unitPriceCents: number,
  kind: BillableKind,
  qty = 1
): BillableCandidate => {
  const grossCents = unitPriceCents * qty;
  return {
    name,
    unitPriceCents,
    qty,
    grossCents,
    discountCents: 0,
    amountCents: grossCents,
    kind,
  };
};

export const breakdownToInvoiceBreakdown = (item: PackageBreakdownItem) => {
  const { gross, discountAmt, net } = computePackageBreakdownItem(item);
  return {
    id: item.id,
    name: item.name,
    qty: item.quantity,
    instructions: item.type,
    unitPriceCents: moneyToCents(item.unitPrice),
    grossCents: moneyToCents(gross),
    discountPercent: item.discount,
    discountCents: moneyToCents(discountAmt),
    amountCents: moneyToCents(net),
  };
};

/**
 * Build a candidate that surfaces the catalog discount on the line: gross is the
 * full price, the default-discount % is applied as the starting line discount, and
 * the max-discount % becomes the editable ceiling so a manual edit can't exceed it.
 */
const toDiscountedCandidate = (
  name: string,
  grossDollars: number,
  defaultDiscountPercent: number,
  maxDiscountPercent: number,
  kind: BillableKind,
  breakdown?: InvoiceLineItem['breakdown']
): BillableCandidate => {
  const grossCents = moneyToCents(grossDollars);
  const discountCents = Math.min(
    grossCents,
    Math.round((grossCents * defaultDiscountPercent) / 100)
  );
  const maxDiscountCents = Math.min(
    grossCents,
    Math.round((grossCents * maxDiscountPercent) / 100)
  );
  return {
    name,
    unitPriceCents: grossCents,
    qty: 1,
    grossCents,
    discountCents,
    amountCents: grossCents - discountCents,
    maxDiscountPercent,
    maxDiscountCents,
    breakdown,
    kind,
  };
};

export const serviceToInvoiceCandidate = (service: ServiceRevamp) =>
  toDiscountedCandidate(
    service.name,
    service.grossAmount,
    service.defaultDiscount ?? 0,
    service.maxDiscount ?? 0,
    'BILLING_ONLY'
  );

export const packageToInvoiceCandidate = (pkg: PackageRevamp) => {
  const { additionalDiscountAmt, afterItemDiscounts } = computePackageTotals(pkg);
  const candidate = toDiscountedCandidate(
    pkg.name,
    afterItemDiscounts,
    pkg.additionalDiscount ?? 0,
    pkg.additionalDiscount ?? 0,
    'PACKAGE_COMPONENT',
    pkg.breakdown.map(breakdownToInvoiceBreakdown)
  );
  return {
    ...candidate,
    packageDefaultDiscountPercent: pkg.additionalDiscount ?? 0,
    packageDefaultDiscountCents: moneyToCents(additionalDiscountAmt),
  };
};

export const uniqueByName = (
  items: BillableCandidate[],
  excludedNames: Set<string>
): BillableCandidate[] => {
  const seen = new Set(excludedNames);
  return items.filter((item) => {
    const key = item.name.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/**
 * Treat an inventory item as a dispensable drug when it is explicitly typed as a
 * Drug, carries a controlled-substance schedule, or is marked prescription-
 * required. Relying on `itemType` alone misses drugs whose type field was never
 * set, so we also accept the drug-only schedule/prescription attributes.
 */
const isDispensableDrug = (item: InventoryItem): boolean => {
  const info = item.basicInfo;
  if (info.itemType?.trim().toLowerCase() === 'drug') return true;
  if (info.drugSchedule?.trim()) return true;
  const requiresRx = info.prescriptionRequired?.trim().toLowerCase();
  return requiresRx === 'yes' || requiresRx === 'true' || requiresRx === 'required';
};

const inventoryToInvoiceCandidate = (item: InventoryItem): BillableCandidate => {
  const sellingDollars = Number(item.pricing?.selling ?? 0);
  const candidate = toInvoiceCandidate(
    item.basicInfo.name,
    moneyToCents(sellingDollars),
    'INVENTORY'
  );
  // Drug stock billed here should also exist as a prescription so the Treatment
  // step and the bill stay in sync; carry the prescription payload so the add
  // handler can backfill one when none exists yet.
  if (isDispensableDrug(item)) {
    return { ...candidate, prescription: inventoryToPrescriptionItem(item) };
  }
  return candidate;
};

const buildServiceCandidates = (
  encounter: AppointmentEncounter,
  existingNames: Set<string>
): BillableCandidate[] =>
  encounter.services
    .filter(
      (item) =>
        !item.billed && item.amountCents > 0 && !existingNames.has(item.name.trim().toLowerCase())
    )
    .map((item) => toInvoiceCandidate(item.name, item.amountCents, 'EXISTING_TREATMENT'));

// In-house medications prescribed this visit. Their price comes from the linked
// inventory item; when it is missing we still surface them at 0 so they can be
// added and priced inline rather than silently dropped from the bill.
const buildPrescriptionCandidates = (
  encounter: AppointmentEncounter,
  existingNames: Set<string>
): BillableCandidate[] =>
  encounter.prescription
    .filter(
      (item) =>
        !item.billed &&
        item.fulfillment === 'IN_HOUSE' &&
        !existingNames.has(item.medicineName.trim().toLowerCase())
    )
    .map((item) =>
      toInvoiceCandidate(
        item.medicineName,
        // priceCents is the UNIT price. Without the quantity a package-expanded
        // medication of 5 at 10 each billed as a single 10 line.
        Math.max(0, item.priceCents ?? 0),
        'IN_HOUSE_PRESCRIPTION',
        Math.max(1, Number.parseInt(item.qty ?? '1', 10) || 1)
      )
    );

const buildCatalogCandidates = (
  catalogServices: ServiceRevamp[],
  catalogPackages: PackageRevamp[],
  organisationId?: string
): BillableCandidate[] => {
  if (!organisationId) return [];
  const isActiveForOrg = (entry: { organisationId?: string; status?: string }): boolean =>
    entry.organisationId === organisationId && entry.status === 'ACTIVE';
  return [
    ...catalogServices.filter(isActiveForOrg).map(serviceToInvoiceCandidate),
    ...catalogPackages.filter(isActiveForOrg).map(packageToInvoiceCandidate),
  ];
};

// Inventory/stock items (drugs, consumables) so they can be charged directly.
const buildInventoryCandidates = (
  inventoryItems: InventoryItem[],
  existingNames: Set<string>
): BillableCandidate[] =>
  inventoryItems
    .filter(
      (item) =>
        Boolean(item.basicInfo?.name) &&
        item.status !== 'HIDDEN' &&
        !existingNames.has((item.basicInfo?.name ?? '').trim().toLowerCase())
    )
    .map(inventoryToInvoiceCandidate);

export const buildBillableItems = (
  encounter: AppointmentEncounter,
  catalogServices: ServiceRevamp[],
  catalogPackages: PackageRevamp[],
  inventoryItems: InventoryItem[],
  organisationId?: string
): BillableCandidate[] => {
  const existingNames = new Set(
    encounter.invoiceLineItems.map((item) => item.name.trim().toLowerCase())
  );
  const visitItems = uniqueByName(
    [
      ...buildServiceCandidates(encounter, existingNames),
      ...buildPrescriptionCandidates(encounter, existingNames),
      ...buildInventoryCandidates(inventoryItems, existingNames),
    ],
    new Set()
  );
  const catalogItems = buildCatalogCandidates(catalogServices, catalogPackages, organisationId);
  return uniqueByName([...visitItems, ...catalogItems], existingNames);
};

/**
 * Names that must not be auto-seeded onto the editable bill because they are already
 * represented there — either on the current builder or on an OPEN (unpaid/partial)
 * invoice, which hydrateInvoiceBilling seeds straight into the builder. Paid invoices
 * are handled separately (settledLineNames) and excluded here so their lines don't
 * block a legitimate re-bill.
 */
export const collectSeededBillNames = (
  builderNames: string[],
  pastInvoices: PastInvoice[]
): Set<string> => {
  const names = new Set(builderNames.map((name) => normalizeLineName(name)));
  for (const invoice of pastInvoices) {
    if (invoice.status === 'PAID_FULL') continue;
    for (const item of invoice.items) names.add(normalizeLineName(item.name));
  }
  return names;
};
