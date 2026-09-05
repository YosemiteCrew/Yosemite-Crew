import React from 'react';
import StatusPill from '@/app/ui/primitives/StatusPill/StatusPill';
import { getInventoryStatusStyle } from '@/app/ui/tables/tableUtils';
import {
  displayStatusLabel,
  formatCurrencyValue,
  formatDisplayDate,
} from '@/app/features/inventory/pages/Inventory/utils';
import { Secondary } from '@/app/ui/primitives/Buttons';

const displayValue = (val?: string | number | null) => {
  if (val === undefined || val === null) return '—';
  if (typeof val === 'string' && val.trim() === '') return '—';
  return val;
};

/**
 * Currency for the phone catalogue card. Delegates to the same formatter the
 * inventory tables use, so the card shows "$143" in the org's own currency
 * rather than a hardcoded "$ 143" - the design writes money with no space
 * after the symbol, and a non-USD clinic was shown dollars regardless.
 */
const formatCurrency = (value: string | number | undefined, currency?: string) =>
  formatCurrencyValue(value, currency);

const InventoryCard = ({ item, handleViewInventory }: any) => {
  const totalValue = () => {
    // `item.pricing` / `item.stock` are dereferenced unguarded further up this same
    // render (unit cost, stock), so they are always present by the time this runs.
    /* Deliberately NOT `Number(x ?? 0)`: that fallback made the isFinite guard
       below unreachable, so an unpriced, uncounted item reported "$0" — a claim
       that the clinic holds nothing of value, rather than that nobody has priced
       or counted it yet. Blank strings and null coerce to 0 too, hence the
       shared missing-value check instead of a bare Number(). */
    if (displayValue(item.pricing.selling) === '—' || displayValue(item.stock.current) === '—') {
      return '—';
    }
    const price = Number(item.pricing.selling);
    const onHand = Number(item.stock.current);
    if (!Number.isFinite(price) || !Number.isFinite(onHand)) return '—';
    return formatCurrencyValue(Math.round(price * onHand), item.currency);
  };

  return (
    <div className="sm:min-w-[280px] w-full sm:w-[calc(50%-12px)] rounded-2xl border border-card-border bg-neutral-0 shadow-[0_1px_2px_var(--sh03),0_8px_22px_var(--sh05)] p-3 flex flex-col justify-between gap-2 cursor-pointer">
      <div className="flex gap-1">
        <div className="text-body-3-emphasis text-text-primary">{item.basicInfo.name}</div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Category:</div>
        <div className="text-caption-1 text-text-primary">{item.basicInfo.category}</div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Stock:</div>
        <div className="text-caption-1 text-text-primary">
          {displayValue(item.stock.current || '') === '—' ? '—' : `${item.stock.current} units`}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Unit cost:</div>
        <div className="text-caption-1 text-text-primary">
          {formatCurrency(item.pricing.purchaseCost, item.currency)}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Selling price:</div>
        <div className="text-caption-1 text-text-primary">
          {formatCurrency(item.pricing.selling, item.currency)}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Total value:</div>
        <div className="text-caption-1 text-text-primary">{totalValue()}</div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Expiry:</div>
        <div className="text-caption-1 text-text-primary">
          {formatDisplayDate(item.batch.expiryDate) || '—'}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Location:</div>
        <div className="text-caption-1 text-text-primary">
          {displayValue(item.stock.stockLocation)}
        </div>
      </div>
      <StatusPill
        style={getInventoryStatusStyle(displayStatusLabel(item))}
        label={displayStatusLabel(item)}
      />
      <div className="flex gap-3 w-full">
        <Secondary
          href="#"
          onClick={() => handleViewInventory(item)}
          text="View"
          className="w-full"
        />
      </div>
    </div>
  );
};

export default InventoryCard;
