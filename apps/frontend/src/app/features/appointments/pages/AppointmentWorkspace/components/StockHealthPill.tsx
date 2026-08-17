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
      // --ink-fixed, not text-neutral-0: neutral-0 is the SURFACE token, so the
      // count was --screen-on-warning-700 at 2.74:1 in light and inverted in
      // dark. Both pill fills are fixed mid-tones, so the count is pinned dark
      // against them - 5.61:1 on the warning fill.
      className={`flex size-6 items-center justify-center rounded-2xl text-[11px] leading-none font-bold text-[var(--ink-fixed)] ${
        low ? 'bg-warning-700' : 'bg-pill-success-text'
      }`}
    >
      {qty}
    </span>
  </span>
);
