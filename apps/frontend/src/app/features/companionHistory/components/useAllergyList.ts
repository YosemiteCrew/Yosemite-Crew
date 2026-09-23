'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { isAuthRedirectError } from '@/app/services/axios';
import { usePermissions } from '@/app/hooks/usePermissions';
import { PERMISSIONS } from '@/app/lib/permissions';
import { useNotify } from '@/app/hooks/useNotify';
import { useOrgStore } from '@/app/stores/orgStore';
import type { AllergyFormValues } from '@/app/features/companionHistory/components/AllergyList';
import {
  createPatientAllergy,
  fetchPatientAllergies,
  resolvePatientAllergy,
  type AllergySeverity,
  type AllergyType,
  type CreatePatientAllergyInput,
  type PatientAllergy,
} from '@/app/features/companionHistory/services/patientAllergyService';

const toIsoDate = (value: string): string => new Date(`${value}T00:00:00.000Z`).toISOString();
const LOAD_ERROR = 'Could not load the allergy list. Please try again.';
const SEVERITY_ORDER: Record<AllergySeverity, number> = {
  LIFE_THREATENING: 0,
  SEVERE: 1,
  MODERATE: 2,
  MILD: 3,
};
const TYPE_ORDER: Record<AllergyType, number> = { DRUG: 0, FOOD: 1, ENVIRONMENTAL: 2, OTHER: 3 };
const sortAllergies = (items: PatientAllergy[]): PatientAllergy[] =>
  [...items].sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      TYPE_ORDER[a.allergyType] - TYPE_ORDER[b.allergyType] ||
      Date.parse(b.createdAt) - Date.parse(a.createdAt)
  );

type RecordsState = {
  key: string;
  allergies: PatientAllergy[];
  loading: boolean;
  error: string | null;
};

const useAllergyRecords = (companionId: string, canView: boolean, key: string) => {
  const [state, setState] = useState<RecordsState>({
    key: '',
    allergies: [],
    loading: true,
    error: null,
  });
  useEffect(() => {
    if (!canView || !companionId) return;
    let active = true;
    fetchPatientAllergies({ patientId: companionId })
      .then((allergies) => active && setState({ key, allergies, loading: false, error: null }))
      .catch((error) => {
        if (active && !isAuthRedirectError(error)) {
          setState({ key, allergies: [], loading: false, error: LOAD_ERROR });
        }
      });
    return () => {
      active = false;
    };
  }, [canView, companionId, key]);
  return {
    state: state.key === key ? state : { key, allergies: [], loading: true, error: null },
    setState,
  };
};

const useCreateAllergy = (
  companionId: string,
  key: string,
  keyRef: RefObject<string>,
  setState: Dispatch<SetStateAction<RecordsState>>
) => {
  const { notify } = useNotify();
  const [creatingFor, setCreatingFor] = useState<string | null>(null);
  const create = useCallback(
    async (values: AllergyFormValues): Promise<boolean> => {
      if (!companionId) return false;
      const operationKey = key;
      setCreatingFor(operationKey);
      try {
        const input: CreatePatientAllergyInput = {
          patientId: companionId,
          allergen: values.allergen,
          allergyType: values.allergyType,
          severity: values.severity,
          ...(values.reaction.trim() ? { reaction: values.reaction.trim() } : {}),
          ...(values.notes.trim() ? { notes: values.notes.trim() } : {}),
          ...(values.onsetDate ? { onsetDate: toIsoDate(values.onsetDate) } : {}),
        };
        const created = await createPatientAllergy(input);
        if (keyRef.current !== operationKey) return false;
        setState((current) => ({
          ...current,
          allergies: sortAllergies([created, ...current.allergies]),
        }));
        notify('success', {
          title: 'Allergy added',
          text: `${created.allergen} was added to the allergy list.`,
        });
        return true;
      } catch (error) {
        if (keyRef.current === operationKey && !isAuthRedirectError(error)) {
          notify('error', { title: 'Could not add allergy', text: 'Please try again.' });
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

const useResolveAllergy = (
  key: string,
  keyRef: RefObject<string>,
  setState: Dispatch<SetStateAction<RecordsState>>
) => {
  const { notify } = useNotify();
  const [resolving, setResolving] = useState<{ key: string; id: string } | null>(null);
  const resolve = useCallback(
    async (allergy: PatientAllergy): Promise<void> => {
      if (resolving?.key === key) return;
      const operationKey = key;
      setResolving({ key: operationKey, id: allergy.id });
      try {
        const updated = await resolvePatientAllergy(allergy.id);
        if (keyRef.current !== operationKey) return;
        setState((current) => ({
          ...current,
          allergies: current.allergies.map((item) => (item.id === updated.id ? updated : item)),
        }));
        notify('success', {
          title: 'Allergy resolved',
          text: `${updated.allergen} was marked resolved.`,
        });
      } catch (error) {
        if (keyRef.current === operationKey && !isAuthRedirectError(error)) {
          notify('error', { title: 'Could not resolve allergy', text: 'Please try again.' });
        }
      } finally {
        if (keyRef.current === operationKey) setResolving(null);
      }
    },
    [key, keyRef, notify, resolving, setState]
  );
  return { resolve, resolvingId: resolving?.key === key ? resolving.id : null };
};

export type AllergyListState = {
  canView: boolean;
  canEdit: boolean;
  allergies: PatientAllergy[];
  loading: boolean;
  error: string | null;
  creating: boolean;
  resolvingId: string | null;
  create: (values: AllergyFormValues) => Promise<boolean>;
  resolve: (allergy: PatientAllergy) => Promise<void>;
};

export const useAllergyList = (companionId: string): AllergyListState => {
  const permissions = usePermissions();
  const canView = permissions.can(PERMISSIONS.APPOINTMENTS_VIEW_ANY);
  const canEdit = permissions.can(PERMISSIONS.APPOINTMENTS_EDIT_ANY);
  const organisationId = useOrgStore((state) => state.primaryOrgId);
  const key = `${organisationId ?? ''}:${companionId}`;
  const keyRef = useRef(key);
  useLayoutEffect(() => {
    keyRef.current = key;
  }, [key]);
  const { state, setState } = useAllergyRecords(companionId, canView, key);
  const { create, creating } = useCreateAllergy(companionId, key, keyRef, setState);
  const { resolve, resolvingId } = useResolveAllergy(key, keyRef, setState);
  return { canView, canEdit, ...state, creating, resolvingId, create, resolve };
};
