'use client';
import React, { useEffect, useMemo, useState } from 'react';
import Waitlist, {
  type WaitlistCompanionOption,
  type WaitlistEntryView,
} from '@/app/features/appointments/components/Waitlist/Waitlist';
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

const ownerNameOf = (firstName?: string | null, lastName?: string | null): string =>
  [firstName, lastName].filter(Boolean).join(' ').trim();

/**
 * Data container for {@link Waitlist}. Loads the primary org's waitlist, resolves
 * each entry's companion + owner names from the companions store (the entry
 * itself carries only `patientId`), and wires the offer/book/cancel/add actions
 * back through the service. Edit actions are withheld — the panel hides them —
 * when the user lacks appointment edit permission.
 */
const WaitlistPanel = () => {
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
        if (!active) return;
        setEntries(data);
      } catch {
        if (!active) return;
        setEntries([]);
        setError('Unable to load the waitlist right now.');
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
        return {
          ...entry,
          companionName: meta?.name,
          ownerName: meta?.ownerName || undefined,
        };
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
  ) => {
    if (!primaryOrgId) return;
    setBusyEntryId(id);
    try {
      await action(primaryOrgId, id);
      const data = await fetchWaitlist(primaryOrgId);
      setEntries(data);
      setError(null);
    } catch {
      setError('That action could not be completed. Try again.');
    } finally {
      setBusyEntryId(null);
    }
  };

  const handleAdd = async (payload: AddToWaitlistPayload): Promise<boolean> => {
    if (!primaryOrgId) return false;
    try {
      await addToWaitlist(primaryOrgId, payload);
      const data = await fetchWaitlist(primaryOrgId);
      setEntries(data);
      setError(null);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <Waitlist
      entries={entriesView}
      companions={companionOptions}
      loading={loading}
      error={error}
      busyEntryId={busyEntryId}
      onOffer={canEdit ? (id) => void runAction(id, offerWaitlistEntry) : undefined}
      onBook={canEdit ? (id) => void runAction(id, bookWaitlistEntry) : undefined}
      onCancel={canEdit ? (id) => void runAction(id, cancelWaitlistEntry) : undefined}
      onAdd={canEdit ? handleAdd : undefined}
    />
  );
};

export default WaitlistPanel;
