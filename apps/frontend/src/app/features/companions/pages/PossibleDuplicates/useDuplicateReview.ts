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
type MatchLoadResult = {
  requestId: number;
  matches: PossibleDuplicate[];
  error: string | null;
};

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

  const loadMatches = useCallback(
    async (targetOrganisationId: string): Promise<MatchLoadResult> => {
      const requestId = ++latestLoadRequest.current;
      try {
        return {
          requestId,
          matches: await loadPossibleDuplicates(targetOrganisationId),
          error: null,
        };
      } catch {
        return {
          requestId,
          matches: [],
          error: 'Possible matches could not be loaded. Try again.',
        };
      }
    },
    []
  );

  const applyLoadedMatches = useCallback(
    (targetOrganisationId: string, result: MatchLoadResult) => {
      if (result.requestId !== latestLoadRequest.current) return;
      setMatches(result.matches);
      setLoadError(
        result.error ? { organisationId: targetOrganisationId, message: result.error } : null
      );
      setLoadedOrganisationId(targetOrganisationId);
      setLoading(false);
    },
    []
  );

  const refresh = useCallback(async () => {
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
    applyLoadedMatches(organisationId, await loadMatches(organisationId));
  }, [applyLoadedMatches, loadMatches, organisationId]);

  useEffect(() => {
    latestDismissRequest.current += 1;
    if (!organisationId) return;
    let active = true;
    void loadMatches(organisationId).then((result) => {
      if (active) applyLoadedMatches(organisationId, result);
    });
    return () => {
      active = false;
      latestLoadRequest.current += 1;
    };
  }, [applyLoadedMatches, loadMatches, organisationId]);

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
