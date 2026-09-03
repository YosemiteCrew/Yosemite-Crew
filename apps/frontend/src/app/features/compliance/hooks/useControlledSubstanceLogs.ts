'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  fetchControlledSubstanceLogs,
  getControlledSubstanceErrorMessage,
} from '@/app/features/compliance/services/controlledSubstanceService';
import type { ControlledSubstanceLog } from '@/app/features/compliance/types/controlledSubstance';

export type ControlledSubstanceDateRange = { fromDate?: string; toDate?: string };

export type UseControlledSubstanceLogs = {
  logs: ControlledSubstanceLog[];
  loading: boolean;
  error: string | null;
  /** Refetch the register, e.g. after appending an entry. */
  reload: () => void;
};

/**
 * List the organisation's controlled-substance ledger, bounded to a date range.
 *
 * Date bounds are server-side so the register stays correct once an org has
 * more entries than one response holds. The free-text drug filter is applied in
 * the register component instead, over the returned rows, so a keystroke does
 * not fire a request.
 */
export const useControlledSubstanceLogs = (
  organisationId?: string,
  dateRange: ControlledSubstanceDateRange = {}
): UseControlledSubstanceLogs => {
  const [logs, setLogs] = useState<ControlledSubstanceLog[]>([]);
  const [loading, setLoading] = useState(Boolean(organisationId));
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const { fromDate, toDate } = dateRange;

  // Render-phase reset (matching useEstimates): an org switch or a date-range
  // change clears the previous org's rows immediately rather than showing them
  // under the new query while the refetch is in flight.
  const loadKey = `${organisationId ?? ''}|${fromDate ?? ''}|${toDate ?? ''}|${reloadToken}`;
  const [prevLoadKey, setPrevLoadKey] = useState(loadKey);
  if (prevLoadKey !== loadKey) {
    setPrevLoadKey(loadKey);
    setLogs([]);
    setError(null);
    setLoading(Boolean(organisationId));
  }

  useEffect(() => {
    if (!organisationId) return undefined;
    let active = true;
    fetchControlledSubstanceLogs(organisationId, { fromDate, toDate })
      .then((rows) => {
        if (!active) return;
        setLogs(rows);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(
          getControlledSubstanceErrorMessage(
            err,
            'Unable to load the controlled substance register.'
          )
        );
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [organisationId, fromDate, toDate, reloadToken]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  return { logs, loading, error, reload };
};
