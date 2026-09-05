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

type FlagSetter = Dispatch<SetStateAction<PatientFlag[]>>;

const useActivePatientFlags = (companionId: string, canView: boolean) => {
  const [flags, setFlags] = useState<PatientFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  return { flags, setFlags, loading, error, setError };
};

const useCreateFlag = (
  companionId: string,
  setFlags: FlagSetter,
  setError: Dispatch<SetStateAction<string | null>>
) => {
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
  return { creating, create };
};

const useResolveFlag = (setFlags: FlagSetter) => {
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
  return { resolvingId, resolve };
};

/**
 * All of the flag panel's state: it loads a companion's active flags, exposes
 * the create and resolve actions, and reports the caller's permissions. Kept out
 * of the component so the panel is a thin projection onto the presentational
 * list.
 */
export const usePatientFlags = (companionId: string): PatientFlagsState => {
  const permissions = usePermissions();
  const canView = permissions.can(PERMISSIONS.COMPANIONS_VIEW_ANY);
  const canEdit = permissions.can(PERMISSIONS.COMPANIONS_EDIT_ANY);
  const { flags, setFlags, loading, error, setError } = useActivePatientFlags(companionId, canView);
  const { creating, create } = useCreateFlag(companionId, setFlags, setError);
  const { resolvingId, resolve } = useResolveFlag(setFlags);

  return { canView, canEdit, flags, loading, error, creating, resolvingId, create, resolve };
};
