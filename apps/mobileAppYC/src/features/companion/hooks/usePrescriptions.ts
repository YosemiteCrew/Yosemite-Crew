// Owner prescriptions for one companion, plus the refill request.
//
// The list endpoint spans every companion the owner has, so the hook loads it
// in full (the service follows every page) and then keeps only this companion's
// rows. Filtering before paging is complete would turn "not on page 1" into
// "nothing prescribed", which is a false clinical statement.

import {useCallback, useEffect, useState} from 'react';
import {Alert} from 'react-native';
import {useTranslation} from 'react-i18next';

import {getFreshStoredTokens} from '@/features/auth/sessionManager';
import {
  prescriptionApi,
  type MobilePrescription,
} from '@/features/companion/services/prescriptionService';

/** `signIn` has no retry: a retry cannot fix a missing session. */
export type PrescriptionsLoadError = 'signIn' | 'loadFailed';

export interface UsePrescriptionsResult {
  prescriptions: MobilePrescription[];
  loading: boolean;
  error: PrescriptionsLoadError | null;
  reload: () => Promise<void>;
  /** The prescription whose refill request is in flight, if any. */
  requestingId: string | null;
  requestRefill: (prescriptionId: string) => Promise<void>;
}

/** The refill request, and which prescription it is in flight for. */
const usePrescriptionRefill = () => {
  const {t} = useTranslation();
  const [requestingId, setRequestingId] = useState<string | null>(null);

  const requestRefill = useCallback(
    async (prescriptionId: string) => {
      // Set before the token lookup so the button is busy for the whole request.
      setRequestingId(prescriptionId);
      try {
        const tokens = await getFreshStoredTokens();
        if (!tokens?.accessToken) {
          Alert.alert(
            t('prescriptions.refillFailedTitle'),
            t('prescriptions.signInAgain'),
          );
          return;
        }
        await prescriptionApi.requestRefill(prescriptionId, tokens.accessToken);
        Alert.alert(
          t('prescriptions.refillRequestedTitle'),
          t('prescriptions.refillRequestedBody'),
        );
      } catch {
        Alert.alert(
          t('prescriptions.refillFailedTitle'),
          t('prescriptions.refillFailedBody'),
        );
      } finally {
        setRequestingId(null);
      }
    },
    [t],
  );

  return {requestingId, requestRefill};
};

export const usePrescriptions = (
  companionId: string,
): UsePrescriptionsResult => {
  const [prescriptions, setPrescriptions] = useState<MobilePrescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<PrescriptionsLoadError | null>(null);
  const refill = usePrescriptionRefill();

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const tokens = await getFreshStoredTokens();
      if (tokens?.accessToken) {
        const all = await prescriptionApi.list(tokens.accessToken);
        setPrescriptions(all.filter(item => item.patientId === companionId));
      } else {
        setError('signIn');
      }
    } catch {
      setError('loadFailed');
    } finally {
      setLoading(false);
    }
  }, [companionId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return {prescriptions, loading, error, reload, ...refill};
};
