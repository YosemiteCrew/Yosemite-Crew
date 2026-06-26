import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LuArrowRight,
  LuBanknote,
  LuCheck,
  LuCreditCard,
  LuDownload,
  LuEye,
  LuEyeOff,
  LuShare,
  LuUpload,
} from 'react-icons/lu';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import CircleIconButton from '@/app/features/appointments/pages/AppointmentWorkspace/components/CircleIconButton';
import TotalBillContainer from '@/app/features/appointments/pages/AppointmentWorkspace/components/TotalBillContainer';
import SectionContainer from '@/app/ui/primitives/SectionContainer/SectionContainer';
import { YosemiteLoader } from '@/app/ui/overlays/Loader';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import type {
  AppointmentEncounter,
  BillableKind,
  InvoiceLineItem,
  InvoiceStatus,
  LineItem,
  PastInvoice,
  PaymentMethod,
  PrescriptionItem,
} from '@/app/features/appointments/types/workspace';
import { formatMoney } from '@/app/lib/money';
import { formatStampDate, formatStampTime } from '@/app/lib/appointmentWorkspace';
import {
  addLineItemsToAppointments,
  createFinanceInvoice,
  finalizeFinanceInvoice,
  getPaymentLink,
  loadAppointmentBilling,
  recordManualInvoicePayment,
  findOpenAppointmentInvoice,
} from '@/app/features/billing/services/invoiceService';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import {
  computePackageBreakdownItem,
  computePackageTotals,
} from '@/app/features/organization/services/catalogCalculations';
import type {
  PackageBreakdownItem,
  PackageRevamp,
  ServiceRevamp,
} from '@/app/features/organization/types/revamp';
import { useInventoryStore } from '@/app/stores/inventoryStore';
import { fetchInventoryItems } from '@/app/features/inventory/services/inventoryService';
import { mapApiItemToInventoryItem } from '@/app/features/inventory/pages/Inventory/utils';
import type { InventoryItem } from '@/app/features/inventory/pages/Inventory/types';
import { inventoryToPrescriptionItem } from '@/app/features/appointments/lib/inventoryPrescription';
import { useNotify } from '@/app/hooks/useNotify';

type InvoiceStepProps = {
  appointmentId: string;
  organisationId?: string;
  patientId?: string;
  parentId?: string;
  encounter: AppointmentEncounter;
  hideBillBuilder?: boolean;
  onOpenSummary: () => void;
};

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  PAID_FULL: 'Paid full',
  UNPAID: 'Unpaid',
  PARTIAL: 'Partial',
};

const STATUS_CLASSES: Record<InvoiceStatus, string> = {
  PAID_FULL: 'border-pill-success-border bg-pill-success-bg text-pill-success-text',
  UNPAID: 'border-pill-warning-border bg-pill-warning-bg text-pill-warning-text',
  PARTIAL: 'border-pill-info-border bg-pill-info-bg text-pill-info-text',
};

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  ONLINE: 'Paid Online',
  CASH: 'Paid via Cash',
  DEPOSIT: 'Paid from Deposit',
};

export type BillableCandidate = Omit<InvoiceLineItem, 'id'> & {
  kind: BillableKind;
  // Present when this candidate is a dispensable drug; used to backfill a linked
  // prescription row when the item is billed without one (the bill/prescription
  // interlink), so clinical details can't be skipped before finalizing.
  prescription?: Omit<PrescriptionItem, 'id'>;
};

const DEFAULT_CURRENCY = 'USD';
const PAYMENT_POLL_INTERVAL_MS = 3000;
const PAYMENT_POLL_TIMEOUT_MS = 120000;

type PaymentProgressState = {
  invoiceId: string;
  checkoutUrl?: string;
  startedAt: number;
  status: 'checking' | 'confirmed' | 'delayed';
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
}): Promise<void> => {
  const invoice = await persistCurrentInvoice({ finalize: true });
  if (invoice?.id) {
    await recordManualInvoicePayment(invoice.id, {
      provider: 'MANUAL',
      settlementChannel: 'CASH',
      amount: centsToMajor(computeInvoiceTotalCents(encounter)),
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

  const checkoutUrl = await getPaymentLink(invoiceToCollectAgainst.id);
  setDepositPaymentLink(checkoutUrl ?? null);
  if (checkoutUrl) {
    startPaymentProgress(invoiceToCollectAgainst.id, checkoutUrl);
    openCheckoutUrl(checkoutUrl);
  }
  recordDepositCollection(appointmentId, {
    amountCents,
    method: 'ONLINE',
    byName: encounter.leadName ?? 'Front desk',
  });
  setConfirmation(
    checkoutUrl
      ? `Payment link generated for the appointment invoice: ${checkoutUrl}`
      : 'Payment link generated for the appointment invoice'
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

const formatCents = (cents: number, currency: string = DEFAULT_CURRENCY): string =>
  formatMoney(cents / 100, currency);

const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char
  );

// Render an invoice as a standalone printable document and open the browser print
// dialog (print-to-PDF). There is no backend invoice-PDF endpoint, so this is the
// portable way to produce a downloadable PDF from the invoice the user sees.
const printInvoice = (invoice: PastInvoice, currency: string): void => {
  if (globalThis.window === undefined) return;
  const printWindow = globalThis.window.open(
    '',
    '_blank',
    'noopener,noreferrer,width=800,height=900'
  );
  if (!printWindow) return;
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
    `<div>Date: ${escapeHtml(new Date(invoice.createdAt).toLocaleString())}</div>` +
    `<table><thead><tr><th style="text-align:left">Item</th><th style="text-align:right">Amount</th></tr></thead>` +
    `<tbody>${rows}</tbody>` +
    `<tfoot><tr><td>Total</td><td style="text-align:right">${escapeHtml(
      formatCents(invoice.totalCents, currency)
    )}</td></tr></tfoot></table>`;
  printWindow.focus();
  printWindow.print();
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

const toInvoiceCandidate = (
  name: string,
  amountCents: number,
  kind: BillableKind
): BillableCandidate => ({
  name,
  unitPriceCents: amountCents,
  qty: 1,
  grossCents: amountCents,
  discountCents: 0,
  amountCents,
  kind,
});

const discountCentsFromPercent = (grossCents: number, percent: number): number =>
  Math.min(grossCents, Math.round((grossCents * percent) / 100));

// Lossless map of a saved Service/Package treatment row into a Total Bill line —
// preserves unit price AND quantity (unlike toInvoiceCandidate, which collapses to
// qty 1 / unitPrice=amountCents and would misprice any qty>1 line).
const serviceLineItemToInvoiceLine = (
  item: LineItem,
  catalogServices: ServiceRevamp[],
  catalogPackages: PackageRevamp[]
): Omit<InvoiceLineItem, 'id'> => {
  const grossCents = Math.max(0, item.unitPriceCents * item.qty);
  const catalogService = catalogServices.find((service) => service.id === item.refId);
  const catalogPackage = catalogPackages.find((pkg) => pkg.id === item.refId);
  const maxDiscountPercent =
    item.kind === 'PACKAGE'
      ? (catalogPackage?.additionalDiscount ?? 0)
      : (catalogService?.maxDiscount ?? 0);
  return {
    name: item.name,
    unitPriceCents: item.unitPriceCents,
    qty: item.qty,
    grossCents,
    discountCents: 0,
    amountCents: grossCents,
    maxDiscountPercent,
    maxDiscountCents: discountCentsFromPercent(grossCents, maxDiscountPercent),
    breakdown: item.breakdown,
  };
};

// Map an in-house prescription row into a Total Bill line (priced per line).
const prescriptionToInvoiceLine = (rx: PrescriptionItem): Omit<InvoiceLineItem, 'id'> => {
  const amountCents = Math.max(0, rx.priceCents ?? 0);
  return {
    name: rx.medicineName,
    unitPriceCents: amountCents,
    qty: 1,
    grossCents: amountCents,
    discountCents: 0,
    amountCents,
  };
};

const moneyToCents = (amount: number): number => Math.max(0, Math.round(amount * 100));

const breakdownToInvoiceBreakdown = (item: PackageBreakdownItem) => {
  const { net } = computePackageBreakdownItem(item);
  return {
    id: item.id,
    name: item.name,
    qty: item.quantity,
    instructions: item.type,
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

const serviceToInvoiceCandidate = (service: ServiceRevamp) =>
  toDiscountedCandidate(
    service.name,
    service.grossAmount,
    service.defaultDiscount ?? 0,
    service.maxDiscount ?? 0,
    'BILLING_ONLY'
  );

const packageToInvoiceCandidate = (pkg: PackageRevamp) => {
  const { totalCost } = computePackageTotals(pkg);
  return toDiscountedCandidate(
    pkg.name,
    totalCost,
    0,
    pkg.additionalDiscount ?? 0,
    'PACKAGE_COMPONENT',
    pkg.breakdown.map(breakdownToInvoiceBreakdown)
  );
};

const uniqueByName = (
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

const buildBillableItems = (
  encounter: AppointmentEncounter,
  catalogServices: ServiceRevamp[],
  catalogPackages: PackageRevamp[],
  inventoryItems: InventoryItem[],
  organisationId?: string
): BillableCandidate[] => {
  const existingNames = new Set(
    encounter.invoiceLineItems.map((item) => item.name.trim().toLowerCase())
  );
  const serviceItems = encounter.services
    .filter((item) => !item.billed && item.amountCents > 0)
    .filter((item) => !existingNames.has(item.name.trim().toLowerCase()))
    .map((item) => toInvoiceCandidate(item.name, item.amountCents, 'EXISTING_TREATMENT'));
  // In-house medications prescribed this visit. Their price comes from the linked
  // inventory item; when it is missing we still surface them at 0 so they can be
  // added and priced inline rather than silently dropped from the bill.
  const prescriptionItems = encounter.prescription
    .filter((item) => !item.billed && item.fulfillment === 'IN_HOUSE')
    .filter((item) => !existingNames.has(item.medicineName.trim().toLowerCase()))
    .map((item) =>
      toInvoiceCandidate(
        item.medicineName,
        Math.max(0, item.priceCents ?? 0),
        'IN_HOUSE_PRESCRIPTION'
      )
    );
  const catalogItems = organisationId
    ? [
        ...catalogServices
          .filter(
            (service) => service.organisationId === organisationId && service.status === 'ACTIVE'
          )
          .map(serviceToInvoiceCandidate),
        ...catalogPackages
          .filter((pkg) => pkg.organisationId === organisationId && pkg.status === 'ACTIVE')
          .map(packageToInvoiceCandidate),
      ]
    : [];
  // Inventory/stock items (drugs, consumables) so they can be charged directly.
  const inventoryCandidates = inventoryItems
    .filter((item) => item.basicInfo?.name && item.status !== 'HIDDEN')
    .map(inventoryToInvoiceCandidate);
  return uniqueByName(
    [...serviceItems, ...prescriptionItems, ...catalogItems, ...inventoryCandidates],
    existingNames
  );
};

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

const invoiceDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const formatInvoiceDate = (iso: string): string => invoiceDateFormatter.format(new Date(iso));

const getDepositMethodLabel = (option: PaymentMethod): string => {
  if (option === 'ONLINE') return 'Online link';
  return 'Cash';
};

const getDepositModalActionLabel = (saving: boolean, method: PaymentMethod): string => {
  if (saving) return 'Saving...';
  return method === 'ONLINE' ? 'Generate link' : 'Collect deposit';
};

const StatusPill = ({ status }: { status: InvoiceStatus }) => (
  <span
    className={`inline-flex rounded-2xl border px-3 py-1 text-caption-1 ${STATUS_CLASSES[status]}`}
  >
    {STATUS_LABELS[status]}
  </span>
);

const isInvoiceSettled = (invoice: PastInvoice | undefined): boolean =>
  Boolean(invoice && (invoice.status === 'PAID_FULL' || invoice.outstandingCents <= 0));

const findInvoiceById = (invoices: PastInvoice[], invoiceId: string): PastInvoice | undefined =>
  invoices.find((invoice) => invoice.id === invoiceId);

const getPaymentProgressDescription = (status: PaymentProgressState['status']): string => {
  if (status === 'checking') {
    return 'Stripe checkout is open. Keep this window open while we confirm the payment status.';
  }
  if (status === 'confirmed') {
    return 'Stripe has confirmed the payment and the invoice status is now up to date.';
  }
  return 'We have not received the final payment confirmation yet. You can keep checking or continue editing and this page will refresh again when you return.';
};

const PaymentProgressOverlay = ({
  state,
  onCheckAgain,
  onContinue,
}: {
  state: PaymentProgressState | null;
  onCheckAgain: () => void;
  onContinue: () => void;
}) => {
  if (!state) return null;
  const isChecking = state.status === 'checking';
  const isConfirmed = state.status === 'confirmed';
  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-neutral-900/48 px-4">
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="payment-progress-title"
        aria-describedby="payment-progress-description"
        className="flex w-full max-w-115 flex-col items-center gap-4 rounded-3xl border border-card-border bg-white p-6 text-center shadow-[0_24px_60px_rgba(0,0,0,0.22)]"
      >
        {isChecking ? (
          <YosemiteLoader size={64} testId="invoice-payment-progress-loader" />
        ) : (
          <span className="flex size-14 items-center justify-center rounded-full bg-success-100 text-success-600">
            <LuCheck size={26} aria-hidden="true" />
          </span>
        )}
        <div className="flex flex-col gap-2">
          <h2 id="payment-progress-title" className="text-yc-20-b-primary">
            {isConfirmed ? 'Payment confirmed' : 'Payment in progress'}
          </h2>
          <p id="payment-progress-description" className="text-body-4 text-text-secondary">
            {getPaymentProgressDescription(state.status)}
          </p>
        </div>
        {state.checkoutUrl && (
          <a
            href={state.checkoutUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="max-w-full break-all text-body-4 text-text-brand underline"
          >
            Reopen Stripe checkout
          </a>
        )}
        {!isChecking && (
          <div className="flex flex-wrap justify-center gap-3">
            <Secondary text="Continue editing" onClick={onContinue} />
            <Primary text="Check again" onClick={onCheckAgain} />
          </div>
        )}
      </section>
    </div>
  );
};

/** Green confirmation badge in the breakdown footer; copy reflects the scenario. */
const SettledBadge = ({ invoice }: { invoice: PastInvoice }) => {
  const label = invoice.paidFromDeposit ? 'Withdrawn from Deposit' : 'Invoice Paid';
  return (
    <span className="inline-flex items-center gap-1.5 rounded-3xl bg-[#15803D] px-3 py-1 text-caption-1 font-medium text-neutral-0">
      {label}
      <LuCheck aria-hidden="true" />
    </span>
  );
};

const ROW_GRID =
  'grid gap-3 sm:grid-cols-[minmax(0,1.7fr)_repeat(5,minmax(0,1fr))] sm:items-center';

const InvoiceBreakdown = ({ invoice, currency }: { invoice: PastInvoice; currency: string }) => (
  <SectionContainer title="Breakdown" nested className="bg-neutral-0">
    <div className="flex flex-col gap-2">
      <div
        className={`${ROW_GRID} px-1 text-caption-2 font-medium tracking-wide text-text-secondary uppercase [&>span]:truncate`}
      >
        <span>Item Name</span>
        <span>Unit Price</span>
        <span>Qnt.</span>
        <span>Gross Amt.</span>
        <span>Discount</span>
        <span className="text-right">Amount</span>
      </div>
      <ul className="flex flex-col">
        {invoice.items.map((item) => (
          <li key={item.id} className={`${ROW_GRID} px-1 py-2.5 text-body-4 text-text-primary`}>
            <span className="truncate font-medium">{item.name}</span>
            <span>{formatCents(item.unitPriceCents, currency)}</span>
            <span className="text-text-secondary">x{item.qty}</span>
            <span>{formatCents(item.grossCents, currency)}</span>
            <span className="text-pill-success-text">
              - {formatCents(item.discountCents, currency)}
            </span>
            <span className="text-right font-medium">
              {formatCents(item.amountCents, currency)}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-card-border pt-3">
        <span className="text-text-secondary">Total</span>
        <span className="text-yc-20-b-primary">{formatCents(invoice.totalCents, currency)}</span>
        <SettledBadge invoice={invoice} />
      </div>
      {invoice.payments && invoice.payments.length > 0 && (
        <div className="mt-2 flex flex-col gap-1.5 border-t border-card-border pt-3">
          <span className="text-caption-2 font-medium tracking-wide text-text-secondary uppercase">
            Payments
          </span>
          {invoice.payments.map((payment) => (
            <div
              key={payment.id}
              className="flex flex-wrap items-center justify-between gap-2 text-body-4 text-text-primary"
            >
              <span className="text-text-secondary">
                {[payment.method, payment.provider].filter(Boolean).join(' · ') || 'Payment'}
                {payment.paidAt ? ` — ${formatStampDate(payment.paidAt)}` : ''}
              </span>
              <span className="flex items-center gap-3">
                <span className="font-medium">{formatCents(payment.amountCents, currency)}</span>
                {payment.receiptUrl && (
                  <a
                    href={payment.receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-pill-success-text underline"
                  >
                    Receipt
                  </a>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  </SectionContainer>
);

/**
 * Shared column template so the (separate) heading grid and each row grid resolve
 * to identical track widths. Every fr track is wrapped in minmax(0,…) so it can
 * never grow to fit its content — otherwise the heading ("Invoice ID") and the
 * row ("1. ID - …") would size their first track differently and shift every
 * column. The Actions track is a fixed 132px (fits the 3 circle buttons), so
 * there is no content-driven `auto` anywhere.
 */
const INVOICE_COLS =
  'sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_132px]';
const INVOICE_ROW_GRID = `grid gap-3 ${INVOICE_COLS} sm:items-center`;

const InvoiceHeadings = () => (
  <div
    // Match the row's p-4 + 1px border so the column origins line up exactly.
    className={`${INVOICE_ROW_GRID} hidden border border-transparent px-4 text-caption-2 font-medium tracking-wide text-text-secondary uppercase [&>span]:truncate sm:grid`}
  >
    <span>Invoice ID</span>
    <span>Time / Date</span>
    <span>Total Amt.</span>
    <span>Outstanding amt.</span>
    <span>Status</span>
    <span className="text-right">Actions</span>
  </div>
);

const InvoiceRow = ({
  invoice,
  index,
  expanded,
  readOnly,
  currency,
  onToggle,
  onDownload,
  onShare,
}: {
  invoice: PastInvoice;
  index: number;
  expanded: boolean;
  readOnly: boolean;
  currency: string;
  onToggle: (id: string) => void;
  onDownload: (invoice: PastInvoice) => void;
  onShare: (invoice: PastInvoice) => void;
}) => (
  <li className="flex flex-col gap-4 rounded-2xl border border-card-border p-4">
    <div className={INVOICE_ROW_GRID}>
      <span className="truncate font-medium text-text-primary">
        {index + 1}. ID - {invoice.id}
      </span>
      <span className="truncate text-body-4 text-text-secondary">
        {formatInvoiceDate(invoice.createdAt)}
      </span>
      <span className="text-body-4 text-text-primary">
        {formatCents(invoice.totalCents, currency)}
      </span>
      <span className="text-body-4 text-text-primary">
        {formatCents(invoice.outstandingCents, currency)}
      </span>
      <div className="flex">
        <StatusPill status={invoice.status} />
      </div>
      <div className="flex justify-end gap-2">
        <CircleIconButton
          icon={expanded ? <LuEyeOff aria-hidden="true" /> : <LuEye aria-hidden="true" />}
          label={expanded ? `Hide invoice ${invoice.id}` : `View invoice ${invoice.id}`}
          variant="dark"
          onClick={() => onToggle(invoice.id)}
        />
        <CircleIconButton
          icon={<LuDownload aria-hidden="true" />}
          label={`Download invoice ${invoice.id}`}
          onClick={() => onDownload(invoice)}
        />
        {!readOnly && (
          <CircleIconButton
            icon={<LuShare aria-hidden="true" />}
            label={`Share invoice ${invoice.id}`}
            onClick={() => onShare(invoice)}
          />
        )}
      </div>
    </div>

    {expanded && <InvoiceBreakdown invoice={invoice} currency={currency} />}

    {invoice.paidByName && (
      <div className="flex flex-wrap items-center justify-end gap-3 text-right">
        <span className="flex flex-col text-caption-1">
          <span className="font-medium text-text-primary">By {invoice.paidByName}</span>
          {invoice.paidAt && (
            <span className="text-pill-success-text">
              {formatStampDate(invoice.paidAt)}, {formatStampTime(invoice.paidAt)}
            </span>
          )}
        </span>
        {invoice.paymentMethod && (
          <span className="inline-flex items-center gap-2 rounded-3xl bg-[#15803D] px-4 py-2 text-body-4 font-medium text-neutral-0">
            {PAYMENT_LABELS[invoice.paymentMethod]}
            <LuCheck aria-hidden="true" />
          </span>
        )}
      </div>
    )}
  </li>
);

const InvoicesSection = ({
  invoices,
  readOnly,
  currency,
  onDownload,
  onShare,
}: {
  invoices: PastInvoice[];
  readOnly: boolean;
  currency: string;
  onDownload: (invoice: PastInvoice) => void;
  onShare: (invoice: PastInvoice) => void;
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(invoices[0]?.id ?? null);

  const handleToggle = (id: string) => setExpandedId((current) => (current === id ? null : id));

  return (
    <SectionContainer
      titleClassName="text-yc-20-b-primary"
      title="Invoices"
      className="flex flex-col gap-5"
    >
      {invoices.length === 0 ? (
        <p className="rounded-2xl bg-neutral-100 p-4 text-body-4 text-text-secondary">
          No invoices recorded yet.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <InvoiceHeadings />
          <ul className="flex flex-col gap-3">
            {invoices.map((invoice, index) => (
              <InvoiceRow
                key={invoice.id}
                invoice={invoice}
                index={index}
                expanded={expandedId === invoice.id}
                readOnly={readOnly}
                currency={currency}
                onToggle={handleToggle}
                onDownload={onDownload}
                onShare={onShare}
              />
            ))}
          </ul>
        </div>
      )}
    </SectionContainer>
  );
};

/** Payment actions below the Total Bill (Collect Deposit / Collect Cash / Pay Online). */
const PaymentActions = ({
  isInpatient,
  depositDisabled,
  paymentDisabled,
  onCollect,
  onSendToClient,
}: {
  isInpatient: boolean;
  depositDisabled: boolean;
  paymentDisabled: boolean;
  onCollect: (method: PaymentMethod) => void;
  onSendToClient: () => void;
}) => (
  <div className="flex flex-wrap items-center justify-between gap-3">
    <Secondary
      text="Collect Deposit"
      icon={<LuCreditCard aria-hidden="true" />}
      iconPosition="right"
      onClick={() => onCollect('DEPOSIT')}
      isDisabled={depositDisabled}
    />
    <div className="flex flex-wrap items-center gap-3">
      {isInpatient && (
        <Secondary
          text="Send to Client"
          icon={<LuUpload aria-hidden="true" />}
          iconPosition="right"
          onClick={onSendToClient}
          isDisabled={paymentDisabled}
        />
      )}
      <Secondary
        text="Collect Cash"
        icon={<LuBanknote aria-hidden="true" />}
        iconPosition="right"
        onClick={() => onCollect('CASH')}
        isDisabled={paymentDisabled}
      />
      <Primary
        text="Pay Online"
        icon={<LuBanknote aria-hidden="true" />}
        iconPosition="right"
        onClick={() => onCollect('ONLINE')}
        isDisabled={paymentDisabled}
      />
    </div>
  </div>
);

const DepositModal = ({
  open,
  saving,
  generatedLink,
  onClose,
  onSubmit,
}: {
  open: boolean;
  saving: boolean;
  generatedLink: string | null;
  onClose: () => void;
  onSubmit: (input: {
    amount: number;
    method: PaymentMethod;
    reference: string;
    notes: string;
  }) => void;
}) => {
  const [amount, setAmount] = useState('100');
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const amountNumber = Math.max(0, Number.parseFloat(amount) || 0);

  return (
    <CenterModal
      showModal={open}
      setShowModal={(next) => !next && onClose()}
      onClose={onClose}
      containerClassName="sm:w-[560px]"
    >
      <ModalHeader title="Collect deposit" onClose={onClose} />
      <div className="flex flex-col gap-4 px-2 pb-2">
        <p className="text-body-4 text-text-secondary">
          Record an upfront visit deposit. Cash deposits are marked collected now; online deposits
          generate a payment link.
        </p>
        <label className="flex flex-col gap-1 text-body-4 text-text-primary">
          <span>Amount</span>
          <input
            type="number"
            min={0}
            step={0.01}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="h-12 rounded-2xl border border-input-border-default px-4 focus-visible:border-input-border-active focus-visible:outline-none"
          />
        </label>
        <div className="grid gap-2 sm:grid-cols-2">
          {(['CASH', 'ONLINE'] as PaymentMethod[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setMethod(option)}
              className={`rounded-2xl border px-4 py-3 text-body-4 ${
                method === option
                  ? 'border-primary-500 bg-primary-100 text-text-brand'
                  : 'border-card-border text-text-primary'
              }`}
            >
              {getDepositMethodLabel(option)}
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-1 text-body-4 text-text-primary">
          <span>Reference</span>
          <input
            type="text"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            className="h-12 rounded-2xl border border-input-border-default px-4 focus-visible:border-input-border-active focus-visible:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-body-4 text-text-primary">
          <span>Notes</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="min-h-20 rounded-2xl border border-input-border-default px-4 py-3 focus-visible:border-input-border-active focus-visible:outline-none"
          />
        </label>
        {generatedLink && (
          <output className="flex flex-col gap-1 rounded-2xl bg-primary-100 p-3 text-body-4 text-text-brand">
            <span>Payment link generated:</span>
            <a
              href={generatedLink}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all underline"
            >
              {generatedLink}
            </a>
          </output>
        )}
        <div className="flex justify-end gap-3">
          <Secondary text="Cancel" onClick={onClose} />
          <Primary
            text={getDepositModalActionLabel(saving, method)}
            isDisabled={saving || amountNumber <= 0}
            onClick={() => onSubmit({ amount: amountNumber, method, reference, notes })}
          />
        </div>
      </div>
    </CenterModal>
  );
};

const InvoiceStep = ({
  appointmentId,
  organisationId,
  patientId,
  parentId,
  encounter,
  hideBillBuilder = false,
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
  const recordInvoicePayment = useAppointmentWorkspaceStore((s) => s.recordInvoicePayment);
  const recordDepositCollection = useAppointmentWorkspaceStore((s) => s.recordDepositCollection);
  const hydrateInvoiceBilling = useAppointmentWorkspaceStore((s) => s.hydrateInvoiceBilling);
  const setStepStatus = useAppointmentWorkspaceStore((s) => s.setStepStatus);
  const catalogServices = useRevampCatalogStore((s) => s.services);
  const catalogPackages = useRevampCatalogStore((s) => s.packages);
  const itemIdsByOrgId = useInventoryStore((s) => s.itemIdsByOrgId);
  const inventoryById = useInventoryStore((s) => s.itemsById);
  const setInventoryForOrg = useInventoryStore((s) => s.setInventoryForOrg);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  // A generated payment link shown under the confirmation; rendered as a wrapping
  // anchor so a long Stripe URL never overflows the container width.
  const [confirmationLink, setConfirmationLink] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentProgress, setPaymentProgress] = useState<PaymentProgressState | null>(null);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [depositPaymentLink, setDepositPaymentLink] = useState<string | null>(null);
  const { notify } = useNotify();
  const readOnly = encounter.viewOnly;
  const isInpatient = encounter.mode === 'INPATIENT';
  const hasItems = encounter.invoiceLineItems.length > 0;
  const canBuildBill = !readOnly && !hideBillBuilder;
  // Currency is encounter-scoped (hydrated from finance, defaults to USD). The
  // finance API works in lower-case ISO codes; display uses the upper-case code.
  // Currency precedence: the finance-hydrated encounter currency (server truth),
  // else the organisation's catalog currency (its configured/ country-derived
  // pricing currency), and only then a last-resort default — so a fresh, not-yet-
  // invoiced appointment shows the org's currency instead of a hardcoded USD.
  // Scope the currency to this appointment's organisation: in a multi-org
  // session the catalog store can hold another org's services/packages, so an
  // unfiltered lookup could surface the wrong currency on a fresh invoice.
  const catalogCurrency = organisationId
    ? (catalogServices.find(
        (service) => service.organisationId === organisationId && service.currency
      )?.currency ??
      catalogPackages.find((pkg) => pkg.organisationId === organisationId && pkg.currency)
        ?.currency)
    : undefined;
  const currency = encounter.currency || catalogCurrency?.toUpperCase() || DEFAULT_CURRENCY;
  const financeCurrency = currency.toLowerCase();

  // Clinical safety: an in-house medication on the bill must have its
  // prescription details (dose, route, frequency, duration) filled before the
  // invoice can be finalized. Flag the billed meds that are still incomplete.
  const billItemNames = useMemo(
    () => new Set(encounter.invoiceLineItems.map((item) => item.name.trim().toLowerCase())),
    [encounter.invoiceLineItems]
  );
  const incompleteMedicationNames = useMemo(() => {
    const names = new Set<string>();
    for (const rx of encounter.prescription) {
      if (rx.fulfillment !== 'IN_HOUSE') continue;
      if (!billItemNames.has(rx.medicineName.trim().toLowerCase())) continue;
      const complete = Boolean(
        rx.dosage?.trim() && rx.route?.trim() && rx.frequency?.trim() && rx.durationDays?.trim()
      );
      if (!complete) names.add(rx.medicineName.trim().toLowerCase());
    }
    return names;
  }, [encounter.prescription, billItemNames]);
  const hasIncompleteMedications = incompleteMedicationNames.size > 0;
  const inventoryIds = useMemo(
    () => (organisationId ? (itemIdsByOrgId[organisationId] ?? []) : []),
    [itemIdsByOrgId, organisationId]
  );
  const inventoryItems = useMemo(
    () => inventoryIds.map((id) => inventoryById[id]).filter(Boolean),
    [inventoryById, inventoryIds]
  );
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

  // Saved (persisted) Service/Package + in-house prescription lines for this visit
  // that are not yet billed, mapped into Total Bill lines. These are auto-added to
  // the bill (below) so a clinician doesn't have to re-add each saved item by search.
  // Catalog/inventory candidates stay opt-in (search only).
  const autoSeedCandidates = useMemo<Omit<InvoiceLineItem, 'id'>[]>(
    () => [
      ...encounter.services
        .filter((item) => !item.billed && item.amountCents > 0)
        .map((item) => serviceLineItemToInvoiceLine(item, catalogServices, catalogPackages)),
      ...encounter.prescription
        .filter(
          (item) => !item.billed && item.fulfillment === 'IN_HOUSE' && (item.priceCents ?? 0) > 0
        )
        .map(prescriptionToInvoiceLine),
    ],
    [catalogPackages, catalogServices, encounter.services, encounter.prescription]
  );

  // Load inventory so drugs/consumables are searchable in the bill builder.
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

  // Hydrate existing invoices + deposit for this appointment from finance — exactly
  // once per appointment. Hydration mutates the store, which re-renders this step
  // with a fresh `encounter` prop; without this guard the load would re-fire in a
  // loop and hammer the finance API.
  // True once finance hydration has run, so the saved-treatment auto-seed (below)
  // waits for any open server-invoice lines to be seeded first and dedupes against them.
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

  // Auto-add saved treatment items (services/packages + in-house prescriptions) to
  // the editable Total Bill once finance hydration has run, so a clinician doesn't
  // have to re-add each saved item by search. Each name seeds at most once per mount
  // (so a manually removed line doesn't snap back), lines already on the bill are
  // skipped, and billed/paid items are excluded upstream by the !billed filter.
  const seededBillNamesRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!canBuildBill || !billingHydrated) return;
    const existing = new Set(
      encounter.invoiceLineItems.map((item) => item.name.trim().toLowerCase())
    );
    autoSeedCandidates.forEach((line) => {
      const key = line.name.trim().toLowerCase();
      if (!key || seededBillNamesRef.current.has(key)) return;
      seededBillNamesRef.current.add(key);
      if (!existing.has(key)) {
        addInvoiceLineItem(appointmentId, line);
      }
    });
  }, [
    addInvoiceLineItem,
    appointmentId,
    autoSeedCandidates,
    billingHydrated,
    canBuildBill,
    encounter.invoiceLineItems,
  ]);

  const refreshPaymentProgress = useCallback(
    async (invoiceId?: string) => {
      const targetInvoiceId = invoiceId ?? paymentProgress?.invoiceId;
      if (!targetInvoiceId) return;
      const billing = await reloadBilling();
      if (!billing) return;
      if (isInvoiceSettled(findInvoiceById(billing.pastInvoices, targetInvoiceId))) {
        setPaymentProgress((current) =>
          current?.invoiceId === targetInvoiceId ? { ...current, status: 'confirmed' } : current
        );
        setConfirmationLink(null);
        setConfirmation('Online payment confirmed');
      }
    },
    [paymentProgress?.invoiceId, reloadBilling]
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
    const lineItems = toFinanceLineItems(encounter.invoiceLineItems);
    // Prefer an existing OPEN invoice for this appointment and append new lines to
    // it (web /lines). When none exists, create one via the web POST /invoices —
    // never the mobile /seed route, which requires a mobile Cognito token on web
    // and 401s (logging the user out).
    const storeInvoiceId = findOpenAppointmentInvoice(organisationId, appointmentId)?.id;
    // Fall back to the server-loaded billing state: loadAppointmentBilling hydrates
    // open invoices into the workspace encounter but not into useInvoiceStore (the
    // only place findOpenAppointmentInvoice reads). Without this fallback an existing
    // open invoice is missed and a duplicate is created with the same bill lines.
    const openInvoiceId = storeInvoiceId ?? findServerOpenInvoiceId();
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
      });
    }
    if (invoice?.id && finalize) {
      await finalizeFinanceInvoice(invoice.id);
    }
    return invoice;
  };

  const handleCollect = async (method: PaymentMethod) => {
    if (method === 'DEPOSIT') {
      setDepositPaymentLink(null);
      setIsDepositModalOpen(true);
      return;
    }
    if (!hasItems) return;
    if (!encounter.readyForBilling.value && (method === 'CASH' || method === 'ONLINE')) {
      notify('warning', {
        title: 'Mark ready for billing first',
        text: 'Set the visit to Ready for billing before collecting cash or sending the invoice online.',
      });
    }
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
          persistCurrentInvoice,
          reloadBilling,
          recordInvoicePayment,
        });
      }
      setConfirmation(`${PAYMENT_LABELS[method]} recorded`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to process payment.');
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
      setErrorMessage(error instanceof Error ? error.message : 'Unable to collect deposit.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleSendToClient = async () => {
    await handleCollect('ONLINE');
  };

  const handlePaymentCheckAgain = () => {
    setPaymentProgress((current) =>
      current ? { ...current, startedAt: Date.now(), status: 'checking' } : current
    );
    void refreshPaymentProgress();
  };

  const handleContinueAfterPaymentDelay = () => {
    setPaymentProgress(null);
    void reloadBilling();
  };

  const handleDownloadInvoice = (invoice: PastInvoice) => {
    if (invoice.pdfUrl) {
      openDocumentUrl(invoice.pdfUrl);
      return;
    }
    printInvoice(invoice, currency);
  };

  // Share = copy a concise invoice summary to the clipboard for pasting into a
  // message/email. Falls back to a confirmation when clipboard isn't available.
  const handleShareInvoice = async (invoice: PastInvoice) => {
    const summary = `Invoice ${invoice.id} — ${formatCents(invoice.totalCents, currency)} (${
      invoice.status
    })`;
    try {
      if (globalThis.navigator?.clipboard) {
        await globalThis.navigator.clipboard.writeText(summary);
        setConfirmationLink(null);
        setConfirmation('Invoice summary copied to clipboard.');
      } else {
        setConfirmationLink(null);
        setConfirmation(summary);
      }
    } catch (error) {
      console.error('Failed to copy invoice summary:', error);
      setConfirmationLink(null);
      setConfirmation(summary);
    }
  };

  const handleFinishInvoice = () => {
    if (hasIncompleteMedications) {
      setErrorMessage(
        'Fill information in previous step for prescribed medications before finalizing.'
      );
      return;
    }
    setStepStatus(appointmentId, 'INVOICE', 'COMPLETED');
    onOpenSummary();
  };

  const handleAddItem = (item: Omit<InvoiceLineItem, 'id'>) => {
    addInvoiceLineItem(appointmentId, item);

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
    if (!alreadyPrescribed) {
      addPrescription(appointmentId, prescription);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* The bill builder + payment controls only show while the encounter is
          editable. A completed appointment shows finalized invoices only. */}
      {canBuildBill && (
        <>
          <TotalBillContainer
            items={encounter.invoiceLineItems}
            billableItems={billableItems}
            incompleteItemNames={incompleteMedicationNames}
            currency={currency}
            depositCents={encounter.depositCents}
            withdrawDeposit={encounter.withdrawDeposit}
            overallDiscountPercent={encounter.overallDiscountPercent}
            taxPercent={encounter.taxPercent}
            onToggleWithdrawDeposit={(value) => setWithdrawDeposit(appointmentId, value)}
            onChangeOverallDiscount={(percent) => setOverallDiscountPercent(appointmentId, percent)}
            onAddItem={handleAddItem}
            onUpdateItem={(id, patch) => updateInvoiceLineItem(appointmentId, id, patch)}
            onRemoveItem={(id) => removeInvoiceLineItem(appointmentId, id)}
          />

          <PaymentActions
            isInpatient={isInpatient}
            depositDisabled={isProcessingPayment}
            paymentDisabled={isProcessingPayment || !hasItems}
            onCollect={handleCollect}
            onSendToClient={handleSendToClient}
          />

          {errorMessage && (
            <p role="alert" className="rounded-2xl bg-danger-100 p-3 text-body-4 text-danger-700">
              {errorMessage}
            </p>
          )}

          {confirmation && (
            <output className="flex flex-col gap-1 rounded-2xl bg-primary-100 p-3 text-body-4 text-text-brand">
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
        </>
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
        onContinue={handleContinueAfterPaymentDelay}
      />

      <InvoicesSection
        invoices={encounter.pastInvoices}
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
            icon={<LuArrowRight aria-hidden="true" />}
            iconPosition="right"
            onClick={handleFinishInvoice}
            isDisabled={hasIncompleteMedications}
          />
        </div>
      )}
    </div>
  );
};

export default InvoiceStep;
