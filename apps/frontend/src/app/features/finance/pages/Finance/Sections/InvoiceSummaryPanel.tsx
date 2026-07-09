import React from 'react';
import { Invoice } from '@yosemite-crew/types';
import { formatMoney } from '@/app/lib/money';
import { getInvoiceOutstanding } from '@/app/lib/financeMetrics';

type InvoiceSummaryPanelProps = {
  invoice: Invoice;
  currency: string;
};

const InvoiceSummaryPanel = ({ invoice, currency }: InvoiceSummaryPanelProps) => {
  const outstanding = getInvoiceOutstanding(invoice);
  const taxLabel = invoice.taxPercent ? `Tax · ${invoice.taxPercent}%` : 'Tax';

  return (
    <section className="flex flex-col gap-3" aria-label="Invoice summary">
      <h3 className="text-body-4-emphasis text-text-primary">Summary</h3>
      <div className="rounded-[14px] border border-card-border px-4.5 py-4 flex flex-col gap-2.5">
        <div className="flex items-center justify-between text-body-4 text-text-tertiary">
          <span>Subtotal</span>
          <span className="tabular-nums text-body-4-emphasis text-text-secondary">
            {formatMoney(invoice.subtotal ?? 0, currency)}
          </span>
        </div>
        <div className="flex items-center justify-between text-body-4 text-text-tertiary">
          <span>Discount</span>
          <span className="tabular-nums text-body-4-emphasis text-text-secondary">
            {formatMoney(invoice.discountTotal ?? 0, currency)}
          </span>
        </div>
        <div className="flex items-center justify-between text-body-4 text-text-tertiary">
          <span>{taxLabel}</span>
          <span className="tabular-nums text-body-4-emphasis text-text-secondary">
            {formatMoney(invoice.taxTotal ?? 0, currency)}
          </span>
        </div>
        <span className="h-px bg-card-border" aria-hidden="true" />
        <div className="flex items-baseline justify-between">
          <span className="text-body-3-emphasis text-text-primary">Total</span>
          <span className="text-heading-2 tabular-nums text-text-primary">
            {formatMoney(invoice.totalAmount ?? 0, currency)}
          </span>
        </div>
        <div className="flex items-center justify-between text-body-4 text-text-tertiary">
          <span>Outstanding</span>
          <span
            className="tabular-nums text-body-4-emphasis"
            style={{
              color:
                outstanding > 0
                  ? 'var(--color-pill-warning-text)'
                  : 'var(--color-pill-success-text)',
            }}
          >
            {formatMoney(outstanding, currency)}
          </span>
        </div>
      </div>
    </section>
  );
};

export default InvoiceSummaryPanel;
