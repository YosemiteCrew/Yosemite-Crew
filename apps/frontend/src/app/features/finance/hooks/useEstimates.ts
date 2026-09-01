'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  getEstimateErrorMessage,
  listEstimates,
} from '@/app/features/finance/services/estimateService';
import type { Estimate, EstimateStatus } from '@/app/features/finance/types/estimate';

export type UseEstimates = {
  estimates: Estimate[];
  loading: boolean;
  error: string | null;
  /** Merge one estimate back in after a lifecycle action, without a refetch. */
  upsert: (estimate: Estimate) => void;
  reload: () => void;
};

/**
 * List the organisation's estimates, optionally narrowed to one status.
 *
 * Filtering is done server-side rather than in the component so the status pills
 * stay correct once an organisation has more estimates than one response holds.
 */
export const useEstimates = (organisationId?: string, status?: EstimateStatus): UseEstimates => {
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [loading, setLoading] = useState(Boolean(organisationId));
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // Render-phase reset, matching useOrganisationDiscountCap: without it, an org
  // switch or a filter change would keep showing the previous list while the new
  // one loads, and a failed load would leave estimates from another organisation
  // on screen.
  const loadKey = `${organisationId ?? ''}|${status ?? ''}|${reloadToken}`;
  const [prevLoadKey, setPrevLoadKey] = useState(loadKey);
  if (prevLoadKey !== loadKey) {
    setPrevLoadKey(loadKey);
    setEstimates([]);
    setError(null);
    setLoading(Boolean(organisationId));
  }

  useEffect(() => {
    if (!organisationId) return undefined;
    let active = true;
    listEstimates(organisationId, status ? { status } : undefined)
      .then((rows) => {
        if (!active) return;
        setEstimates(rows);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(getEstimateErrorMessage(err, 'Unable to load estimates.'));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [organisationId, status, reloadToken]);

  const upsert = useCallback(
    (estimate: Estimate) => {
      setEstimates((current) => {
        const index = current.findIndex((row) => row.id === estimate.id);
        // A lifecycle action changes the status, which can move the estimate out
        // of the filter currently being viewed - approving under "Draft", or
        // converting under "Approved". Dropping it keeps the list honest instead
        // of showing a row whose status contradicts the active pill.
        if (status && estimate.status !== status) {
          return index === -1 ? current : current.filter((row) => row.id !== estimate.id);
        }
        if (index === -1) return [estimate, ...current];
        const next = [...current];
        next[index] = estimate;
        return next;
      });
    },
    [status]
  );

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  return { estimates, loading, error, upsert, reload };
};
