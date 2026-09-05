/**
 * The invoice step's presentational pieces: status pill, payment overlay and
 * badge, the breakdown and invoice rows, the invoices section, the payment
 * action row and the deposit modal.
 *
 * Split out of InvoiceStep.tsx because a module that exports both React components
 * and plain values loses per-component Fast Refresh, and so each of these stays
 * findable on its own instead of sitting inside a 1500-line step module
 * (react-doctor/only-export-components, react-doctor/no-multi-component-file).
 */
import React, { useState } from 'react';
import {
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
import PackageBreakdownTooltip from '@/app/features/appointments/pages/AppointmentWorkspace/components/PackageBreakdownTooltip';
import PaymentLinkStatus from '@/app/features/appointments/pages/AppointmentWorkspace/components/PaymentLinkStatus';
import { type PaymentLinkStatus as PaymentLinkStatusModel } from '@/app/features/appointments/lib/paymentLinkStatus';
import SectionContainer from '@/app/ui/primitives/SectionContainer/SectionContainer';
import { YosemiteLoader } from '@/app/ui/overlays/Loader';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import type {
  InvoiceStatus,
  PastInvoice,
  PaymentMethod,
} from '@/app/features/appointments/types/workspace';
import { formatMoney } from '@/app/lib/money';
import { formatDateTimeLocal } from '@/app/lib/date';
import { formatStampDate, formatStampTime } from '@/app/lib/appointmentWorkspace';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import { type PaymentProgressState, isInvoiceSettled } from './invoiceStepHooks';
import '@/app/ui/tables/GenericTable/Generictable.css';
import {
  PAYMENT_LABELS,
  formatCents,
} from '@/app/features/appointments/pages/AppointmentWorkspace/steps/invoiceFormat';

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
            className="max-w-full break-all text-body-4 text-blue-text underline"
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
    <span className="inline-flex items-center gap-1.5 rounded-3xl bg-[var(--success-strong)] px-3 py-1 text-caption-1 font-medium text-[var(--success-strong-ink)]">
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
        className={`${ROW_GRID} yc-table-head yc-table-head--static rounded-lg px-1! [&>span]:truncate`}
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
              {/* Same clipped billed-item name as TotalBillContainer. */}
              <span className="truncate" title={item.name}>
                {item.name}
              </span>
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
        <span
          className="text-[26px] font-bold tracking-[-0.03em] tabular-nums"
          style={{ color: 'var(--ink)' }}
        >
          {formatCents(invoice.totalCents, currency)}
        </span>
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
    className={`${INVOICE_ROW_GRID} yc-table-head yc-table-head--static hidden rounded-lg border border-transparent px-4! [&>span]:truncate sm:grid`}
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
          {formatDateTimeLocal(invoice.createdAt)}
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
            <span className="inline-flex items-center gap-2 rounded-3xl bg-[var(--success-strong)] px-4 py-2 text-body-4 font-medium text-[var(--success-strong-ink)]">
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
    <SectionContainer title="Invoices" className="flex flex-col gap-5">
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

const PAYMENT_METHOD_LABELS = {
  ONLINE: 'Online',
  CASH: 'Cash',
  DEPOSIT: 'Deposit',
} as const;

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
  paymentLinkStatus = null,
}: {
  isInpatient: boolean;
  depositDisabled: boolean;
  paymentDisabled: boolean;
  paymentDisabledReason?: string;
  dueCents: number;
  currency: string;
  onCollect: (method: PaymentMethod) => void;
  onSendToClient: () => void;
  /** Real payment-link state for this appointment's invoice; null hides the line. */
  paymentLinkStatus?: PaymentLinkStatusModel | null;
}) => {
  // Online/Cash/Deposit is a single method choice + one "Collect" action (design's
  // payment-method card). Send-to-Client remains a distinct action with its own gating.
  const [method, setMethod] = useState<'ONLINE' | 'CASH' | 'DEPOSIT'>('ONLINE');
  const isDeposit = method === 'DEPOSIT';
  const collectDisabled = isDeposit ? depositDisabled : paymentDisabled;
  const collectButton = (
    <button
      type="button"
      onClick={() => onCollect(method)}
      disabled={collectDisabled}
      className="flex h-11 w-full items-center justify-center gap-2 rounded-full text-[14px] font-bold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
      style={{ background: 'var(--blue)', boxShadow: '0 10px 26px var(--glow-b26)' }}
    >
      {`Collect ${formatMoney(dueCents / 100, currency)}`}
      <IoCashOutline aria-hidden="true" />
    </button>
  );
  const disabledReason = isDeposit ? undefined : paymentDisabledReason;
  return (
    <section
      aria-label="Payment method"
      className="flex flex-col gap-3 rounded-[14px] border border-card-border bg-neutral-0 p-4 shadow-[0_1px_2px_var(--sh03),0_8px_22px_var(--sh05)]"
    >
      <span
        className="text-[14px] font-bold leading-[130%] tracking-[-0.01em]"
        style={{ color: 'var(--ink)' }}
      >
        Payment method
      </span>
      <div
        className="flex gap-1 rounded-xl border p-[3px]"
        style={{ background: 'var(--band)', borderColor: 'var(--hairline)' }}
      >
        {(['ONLINE', 'CASH', 'DEPOSIT'] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={method === option}
            disabled={option === 'DEPOSIT' && depositDisabled}
            onClick={() => setMethod(option)}
            className="flex-1 rounded-lg py-2 text-[12.5px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            style={
              method === option
                ? {
                    background: 'var(--screen)',
                    color: 'var(--ink)',
                    boxShadow: '0 1px 3px var(--sh08)',
                  }
                : { color: 'var(--ink-muted)' }
            }
          >
            {PAYMENT_METHOD_LABELS[option]}
          </button>
        ))}
      </div>
      {disabledReason ? (
        <GlassTooltip content={disabledReason} side="top" maxWidth={320}>
          <span className="inline-flex w-full [&>*]:w-full">{collectButton}</span>
        </GlassTooltip>
      ) : (
        <span className="inline-flex w-full [&>*]:w-full">{collectButton}</span>
      )}
      <PaymentLinkStatus status={paymentLinkStatus} />
      {isInpatient && (
        <div className="flex flex-wrap gap-2 border-t border-card-border pt-3">
          <Secondary
            text="Send to Client"
            icon={<IoCloudUploadOutline aria-hidden="true" />}
            iconPosition="right"
            onClick={onSendToClient}
            isDisabled={paymentDisabled}
          />
        </div>
      )}
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
                  ? 'border-primary-500 bg-primary-100 text-blue-text'
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
          <output className="flex flex-col gap-1 rounded-2xl bg-primary-100 p-3 text-body-4 text-blue-text">
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
