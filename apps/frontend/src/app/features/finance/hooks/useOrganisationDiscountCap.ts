'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  getDiscountSettingsErrorMessage,
  getOrganisationDiscountSettings,
} from '@/app/features/finance/services/discountSettingsService';

export type OrganisationDiscountCap = {
  /** The organisation's cap, or null when none is configured (unconstrained). */
  maxOverallDiscountPercent: number | null;
  loading: boolean;
  error: string | null;
  /** Apply a locally-saved value without a refetch. */
  setCap: (percent: number | null) => void;
  reload: () => void;
};

/**
 * Read the organisation's maximum overall invoice discount percent.
 *
 * Stays null while loading and on failure: a missing cap is a real, valid state
 * (unconstrained), so callers must not treat "not loaded yet" as "capped at 0".
 * The server-side check in the finance API is the authority; this only drives the
 * client-side rejection message.
 */
export const useOrganisationDiscountCap = (organisationId?: string): OrganisationDiscountCap => {
  const [maxOverallDiscountPercent, setMaxOverallDiscountPercent] = useState<number | null>(null);
  const [loading, setLoading] = useState(Boolean(organisationId));
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // Render-phase adjustment: reset for each (re)load so a previous organisation's
  // cap is not retained across an org switch, and a failed lookup leaves no stale
  // cap - matching this hook's documented "null while loading and on failure".
  const loadKey = `${organisationId ?? ''}|${reloadToken}`;
  const [prevLoadKey, setPrevLoadKey] = useState(loadKey);
  if (prevLoadKey !== loadKey) {
    setPrevLoadKey(loadKey);
    if (organisationId) {
      setLoading(true);
      setError(null);
      setMaxOverallDiscountPercent(null);
    } else {
      // No organisation to read a cap for. The previous organisation's cap has
      // to go with it, or the input keeps enforcing a limit that belongs to an
      // organisation the user is no longer in.
      setLoading(false);
      setError(null);
      setMaxOverallDiscountPercent(null);
    }
  }

  useEffect(() => {
    if (!organisationId) return undefined;
    let active = true;
    getOrganisationDiscountSettings(organisationId)
      .then((settings) => {
        if (!active) return;
        setMaxOverallDiscountPercent(settings.maxOverallDiscountPercent);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(getDiscountSettingsErrorMessage(err, 'Unable to load the discount cap.'));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [organisationId, reloadToken]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  return {
    maxOverallDiscountPercent,
    loading,
    error,
    setCap: setMaxOverallDiscountPercent,
    reload,
  };
};
