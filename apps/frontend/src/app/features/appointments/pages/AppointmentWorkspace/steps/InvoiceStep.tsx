import React, { useCallback, useMemo, useState } from 'react';
import { IoArrowForwardOutline } from 'react-icons/io5';
import { Primary } from '@/app/ui/primitives/Buttons';
import TotalBillContainer from '@/app/features/appointments/pages/AppointmentWorkspace/components/TotalBillContainer';
import {
  derivePaymentLinkStatus,
  findPaymentLinkInvoice,
} from '@/app/features/appointments/lib/paymentLinkStatus';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import type {
  AppointmentEncounter,
  InvoiceLineItem,
  PastInvoice,
  PaymentMethod,
} from '@/app/features/appointments/types/workspace';
import { formatDateTimeLocal } from '@/app/lib/date';
import {
  addLineItemsToAppointments,
  createFinanceInvoice,
  finalizeFinanceInvoice,
  getFinanceInvoiceById,
  getPaymentLink,
  recordManualInvoicePayment,
  sendInvoiceToClient,
  findOpenAppointmentInvoice,
} from '@/app/features/billing/services/invoiceService';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import { useOrganisationDiscountCap } from '@/app/features/finance/hooks/useOrganisationDiscountCap';
import { useInvoiceStore } from '@/app/stores/invoiceStore';
import {
  deletePrescriptionArtifact,
  savePrescriptionArtifact,
} from '@/app/features/appointments/services/workspaceClinicalService';
import { useNotify } from '@/app/hooks/useNotify';
import { buildBillableItems, getInvoiceErrorMessage, normalizeLineName } from './invoiceStepUtils';
import {
  computeIncompleteMedicationNames,
  enrichInvoiceLineItems,
  useAutoSeedBillLines,
  useInvoiceBillingHydration,
  useInvoiceCatalogAndInventory,
  usePackageBreakdownHydration,
  usePaymentProgress,
} from './invoiceStepHooks';
import '@/app/ui/tables/GenericTable/Generictable.css';
import {
  DEFAULT_CURRENCY,
  PAYMENT_LABELS,
  formatCents,
} from '@/app/features/appointments/pages/AppointmentWorkspace/steps/invoiceFormat';
import {
  DepositModal,
  InvoicesSection,
  PaymentActions,
  PaymentProgressOverlay,
} from '@/app/features/appointments/pages/AppointmentWorkspace/steps/invoicePresentation';

type InvoiceStepProps = {
  appointmentId: string;
  organisationId?: string;
  encounterId?: string;
  authorId?: string;
  patientId?: string;
  parentId?: string;
  encounter: AppointmentEncounter;
  hideBillBuilder?: boolean;
  /** Name of the appointment's booked service/consultation — its bill line can't be removed. */
  bookedItemName?: string;
  onOpenSummary: () => void;
};

type PricedCatalogEntry = { organisationId: string; currency?: string };

/**
 * Currency is encounter-scoped (hydrated from finance, defaults to USD). Precedence:
 * the finance-hydrated encounter currency (server truth), else the organisation's
 * catalog currency (its configured / country-derived pricing currency), and only then
 * a last-resort default — so a fresh, not-yet-invoiced appointment shows the org's
 * currency instead of a hardcoded USD. The catalog lookup is scoped to this
 * appointment's organisation: in a multi-org session the catalog store can hold another
 * org's services/packages, so an unfiltered lookup could surface the wrong currency.
 */
const resolveInvoiceCurrency = (
  encounterCurrency: string | undefined,
  organisationId: string | undefined,
  services: PricedCatalogEntry[],
  packages: PricedCatalogEntry[]
): string => {
  if (encounterCurrency) return encounterCurrency;
  if (!organisationId) return DEFAULT_CURRENCY;
  const isOrgPriced = (entry: PricedCatalogEntry) =>
    entry.organisationId === organisationId && Boolean(entry.currency);
  const priced = services.find(isOrgPriced) ?? packages.find(isOrgPriced);
  return priced?.currency?.toUpperCase() ?? DEFAULT_CURRENCY;
};

type PersistInvoiceFn = (options?: { finalize?: boolean }) => Promise<{ id?: string } | undefined>;

type RecordInvoicePaymentFn = (
  appointmentId: string,
  payload: {
    method: PaymentMethod;
    byName: string;
  }
) => void;

type RecordDepositCollectionFn = (
  appointmentId: string,
  payload: {
    amountCents: number;
    method: PaymentMethod;
    byName: string;
  }
) => void;

type HandleCollectContext = {
  appointmentId: string;
  encounter: AppointmentEncounter;
  currency: string;
  financeCurrency: string;
  hasItems: boolean;
  persistCurrentInvoice: PersistInvoiceFn;
  reloadBilling: () => Promise<unknown>;
  recordInvoicePayment: RecordInvoicePaymentFn;
  startPaymentProgress: (invoiceId: string, checkoutUrl: string) => void;
  setConfirmation: (message: string) => void;
  setConfirmationLink: (link: string | null) => void;
  setDepositPaymentLink: (link: string | null) => void;
  setErrorMessage: (message: string | null) => void;
  setIsDepositModalOpen: (open: boolean) => void;
  setIsProcessingPayment: (processing: boolean) => void;
};

type HandleDepositContext = HandleCollectContext & {
  organisationId?: string;
  parentId?: string;
  patientId?: string;
  recordDepositCollection: RecordDepositCollectionFn;
};

const runOnlineCollection = async ({
  persistCurrentInvoice,
  reloadBilling,
  startPaymentProgress,
  setConfirmation,
  setConfirmationLink,
}: Pick<
  HandleCollectContext,
  | 'persistCurrentInvoice'
  | 'reloadBilling'
  | 'startPaymentProgress'
  | 'setConfirmation'
  | 'setConfirmationLink'
>): Promise<void> => {
  setConfirmationLink(null);
  const invoice = await persistCurrentInvoice({ finalize: false });
  if (invoice?.id) {
    const url = await getPaymentLink(invoice.id);
    if (url) {
      startPaymentProgress(invoice.id, url);
      openCheckoutUrl(url);
      setConfirmation('Payment link generated:');
      setConfirmationLink(url);
    } else {
      setConfirmation('Payment link generated');
      await reloadBilling();
    }
    return;
  }

  setConfirmation('Invoice prepared for online payment');
  await reloadBilling();
};

const runManualCollection = async ({
  appointmentId,
  encounter,
  financeCurrency,
  method,
  dueCents,
  persistCurrentInvoice,
  reloadBilling,
  recordInvoicePayment,
}: Pick<
  HandleCollectContext,
  | 'appointmentId'
  | 'encounter'
  | 'financeCurrency'
  | 'persistCurrentInvoice'
  | 'reloadBilling'
  | 'recordInvoicePayment'
> & {
  method: PaymentMethod;
  /** What the Collect button showed - the total less any deposit being applied. */
  dueCents: number;
}): Promise<void> => {
  const invoice = await persistCurrentInvoice({ finalize: true });
  if (invoice?.id) {
    await recordManualInvoicePayment(invoice.id, {
      provider: 'MANUAL',
      settlementChannel: 'CASH',
      // The amount the button offered to collect, not the invoice total. When a
      // deposit is being applied the two differ, and recording the total meant
      // staff collected one figure while the payment record claimed another.
      amount: centsToMajor(dueCents),
      currency: financeCurrency,
      receivedAt: new Date().toISOString(),
    });
  }
  recordInvoicePayment(appointmentId, {
    method,
    byName: encounter.leadName ?? 'Front desk',
  });
  await reloadBilling();
};

const handleDepositOnlineCollection = async ({
  appointmentId,
  amountCents,
  encounter,
  persistCurrentInvoice,
  startPaymentProgress,
  reloadBilling,
  setConfirmation,
  setDepositPaymentLink,
  recordDepositCollection,
}: Pick<
  HandleDepositContext,
  | 'appointmentId'
  | 'encounter'
  | 'persistCurrentInvoice'
  | 'startPaymentProgress'
  | 'reloadBilling'
  | 'setConfirmation'
  | 'setDepositPaymentLink'
  | 'recordDepositCollection'
> & { amountCents: number }): Promise<void> => {
  const invoiceToCollectAgainst = await persistCurrentInvoice({ finalize: false });
  if (!invoiceToCollectAgainst?.id) return;

  // Pass the requested deposit through. Without it the link is for the whole
  // outstanding balance, so a $25 deposit on a $500 invoice produced a $500
  // checkout that the UI labelled a deposit link.
  const checkoutUrl = await getPaymentLink(invoiceToCollectAgainst.id, centsToMajor(amountCents));
  setDepositPaymentLink(checkoutUrl ?? null);
  if (checkoutUrl) {
    startPaymentProgress(invoiceToCollectAgainst.id, checkoutUrl);
    openCheckoutUrl(checkoutUrl);
  }
  // Only record the deposit once the link exists. Recording it up front showed
  // a deposit balance for money the customer had not been asked for yet.
  if (checkoutUrl) {
    recordDepositCollection(appointmentId, {
      amountCents,
      method: 'ONLINE',
      byName: encounter.leadName ?? 'Front desk',
    });
  }
  setConfirmation(
    checkoutUrl
      ? `Deposit payment link generated: ${checkoutUrl}`
      : 'Deposit payment link generated'
  );
  if (!checkoutUrl) await reloadBilling();
};

// Open a Stripe checkout URL in a new tab. `noopener` prevents the opened page
// from accessing this window; guarded for SSR / non-browser contexts.
const openCheckoutUrl = (url: string): void => {
  if (globalThis.window === undefined) return;
  globalThis.window.open(url, '_blank', 'noopener,noreferrer');
};

const openDocumentUrl = (url: string): void => {
  if (globalThis.window === undefined) return;
  globalThis.window.open(url, '_blank', 'noopener,noreferrer');
};

const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char
  );

// Render an invoice as a standalone printable document and open the browser print
// dialog (print-to-PDF). There is no backend invoice-PDF endpoint, so this is the
// portable way to produce a downloadable PDF from the invoice the user sees.
const printInvoice = (invoice: PastInvoice, currency: string): boolean => {
  if (globalThis.window === undefined) return false;
  const printWindow = globalThis.window.open('', '_blank', 'width=800,height=900');
  // Popup blocked (or otherwise unavailable) — report failure so the caller can
  // surface it instead of the download silently doing nothing.
  if (!printWindow) return false;
  const rows = invoice.items
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.name)}</td><td style="text-align:right">${escapeHtml(
          formatCents(item.amountCents, currency)
        )}</td></tr>`
    )
    .join('');
  // document.write is deprecated; populate the popup's head/body directly instead.
  printWindow.document.head.innerHTML =
    `<title>Invoice ${escapeHtml(invoice.id)}</title>` +
    `<style>body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#1a1a1a}` +
    `h1{font-size:18px}table{width:100%;border-collapse:collapse;margin-top:16px}` +
    `td,th{padding:8px 0;border-bottom:1px solid #e5e5e5;font-size:13px}` +
    `tfoot td{font-weight:bold;border-bottom:none}</style>`;
  printWindow.document.body.innerHTML =
    `<h1>Invoice ${escapeHtml(invoice.id)}</h1>` +
    // The printed date has to read the same as the invoice row it was printed
    // from. This was `new Date(...).toLocaleString()` - the device locale and
    // zone, numeric and with seconds ("9/3/2026, 10:05:00 PM", or "03/09/2026"
    // day-first on an en-GB machine) - against "Sep 3, 2026, 10:05 PM" on screen.
    `<div>Date: ${escapeHtml(formatDateTimeLocal(invoice.createdAt))}</div>` +
    `<table><thead><tr><th style="text-align:left">Item</th><th style="text-align:right">Amount</th></tr></thead>` +
    `<tbody>${rows}</tbody>` +
    `<tfoot><tr><td>Total</td><td style="text-align:right">${escapeHtml(
      formatCents(invoice.totalCents, currency)
    )}</td></tr></tfoot></table>`;
  printWindow.focus();
  printWindow.print();
  return true;
};

/** The workspace tracks money in integer cents; the finance API stores major units
 *  (dollars/decimals), so convert on the way out. */
const centsToMajor = (cents: number): number => Math.round(cents) / 100;

const toFinanceLineItems = (items: InvoiceLineItem[]) =>
  items.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.name,
    quantity: item.qty,
    unitPrice: centsToMajor(item.unitPriceCents),
    total: centsToMajor(item.amountCents),
  }));

const computeInvoiceTotalCents = (encounter: AppointmentEncounter): number => {
  const subtotalCents = encounter.invoiceLineItems.reduce((sum, item) => sum + item.grossCents, 0);
  const lineDiscountCents = encounter.invoiceLineItems.reduce(
    (sum, item) => sum + item.discountCents,
    0
  );
  const overallDiscountCents = Math.round((subtotalCents * encounter.overallDiscountPercent) / 100);
  const discountedCents = Math.max(0, subtotalCents - lineDiscountCents - overallDiscountCents);
  return discountedCents + Math.round((discountedCents * encounter.taxPercent) / 100);
};

const useInvoiceStepContent = ({
  appointmentId,
  organisationId,
  encounterId,
  authorId,
  patientId,
  parentId,
  encounter,
  hideBillBuilder = false,
  bookedItemName,
  onOpenSummary,
}: InvoiceStepProps) => {
  const setWithdrawDeposit = useAppointmentWorkspaceStore((s) => s.setWithdrawDeposit);
  const setOverallDiscountPercent = useAppointmentWorkspaceStore(
    (s) => s.setOverallDiscountPercent
  );
  const addInvoiceLineItem = useAppointmentWorkspaceStore((s) => s.addInvoiceLineItem);
  const addPrescription = useAppointmentWorkspaceStore((s) => s.addPrescription);
  const updateInvoiceLineItem = useAppointmentWorkspaceStore((s) => s.updateInvoiceLineItem);
  const removeInvoiceLineItem = useAppointmentWorkspaceStore((s) => s.removeInvoiceLineItem);
  const removePrescription = useAppointmentWorkspaceStore((s) => s.removePrescription);
  const recordInvoicePayment = useAppointmentWorkspaceStore((s) => s.recordInvoicePayment);
  const recordDepositCollection = useAppointmentWorkspaceStore((s) => s.recordDepositCollection);
  const setStepStatus = useAppointmentWorkspaceStore((s) => s.setStepStatus);
  const catalogServices = useRevampCatalogStore((s) => s.services);
  const catalogPackages = useRevampCatalogStore((s) => s.packages);
  // Subscribed (not read via getState) so the status line under Collect updates as
  // soon as generating a link upserts the invoice back into the store.
  const invoicesById = useInvoiceStore((s) => s.invoicesById);
  const paymentLinkStatus = useMemo(
    () =>
      derivePaymentLinkStatus(findPaymentLinkInvoice(Object.values(invoicesById), appointmentId)),
    [invoicesById, appointmentId]
  );
  const [confirmation, setConfirmation] = useState<string | null>(null);
  // A generated payment link shown under the confirmation; rendered as a wrapping
  // anchor so a long Stripe URL never overflows the container width.
  const [confirmationLink, setConfirmationLink] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [depositPaymentLink, setDepositPaymentLink] = useState<string | null>(null);
  const { notify } = useNotify();
  const readOnly = encounter.viewOnly;
  const isInpatient = encounter.mode === 'INPATIENT';
  const hasItems = encounter.invoiceLineItems.length > 0;
  const isReadyForBilling = encounter.readyForBilling.value;
  const canBuildBill = !readOnly && !hideBillBuilder;
  const paymentDisabledReason = isReadyForBilling
    ? undefined
    : 'Mark this visit ready for billing before sending to client, collecting cash, or paying online.';
  // The finance API works in lower-case ISO codes; display uses the upper-case code.
  const currency = resolveInvoiceCurrency(
    encounter.currency,
    organisationId,
    catalogServices,
    catalogPackages
  );
  const financeCurrency = currency.toLowerCase();

  const incompleteMedicationNames = useMemo(
    () => computeIncompleteMedicationNames(encounter),
    [encounter]
  );
  const hasIncompleteMedications = incompleteMedicationNames.size > 0;
  const { inventoryItems } = useInvoiceCatalogAndInventory(organisationId);
  // The organisation's overall-discount cap. Null while loading, on failure, and
  // when none is configured — all three mean "don't constrain the input", which is
  // exactly today's behaviour. The finance API rejects an over-cap discount with a
  // 409 regardless, and that message surfaces through `errorMessage` below.
  const { maxOverallDiscountPercent } = useOrganisationDiscountCap(organisationId);
  const billableItems = useMemo(
    () =>
      buildBillableItems(
        encounter,
        catalogServices,
        catalogPackages,
        inventoryItems,
        organisationId
      ),
    [catalogPackages, catalogServices, encounter, inventoryItems, organisationId]
  );

  // Bill lines enriched with: (1) their max-discount ceiling — a line that lost it on a backend
  // prefill recovers the percent (and cents) from the catalog by name (saved values win); and
  // (2) a `removable` flag — the appointment's booked service/consultation can't be removed.
  const bookedLineKey = bookedItemName ? normalizeLineName(bookedItemName) : undefined;
  const enrichedInvoiceLineItems = useMemo(
    () =>
      enrichInvoiceLineItems(
        encounter,
        catalogServices,
        catalogPackages,
        organisationId,
        bookedLineKey
      ),
    [bookedLineKey, catalogPackages, catalogServices, encounter, organisationId]
  );

  const { billingHydrated, reloadBilling } = useInvoiceBillingHydration(
    organisationId,
    appointmentId
  );

  const { getSeededBillNames } = useAutoSeedBillLines({
    appointmentId,
    encounter,
    canBuildBill,
    billingHydrated,
    bookedLineKey,
  });

  const { displayInvoices } = usePackageBreakdownHydration({
    appointmentId,
    organisationId,
    encounter,
  });

  const {
    paymentProgress,
    startPaymentProgress,
    handlePaymentCheckAgain,
    handleContinueAfterPaymentDelay,
    handleAbortPaymentProgress,
  } = usePaymentProgress({
    appointmentId,
    encounterLeadName: encounter.leadName,
    reloadBilling,
    setConfirmation,
    setConfirmationLink,
  });

  // The id of an open (still-outstanding) invoice already loaded from the finance
  // service into the workspace encounter. The deposit-id fallback in hydration uses
  // appointmentId when an invoice has no id, so reject that sentinel here.
  const findServerOpenInvoiceId = (): string | undefined =>
    encounter.pastInvoices.find(
      (invoice) => invoice.id && invoice.id !== appointmentId && invoice.outstandingCents > 0
    )?.id;

  // Persist the current bill lines onto the single open appointment invoice. By default this does
  // NOT finalize — the bill stays editable until the visit is actually closing, so later treatment
  // additions can still be appended (finance gap doc Gap 1). Pass `{ finalize: true }` only at the
  // explicit end-of-visit settlement.
  const persistCurrentInvoice = async ({ finalize = false }: { finalize?: boolean } = {}) => {
    if (!organisationId) return undefined;
    // Lines seeded out of an already-persisted invoice are ALREADY charged, and
    // the add-items endpoint only appends. Re-sending one charges it twice, and
    // editing one changed its content key so the duplicate filter stopped
    // recognising it - so they are excluded here rather than relying on that
    // filter to catch them.
    const lineItems = toFinanceLineItems(
      encounter.invoiceLineItems.filter((item) => !item.seededFromInvoiceId)
    );
    // Prefer an existing OPEN invoice for this appointment and append new lines to
    // it (web /lines). When none exists, create one via the web POST /invoices —
    // never the mobile /seed route, which requires a mobile session on web
    // and 401s (logging the user out).
    const storeInvoiceId = findOpenAppointmentInvoice(organisationId, appointmentId)?.id;
    // Fall back to the server-loaded billing state: loadAppointmentBilling hydrates
    // open invoices into the workspace encounter but not into useInvoiceStore (the
    // only place findOpenAppointmentInvoice reads). Without this fallback an existing
    // open invoice is missed and a duplicate is created with the same bill lines.
    const serverInvoiceId = storeInvoiceId ? undefined : findServerOpenInvoiceId();
    // addLineItemsToAppointments re-resolves the invoice through useInvoiceStore and seeds a
    // new one via the mobile-auth-only /seed route when the store has no match. Hydrating the
    // store over the web invoice route first keeps that reuse on a PMS-authorised endpoint.
    if (serverInvoiceId) await getFinanceInvoiceById(serverInvoiceId);
    const openInvoiceId = storeInvoiceId ?? serverInvoiceId;
    let invoice: { id?: string } | undefined = openInvoiceId ? { id: openInvoiceId } : undefined;
    if (invoice?.id) {
      await addLineItemsToAppointments(lineItems, appointmentId, currency);
    } else {
      if (lineItems.length === 0) return undefined;
      invoice = await createFinanceInvoice({
        appointmentId,
        parentId,
        patientId,
        organisationId,
        paymentCollectionMethod: 'PAYMENT_LINK',
        items: lineItems,
        // Send the overall discount so it reaches the ledger. Without it the invoice
        // totals the full (line-discounted) amount while runManualCollection collects
        // computeInvoiceTotalCents (which DOES subtract the overall discount), leaving
        // the difference as a receivable that can never be settled. undefined at 0,
        // which JSON drops from the request body, so an undiscounted invoice keeps a
        // null discount type/value exactly as before.
        invoiceDiscount:
          encounter.overallDiscountPercent > 0
            ? { type: 'PERCENTAGE' as const, value: encounter.overallDiscountPercent }
            : undefined,
      });
    }
    if (invoice?.id && finalize) {
      await finalizeFinanceInvoice(invoice.id);
    }
    return invoice;
  };

  // NOTE: the Total Bill is a local DRAFT. Lines (and their linked prescriptions) are persisted to
  // the finance invoice only on an explicit Save / payment (persistCurrentInvoice), NOT on add —
  // there is no backend endpoint to remove an invoice line, so pushing lines eagerly made a removed
  // line reappear on refresh. Keeping the bill local until save keeps add/remove fully reversible.

  const handleCollect = async (method: PaymentMethod) => {
    if (method === 'DEPOSIT') {
      setDepositPaymentLink(null);
      setIsDepositModalOpen(true);
      return;
    }
    if (!hasItems) return;
    /* v8 ignore start -- the Collect button is disabled whenever the visit is not ready for billing (paymentDisabled), so this guard is a defensive mirror of that UI gate and is unreachable from the rendered UI */
    if (!isReadyForBilling && (method === 'CASH' || method === 'ONLINE')) {
      notify('warning', {
        title: 'Mark ready for billing first',
        text: 'Set the visit to Ready for billing before collecting cash or sending the invoice online.',
      });
      return;
    }
    /* v8 ignore stop */
    setErrorMessage(null);
    setIsProcessingPayment(true);
    try {
      if (method === 'ONLINE') {
        await runOnlineCollection({
          persistCurrentInvoice,
          reloadBilling,
          startPaymentProgress,
          setConfirmation,
          setConfirmationLink,
        });
      } else {
        await runManualCollection({
          appointmentId,
          encounter,
          financeCurrency,
          method,
          dueCents,
          persistCurrentInvoice,
          reloadBilling,
          recordInvoicePayment,
        });
        // Only a manual collection is settled here and now. The ONLINE path has merely
        // opened Stripe checkout, so it keeps runOnlineCollection's link message —
        // payment progress reports settlement once Stripe confirms it.
        setConfirmation(`${PAYMENT_LABELS[method]} recorded`);
      }
    } catch (error) {
      setErrorMessage(getInvoiceErrorMessage(error, 'Unable to process payment.'));
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleDepositSubmit = async (input: {
    amount: number;
    method: PaymentMethod;
    reference: string;
    notes: string;
  }) => {
    const amountCents = Math.round(input.amount * 100);
    setErrorMessage(null);
    setIsProcessingPayment(true);
    try {
      const invoiceToCollectAgainst =
        organisationId && hasItems ? await persistCurrentInvoice({ finalize: false }) : undefined;
      if (invoiceToCollectAgainst?.id) {
        if (input.method === 'ONLINE') {
          await handleDepositOnlineCollection({
            appointmentId,
            amountCents,
            encounter,
            persistCurrentInvoice,
            startPaymentProgress,
            reloadBilling,
            setConfirmation,
            setDepositPaymentLink,
            recordDepositCollection,
          });
          return;
        }

        await recordManualInvoicePayment(invoiceToCollectAgainst.id, {
          provider: 'MANUAL',
          settlementChannel: 'DEPOSIT',
          amount: input.amount,
          currency: financeCurrency,
          reference: input.reference || undefined,
          receivedAt: new Date().toISOString(),
          notes: input.notes || undefined,
        });
        recordDepositCollection(appointmentId, {
          amountCents,
          method: input.method,
          byName: encounter.leadName ?? 'Front desk',
        });
        setConfirmation(`${PAYMENT_LABELS[input.method]} recorded on the appointment invoice`);
        setIsDepositModalOpen(false);
        await reloadBilling();
        return;
      }
      recordDepositCollection(appointmentId, {
        amountCents,
        method: input.method,
        byName: encounter.leadName ?? 'Front desk',
      });
      setConfirmation(`${PAYMENT_LABELS[input.method]} recorded on the appointment invoice`);
      setIsDepositModalOpen(false);
      await reloadBilling();
    } catch (error) {
      setErrorMessage(getInvoiceErrorMessage(error, 'Unable to collect deposit.'));
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleSendToClient = async () => {
    /* v8 ignore start -- the Send to Client button is disabled whenever the visit is not ready for billing (paymentDisabled), so this guard is a defensive mirror of that UI gate and is unreachable from the rendered UI */
    if (!hasItems || !isReadyForBilling) {
      notify('warning', {
        title: 'Mark ready for billing first',
        text: 'Set the visit to Ready for billing before sending the invoice to the client.',
      });
      return;
    }
    /* v8 ignore stop */
    setErrorMessage(null);
    setIsProcessingPayment(true);
    try {
      const invoice = await persistCurrentInvoice({ finalize: false });
      if (!invoice?.id) {
        throw new Error('Unable to prepare the invoice for sending.');
      }
      const result = await sendInvoiceToClient(invoice.id);
      const checkoutUrl = result.checkout?.url ?? result.checkout?.checkoutUrl;
      setConfirmationLink(result.emailSent ? null : (checkoutUrl ?? null));
      let confirmationMessage: string;
      if (result.emailSent) {
        confirmationMessage = 'Invoice sent to client.';
      } else if (checkoutUrl) {
        confirmationMessage =
          'Checkout created, but the client email was not sent. Share this link manually.';
      } else {
        confirmationMessage = 'Invoice prepared for client payment.';
      }
      setConfirmation(confirmationMessage);
      await reloadBilling();
    } catch (error) {
      setErrorMessage(getInvoiceErrorMessage(error, 'Unable to send invoice to client.'));
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleDownloadInvoice = (invoice: PastInvoice) => {
    // Prefer a backend-rendered PDF when finance exposes one; otherwise fall back to
    // a client-rendered print-to-PDF of the invoice the user sees.
    if (invoice.pdfUrl) {
      openDocumentUrl(invoice.pdfUrl);
      return;
    }
    const opened = printInvoice(invoice, currency);
    // The print window is opened synchronously inside a click handler, so a null
    // result means the browser blocked the popup — tell the user rather than
    // leaving the Download button looking dead.
    if (!opened) {
      notify('warning', {
        title: 'Allow pop-ups to download',
        text: 'Your browser blocked the invoice window. Enable pop-ups for this site, then try Download again.',
      });
    }
  };

  // Share = copy the invoice's shareable URL to the clipboard for pasting into a
  // message/email. Prefer the hosted invoice/checkout link when the finance record
  // carries one; otherwise fall back to a deep link to this appointment's invoice
  // step so the recipient still lands on the right invoice. A concise text summary
  // is the last resort when no URL can be built (e.g. no window/origin).
  const buildShareUrl = (invoice: PastInvoice): string | null => {
    if (invoice.pdfUrl) return invoice.pdfUrl;
    if (globalThis.window === undefined) return null;
    const origin = globalThis.window.location.origin;
    return `${origin}/appointments/${appointmentId}/workspace?step=INVOICE`;
  };

  const handleShareInvoice = async (invoice: PastInvoice) => {
    const shareUrl = buildShareUrl(invoice);
    const payload =
      shareUrl ??
      `Invoice ${invoice.id} — ${formatCents(invoice.totalCents, currency)} (${invoice.status})`;
    try {
      if (globalThis.navigator?.clipboard) {
        await globalThis.navigator.clipboard.writeText(payload);
        setConfirmationLink(shareUrl);
        setConfirmation(shareUrl ? 'Invoice link copied to clipboard.' : payload);
      } else {
        setConfirmationLink(shareUrl);
        setConfirmation(shareUrl ? 'Invoice link:' : payload);
      }
    } catch (error) {
      console.error('Failed to copy invoice link:', error);
      setConfirmationLink(shareUrl);
      setConfirmation(shareUrl ? 'Invoice link:' : payload);
    }
  };

  const handleFinishInvoice = () => {
    /* v8 ignore start -- the Summary button is disabled whenever there are incomplete medications, so this guard is a defensive mirror of that UI gate and is unreachable from the rendered UI */
    if (hasIncompleteMedications) {
      setErrorMessage(
        'Fill information in previous step for prescribed medications before finalizing.'
      );
      return;
    }
    /* v8 ignore stop */
    setStepStatus(appointmentId, 'INVOICE', 'COMPLETED');
    onOpenSummary();
  };

  const handleAddItem = async (item: Omit<InvoiceLineItem, 'id'>) => {
    // The store returns the id it assigned this line so a later save can link it
    // back to its prescription (see below).
    const addedLineId = addInvoiceLineItem(appointmentId, item);

    // Interlink: when a billed item is a dispensable drug and no prescription row
    // exists for it yet, create a linked one so it shows in the Treatment step.
    // The new row inherits whatever clinical detail the inventory item provides;
    // any missing dose/route/frequency/duration keeps it flagged incomplete and
    // blocks invoice finalize until a clinician fills it in.
    const candidate = billableItems.find(
      (entry) => entry.name.trim().toLowerCase() === item.name.trim().toLowerCase()
    );
    const prescription = candidate?.prescription;
    if (!prescription) return;
    const targetName = prescription.medicineName.trim().toLowerCase();
    const alreadyPrescribed = encounter.prescription.some(
      (rx) => rx.medicineName.trim().toLowerCase() === targetName
    );
    // Only org-scoped inventory candidates carry a prescription payload, so organisationId
    // is always set by the time one is found.
    if (alreadyPrescribed || !organisationId) return;
    // Treatment already ran its save pass by the time the bill is built, so a row
    // backfilled here has no later persist step to ride along with — save it now and
    // seed the store with the backend id so finalize and delete target the real artifact.
    try {
      const saved = await savePrescriptionArtifact(
        { organisationId, appointmentId, encounterId, authorId },
        prescription
      );
      const savedPrescriptionId = (saved as { id?: string } | undefined)?.id;
      addPrescription(appointmentId, prescription, savedPrescriptionId);
      // Link the bill line to the saved prescription so removing the line also
      // deletes the persisted draft — handleRemoveBillLine keys off
      // sourcePrescriptionId, so without this the draft orphans and re-seeds on
      // the next refresh.
      if (savedPrescriptionId && addedLineId) {
        updateInvoiceLineItem(appointmentId, addedLineId, {
          sourcePrescriptionId: savedPrescriptionId,
        });
      }
    } catch (error) {
      console.error('Failed to save prescription from invoice:', error);
      addPrescription(appointmentId, prescription);
      notify('error', {
        title: 'Couldn’t save the linked prescription',
        text: 'The change wasn’t saved. Please try again.',
      });
    }
  };

  // Remove a bill line. When the line was seeded from an in-house prescription, deleting it also
  // deletes the underlying (unbilled) prescription end-to-end so it does not re-seed on refresh.
  // The backend only deletes DRAFT prescriptions (409 once finalized/dispensed) — surface that.
  const handleRemoveBillLine = useCallback(
    async (id: string) => {
      const line = encounter.invoiceLineItems.find((item) => item.id === id);
      removeInvoiceLineItem(appointmentId, id);
      const prescriptionId = line?.sourcePrescriptionId;
      if (!prescriptionId || !organisationId) return;
      // Drop the source prescription locally and remember the dismissal so auto-seed doesn't
      // re-add it this session.
      if (line?.name) getSeededBillNames().add(line.name.trim().toLowerCase());
      removePrescription(appointmentId, prescriptionId);
      const isPersisted = !prescriptionId.startsWith('local-');
      if (!isPersisted) return;
      try {
        await deletePrescriptionArtifact(organisationId, prescriptionId);
      } catch (error) {
        console.error('Failed to delete prescription from invoice:', error);
        const status = (error as { response?: { status?: number } })?.response?.status;
        notify('error', {
          title: 'Couldn’t remove the prescription',
          text:
            status === 409
              ? 'This prescription is finalized or dispensed and can no longer be removed.'
              : 'The change wasn’t saved. Please try again.',
        });
      }
    },
    [
      appointmentId,
      encounter.invoiceLineItems,
      getSeededBillNames,
      notify,
      organisationId,
      removeInvoiceLineItem,
      removePrescription,
    ]
  );

  const invoiceTotalCents = computeInvoiceTotalCents(encounter);
  const dueCents = encounter.withdrawDeposit
    ? Math.max(0, invoiceTotalCents - encounter.depositCents)
    : invoiceTotalCents;

  return (
    <div className="flex flex-col gap-5">
      {/* The bill builder + payment controls only show while the encounter is
          editable. A completed appointment shows finalized invoices only. */}
      {canBuildBill && (
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            <TotalBillContainer
              items={enrichedInvoiceLineItems}
              billableItems={billableItems}
              incompleteItemNames={incompleteMedicationNames}
              currency={currency}
              depositCents={encounter.depositCents}
              withdrawDeposit={encounter.withdrawDeposit}
              overallDiscountPercent={encounter.overallDiscountPercent}
              maxOverallDiscountPercent={maxOverallDiscountPercent}
              taxPercent={encounter.taxPercent}
              onToggleWithdrawDeposit={(value) => setWithdrawDeposit(appointmentId, value)}
              onChangeOverallDiscount={(percent) =>
                setOverallDiscountPercent(appointmentId, percent)
              }
              onAddItem={(item) => void handleAddItem(item)}
              onUpdateItem={(id, patch) => updateInvoiceLineItem(appointmentId, id, patch)}
              onRemoveItem={(id) => void handleRemoveBillLine(id)}
            />
          </div>
          <aside className="flex w-full flex-col gap-3 lg:w-[340px] lg:shrink-0">
            <PaymentActions
              isInpatient={isInpatient}
              depositDisabled={isProcessingPayment}
              paymentDisabled={isProcessingPayment || !hasItems || !isReadyForBilling}
              paymentDisabledReason={paymentDisabledReason}
              dueCents={dueCents}
              currency={currency}
              onCollect={handleCollect}
              onSendToClient={handleSendToClient}
              paymentLinkStatus={paymentLinkStatus}
            />

            {errorMessage && (
              <p role="alert" className="rounded-2xl bg-danger-100 p-3 text-body-4 text-text-error">
                {errorMessage}
              </p>
            )}

            {confirmation && (
              <output className="flex flex-col gap-1 rounded-2xl bg-primary-100 p-3 text-body-4 text-blue-text">
                <span>{confirmation}</span>
                {confirmationLink && (
                  <a
                    href={confirmationLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full break-all underline"
                  >
                    {confirmationLink}
                  </a>
                )}
              </output>
            )}
          </aside>
        </div>
      )}

      <DepositModal
        open={isDepositModalOpen}
        saving={isProcessingPayment}
        generatedLink={depositPaymentLink}
        onClose={() => setIsDepositModalOpen(false)}
        onSubmit={handleDepositSubmit}
      />

      <PaymentProgressOverlay
        state={paymentProgress}
        onCheckAgain={handlePaymentCheckAgain}
        onAbort={handleAbortPaymentProgress}
        onContinue={handleContinueAfterPaymentDelay}
      />

      <InvoicesSection
        invoices={displayInvoices}
        readOnly={readOnly}
        currency={currency}
        onDownload={handleDownloadInvoice}
        onShare={handleShareInvoice}
      />

      {!readOnly && (
        <div className="flex flex-col items-end gap-2">
          {hasIncompleteMedications && (
            <p className="text-body-4 text-pill-warning-text">
              Fill prescription details in the Treatment step before finalizing.
            </p>
          )}
          <Primary
            text="Summary"
            icon={<IoArrowForwardOutline aria-hidden="true" />}
            iconPosition="right"
            onClick={handleFinishInvoice}
            isDisabled={hasIncompleteMedications}
          />
        </div>
      )}
    </div>
  );
};

const InvoiceStep = (props: InvoiceStepProps) => useInvoiceStepContent(props);

export default InvoiceStep;
