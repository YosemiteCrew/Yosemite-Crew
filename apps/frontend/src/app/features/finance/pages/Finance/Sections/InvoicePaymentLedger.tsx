import React from 'react';
import { Invoice } from '@yosemite-crew/types';
import { IoCardOutline, IoCheckmarkCircle, IoPhonePortraitOutline } from 'react-icons/io5';
import { formatMoney } from '@/app/lib/money';
import { formatDateLabel, formatTimeLabel } from '@/app/lib/forms';
import { getInvoicePaymentMethodLabel } from '@/app/lib/invoicePaymentMethod';

type InvoicePaymentLedgerProps = {
  invoice: Invoice;
  currency: string;
  payerName?: string;
  payerEmail?: string;
};

const SETTLED_STATUSES = new Set(['PAID', 'REFUNDED']);

const isSettledInvoice = (invoice: Invoice): boolean =>
  SETTLED_STATUSES.has(invoice.status) || Boolean(invoice.paidAt);

type LedgerChannel = {
  Icon: typeof IoCardOutline;
  title: string;
};

/**
 * The design labels the payment row by the channel it came through rather than
 * with a generic "Payment recorded": an app/link payment reads "Paid in the
 * pet-parent app" behind a phone glyph, an at-the-desk payment reads "Paid at
 * the clinic" behind a card glyph.
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
  const dateText = formatDateLabel(paidAt);
  const timeText = formatTimeLabel(paidAt);
  const stamp = [dateText, timeText].filter(Boolean).join(', ');
  const parts = [methodLabel !== '-' ? methodLabel : null, stamp || null];
  if (payerName?.trim()) parts.push(`by ${payerName.trim()}`);
  return parts.filter(Boolean).join(' · ');
};

const InvoicePaymentLedger = ({
  invoice,
  currency,
  payerName,
  payerEmail,
}: InvoicePaymentLedgerProps) => {
  if (!isSettledInvoice(invoice)) return null;

  const caption = buildLedgerCaption(invoice, payerName);
  const { Icon: ChannelIcon, title: channelTitle } = getLedgerChannel(invoice);
  const receiptUrl = invoice.stripeReceiptUrl;
  const email = payerEmail?.trim();

  return (
    <section className="flex flex-col gap-3" aria-label="Payments">
      <h3 className="text-[13px] font-bold text-[var(--ink)]">Payments</h3>
      <div className="rounded-[14px] border border-card-border overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-[11px]">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-blue-light text-blue-text">
            <ChannelIcon size={15} aria-hidden="true" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[13px] font-bold text-[var(--ink)]">{channelTitle}</span>
            <span className="block text-[11.5px] text-text-tertiary truncate" title={caption}>
              {caption}
            </span>
          </span>
          <span className="text-[13px] font-bold text-[var(--ink)] tabular-nums">
            {formatMoney(invoice.totalAmount ?? 0, currency)}
          </span>
          {receiptUrl && (
            <a
              href={receiptUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11.5px] font-semibold text-blue-text hover:underline"
            >
              Receipt
            </a>
          )}
        </div>
      </div>
      {email && (
        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[var(--inset)] text-[12px] text-text-secondary">
          <IoCheckmarkCircle size={14} aria-hidden="true" style={{ color: 'var(--success)' }} />
          <span className="truncate" title={`Receipt sent to ${email}`}>
            Receipt sent to {email}
          </span>
        </div>
      )}
    </section>
  );
};

export default InvoicePaymentLedger;
