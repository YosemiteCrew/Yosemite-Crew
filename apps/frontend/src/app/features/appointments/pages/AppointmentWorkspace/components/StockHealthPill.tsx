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
      // The two fills behave differently, so their inks do too.
      //   warning-700 is FIXED (a mid orange in both themes) -> pin the ink dark,
      //     5.61. It used to take text-neutral-0, which inverted to near-white.
      //   the success fill THEMES (deep green in light, light green in dark) ->
      //     keep text-neutral-0, whose inversion is exactly right here: light on
      //     the deep fill, dark on the light one. Pinning it white gave 1.86 in
      //     dark, so this branch was right all along.
      className={`flex size-6 items-center justify-center rounded-2xl text-[11px] leading-none font-bold ${
        low ? 'bg-warning-700 text-[var(--ink-fixed)]' : 'bg-pill-success-text text-neutral-0'
      }`}
    >
      {qty}
    </span>
  </span>
);
