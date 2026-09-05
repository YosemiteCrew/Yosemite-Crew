'use client';

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { isAuthRedirectError } from '@/app/services/axios';
import { usePermissions } from '@/app/hooks/usePermissions';
import { PERMISSIONS } from '@/app/lib/permissions';
import { useNotify } from '@/app/hooks/useNotify';
import type { FlagFormValues } from '@/app/features/companionHistory/components/FlagList';
import {
  createPatientFlag,
  fetchPatientFlags,
  resolvePatientFlag,
  type CreatePatientFlagInput,
  type PatientFlag,
} from '@/app/features/companionHistory/services/patientFlagService';

const LOAD_ERROR = 'Could not load patient flags. Please try again.';

type SetFlags = Dispatch<SetStateAction<PatientFlag[]>>;
type SetError = Dispatch<SetStateAction<string | null>>;

/** Loads a companion's active flags and resets to a loading state when the companion changes. */
const useFlagRecords = (companionId: string, canView: boolean) => {
  const [flags, setFlags] = useState<PatientFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reset during render (React's recommended pattern) rather than in an effect;
  // `loadedFor` tracks which companion the current state belongs to.
  const [loadedFor, setLoadedFor] = useState(companionId);
  if (companionId !== loadedFor) {
    setLoadedFor(companionId);
    setFlags([]);
    setError(null);
    setLoading(true);
  }

  useEffect(() => {
    if (!canView || !companionId) return;
    let active = true;
    fetchPatientFlags({ patientId: companionId, isActive: true })
      .then((nextFlags) => {
        if (active) setFlags(nextFlags);
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

  return { flags, loading, error, setFlags, setError };
};

/** The create action and its in-flight flag; refreshes the list from the server on success. */
const useCreateFlag = (companionId: string, setFlags: SetFlags, setError: SetError) => {
  const { notify } = useNotify();
  const [creating, setCreating] = useState(false);
  const create = useCallback(
    async (values: FlagFormValues): Promise<boolean> => {
      if (!companionId) return false;
      setCreating(true);
      try {
        const input: CreatePatientFlagInput = {
          patientId: companionId,
          title: values.title,
          flagType: values.flagType,
          severity: values.severity,
          ...(values.description.trim() ? { description: values.description.trim() } : {}),
        };
        await createPatientFlag(input);
        setFlags(await fetchPatientFlags({ patientId: companionId, isActive: true }));
        setError(null);
        notify('success', {
          title: 'Flag added',
          text: `${values.title} was added to the patient flags.`,
        });
        return true;
      } catch (requestError) {
        if (!isAuthRedirectError(requestError)) {
          notify('error', { title: 'Could not add flag', text: 'Please try again.' });
        }
        return false;
      } finally {
        setCreating(false);
      }
    },
    [companionId, notify, setError, setFlags]
  );
  return { create, creating };
};

/** The resolve action and the id it is resolving; drops the flag from the active list on success. */
const useResolveFlag = (setFlags: SetFlags) => {
  const { notify } = useNotify();
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const resolve = useCallback(
    async (flag: PatientFlag): Promise<void> => {
      setResolvingId(flag.id);
      try {
        await resolvePatientFlag(flag.id);
        setFlags((current) => current.filter((item) => item.id !== flag.id));
        notify('success', {
          title: 'Flag resolved',
          text: `${flag.title} was removed from the active flags.`,
        });
      } catch (requestError) {
        if (!isAuthRedirectError(requestError)) {
          notify('error', { title: 'Could not resolve flag', text: 'Please try again.' });
        }
      } finally {
        setResolvingId(null);
      }
    },
    [notify, setFlags]
  );
  return { resolve, resolvingId };
};

export type PatientFlagsState = {
  /** The backend gates the list on `companions:view:any`. */
  canView: boolean;
  /** Create and resolve need `companions:edit:any`. */
  canEdit: boolean;
  flags: PatientFlag[];
  loading: boolean;
  error: string | null;
  creating: boolean;
  resolvingId: string | null;
  create: (values: FlagFormValues) => Promise<boolean>;
  resolve: (flag: PatientFlag) => Promise<void>;
};

/**
 * Composes the flag panel's state from three focused sub-hooks - records,
 * create and resolve - so no single function owns loading, mutation and
 * notification at once. The panel is a thin projection over what this returns.
 */
export const usePatientFlags = (companionId: string): PatientFlagsState => {
  const permissions = usePermissions();
  const canView = permissions.can(PERMISSIONS.COMPANIONS_VIEW_ANY);
  const canEdit = permissions.can(PERMISSIONS.COMPANIONS_EDIT_ANY);

  const { flags, loading, error, setFlags, setError } = useFlagRecords(companionId, canView);
  const { create, creating } = useCreateFlag(companionId, setFlags, setError);
  const { resolve, resolvingId } = useResolveFlag(setFlags);

  return { canView, canEdit, flags, loading, error, creating, resolvingId, create, resolve };
};
