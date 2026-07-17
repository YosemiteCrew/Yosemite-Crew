import React from 'react';
import { InvoiceItem } from '@yosemite-crew/types';
import { formatMoney } from '@/app/lib/money';

type InvoiceBilledItemsProps = {
  items: InvoiceItem[];
  currency: string;
};

const gridTemplate = 'minmax(0,1.9fr) 50px 90px 90px';

const InvoiceBilledItems = ({ items, currency }: InvoiceBilledItemsProps) => {
  return (
    <section className="flex flex-col gap-3" aria-label="Billed items">
      <h3 className="text-body-4-emphasis text-text-primary">Billed items</h3>
      <div className="rounded-[14px] border border-card-border overflow-hidden">
        <div
          className="grid gap-2.5 px-4 py-2 bg-card-hover text-caption-2 text-text-tertiary uppercase tracking-wider"
          style={{ gridTemplateColumns: gridTemplate }}
        >
          <span>Item</span>
          <span>Qty</span>
          <span className="text-right">Gross</span>
          <span className="text-right">Amount</span>
        </div>
        {items.length === 0 ? (
          <output className="block px-4 py-3 text-caption-1 text-text-tertiary border-t border-card-border">
            No billed items recorded for this invoice.
          </output>
        ) : (
          items.map((item, index) => (
            <div
              key={item.id ?? `${item.name}-${index}`}
              className="grid gap-2.5 px-4 py-2.5 border-t border-card-border text-body-4 text-text-secondary items-center"
              style={{ gridTemplateColumns: gridTemplate }}
            >
              <span className="text-body-4-emphasis text-text-primary truncate" title={item.name}>
                {item.name}
              </span>
              <span className="tabular-nums">{item.quantity}</span>
              <span className="text-right tabular-nums">
                {formatMoney(item.unitPrice ?? 0, currency)}
              </span>
              <span className="text-right tabular-nums text-body-4-emphasis text-text-primary">
                {formatMoney(item.total ?? 0, currency)}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
};

export default InvoiceBilledItems;
