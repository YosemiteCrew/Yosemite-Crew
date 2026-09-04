'use client';

import { useCallback, useEffect, useState } from 'react';
import { isAuthRedirectError } from '@/app/services/axios';
import { usePermissions } from '@/app/hooks/usePermissions';
import { PERMISSIONS } from '@/app/lib/permissions';
import { useNotify } from '@/app/hooks/useNotify';
import FlagList, { type FlagFormValues } from './FlagList';
import {
  createPatientFlag,
  fetchPatientFlags,
  resolvePatientFlag,
  type CreatePatientFlagInput,
  type PatientFlag,
} from '@/app/features/companionHistory/services/patientFlagService';

export type FlagListPanelProps = {
  companionId: string;
};

const LOAD_ERROR = 'Could not load patient flags. Please try again.';

const FlagListPanel = ({ companionId }: FlagListPanelProps) => {
  const permissions = usePermissions();
  const canView = permissions.can(PERMISSIONS.COMPANIONS_VIEW_ANY);
  const canEdit = permissions.can(PERMISSIONS.COMPANIONS_EDIT_ANY);
  const { notify } = useNotify();
  const [flags, setFlags] = useState<PatientFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

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

  const handleCreate = useCallback(
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
        const refreshed = await fetchPatientFlags({ patientId: companionId, isActive: true });
        setFlags(refreshed);
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
    [companionId, notify]
  );

  const handleResolve = useCallback(
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
    [notify]
  );

  if (!canView) return null;

  return (
    <FlagList
      flags={flags}
      loading={loading}
      error={error}
      canEdit={canEdit}
      onCreate={handleCreate}
      onResolve={handleResolve}
      creating={creating}
      resolvingId={resolvingId}
    />
  );
};

export default FlagListPanel;
