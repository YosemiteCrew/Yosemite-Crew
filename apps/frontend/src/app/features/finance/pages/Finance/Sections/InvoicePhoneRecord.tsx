'use client';
import React from 'react';
import Image from 'next/image';
import { Appointment, Invoice } from '@yosemite-crew/types';
import {
  IoCardOutline,
  IoCheckmarkCircle,
  IoClose,
  IoDownloadOutline,
  IoOpenOutline,
  IoPhonePortraitOutline,
} from 'react-icons/io5';
import { formatMoney } from '@/app/lib/money';
import { formatDateLabel, formatTimeLabel } from '@/app/lib/forms';
import { getInvoiceNumberLabel } from '@/app/lib/invoice';
import { getInvoicePaymentMethodLabel } from '@/app/lib/invoicePaymentMethod';
import { getSafeImageUrl, ImageType } from '@/app/lib/urls';
import { getAppointmentCompanion, getAppointmentCompanionPhotoUrl } from '@/app/lib/appointments';
import { formatCompanionNameWithOwnerLastName } from '@/app/lib/companionName';

type InvoicePhoneRecordProps = {
  titleId: string;
  invoice: Invoice;
  appointment?: Appointment;
  currency: string;
  statusLabel: string;
  statusStyle: React.CSSProperties;
  payerName?: string;
  payerEmail?: string;
  onClose: () => void;
  onOpenAppointment?: () => void;
};

const SETTLED_STATUSES = new Set(['PAID', 'REFUNDED']);

const isSettledInvoice = (invoice: Invoice): boolean =>
  SETTLED_STATUSES.has(invoice.status) || Boolean(invoice.paidAt);

const buildSubtitle = (invoice: Invoice, appointment?: Appointment): string => {
  const identity = appointment
    ? formatCompanionNameWithOwnerLastName(
        getAppointmentCompanion(appointment).name,
        getAppointmentCompanion(appointment).parent
      )
    : '';
  const dateText = formatDateLabel(invoice.createdAt);
  // `identity` and `dateText` are always strings (empty when absent), so no
  // optional chaining is needed before trimming.
  return [identity, dateText]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' · ');
};

type LedgerChannel = {
  Icon: typeof IoCardOutline;
  title: string;
};

/**
 * Mirrors the desktop record: the payment row is labelled by the channel the
 * payment came through, so the same invoice reads the same way at every width.
 */
const getLedgerChannel = (invoice: Invoice): LedgerChannel => {
  const method = invoice.paymentCollectionMethod;
  if (method === 'PAYMENT_INTENT' || method === 'PAYMENT_LINK') {
    return { Icon: IoPhonePortraitOutline, title: 'Paid in the pet-parent app' };
  }
  if (method === 'PAYMENT_AT_CLINIC') {
    return { Icon: IoCardOutline, title: 'Paid at the clinic' };
  }
  return { Icon: IoCardOutline, title: 'Payment recorded' };
};

const buildLedgerCaption = (invoice: Invoice, payerName?: string): string => {
  const methodLabel = getInvoicePaymentMethodLabel(invoice);
  const paidAt = invoice.paidAt ?? invoice.createdAt;
  const stamp = [formatDateLabel(paidAt), formatTimeLabel(paidAt)].filter(Boolean).join(' ');
  const trimmedPayer = (payerName ?? '').trim();
  const parts = [methodLabel !== '-' ? methodLabel : null, stamp || null];
  if (trimmedPayer) parts.push(trimmedPayer);
  return parts.filter(Boolean).join(' · ');
};

/**
 * The phone (< 768px) invoice record, per the responsive design's sheet: a
 * compact 36px-avatar header, a single Item + amount block that ends in a
 * --screen-2 Tax row and a big Total row, one payment row, a finalized note,
 * and the two full-width buttons (PDF outline + "Open appointment" CTA). It
 * replaces the desktop record reflowed into the sheet. Presentation only; it is
 * handed the same computed values (payer, status, appointment) the desktop
 * record uses, so data flow and the "Open appointment" route are unchanged.
 */
const InvoicePhoneRecord = ({
  titleId,
  invoice,
  appointment,
  currency,
  statusLabel,
  statusStyle,
  payerName,
  payerEmail,
  onClose,
  onOpenAppointment,
}: InvoicePhoneRecordProps) => {
  const numberLabel = getInvoiceNumberLabel(invoice) || 'Invoice';
  const subtitle = buildSubtitle(invoice, appointment);
  const companion = appointment ? getAppointmentCompanion(appointment) : undefined;
  const avatarSrc = getSafeImageUrl(
    getAppointmentCompanionPhotoUrl(companion),
    (companion?.species as ImageType) ?? 'other'
  );
  const items = invoice.items ?? [];
  const discount = invoice.discountTotal ?? 0;
  const taxLabel = invoice.taxPercent ? `Tax ${invoice.taxPercent}%` : 'Tax';
  const settled = isSettledInvoice(invoice);
  const caption = buildLedgerCaption(invoice, payerName);
  const { Icon: ChannelIcon, title: channelTitle } = getLedgerChannel(invoice);
  const email = payerEmail?.trim();
  const pdfUrl = invoice.pdfUrl;
  const receiptUrl = invoice.stripeReceiptUrl;

  return (
    <div className="flex flex-col gap-3 pb-1">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="flex items-center gap-2.5 min-w-0">
          <span className="flex size-9 shrink-0 overflow-hidden rounded-full bg-card-hover">
            <Image
              src={avatarSrc}
              alt=""
              width={36}
              height={36}
              className="size-9 rounded-full object-cover"
            />
          </span>
          <span className="flex flex-col min-w-0">
            <span className="flex items-center gap-1.5">
              <h2
                id={titleId}
                className="text-[15.5px] font-bold tracking-[-0.01em] text-[var(--ink)] truncate"
              >
                {numberLabel}
              </h2>
              {statusLabel && (
                <span
                  className="shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.04em]"
                  style={statusStyle}
                >
                  {statusLabel}
                </span>
              )}
            </span>
            {subtitle && (
              <span className="text-[11px] text-[var(--ink-faint)] truncate" title={subtitle}>
                {subtitle}
              </span>
            )}
          </span>
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex size-[30px] shrink-0 items-center justify-center rounded-full border border-[var(--hairline)] text-[var(--ink-faint)]"
        >
          <IoClose size={15} aria-hidden="true" />
        </button>
      </div>

      {/* Items + tax + total */}
      <div className="rounded-[14px] border border-[var(--hairline)] overflow-hidden">
        {items.length === 0 ? (
          <output className="block px-3.5 py-2.5 text-[12px] text-[var(--ink-faint)]">
            No billed items recorded.
          </output>
        ) : (
          items.map((item, index) => (
            <div
              key={item.id ?? `${item.name}-${index}`}
              className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-[12.5px] text-[var(--ink-body)] [&:not(:first-child)]:border-t [&:not(:first-child)]:border-[var(--hairline)]"
            >
              <span className="font-semibold truncate" title={item.name}>
                {item.name}
              </span>
              <span className="shrink-0 font-bold tabular-nums">
                {formatMoney(item.total ?? 0, currency)}
              </span>
            </div>
          ))
        )}
        {discount > 0 && (
          <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 border-t border-[var(--hairline)] bg-[var(--screen-2)] text-[12.5px] text-[var(--ink-muted)]">
            <span>Discount</span>
            <span className="font-semibold tabular-nums">-{formatMoney(discount, currency)}</span>
          </div>
        )}
        <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 border-t border-[var(--hairline)] bg-[var(--screen-2)] text-[12.5px] text-[var(--ink-muted)]">
          <span>{taxLabel}</span>
          <span className="font-semibold tabular-nums">
            {formatMoney(invoice.taxTotal ?? 0, currency)}
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-3 px-3.5 py-3 border-t border-[var(--hairline)]">
          <span className="text-[12.5px] font-bold text-[var(--ink)]">Total</span>
          <span className="text-[20px] font-bold tracking-[-0.03em] tabular-nums text-[var(--ink)]">
            {formatMoney(invoice.totalAmount ?? 0, currency)}
          </span>
        </div>
      </div>

      {/* Payment ledger */}
      {settled && (
        <div className="flex items-center gap-2.5 rounded-[14px] border border-[var(--hairline)] px-3.5 py-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-blue-light text-blue-text">
            <ChannelIcon size={15} aria-hidden="true" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[12.5px] font-bold text-[var(--ink)]">{channelTitle}</span>
            <span className="block text-[10.5px] text-[var(--ink-faint)] truncate" title={caption}>
              {caption}
            </span>
          </span>
          {receiptUrl && (
            <a
              href={receiptUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-[11px] font-semibold text-blue-text"
            >
              Receipt
            </a>
          )}
        </div>
      )}

      {/* Finalized note */}
      {settled && email && (
        <span className="flex items-center gap-2 rounded-xl bg-[var(--inset)] px-3 py-2.5 text-[11px] text-[var(--ink-muted)]">
          <IoCheckmarkCircle size={13} aria-hidden="true" style={{ color: 'var(--success)' }} />
          <span className="truncate" title={`Receipt sent to ${email}`}>
            Receipt sent to {email}
          </span>
        </span>
      )}

      {/* Actions */}
      {(pdfUrl || (appointment && onOpenAppointment)) && (
        <div className="flex gap-2.5 pt-1">
          {pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 items-center justify-center gap-1.5 h-11 rounded-full border border-[var(--divider)] text-[12.5px] font-semibold text-[var(--ink-body)]"
              aria-label={`Download invoice ${numberLabel} PDF`}
            >
              <IoDownloadOutline size={14} aria-hidden="true" />
              PDF
            </a>
          )}
          {appointment && onOpenAppointment && (
            <button
              type="button"
              onClick={onOpenAppointment}
              className="flex flex-[1.4] items-center justify-center gap-1.5 h-11 rounded-full bg-[var(--cta)] text-[12.5px] font-bold text-[var(--cta-text)]"
            >
              <IoOpenOutline size={14} aria-hidden="true" />
              Open appointment
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default InvoicePhoneRecord;
