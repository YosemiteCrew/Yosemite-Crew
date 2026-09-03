'use client';
import { useEffect, useMemo, useState } from 'react';
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

  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyEntryId, setBusyEntryId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!primaryOrgId) {
        setEntries([]);
        setError(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const data = await fetchWaitlist(primaryOrgId);
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
  }, [primaryOrgId]);

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

  const runAction = async (
    id: string,
    action: (organisationId: string, entryId: string) => Promise<WaitlistEntry>
  ): Promise<void> => {
    if (!primaryOrgId) return;
    setBusyEntryId(id);
    try {
      await action(primaryOrgId, id);
      setEntries(await fetchWaitlist(primaryOrgId));
      setError(null);
    } catch {
      setError('That action could not be completed. Try again.');
    } finally {
      setBusyEntryId(null);
    }
  };

  const add = async (payload: AddToWaitlistPayload): Promise<boolean> => {
    if (!primaryOrgId) return false;
    try {
      await addToWaitlist(primaryOrgId, payload);
      setEntries(await fetchWaitlist(primaryOrgId));
      setError(null);
      return true;
    } catch {
      return false;
    }
  };

  return {
    canEdit,
    entriesView,
    companionOptions,
    loading,
    error,
    busyEntryId,
    offer: (id) => runAction(id, offerWaitlistEntry),
    book: (id) => runAction(id, bookWaitlistEntry),
    cancel: (id) => runAction(id, cancelWaitlistEntry),
    add,
  };
};
