'use client';
import React from 'react';
import TableHead from '@/app/ui/tables/TableHead';
import { formatMoneyPrecise } from '@/app/lib/money';
import type { Estimate } from '@/app/features/finance/types/estimate';

type EstimateLineItemsProps = {
  estimate: Estimate;
};

/**
 * The estimate's line items.
 *
 * Built the way `InvoiceBilledItems` is built - the shared `TableHead` recipe
 * over a CSS grid, with the same track on the header and the rows - so an
 * estimate and the invoice it converts into read as one family rather than two
 * independently styled tables.
 */
const gridTemplate = 'minmax(0,1.9fr) 50px 90px 60px 90px';

const EstimateLineItems = ({ estimate }: EstimateLineItemsProps) => (
  <div className="rounded-[14px] border border-card-border overflow-hidden">
    <TableHead
      columns={[
        { key: 'description', label: 'Description' },
        { key: 'qty', label: 'Qty' },
        { key: 'unitPrice', label: 'Unit price', align: 'right' },
        { key: 'tax', label: 'Tax', align: 'right' },
        { key: 'lineTotal', label: 'Line total', align: 'right' },
      ]}
      track={gridTemplate}
      gap="10px"
      // Not sticky: this sits inside a detail card, where sticky resolves
      // against the wrong container and strands the band mid-panel.
      sticky={false}
      className="px-4!"
    />
    {estimate.items.length === 0 ? (
      <output className="block px-4 py-3 text-body-4 text-text-tertiary border-t border-card-border">
        This estimate has no lines.
      </output>
    ) : (
      estimate.items.map((item) => (
        <div
          key={item.id}
          className="grid gap-2.5 px-4 py-[11px] border-t border-card-border text-body-4 text-text-primary items-center"
          style={{ gridTemplateColumns: gridTemplate }}
        >
          <span className="min-w-0">
            <span className="font-semibold block truncate" title={item.description}>
              {item.description}
            </span>
            {item.notes ? (
              <span
                className="block text-caption-2 text-text-secondary truncate"
                title={item.notes}
              >
                {item.notes}
              </span>
            ) : null}
          </span>
          <span className="tabular-nums">{item.quantity}</span>
          <span className="text-right tabular-nums">
            {formatMoneyPrecise(item.unitPrice, estimate.currency)}
          </span>
          <span className="text-right tabular-nums">{item.taxRate}%</span>
          <span className="text-right tabular-nums font-bold">
            {formatMoneyPrecise(item.lineTotal, estimate.currency)}
          </span>
        </div>
      ))
    )}
  </div>
);

export default EstimateLineItems;
