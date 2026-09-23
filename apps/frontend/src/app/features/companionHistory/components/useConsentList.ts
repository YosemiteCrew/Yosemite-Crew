'use client';

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { isAuthRedirectError } from '@/app/services/axios';
import { usePermissions } from '@/app/hooks/usePermissions';
import { PERMISSIONS } from '@/app/lib/permissions';
import { useNotify } from '@/app/hooks/useNotify';
import type { ConsentFormValues } from '@/app/features/companionHistory/components/ConsentList';
import {
  fetchPatientConsents,
  grantPatientConsent,
  revokePatientConsent,
  type ConsentStatus,
  type CreatePatientConsentInput,
  type PatientConsent,
} from '@/app/features/companionHistory/services/patientConsentService';

const LOAD_ERROR = 'Could not load the consent list. Please try again.';
const toIsoDate = (value: string): string => new Date(`${value}T00:00:00.000Z`).toISOString();

// Active consents lead the list; expired ones follow, then revoked. Within a
// status the most recently granted consent reads first.
const STATUS_ORDER: Record<ConsentStatus, number> = { ACTIVE: 0, EXPIRED: 1, REVOKED: 2 };
const sortConsents = (items: PatientConsent[]): PatientConsent[] =>
  [...items].sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      Date.parse(b.consentedAt) - Date.parse(a.consentedAt)
  );

type SetConsents = Dispatch<SetStateAction<PatientConsent[]>>;
type SetError = Dispatch<SetStateAction<string | null>>;

/** Loads a companion's consents and resets to a loading state when the companion changes. */
const useConsentRecords = (companionId: string, canView: boolean) => {
  const [consents, setConsents] = useState<PatientConsent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reset during render (React's recommended pattern) rather than in an effect;
  // `loadedFor` tracks which companion the current state belongs to.
  const [loadedFor, setLoadedFor] = useState(companionId);
  if (companionId !== loadedFor) {
    setLoadedFor(companionId);
    setConsents([]);
    setError(null);
    setLoading(true);
  }

  useEffect(() => {
    if (!canView || !companionId) return;
    let active = true;
    fetchPatientConsents({ patientId: companionId })
      .then((next) => {
        if (active) setConsents(sortConsents(next));
      })
      .catch((requestError) => {
        if (active && !isAuthRedirectError(requestError)) setError(LOAD_ERROR);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [canView, companionId]);

  return { consents, loading, error, setConsents, setError };
};

/** The grant action and its in-flight flag; refreshes the list from the server on success. */
const useGrantConsent = (companionId: string, setConsents: SetConsents, setError: SetError) => {
  const { notify } = useNotify();
  const [creating, setCreating] = useState(false);
  const grant = useCallback(
    async (values: ConsentFormValues): Promise<boolean> => {
      if (!companionId) return false;
      setCreating(true);
      try {
        const input: CreatePatientConsentInput = {
          patientId: companionId,
          consentType: values.consentType,
          ...(values.procedureDesc.trim() ? { procedureDesc: values.procedureDesc.trim() } : {}),
          ...(values.consentedByName.trim()
            ? { consentedByName: values.consentedByName.trim() }
            : {}),
          ...(values.witnessedBy.trim() ? { witnessedBy: values.witnessedBy.trim() } : {}),
          ...(values.notes.trim() ? { notes: values.notes.trim() } : {}),
          ...(values.expiresAt ? { expiresAt: toIsoDate(values.expiresAt) } : {}),
        };
        await grantPatientConsent(input);
        setConsents(sortConsents(await fetchPatientConsents({ patientId: companionId })));
        setError(null);
        notify('success', {
          title: 'Consent recorded',
          text: 'The consent was added to the patient record.',
        });
        return true;
      } catch (requestError) {
        if (!isAuthRedirectError(requestError)) {
          notify('error', { title: 'Could not record consent', text: 'Please try again.' });
        }
        return false;
      } finally {
        setCreating(false);
      }
    },
    [companionId, notify, setConsents, setError]
  );
  return { grant, creating };
};

/** The revoke action and the id it is revoking; updates the consent in place on success. */
const useRevokeConsent = (setConsents: SetConsents) => {
  const { notify } = useNotify();
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const revoke = useCallback(
    async (consent: PatientConsent, revokedReason?: string): Promise<boolean> => {
      setRevokingId(consent.id);
      try {
        const updated = await revokePatientConsent(consent.id, revokedReason);
        setConsents((current) =>
          sortConsents(current.map((item) => (item.id === updated.id ? updated : item)))
        );
        notify('success', {
          title: 'Consent revoked',
          text: 'The consent was marked revoked.',
        });
        return true;
      } catch (requestError) {
        if (!isAuthRedirectError(requestError)) {
          notify('error', { title: 'Could not revoke consent', text: 'Please try again.' });
        }
        return false;
      } finally {
        setRevokingId(null);
      }
    },
    [notify, setConsents]
  );
  return { revoke, revokingId };
};

export type ConsentListState = {
  /** The backend gates the list on `appointments:view:any`. */
  canView: boolean;
  /** Grant and revoke need `appointments:edit:any`. */
  canEdit: boolean;
  consents: PatientConsent[];
  loading: boolean;
  error: string | null;
  creating: boolean;
  revokingId: string | null;
  grant: (values: ConsentFormValues) => Promise<boolean>;
  revoke: (consent: PatientConsent, revokedReason?: string) => Promise<boolean>;
};

/**
 * Composes the consent panel's state from three focused sub-hooks - records,
 * grant and revoke - so no single function owns loading, mutation and
 * notification at once. The panel is a thin projection over what this returns.
 */
export const useConsentList = (companionId: string): ConsentListState => {
  const permissions = usePermissions();
  const canView = permissions.can(PERMISSIONS.APPOINTMENTS_VIEW_ANY);
  const canEdit = permissions.can(PERMISSIONS.APPOINTMENTS_EDIT_ANY);

  const { consents, loading, error, setConsents, setError } = useConsentRecords(
    companionId,
    canView
  );
  const { grant, creating } = useGrantConsent(companionId, setConsents, setError);
  const { revoke, revokingId } = useRevokeConsent(setConsents);

  return { canView, canEdit, consents, loading, error, creating, revokingId, grant, revoke };
};
