'use client';
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import {
  addToWaitlist,
  bookWaitlistEntry,
  cancelWaitlistEntry,
  fetchWaitlist,
  offerWaitlistEntry,
  type AddToWaitlistPayload,
  type WaitlistEntry,
} from '@/app/features/appointments/services/waitlistService';
import {
  useCompanionsParentsForPrimaryOrg,
  useLoadCompanionsForPrimaryOrg,
} from '@/app/hooks/useCompanion';
import { useOrgStore } from '@/app/stores/orgStore';
import { usePermissions } from '@/app/hooks/usePermissions';
import { PERMISSIONS } from '@/app/lib/permissions';
import type {
  WaitlistCompanionOption,
  WaitlistEntryView,
} from '@/app/features/appointments/components/Waitlist/Waitlist';

const ownerNameOf = (firstName?: string | null, lastName?: string | null): string =>
  [firstName, lastName].filter(Boolean).join(' ').trim();

export interface WaitlistState {
  canEdit: boolean;
  entriesView: WaitlistEntryView[];
  companionOptions: WaitlistCompanionOption[];
  loading: boolean;
  error: string | null;
  busyEntryId: string | null;
  offer: (id: string) => Promise<void>;
  book: (id: string) => Promise<void>;
  cancel: (id: string) => Promise<void>;
  add: (payload: AddToWaitlistPayload) => Promise<boolean>;
}

type WaitlistData = {
  entries: WaitlistEntry[];
  setEntries: Dispatch<SetStateAction<WaitlistEntry[]>>;
  loading: boolean;
  error: string | null;
  setError: Dispatch<SetStateAction<string | null>>;
};

const useWaitlistData = (organisationId: string | null): WaitlistData => {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!organisationId) {
        setEntries([]);
        setError(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const data = await fetchWaitlist(organisationId);
        if (active) setEntries(data);
      } catch {
        if (active) {
          setEntries([]);
          setError('Unable to load the waitlist right now.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [organisationId]);

  return { entries, setEntries, loading, error, setError };
};

const useWaitlistActions = (
  organisationId: string | null,
  setEntries: WaitlistData['setEntries'],
  setError: WaitlistData['setError']
) => {
  const [busyEntryId, setBusyEntryId] = useState<string | null>(null);
  const runAction = async (
    id: string,
    action: (orgId: string, entryId: string) => Promise<WaitlistEntry>
  ): Promise<void> => {
    if (!organisationId) return;
    setBusyEntryId(id);
    try {
      await action(organisationId, id);
      setEntries(await fetchWaitlist(organisationId));
      setError(null);
    } catch {
      setError('That action could not be completed. Try again.');
    } finally {
      setBusyEntryId(null);
    }
  };
  const add = async (payload: AddToWaitlistPayload): Promise<boolean> => {
    if (!organisationId) return false;
    try {
      await addToWaitlist(organisationId, payload);
      setEntries(await fetchWaitlist(organisationId));
      setError(null);
      return true;
    } catch {
      return false;
    }
  };
  return {
    busyEntryId,
    offer: (id: string) => runAction(id, offerWaitlistEntry),
    book: (id: string) => runAction(id, bookWaitlistEntry),
    cancel: (id: string) => runAction(id, cancelWaitlistEntry),
    add,
  };
};

/**
 * All of the waitlist container's state: it loads the primary org's waitlist,
 * resolves each entry's companion + owner names from the companions store (the
 * entry itself carries only `patientId`), and exposes the offer/book/cancel/add
 * actions. Kept out of the component so the container is a thin projection.
 */
export const useWaitlist = (): WaitlistState => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const permissions = usePermissions();
  const canEdit =
    permissions.can(PERMISSIONS.APPOINTMENTS_EDIT_ANY) ||
    permissions.can(PERMISSIONS.APPOINTMENTS_EDIT_OWN);

  useLoadCompanionsForPrimaryOrg();
  const companionsParents = useCompanionsParentsForPrimaryOrg();
  const { entries, setEntries, loading, error, setError } = useWaitlistData(primaryOrgId);
  const actions = useWaitlistActions(primaryOrgId, setEntries, setError);

  const companionMetaById = useMemo(() => {
    const map = new Map<string, { name: string; ownerName: string }>();
    for (const { companion, parent } of companionsParents) {
      map.set(companion.id, {
        name: companion.name,
        ownerName: ownerNameOf(parent.firstName, parent.lastName),
      });
    }
    return map;
  }, [companionsParents]);

  const entriesView = useMemo<WaitlistEntryView[]>(
    () =>
      entries.map((entry) => {
        const meta = companionMetaById.get(entry.patientId);
        return { ...entry, companionName: meta?.name, ownerName: meta?.ownerName || undefined };
      }),
    [entries, companionMetaById]
  );

  const companionOptions = useMemo<WaitlistCompanionOption[]>(
    () =>
      companionsParents.map(({ companion, parent }) => ({
        id: companion.id,
        name: companion.name,
        ownerName: ownerNameOf(parent.firstName, parent.lastName) || undefined,
      })),
    [companionsParents]
  );

  return {
    canEdit,
    entriesView,
    companionOptions,
    loading,
    error,
    ...actions,
  };
};
