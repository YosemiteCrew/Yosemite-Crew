import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import { useInventoryStore } from '@/app/stores/inventoryStore';
import { loadAppointmentBilling } from '@/app/features/billing/services/invoiceService';
import { fetchInventoryItems } from '@/app/features/inventory/services/inventoryService';
import { mapApiItemToInventoryItem } from '@/app/features/inventory/pages/Inventory/utils';
import { computePackageTotals } from '@/app/features/organization/services/catalogCalculations';
import type { PackageRevamp, ServiceRevamp } from '@/app/features/organization/types/revamp';
import type {
  AppointmentEncounter,
  InvoiceLineItem,
  LineItem,
  PastInvoice,
  PrescriptionItem,
} from '@/app/features/appointments/types/workspace';
import {
  breakdownToInvoiceBreakdown,
  collectSeededBillNames,
  discountCentsFromPercent,
  moneyToCents,
  normalizeLineName,
} from './invoiceStepUtils';

export const PAYMENT_POLL_INTERVAL_MS = 3000;
export const PAYMENT_POLL_TIMEOUT_MS = 120000;

export type PaymentProgressState = {
  invoiceId: string;
  checkoutUrl?: string;
  startedAt: number;
  status: 'checking' | 'confirmed' | 'delayed';
};

export const isInvoiceSettled = (invoice: PastInvoice | undefined): boolean =>
  Boolean(invoice && (invoice.status === 'PAID_FULL' || invoice.outstandingCents <= 0));

export const findInvoiceById = (
  invoices: PastInvoice[],
  invoiceId: string
): PastInvoice | undefined => invoices.find((invoice) => invoice.id === invoiceId);

// Lossless map of a saved Service/Package treatment row into a Total Bill line —
// preserves unit price AND quantity (unlike toInvoiceCandidate, which collapses to
// qty 1 / unitPrice=amountCents and would misprice any qty>1 line).
export const serviceLineItemToInvoiceLine = (
  item: LineItem,
  catalogServices: ServiceRevamp[],
  catalogPackages: PackageRevamp[]
): Omit<InvoiceLineItem, 'id'> => {
  const catalogService = catalogServices.find((service) => service.id === item.refId);
  const catalogPackage = catalogPackages.find((pkg) => pkg.id === item.refId);
  if (catalogPackage) {
    const { additionalDiscountAmt, afterItemDiscounts } = computePackageTotals(catalogPackage);
    const unitPriceCents = moneyToCents(afterItemDiscounts);
    const grossCents = unitPriceCents * item.qty;
    const defaultDiscountPercent = catalogPackage.additionalDiscount ?? 0;
    const discountCents = discountCentsFromPercent(grossCents, defaultDiscountPercent);
    return {
      name: item.name,
      unitPriceCents,
      qty: item.qty,
      grossCents,
      discountCents,
      amountCents: grossCents - discountCents,
      packageDefaultDiscountPercent: defaultDiscountPercent,
      packageDefaultDiscountCents:
        item.qty === 1 ? moneyToCents(additionalDiscountAmt) : discountCents,
      maxDiscountPercent: defaultDiscountPercent,
      maxDiscountCents: discountCents,
      breakdown: item.breakdown,
    };
  }
  if (catalogService) {
    const unitPriceCents = moneyToCents(catalogService.grossAmount);
    const grossCents = unitPriceCents * item.qty;
    const defaultDiscountPercent = catalogService.defaultDiscount ?? 0;
    const maxDiscountPercent = catalogService.maxDiscount ?? 0;
    const discountCents = discountCentsFromPercent(grossCents, defaultDiscountPercent);
    return {
      name: item.name,
      unitPriceCents,
      qty: item.qty,
      grossCents,
      discountCents,
      amountCents: grossCents - discountCents,
      maxDiscountPercent,
      maxDiscountCents: discountCentsFromPercent(grossCents, maxDiscountPercent),
      breakdown: item.breakdown,
    };
  }
  const grossCents = Math.max(0, item.unitPriceCents * item.qty);
  const defaultDiscountPercent = item.defaultDiscountPercent ?? 0;
  const maxDiscountPercent = item.maxDiscountPercent ?? 0;
  const discountCents = discountCentsFromPercent(grossCents, defaultDiscountPercent);
  return {
    name: item.name,
    unitPriceCents: item.unitPriceCents,
    qty: item.qty,
    grossCents,
    discountCents,
    amountCents: grossCents - discountCents,
    packageDefaultDiscountPercent:
      item.kind === 'PACKAGE' ? item.defaultDiscountPercent : undefined,
    packageDefaultDiscountCents: item.kind === 'PACKAGE' ? discountCents : undefined,
    maxDiscountPercent,
    maxDiscountCents: discountCentsFromPercent(grossCents, maxDiscountPercent),
    breakdown: item.breakdown,
  };
};

// Map an in-house prescription row into a Total Bill line (priced per line).
export const prescriptionToInvoiceLine = (rx: PrescriptionItem): Omit<InvoiceLineItem, 'id'> => {
  const amountCents = Math.max(0, rx.priceCents ?? 0);
  return {
    name: rx.medicineName,
    unitPriceCents: amountCents,
    qty: 1,
    grossCents: amountCents,
    discountCents: 0,
    amountCents,
    // Link back to the source prescription so removing this bill line deletes it end-to-end.
    sourcePrescriptionId: rx.id,
    sourceInventoryItemId: rx.inventoryItemId,
  };
};

export const findCatalogPackageForLine = (
  line: InvoiceLineItem,
  catalogPackages: PackageRevamp[],
  organisationId?: string
): PackageRevamp | undefined => {
  const lineName = normalizeLineName(line.name);
  if (!lineName) return undefined;
  return catalogPackages.find(
    (pkg) => pkg.organisationId === organisationId && normalizeLineName(pkg.name) === lineName
  );
};

export const packageInvoicePatch = (pkg: PackageRevamp): Partial<InvoiceLineItem> => {
  return {
    breakdown: pkg.breakdown.map(breakdownToInvoiceBreakdown),
  };
};

// Clinical safety: an in-house medication on the bill must have its
// prescription details (dose, route, frequency, duration) filled before the
// invoice can be finalized. Flag the billed meds that are still incomplete.
export const computeIncompleteMedicationNames = (encounter: AppointmentEncounter): Set<string> => {
  const billItemNames = new Set(
    encounter.invoiceLineItems.map((item) => item.name.trim().toLowerCase())
  );
  const names = new Set<string>();
  for (const rx of encounter.prescription) {
    if (rx.fulfillment !== 'IN_HOUSE') continue;
    if (!billItemNames.has(rx.medicineName.trim().toLowerCase())) continue;
    const hasDose = Boolean((rx.strength ?? rx.dosage)?.trim());
    const complete = Boolean(
      hasDose && rx.route?.trim() && rx.frequency?.trim() && rx.durationDays?.trim()
    );
    if (!complete) names.add(rx.medicineName.trim().toLowerCase());
  }
  return names;
};

// Bill lines enriched with: (1) their max-discount ceiling — a line that lost it on a backend
// prefill recovers the percent (and cents) from the catalog by name (saved values win); and
// (2) a `removable` flag — the appointment's booked service/consultation can't be removed.
// The discount lookup is keyed by line name from the org catalog: lines prefilled from the
// backend (encounter.invoiceLineItems) don't carry their max-discount ceiling — the backend
// persists only price — so we recover it here from the catalog (services + packages).
export const enrichInvoiceLineItems = (
  encounter: AppointmentEncounter,
  catalogServices: ServiceRevamp[],
  catalogPackages: PackageRevamp[],
  organisationId: string | undefined,
  bookedLineKey: string | undefined
): (InvoiceLineItem & { removable: boolean })[] => {
  const discountByName = new Map<
    string,
    Pick<InvoiceLineItem, 'maxDiscountPercent' | 'packageDefaultDiscountPercent'>
  >();
  if (organisationId) {
    for (const service of catalogServices) {
      if (service.organisationId !== organisationId) continue;
      discountByName.set(normalizeLineName(service.name), {
        maxDiscountPercent: service.maxDiscount ?? 0,
      });
    }
    for (const pkg of catalogPackages) {
      if (pkg.organisationId !== organisationId) continue;
      discountByName.set(normalizeLineName(pkg.name), {
        maxDiscountPercent: pkg.additionalDiscount ?? 0,
        packageDefaultDiscountPercent: pkg.additionalDiscount ?? 0,
      });
    }
  }
  return encounter.invoiceLineItems.map((line) => {
    const removable = bookedLineKey ? normalizeLineName(line.name) !== bookedLineKey : true;
    const hasMax = line.maxDiscountPercent != null || line.maxDiscountCents != null;
    if (hasMax) return { ...line, removable };
    const fallback = discountByName.get(normalizeLineName(line.name));
    if (fallback?.maxDiscountPercent == null) return { ...line, removable };
    return {
      ...line,
      removable,
      maxDiscountPercent: fallback.maxDiscountPercent,
      maxDiscountCents: discountCentsFromPercent(line.grossCents, fallback.maxDiscountPercent),
      packageDefaultDiscountPercent:
        line.packageDefaultDiscountPercent ?? fallback.packageDefaultDiscountPercent,
    };
  });
};

/**
 * Loads the org catalog (so saved service/package lines can recover their max-discount
 * ceiling and unit price when landing on Invoice directly) plus the org inventory (so
 * drugs/consumables are searchable in the bill builder). Returns the inventory items.
 */
export const useInvoiceCatalogAndInventory = (organisationId?: string) => {
  const catalogServices = useRevampCatalogStore((s) => s.services);
  const catalogPackages = useRevampCatalogStore((s) => s.packages);
  const loadOrganisationCatalog = useRevampCatalogStore((s) => s.loadOrganisationCatalog);
  const itemIdsByOrgId = useInventoryStore((s) => s.itemIdsByOrgId);
  const inventoryById = useInventoryStore((s) => s.itemsById);
  const setInventoryForOrg = useInventoryStore((s) => s.setInventoryForOrg);

  useEffect(() => {
    if (!organisationId || catalogServices.length > 0 || catalogPackages.length > 0) return;
    loadOrganisationCatalog(organisationId).catch((error) => {
      console.error('Failed to load invoice catalog:', error);
    });
  }, [organisationId, catalogServices.length, catalogPackages.length, loadOrganisationCatalog]);

  const inventoryIds = useMemo(
    () => (organisationId ? (itemIdsByOrgId[organisationId] ?? []) : []),
    [itemIdsByOrgId, organisationId]
  );

  useEffect(() => {
    if (!organisationId || inventoryIds.length > 0) return undefined;
    let active = true;
    fetchInventoryItems(organisationId)
      .then((items) => {
        if (active) setInventoryForOrg(organisationId, items.map(mapApiItemToInventoryItem));
      })
      .catch((error) => console.error('Failed to load invoice inventory:', error));
    return () => {
      active = false;
    };
  }, [inventoryIds.length, organisationId, setInventoryForOrg]);

  const inventoryItems = useMemo(
    () => inventoryIds.flatMap((id) => (inventoryById[id] ? [inventoryById[id]] : [])),
    [inventoryById, inventoryIds]
  );

  return { inventoryItems };
};

/**
 * Hydrate existing invoices + deposit for this appointment from finance — exactly
 * once per appointment. Hydration mutates the store, which re-renders the step
 * with a fresh `encounter` prop; without this guard the load would re-fire in a
 * loop and hammer the finance API. `billingHydrated` flips true once finance
 * hydration has run, so the saved-treatment auto-seed waits for any open
 * server-invoice lines to be seeded first and dedupes against them.
 */
export const useInvoiceBillingHydration = (
  organisationId: string | undefined,
  appointmentId: string
) => {
  const hydrateInvoiceBilling = useAppointmentWorkspaceStore((s) => s.hydrateInvoiceBilling);
  const [billingHydrated, setBillingHydrated] = useState(false);
  const billingLoadedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!organisationId || !appointmentId) return undefined;
    const loadKey = `${organisationId}:${appointmentId}`;
    if (billingLoadedRef.current === loadKey) return undefined;
    billingLoadedRef.current = loadKey;
    loadAppointmentBilling(organisationId, appointmentId)
      .then((billing) => {
        // Always apply to the store — it's mount-independent (Zustand), so a
        // transient unmount/remount between request and response must not drop the
        // result. Skipping on unmount previously left pastInvoices empty with the
        // load guard still set, so the invoices never appeared.
        hydrateInvoiceBilling(appointmentId, {
          pastInvoices: billing.pastInvoices,
          depositCents: billing.depositCents,
          currency: billing.currency,
        });
        setBillingHydrated(true);
      })
      .catch((error) => {
        // Allow a later retry if the load failed.
        if (billingLoadedRef.current === loadKey) billingLoadedRef.current = null;
        console.error('Failed to load appointment billing:', error);
      });
    return undefined;
  }, [appointmentId, hydrateInvoiceBilling, organisationId]);

  // Refetch the appointment's finance state (invoices, deposit, currency) from
  // the backend so the bill, payment status, and deposit summary reflect server
  // truth after a payment action rather than only the optimistic store write.
  const reloadBilling = useCallback(async () => {
    if (!organisationId || !appointmentId) return undefined;
    try {
      const billing = await loadAppointmentBilling(organisationId, appointmentId);
      hydrateInvoiceBilling(appointmentId, {
        pastInvoices: billing.pastInvoices,
        depositCents: billing.depositCents,
        currency: billing.currency,
      });
      return billing;
    } catch (error) {
      console.error('Failed to refresh appointment billing:', error);
      return undefined;
    }
  }, [appointmentId, hydrateInvoiceBilling, organisationId]);

  return { billingHydrated, reloadBilling };
};

/**
 * Auto-add saved treatment items (services/packages + in-house prescriptions) to
 * the editable Total Bill once finance hydration has run, so a clinician doesn't
 * have to re-add each saved item by search. Each name seeds at most once per mount
 * (so a manually removed line doesn't snap back), lines already on the bill are
 * skipped, and billed/paid items are excluded upstream by the !billed filter.
 * Any line name appearing on a SETTLED (paid / zero-outstanding) past invoice is
 * treated as final and never re-added, regardless of the server-derived `billed`
 * flag — the server-authoritative anti-double-bill guard (finance double-bill).
 */
export const useAutoSeedBillLines = ({
  appointmentId,
  encounter,
  canBuildBill,
  billingHydrated,
  bookedLineKey,
}: {
  appointmentId: string;
  encounter: AppointmentEncounter;
  canBuildBill: boolean;
  billingHydrated: boolean;
  bookedLineKey?: string;
}) => {
  const addInvoiceLineItem = useAppointmentWorkspaceStore((s) => s.addInvoiceLineItem);
  const catalogServices = useRevampCatalogStore((s) => s.services);
  const catalogPackages = useRevampCatalogStore((s) => s.packages);

  const settledLineNames = useMemo(() => {
    const names = new Set<string>();
    for (const invoice of encounter.pastInvoices) {
      if (!isInvoiceSettled(invoice)) continue;
      for (const item of invoice.items) names.add(normalizeLineName(item.name));
    }
    return names;
  }, [encounter.pastInvoices]);

  // Saved (persisted) Service/Package + in-house prescription lines for this visit
  // that are not yet billed, mapped into Total Bill lines. Catalog/inventory
  // candidates stay opt-in (search only). Lines already settled on a paid invoice
  // are excluded so they can't be re-billed.
  const autoSeedCandidates = useMemo<Omit<InvoiceLineItem, 'id'>[]>(() => {
    const candidates: Omit<InvoiceLineItem, 'id'>[] = [];
    for (const item of encounter.services) {
      if (
        !item.billed &&
        item.amountCents > 0 &&
        !settledLineNames.has(normalizeLineName(item.name))
      ) {
        candidates.push(serviceLineItemToInvoiceLine(item, catalogServices, catalogPackages));
      }
    }
    for (const item of encounter.prescription) {
      if (
        !item.billed &&
        item.fulfillment === 'IN_HOUSE' &&
        (item.priceCents ?? 0) > 0 &&
        !settledLineNames.has(normalizeLineName(item.medicineName))
      ) {
        candidates.push(prescriptionToInvoiceLine(item));
      }
    }
    return candidates;
  }, [
    catalogPackages,
    catalogServices,
    encounter.services,
    encounter.prescription,
    settledLineNames,
  ]);

  const seededBillNamesRef = useRef<Set<string> | null>(null);
  const getSeededBillNames = useCallback(() => {
    seededBillNamesRef.current ??= new Set();
    return seededBillNamesRef.current;
  }, []);

  useEffect(() => {
    if (!canBuildBill || !billingHydrated) return;
    // Names already represented on the bill: the current builder plus any OPEN invoice
    // (hydrateInvoiceBilling seeds those into the builder). The booked service in
    // particular is persisted onto that invoice AND exists as a treatment row here; its
    // invoice line name and treatment name can differ, so anchoring the booked service by
    // its dedicated key stops the second copy from seeding. `taken` is mutated in-loop so
    // two candidates that normalize to the same name can't both seed.
    const taken = collectSeededBillNames(
      encounter.invoiceLineItems.map((item) => item.name),
      encounter.pastInvoices
    );
    // A booked line already on any open invoice blocks re-seeding it under a mismatched name.
    const bookedAlreadyOnBill =
      bookedLineKey !== undefined && taken.size > 0 && encounter.pastInvoices.length > 0;
    const seededBillNames = getSeededBillNames();
    autoSeedCandidates.forEach((line) => {
      const key = normalizeLineName(line.name);
      if (!key || seededBillNames.has(key)) return;
      seededBillNames.add(key);
      const isBookedDuplicate = key === bookedLineKey && bookedAlreadyOnBill;
      if (taken.has(key) || isBookedDuplicate) return;
      taken.add(key);
      addInvoiceLineItem(appointmentId, line);
    });
  }, [
    addInvoiceLineItem,
    appointmentId,
    autoSeedCandidates,
    billingHydrated,
    bookedLineKey,
    canBuildBill,
    encounter.invoiceLineItems,
    encounter.pastInvoices,
    getSeededBillNames,
  ]);

  return { getSeededBillNames };
};

/**
 * Recovers package breakdowns for bill lines and invoice history rows that lost
 * them on a backend prefill, hydrating package detail from the catalog when the
 * summary record has no breakdown yet. Returns the past invoices with breakdowns
 * patched in for display.
 */
export const usePackageBreakdownHydration = ({
  appointmentId,
  organisationId,
  encounter,
}: {
  appointmentId: string;
  organisationId?: string;
  encounter: AppointmentEncounter;
}) => {
  const catalogPackages = useRevampCatalogStore((s) => s.packages);
  const hydratePackageDetail = useRevampCatalogStore((s) => s.hydratePackageDetail);
  const updateInvoiceLineItem = useAppointmentWorkspaceStore((s) => s.updateInvoiceLineItem);

  useEffect(() => {
    if (!organisationId) return;
    const invoiceHistoryItems = encounter.pastInvoices.flatMap((invoice) => invoice.items);
    const packageIdsNeedingDetail: string[] = [];
    for (const line of [...encounter.invoiceLineItems, ...invoiceHistoryItems]) {
      if (line.breakdown?.length) continue;
      const pkg = findCatalogPackageForLine(line, catalogPackages, organisationId);
      if (pkg?.breakdown.length === 0) {
        packageIdsNeedingDetail.push(pkg.id);
      }
    }
    if (packageIdsNeedingDetail.length === 0) return;
    Promise.all([...new Set(packageIdsNeedingDetail)].map((id) => hydratePackageDetail(id))).catch(
      (error) => {
        console.error('Failed to hydrate invoice package breakdown:', error);
      }
    );
  }, [
    catalogPackages,
    encounter.invoiceLineItems,
    encounter.pastInvoices,
    hydratePackageDetail,
    organisationId,
  ]);

  useEffect(() => {
    if (!organisationId || encounter.invoiceLineItems.length === 0) return;
    encounter.invoiceLineItems.forEach((line) => {
      if (line.breakdown && line.breakdown.length > 0) return;
      const pkg = findCatalogPackageForLine(line, catalogPackages, organisationId);
      if (!pkg || pkg.breakdown.length === 0) return;
      updateInvoiceLineItem(appointmentId, line.id, packageInvoicePatch(pkg));
    });
  }, [
    appointmentId,
    catalogPackages,
    encounter.invoiceLineItems,
    organisationId,
    updateInvoiceLineItem,
  ]);

  const displayInvoices = useMemo(
    () =>
      encounter.pastInvoices.map((invoice) => ({
        ...invoice,
        items: invoice.items.map((line) => {
          if (line.breakdown && line.breakdown.length > 0) return line;
          if (!organisationId) return line;
          const pkg = findCatalogPackageForLine(line, catalogPackages, organisationId);
          if (!pkg || pkg.breakdown.length === 0) return line;
          return { ...line, ...packageInvoicePatch(pkg) };
        }),
      })),
    [catalogPackages, encounter.pastInvoices, organisationId]
  );

  return { displayInvoices };
};

/**
 * Online payment progress: after a Stripe checkout opens, poll finance until the
 * invoice settles (or the poll times out into a "delayed" state). On settlement,
 * clears the editable draft bill and marks the paid treatment/prescription rows
 * billed — the manual (cash/deposit) paths do this via recordInvoicePayment, but
 * the online poll only reloads pastInvoices, so without this the paid line items
 * would linger in the Total Bill after the client pays. recordInvoicePayment
 * no-ops once invoiceLineItems is empty, so the repeated poll → confirm
 * transition stays idempotent.
 */
export const usePaymentProgress = ({
  appointmentId,
  encounterLeadName,
  reloadBilling,
  setConfirmation,
  setConfirmationLink,
}: {
  appointmentId: string;
  encounterLeadName?: string;
  reloadBilling: () => Promise<{ pastInvoices: PastInvoice[] } | undefined>;
  setConfirmation: (message: string | null) => void;
  setConfirmationLink: (link: string | null) => void;
}) => {
  const recordInvoicePayment = useAppointmentWorkspaceStore((s) => s.recordInvoicePayment);
  const [paymentProgress, setPaymentProgress] = useState<PaymentProgressState | null>(null);

  const refreshPaymentProgress = useCallback(
    async (invoiceId?: string) => {
      const targetInvoiceId = invoiceId ?? paymentProgress?.invoiceId;
      if (!targetInvoiceId) return;
      const billing = await reloadBilling();
      if (!billing) return;
      if (isInvoiceSettled(findInvoiceById(billing.pastInvoices, targetInvoiceId))) {
        recordInvoicePayment(appointmentId, {
          method: 'ONLINE',
          byName: encounterLeadName ?? 'Front desk',
        });
        setPaymentProgress((current) =>
          current?.invoiceId === targetInvoiceId ? { ...current, status: 'confirmed' } : current
        );
        setConfirmationLink(null);
        setConfirmation('Online payment confirmed');
      }
    },
    [
      appointmentId,
      encounterLeadName,
      paymentProgress?.invoiceId,
      recordInvoicePayment,
      reloadBilling,
      setConfirmation,
      setConfirmationLink,
    ]
  );

  const startPaymentProgress = useCallback(
    (invoiceId: string, checkoutUrl?: string) => {
      setPaymentProgress({
        invoiceId,
        checkoutUrl,
        startedAt: Date.now(),
        status: 'checking',
      });
      void refreshPaymentProgress(invoiceId);
    },
    [refreshPaymentProgress]
  );

  useEffect(() => {
    if (paymentProgress?.status !== 'checking') return undefined;

    const poll = () => {
      if (Date.now() - paymentProgress.startedAt > PAYMENT_POLL_TIMEOUT_MS) {
        setPaymentProgress((current) => {
          if (current?.invoiceId !== paymentProgress.invoiceId) return current;
          return { ...current, status: 'delayed' };
        });
        return;
      }
      void refreshPaymentProgress(paymentProgress.invoiceId);
    };

    const intervalId = globalThis.window.setInterval(poll, PAYMENT_POLL_INTERVAL_MS);
    const handleFocus = () => poll();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') poll();
    };

    globalThis.window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      globalThis.window.clearInterval(intervalId);
      globalThis.window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [paymentProgress, refreshPaymentProgress]);

  const handlePaymentCheckAgain = useCallback(() => {
    setPaymentProgress((current) =>
      current ? { ...current, startedAt: Date.now(), status: 'checking' } : current
    );
    void refreshPaymentProgress();
  }, [refreshPaymentProgress]);

  const handleContinueAfterPaymentDelay = useCallback(() => {
    setPaymentProgress(null);
    void reloadBilling();
  }, [reloadBilling]);

  const handleAbortPaymentProgress = useCallback(() => {
    setPaymentProgress(null);
  }, []);

  return {
    paymentProgress,
    startPaymentProgress,
    handlePaymentCheckAgain,
    handleContinueAfterPaymentDelay,
    handleAbortPaymentProgress,
  };
};
