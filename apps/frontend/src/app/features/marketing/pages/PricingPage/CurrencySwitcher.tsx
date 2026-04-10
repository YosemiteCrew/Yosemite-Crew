'use client';
import React from 'react';

import { useCurrencyStore } from '@/app/stores/currencyStore';
import type { SupportedCurrency } from './types';

const OPTIONS: Array<{ code: SupportedCurrency; label: string }> = [
  { code: 'USD', label: 'USD' },
  { code: 'GBP', label: 'GBP' },
  { code: 'EUR', label: 'EUR' },
];

type Props = {
  /** The currency currently in use (from the backend response). */
  currency: SupportedCurrency;
};

const CurrencySwitcher = ({ currency }: Props) => {
  const setPreferred = useCurrencyStore((s) => s.setPreferred);

  return (
    <div
      role="group"
      aria-label="Display currency"
      className="inline-flex items-center gap-1 rounded-2xl border border-grey-light p-1"
    >
      {OPTIONS.map((opt) => {
        const isActive = opt.code === currency;
        return (
          <button
            key={opt.code}
            type="button"
            aria-pressed={isActive}
            onClick={() => setPreferred(opt.code)}
            className={`${
              isActive
                ? 'bg-blue-light text-blue-text shadow-[0_0_4px_0_rgba(0,0,0,0.12)]'
                : 'text-grey-noti hover:text-black-text'
            } font-satoshi text-[13px] font-semibold px-3 h-7 rounded-xl transition-colors cursor-pointer`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};

export default CurrencySwitcher;
