import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { SupportedCurrency } from '@/app/features/marketing/pages/PricingPage/types';

const SUPPORTED = new Set<SupportedCurrency>(['USD', 'GBP', 'EUR']);

type CurrencyState = {
  /**
   * `null` = auto-detect (backend will resolve via IP).
   * When set, the axios interceptor attaches `X-Preferred-Currency` on
   * outgoing requests and the pricing page re-fetches.
   */
  preferred: SupportedCurrency | null;
  setPreferred: (currency: SupportedCurrency) => void;
  clearPreferred: () => void;
};

export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set) => ({
      preferred: null,
      setPreferred: (currency) => {
        if (!SUPPORTED.has(currency)) return;
        set({ preferred: currency });
      },
      clearPreferred: () => set({ preferred: null }),
    }),
    {
      name: 'currency-store',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ preferred: state.preferred }),
    }
  )
);
