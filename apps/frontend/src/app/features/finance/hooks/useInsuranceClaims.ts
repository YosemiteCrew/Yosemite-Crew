'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  getClaimErrorMessage,
  listInsuranceClaims,
} from '@/app/features/finance/services/insuranceClaimService';
import type {
  InsuranceClaim,
  InsuranceClaimStatus,
} from '@/app/features/finance/types/insuranceClaim';

export type UseInsuranceClaims = {
  claims: InsuranceClaim[];
  loading: boolean;
  error: string | null;
  /** Merge one claim back in after a lifecycle action, without a refetch. */
  upsert: (claim: InsuranceClaim) => void;
  reload: () => void;
};

/**
 * List the organisation's insurance claims, optionally narrowed to one status.
 *
 * Filtering is done server-side rather than in the component so the status pills
 * stay correct once an organisation has more claims than one response holds.
 * Mirrors `useEstimates` - a render-phase reset clears a previous org's list on
 * a switch, and `upsert` guards against a response landing after that switch.
 */
export const useInsuranceClaims = (
  organisationId?: string,
  status?: InsuranceClaimStatus
): UseInsuranceClaims => {
  const [claims, setClaims] = useState<InsuranceClaim[]>([]);
  const [loading, setLoading] = useState(Boolean(organisationId));
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const loadKey = `${organisationId ?? ''}|${status ?? ''}|${reloadToken}`;
  const [prevLoadKey, setPrevLoadKey] = useState(loadKey);
  if (prevLoadKey !== loadKey) {
    setPrevLoadKey(loadKey);
    setClaims([]);
    setError(null);
    setLoading(Boolean(organisationId));
  }

  useEffect(() => {
    if (!organisationId) return undefined;
    let active = true;
    listInsuranceClaims(organisationId, status ? { status } : undefined)
      .then((rows) => {
        if (!active) return;
        setClaims(rows);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(getClaimErrorMessage(err, 'Unable to load insurance claims.'));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [organisationId, status, reloadToken]);

  const upsert = useCallback(
    (claim: InsuranceClaim) => {
      if (organisationId && claim.organisationId !== organisationId) return;
      setClaims((current) => {
        const index = current.findIndex((row) => row.id === claim.id);
        // A lifecycle action changes the status, which can move the claim out of
        // the filter currently being viewed. Dropping it keeps the list honest
        // instead of showing a row whose status contradicts the active pill.
        if (status && claim.status !== status) {
          return index === -1 ? current : current.filter((row) => row.id !== claim.id);
        }
        if (index === -1) return [claim, ...current];
        const next = [...current];
        next[index] = claim;
        return next;
      });
    },
    [status, organisationId]
  );

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  return { claims, loading, error, upsert, reload };
};
