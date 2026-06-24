import React from 'react';

/**
 * Stock-health pill: green "In stock" or amber "Low stock", with the on-hand
 * count in an inner circle.
 */
export const StockHealthPill = ({ qty, low }: { qty: number; low: boolean }) => (
  <span
    className={`flex h-8 items-center gap-2 rounded-2xl border py-2 pr-1 pl-3 text-caption-2 font-medium shadow-[0_1px_10px_0_rgba(169,163,158,0.10)] ${
      low
        ? 'border-pill-warning-text bg-pill-warning-bg text-pill-warning-text'
        : 'border-pill-success-text bg-pill-success-bg text-pill-success-text'
    }`}
  >
    {low ? 'Low stock' : 'In stock'}
    <span
      className={`flex size-6 items-center justify-center rounded-2xl text-[11px] leading-none font-bold text-neutral-0 ${
        low ? 'bg-warning-700' : 'bg-pill-success-text'
      }`}
    >
      {qty}
    </span>
  </span>
);
