import React from 'react';
import { InvoiceItem } from '@yosemite-crew/types';
import { formatMoneyPrecise } from '@/app/lib/money';
import TableHead from '@/app/ui/tables/TableHead';

type InvoiceBilledItemsProps = {
  items: InvoiceItem[];
  currency: string;
};

const gridTemplate = 'minmax(0,1.9fr) 50px 90px 90px';

const InvoiceBilledItems = ({ items, currency }: InvoiceBilledItemsProps) => {
  return (
    <section className="flex flex-col gap-3" aria-label="Billed items">
      <h3 className="text-[13px] font-bold text-[var(--ink)]">Billed items</h3>
      <div className="rounded-[14px] border border-card-border overflow-hidden">
        <TableHead
          columns={[
            { key: 'item', label: 'Item' },
            { key: 'qty', label: 'Qty' },
            { key: 'gross', label: 'Gross', align: 'right' },
            { key: 'amount', label: 'Amount', align: 'right' },
          ]}
          track={gridTemplate}
          gap="10px"
          sticky={false}
          // Rows below use px-4; the recipe's 20px would start every heading
          // 4px right of its values and narrow the flexible track by 8px.
          className="px-4!"
        />
        {items.length === 0 ? (
          <output className="block px-4 py-3 text-[13px] text-text-tertiary border-t border-card-border">
            No billed items recorded for this invoice.
          </output>
        ) : (
          items.map((item, index) => (
            <div
              key={item.id ?? `${item.name}-${index}`}
              className="grid gap-2.5 px-4 py-[11px] border-t border-card-border text-[13px] text-[var(--ink-body)] items-center"
              style={{ gridTemplateColumns: gridTemplate }}
            >
              <span className="font-semibold truncate" title={item.name}>
                {item.name}
              </span>
              <span className="tabular-nums">{item.quantity}</span>
              <span className="text-right tabular-nums">
                {formatMoneyPrecise(item.unitPrice ?? 0, currency)}
              </span>
              <span className="text-right tabular-nums font-bold">
                {formatMoneyPrecise(item.total ?? 0, currency)}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
};

export default InvoiceBilledItems;
