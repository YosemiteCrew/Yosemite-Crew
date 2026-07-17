import React, { useCallback, useMemo, useState } from 'react';
import {
  IoArrowForwardOutline,
  IoCardOutline,
  IoCashOutline,
  IoCheckmarkOutline,
  IoCloudUploadOutline,
  IoDownloadOutline,
  IoEyeOffOutline,
  IoEyeOutline,
  IoShareOutline,
} from 'react-icons/io5';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import CircleIconButton from '@/app/features/appointments/pages/AppointmentWorkspace/components/CircleIconButton';
import TotalBillContainer from '@/app/features/appointments/pages/AppointmentWorkspace/components/TotalBillContainer';
import PackageBreakdownTooltip from '@/app/features/appointments/pages/AppointmentWorkspace/components/PackageBreakdownTooltip';
import SectionContainer from '@/app/ui/primitives/SectionContainer/SectionContainer';
import { YosemiteLoader } from '@/app/ui/overlays/Loader';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import { useAppointmentWorkspaceStore } from '@/app/stores/appointmentWorkspaceStore';
import type {
  AppointmentEncounter,
  InvoiceLineItem,
  InvoiceStatus,
  PastInvoice,
  PaymentMethod,
} from '@/app/features/appointments/types/workspace';
import { formatMoney } from '@/app/lib/money';
import { formatStampDate, formatStampTime } from '@/app/lib/appointmentWorkspace';
import {
  addLineItemsToAppointments,
  createFinanceInvoice,
  finalizeFinanceInvoice,
  getPaymentLink,
  recordManualInvoicePayment,
  sendInvoiceToClient,
  findOpenAppointmentInvoice,
} from '@/app/features/billing/services/invoiceService';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import { useOrganisationDiscountCap } from '@/app/features/finance/hooks/useOrganisationDiscountCap';
import { deletePrescriptionArtifact } from '@/app/features/appointments/services/workspaceClinicalService';
import { useNotify } from '@/app/hooks/useNotify';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import { buildBillableItems, getInvoiceErrorMessage, normalizeLineName } from './invoiceStepUtils';
import {
  type PaymentProgressState,
  computeIncompleteMedicationNames,
  enrichInvoiceLineItems,
  isInvoiceSettled,
  useAutoSeedBillLines,
  useInvoiceBillingHydration,
  useInvoiceCatalogAndInventory,
  usePackageBreakdownHydration,
  usePaymentProgress,
} from './invoiceStepHooks';

type InvoiceStepProps = {
  appointmentId: string;
  organisationId?: string;
  patientId?: string;
  parentId?: string;
  encounter: AppointmentEncounter;
  hideBillBuilder?: boolean;
  /** Name of the appointment's booked service/consultation — its bill line can't be removed. */
  bookedItemName?: string;
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

const DEFAULT_CURRENCY = 'USD';

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
    `<div>Date: ${escapeHtml(new Date(invoice.createdAt).toLocaleString())}</div>` +
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

export const StatusPill = ({ status }: { status: InvoiceStatus }) => (
  <span
    className={`inline-flex rounded-2xl border px-3 py-1 text-caption-1 ${STATUS_CLASSES[status]}`}
  >
    {STATUS_LABELS[status]}
  </span>
);

const getPaymentProgressDescription = (status: PaymentProgressState['status']): string => {
  if (status === 'checking') {
    return 'Stripe checkout is open. Keep this window open while we confirm the payment status.';
  }
  if (status === 'confirmed') {
    return 'Stripe has confirmed the payment and the invoice status is now up to date.';
  }
  return 'We have not received the final payment confirmation yet. You can keep checking or continue editing and this page will refresh again when you return.';
};

export const PaymentProgressOverlay = ({
  state,
  onCheckAgain,
  onAbort,
  onContinue,
}: {
  state: PaymentProgressState | null;
  onCheckAgain: () => void;
  onAbort: () => void;
  onContinue: () => void;
}) => {
  if (!state) return null;
  const isChecking = state.status === 'checking';
  const isConfirmed = state.status === 'confirmed';
  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-neutral-900/48 px-4">
      <dialog
        open
        aria-modal="true"
        aria-labelledby="payment-progress-title"
        aria-describedby="payment-progress-description"
        className="flex w-full max-w-115 flex-col items-center gap-4 rounded-3xl border border-card-border bg-neutral-0 p-6 text-center shadow-[0_24px_60px_rgba(0,0,0,0.22)]"
      >
        {isChecking ? (
          <YosemiteLoader size={64} testId="invoice-payment-progress-loader" />
        ) : (
          <span className="flex size-14 items-center justify-center rounded-full bg-success-100 text-success-600">
            <IoCheckmarkOutline size={26} aria-hidden="true" />
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
        {isChecking && <Secondary text="Abort" onClick={onAbort} />}
        {isConfirmed && (
          // Payment is confirmed — the only sensible action is to close and continue.
          // Never show Abort (nothing left to abort) or Check again (already settled).
          <Primary text="Done" onClick={onContinue} />
        )}
        {!isChecking && !isConfirmed && (
          // Delayed: confirmation hasn't arrived yet, so keep both the retry and the
          // escape hatches available.
          <div className="flex flex-wrap justify-center gap-3">
            <Secondary text="Abort" onClick={onAbort} />
            <Secondary text="Continue editing" onClick={onContinue} />
            <Primary text="Check again" onClick={onCheckAgain} />
          </div>
        )}
      </dialog>
    </div>
  );
};

/** Green confirmation badge in the breakdown footer; copy reflects the scenario. */
export const SettledBadge = ({ invoice }: { invoice: PastInvoice }) => {
  const label = invoice.paidFromDeposit ? 'Withdrawn from Deposit' : 'Invoice Paid';
  return (
    <span className="inline-flex items-center gap-1.5 rounded-3xl bg-[#15803D] px-3 py-1 text-caption-1 font-medium text-white">
      {label}
      <IoCheckmarkOutline aria-hidden="true" />
    </span>
  );
};

const ROW_GRID =
  'grid gap-3 sm:grid-cols-[minmax(0,1.7fr)_repeat(5,minmax(0,1fr))] sm:items-center';

export const InvoiceBreakdown = ({
  invoice,
  currency,
}: {
  invoice: PastInvoice;
  currency: string;
}) => (
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
            <span className="inline-flex min-w-0 items-center gap-1 font-medium">
              <span className="truncate">{item.name}</span>
              <PackageBreakdownTooltip item={item} currency={currency} />
            </span>
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
        {isInvoiceSettled(invoice) && <SettledBadge invoice={invoice} />}
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

export const InvoiceHeadings = () => (
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

export const InvoiceRow = ({
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
}) => {
  const settled = isInvoiceSettled(invoice);
  return (
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
            icon={
              expanded ? (
                <IoEyeOffOutline aria-hidden="true" />
              ) : (
                <IoEyeOutline aria-hidden="true" />
              )
            }
            label={expanded ? `Hide invoice ${invoice.id}` : `View invoice ${invoice.id}`}
            variant="dark"
            onClick={() => onToggle(invoice.id)}
          />
          {settled && (
            <CircleIconButton
              icon={<IoDownloadOutline aria-hidden="true" />}
              label={`Download invoice ${invoice.id}`}
              onClick={() => onDownload(invoice)}
            />
          )}
          {settled && !readOnly && (
            <CircleIconButton
              icon={<IoShareOutline aria-hidden="true" />}
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
            <span className="inline-flex items-center gap-2 rounded-3xl bg-[#15803D] px-4 py-2 text-body-4 font-medium text-white">
              {PAYMENT_LABELS[invoice.paymentMethod]}
              <IoCheckmarkOutline aria-hidden="true" />
            </span>
          )}
        </div>
      )}
    </li>
  );
};

export const InvoicesSection = ({
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
export const PaymentActions = ({
  isInpatient,
  depositDisabled,
  paymentDisabled,
  paymentDisabledReason,
  dueCents,
  currency,
  onCollect,
  onSendToClient,
}: {
  isInpatient: boolean;
  depositDisabled: boolean;
  paymentDisabled: boolean;
  paymentDisabledReason?: string;
  dueCents: number;
  currency: string;
  onCollect: (method: PaymentMethod) => void;
  onSendToClient: () => void;
}) => {
  // Online/Cash is a single method choice + one "Collect" action (design's payment-method
  // card). Deposit and Send-to-Client remain distinct actions with their own gating.
  const [method, setMethod] = useState<'ONLINE' | 'CASH'>('ONLINE');
  const collectButton = (
    <Primary
      text={`Collect ${formatMoney(dueCents / 100, currency)}`}
      icon={<IoCashOutline aria-hidden="true" />}
      iconPosition="right"
      onClick={() => onCollect(method)}
      isDisabled={paymentDisabled}
    />
  );
  return (
    <section
      aria-label="Payment method"
      className="flex flex-col gap-3 rounded-[14px] border border-card-border bg-neutral-0 p-4 shadow-[0_1px_2px_var(--sh03),0_8px_22px_var(--sh05)]"
    >
      <span className="text-body-3-emphasis text-text-primary">Payment method</span>
      <div className="flex gap-1 rounded-xl bg-neutral-100 p-1">
        {(['ONLINE', 'CASH'] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={method === option}
            onClick={() => setMethod(option)}
            className={`flex-1 rounded-lg py-2 text-caption-1 font-semibold transition-colors ${
              method === option
                ? 'bg-neutral-0 text-text-primary shadow-[0_1px_3px_var(--sh08)]'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {option === 'ONLINE' ? 'Online' : 'Cash'}
          </button>
        ))}
      </div>
      {paymentDisabledReason ? (
        <GlassTooltip content={paymentDisabledReason} side="top" maxWidth={320}>
          <span className="inline-flex w-full [&>*]:w-full">{collectButton}</span>
        </GlassTooltip>
      ) : (
        <span className="inline-flex w-full [&>*]:w-full">{collectButton}</span>
      )}
      <div className="flex flex-wrap gap-2 border-t border-card-border pt-3">
        <Secondary
          text="Collect Deposit"
          icon={<IoCardOutline aria-hidden="true" />}
          iconPosition="right"
          onClick={() => onCollect('DEPOSIT')}
          isDisabled={depositDisabled}
        />
        {isInpatient && (
          <Secondary
            text="Send to Client"
            icon={<IoCloudUploadOutline aria-hidden="true" />}
            iconPosition="right"
            onClick={onSendToClient}
            isDisabled={paymentDisabled}
          />
        )}
      </div>
    </section>
  );
};

export const DepositModal = ({
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

const useInvoiceStepContent = ({
  appointmentId,
  organisationId,
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
    const lineItems = toFinanceLineItems(encounter.invoiceLineItems);
    // Prefer an existing OPEN invoice for this appointment and append new lines to
    // it (web /lines). When none exists, create one via the web POST /invoices —
    // never the mobile /seed route, which requires a mobile session on web
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
        // Send the overall discount so it reaches the ledger. Without it the invoice
        // totals the full (line-discounted) amount while runManualCollection collects
        // computeInvoiceTotalCents (which DOES subtract the overall discount), leaving
        // the difference as a receivable that can never be settled. Omitted entirely at
        // 0 so an undiscounted invoice keeps a null discount type/value as it does today.
        ...(encounter.overallDiscountPercent > 0
          ? {
              invoiceDiscount: {
                type: 'PERCENTAGE' as const,
                value: encounter.overallDiscountPercent,
              },
            }
          : {}),
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
          persistCurrentInvoice,
          reloadBilling,
          recordInvoicePayment,
        });
      }
      setConfirmation(`${PAYMENT_LABELS[method]} recorded`);
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
              onAddItem={handleAddItem}
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
