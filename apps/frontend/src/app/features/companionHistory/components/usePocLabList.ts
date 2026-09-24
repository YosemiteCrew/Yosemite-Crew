'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { isAuthRedirectError } from '@/app/services/axios';
import { usePermissions } from '@/app/hooks/usePermissions';
import { PERMISSIONS } from '@/app/lib/permissions';
import { useNotify } from '@/app/hooks/useNotify';
import { useOrgStore } from '@/app/stores/orgStore';
import {
  TEST_TYPE_LABEL,
  buildPocLabPayload,
  type PocLabFormValues,
} from '@/app/features/companionHistory/components/pocLabForm';
import {
  createPocLabResult,
  fetchPocLabResults,
  type PointOfCareLabResult,
} from '@/app/features/companionHistory/services/pocLabService';

const LOAD_ERROR = 'Could not load in-house lab results. Please try again.';

const newestFirst = (items: PointOfCareLabResult[]): PointOfCareLabResult[] =>
  [...items].sort((a, b) => Date.parse(b.conductedAt) - Date.parse(a.conductedAt));

type RecordsState = {
  key: string;
  records: PointOfCareLabResult[];
  loading: boolean;
  error: string | null;
  /** The record this member just saved, so the list can open it. */
  createdId: string | null;
};

const loadingState = (key: string): RecordsState => ({
  key,
  records: [],
  loading: true,
  error: null,
  createdId: null,
});

const usePocLabRecords = (companionId: string, canView: boolean, key: string) => {
  const [state, setState] = useState<RecordsState>(() => loadingState(''));
  useEffect(() => {
    if (!canView || !companionId) return;
    let active = true;
    fetchPocLabResults({ patientId: companionId })
      .then((records) => {
        if (active) setState({ key, records, loading: false, error: null, createdId: null });
      })
      .catch((error) => {
        if (!active) return;
        // An auth redirect is already navigating away; an error banner would flash.
        const message = isAuthRedirectError(error) ? null : LOAD_ERROR;
        setState({ key, records: [], loading: false, error: message, createdId: null });
      });
    return () => {
      active = false;
    };
  }, [canView, companionId, key]);
  return { state: state.key === key ? state : loadingState(key), setState };
};

const useCreatePocLabResult = (
  companionId: string,
  key: string,
  keyRef: RefObject<string>,
  setState: Dispatch<SetStateAction<RecordsState>>
) => {
  const { notify } = useNotify();
  const [creatingFor, setCreatingFor] = useState<string | null>(null);
  const create = useCallback(
    async (values: PocLabFormValues): Promise<boolean> => {
      if (!companionId) return false;
      const operationKey = key;
      setCreatingFor(operationKey);
      try {
        const created = await createPocLabResult(buildPocLabPayload(companionId, values));
        if (keyRef.current !== operationKey) return false;
        setState((current) => ({
          ...current,
          records: newestFirst([created, ...current.records]),
          createdId: created.id,
        }));
        notify('success', {
          title: 'Lab result recorded',
          text: `${TEST_TYPE_LABEL[created.testType]} was added to in-house lab results.`,
        });
        return true;
      } catch (error) {
        if (keyRef.current === operationKey && !isAuthRedirectError(error)) {
          notify('error', { title: 'Could not record lab result', text: 'Please try again.' });
        }
        return false;
      } finally {
        if (keyRef.current === operationKey) setCreatingFor(null);
      }
    },
    [companionId, key, keyRef, notify, setState]
  );
  return { create, creating: creatingFor === key };
};

export type PocLabListState = {
  canView: boolean;
  canEdit: boolean;
  records: PointOfCareLabResult[];
  loading: boolean;
  error: string | null;
  createdId: string | null;
  creating: boolean;
  create: (values: PocLabFormValues) => Promise<boolean>;
};

/**
 * State for the in-house lab results panel. Viewing needs
 * `appointments:view:any`; recording needs `appointments:edit:any`, the gate on
 * the backend POST. Results are keyed by organisation and companion so a reply
 * for the previous patient is never written into the next one's list.
 */
export const usePocLabList = (companionId: string): PocLabListState => {
  const permissions = usePermissions();
  const canView = permissions.can(PERMISSIONS.APPOINTMENTS_VIEW_ANY);
  const canEdit = permissions.can(PERMISSIONS.APPOINTMENTS_EDIT_ANY);
  const organisationId = useOrgStore((state) => state.primaryOrgId);
  const key = `${organisationId ?? ''}:${companionId}`;
  const keyRef = useRef(key);
  useLayoutEffect(() => {
    keyRef.current = key;
  }, [key]);
  const { state, setState } = usePocLabRecords(companionId, canView, key);
  const { create, creating } = useCreatePocLabResult(companionId, key, keyRef, setState);
  const { records, loading, error, createdId } = state;
  return { canView, canEdit, records, loading, error, createdId, creating, create };
};
