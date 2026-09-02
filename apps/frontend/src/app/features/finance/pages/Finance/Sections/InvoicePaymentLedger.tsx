import React from 'react';
import { Invoice } from '@yosemite-crew/types';
import { formatMoneyPrecise, recordCurrency } from '@/app/lib/money';
import { formatDateLabel, formatTimeLabel } from '@/app/lib/forms';
import { getInvoicePaymentMethodLabel } from '@/app/lib/invoicePaymentMethod';
import { getLedgerChannel } from '@/app/features/finance/pages/Finance/Sections/ledgerChannel';
import { getSafeStripeRedirectUrl } from '@/app/lib/urls';

type InvoicePaymentLedgerProps = {
  invoice: Invoice;
  currency: string;
  payerName?: string;
};

const SETTLED_STATUSES = new Set(['PAID', 'REFUNDED']);

const isSettledInvoice = (invoice: Invoice): boolean =>
  SETTLED_STATUSES.has(invoice.status) || Boolean(invoice.paidAt);

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

const InvoicePaymentLedger = ({ invoice, currency, payerName }: InvoicePaymentLedgerProps) => {
  if (!isSettledInvoice(invoice)) return null;

  const caption = buildLedgerCaption(invoice, payerName);
  const { Icon: ChannelIcon, title: channelTitle } = getLedgerChannel(invoice);
  // Validated rather than rendered straight into an href: React does not
  // sanitize link protocols, and a receipt URL is invoice data. The helper keeps
  // this to real Stripe receipt hosts over https.
  const receiptUrl = getSafeStripeRedirectUrl(invoice.stripeReceiptUrl);

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
            {formatMoneyPrecise(invoice.totalAmount ?? 0, recordCurrency(invoice, currency))}
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
      {/*
        No "Receipt sent to ..." line. It used to render whenever a payer email
        was on file, which is not evidence that anything was sent: nothing in the
        product emails an invoice receipt, `receipt_email` is never set on the
        PaymentIntent, and the invoice carries no delivery state. It also showed
        for cash and pay-at-clinic settlements, where no receipt exists at all -
        so staff could stop chasing a receipt a client never got. The Stripe
        receipt link above is the real signal, and it is already rendered.
      */}
    </section>
  );
};

export default InvoicePaymentLedger;
