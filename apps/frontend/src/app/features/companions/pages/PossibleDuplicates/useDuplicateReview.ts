import { useCallback, useEffect, useRef, useState } from 'react';
import {
  dismissPossibleDuplicate,
  loadPossibleDuplicates,
  type PossibleDuplicate,
} from '@/app/features/companions/services/patientDuplicateReviewService';

/** The same key for a pair whichever record is listed first. */
export const duplicatePairId = (match: PossibleDuplicate) =>
  [match.patientA.id, match.patientB.id].sort((left, right) => left.localeCompare(right)).join(':');

type ReviewError = { organisationId: string; message: string };

export const useDuplicateReview = (organisationId: string | null) => {
  const [matches, setMatches] = useState<PossibleDuplicate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<ReviewError | null>(null);
  const [dismissError, setDismissError] = useState<ReviewError | null>(null);
  const [loadedOrganisationId, setLoadedOrganisationId] = useState<string | null>(null);
  const [busyDismissal, setBusyDismissal] = useState<{
    organisationId: string;
    pairId: string;
    requestId: number;
  } | null>(null);
  const latestLoadRequest = useRef(0);
  const latestDismissRequest = useRef(0);
  const currentLoadError = loadError?.organisationId === organisationId ? loadError.message : null;
  const currentDismissError =
    dismissError?.organisationId === organisationId ? dismissError.message : null;
  const busyPair = busyDismissal?.organisationId === organisationId ? busyDismissal.pairId : null;
  const isLoading = Boolean(organisationId && (loading || loadedOrganisationId !== organisationId));
  const visibleError = organisationId
    ? (currentDismissError ?? currentLoadError)
    : 'Choose a clinic to review patient records.';

  const refresh = useCallback(async () => {
    const requestId = ++latestLoadRequest.current;
    if (!organisationId) {
      setMatches([]);
      setLoadError(null);
      setDismissError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    setDismissError(null);
    try {
      const result = await loadPossibleDuplicates(organisationId);
      if (requestId !== latestLoadRequest.current) return;
      setMatches(result);
      setLoadedOrganisationId(organisationId);
    } catch {
      if (requestId !== latestLoadRequest.current) return;
      setMatches([]);
      setLoadError({ organisationId, message: 'Possible matches could not be loaded. Try again.' });
      setLoadedOrganisationId(organisationId);
    } finally {
      if (requestId === latestLoadRequest.current) setLoading(false);
    }
  }, [organisationId]);

  useEffect(() => {
    const requestId = ++latestLoadRequest.current;
    latestDismissRequest.current += 1;
    if (!organisationId) {
      return;
    }
    let active = true;
    loadPossibleDuplicates(organisationId)
      .then((result) => {
        if (!active || requestId !== latestLoadRequest.current) return;
        setMatches(result);
        setLoadError(null);
        setLoadedOrganisationId(organisationId);
        setLoading(false);
      })
      .catch(() => {
        if (!active || requestId !== latestLoadRequest.current) return;
        setMatches([]);
        setLoadError({
          organisationId,
          message: 'Possible matches could not be loaded. Try again.',
        });
        setLoadedOrganisationId(organisationId);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [organisationId]);

  const dismiss = async (match: PossibleDuplicate) => {
    if (!organisationId || busyPair) return;
    const requestId = ++latestDismissRequest.current;
    const pairId = duplicatePairId(match);
    setBusyDismissal({ organisationId, pairId, requestId });
    setDismissError(null);
    try {
      await dismissPossibleDuplicate(organisationId, match.patientA.id, match.patientB.id);
      if (requestId !== latestDismissRequest.current) return;
      setMatches((current) => current.filter((item) => duplicatePairId(item) !== pairId));
    } catch {
      if (requestId === latestDismissRequest.current) {
        setDismissError({
          organisationId,
          message: 'This match could not be dismissed. Try again.',
        });
      }
    } finally {
      setBusyDismissal((current) => (current?.requestId === requestId ? null : current));
    }
  };

  return {
    matches,
    loading,
    refresh,
    dismiss,
    busyPair,
    currentLoadError,
    visibleError,
    isLoading,
  };
};
