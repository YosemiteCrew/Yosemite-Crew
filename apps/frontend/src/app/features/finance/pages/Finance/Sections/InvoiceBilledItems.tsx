import React from 'react';
import { InvoiceItem } from '@yosemite-crew/types';
import { formatMoneyPrecise } from '@/app/lib/money';
import TableHead from '@/app/ui/tables/TableHead';

type InvoiceBilledItemsProps = {
  items: InvoiceItem[];
  currency: string;
};

const gridTemplate = 'minmax(0,1.9fr) 50px 90px 90px';

// Line items carry only an OPTIONAL id (it comes from the FHIR charge-item
// code), so a row without one keys off its own content instead of its position.
// The `#n` suffix separates two byte-identical lines, which are the only rows
// position can still decide - every distinguishable row keeps a stable key
// across a reorder.
const withRowKeys = (items: InvoiceItem[]): Array<{ item: InvoiceItem; key: string }> => {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const base = item.id ?? `${item.name}|${item.quantity}|${item.unitPrice}|${item.total}`;
    const occurrence = (seen.get(base) ?? 0) + 1;
    seen.set(base, occurrence);
    return { item, key: occurrence === 1 ? base : `${base}#${occurrence}` };
  });
};

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
          withRowKeys(items).map(({ item, key }) => (
            <div
              key={key}
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
