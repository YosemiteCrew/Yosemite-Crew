'use client';
import { useEffect, useState } from 'react';

import { getData } from '@/app/services/axios';
import { useConsentStore } from '@/app/stores/consentStore';
import { useCurrencyStore } from '@/app/stores/currencyStore';
import type { PricingResponse } from '@/app/features/marketing/pages/PricingPage/types';
import { logger } from '@/app/lib/logger';

const PRICING_ENDPOINT = '/v1/pricing';

type UsePricingResult = {
  data: PricingResponse | null;
  loading: boolean;
  error: string | null;
};

/**
 * Fetches `/v1/pricing` from the backend and returns the response.
 *
 * Consent gate: the request only fires once the user has **granted** cookie
 * consent, or after they have explicitly chosen a currency from the manual
 * switcher. This keeps the pricing page usable (shows USD defaults) without
 * ever making a network call before a lawful basis exists for it.
 *
 * Re-fetches whenever consent state or preferred currency changes.
 */
export const usePricing = (): UsePricingResult => {
  const consentStatus = useConsentStore((s) => s.status);
  const preferred = useCurrencyStore((s) => s.preferred);

  const [data, setData] = useState<PricingResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const shouldFetch =
      consentStatus === 'granted' || (preferred !== null && consentStatus !== 'denied');
    if (!shouldFetch) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    getData<PricingResponse>(PRICING_ENDPOINT)
      .then((res) => {
        if (cancelled) return;
        setData(res.data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        logger.warn('usePricing: failed to fetch pricing', err);
        setError('Unable to load pricing');
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [consentStatus, preferred]);

  return { data, loading, error };
};
