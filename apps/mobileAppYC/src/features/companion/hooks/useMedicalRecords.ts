// A companion's current allergies and health problems, as the owner sees them.
//
// Every state write is tied to the request that produced it. A response that
// lands after the owner has moved to another companion (or retried) is
// dropped, so one pet's records can never show on another pet's screen.

import {useEffect, useState} from 'react';

import {getFreshStoredTokens} from '@/features/auth/sessionManager';
import {
  medicalRecordApi,
  type MobileAllergy,
  type MobileProblem,
} from '@/features/companion/services/medicalRecordService';

/** `signIn` has no retry: a retry cannot fix a missing session. */
export type MedicalRecordsLoadError = 'signIn' | 'loadFailed';

export interface UseMedicalRecordsResult {
  allergies: MobileAllergy[];
  problems: MobileProblem[];
  loading: boolean;
  error: MedicalRecordsLoadError | null;
  retry: () => void;
}

const SIGN_IN_REQUIRED = new Error('signIn');

export const useMedicalRecords = (
  companionId: string,
): UseMedicalRecordsResult => {
  const [allergies, setAllergies] = useState<MobileAllergy[]>([]);
  const [problems, setProblems] = useState<MobileProblem[]>([]);
  const [error, setError] = useState<MedicalRecordsLoadError | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  // Loading is derived from which request the state belongs to, so a new
  // companion (or a retry) never shows the previous result while it loads.
  const requestKey = `${companionId}:${retryCount}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const tokens = await getFreshStoredTokens();
        if (!tokens?.accessToken) throw SIGN_IN_REQUIRED;
        const [nextAllergies, nextProblems] = await Promise.all([
          medicalRecordApi.fetchAllergies(companionId, tokens.accessToken),
          medicalRecordApi.fetchProblems(companionId, tokens.accessToken),
        ]);
        if (active) {
          setAllergies(nextAllergies);
          setProblems(nextProblems);
          setError(null);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError === SIGN_IN_REQUIRED ? 'signIn' : 'loadFailed');
        }
      } finally {
        if (active) setLoadedKey(requestKey);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [companionId, requestKey]);

  return {
    allergies,
    problems,
    loading: loadedKey !== requestKey,
    error,
    retry: () => setRetryCount(value => value + 1),
  };
};
