import React from 'react';
import { Invoice } from '@yosemite-crew/types';
import { formatMoneyPrecise, recordCurrency } from '@/app/lib/money';
import { getInvoiceOutstanding } from '@/app/lib/financeMetrics';

type InvoiceSummaryPanelProps = {
  invoice: Invoice;
  currency: string;
};

const InvoiceSummaryPanel = ({ invoice, currency }: InvoiceSummaryPanelProps) => {
  const outstanding = getInvoiceOutstanding(invoice);
  // The invoice's own currency, and to the penny. The prop is an organisation
  // value that is always USD (#2597), and these figures have to reconcile with
  // the stored amount and with the credit ledger below - 144.60 rounded to 145
  // is a different number to the client.
  const money = recordCurrency(invoice, currency);
  const taxLabel = invoice.taxPercent ? `Tax · ${invoice.taxPercent}%` : 'Tax';

  return (
    <section className="flex flex-col gap-3" aria-label="Invoice summary">
      <h3 className="text-[13px] font-bold text-[var(--ink)]">Summary</h3>
      <div className="rounded-[14px] border border-card-border px-4.5 py-4 flex flex-col gap-2.5">
        <div className="flex items-center justify-between text-[13px] text-[var(--ink-muted)]">
          <span>Subtotal</span>
          <span className="tabular-nums text-[13px] font-semibold text-[var(--ink-body)]">
            {formatMoneyPrecise(invoice.subtotal ?? 0, money)}
          </span>
        </div>
        <div className="flex items-center justify-between text-[13px] text-[var(--ink-muted)]">
          <span>Discount</span>
          <span className="tabular-nums text-[13px] font-semibold text-[var(--ink-body)]">
            {formatMoneyPrecise(invoice.discountTotal ?? 0, money)}
          </span>
        </div>
        <div className="flex items-center justify-between text-[13px] text-[var(--ink-muted)]">
          <span>{taxLabel}</span>
          <span className="tabular-nums text-[13px] font-semibold text-[var(--ink-body)]">
            {formatMoneyPrecise(invoice.taxTotal ?? 0, money)}
          </span>
        </div>
        <span className="h-px bg-card-border" aria-hidden="true" />
        <div className="flex items-baseline justify-between">
          <span className="text-[13.5px] font-bold text-[var(--ink)]">Total</span>
          <span className="text-[24px] font-bold tracking-[-0.03em] tabular-nums text-[var(--ink)]">
            {formatMoneyPrecise(invoice.totalAmount ?? 0, money)}
          </span>
        </div>
        <div className="flex items-center justify-between text-[13px] text-[var(--ink-muted)]">
          <span>Outstanding</span>
          <span
            className="tabular-nums text-[13px] font-bold"
            style={{
              color: outstanding > 0 ? 'var(--warn-text)' : 'var(--success-text)',
            }}
          >
            {formatMoneyPrecise(outstanding, money)}
          </span>
        </div>
      </div>
    </section>
  );
};

export default InvoiceSummaryPanel;
