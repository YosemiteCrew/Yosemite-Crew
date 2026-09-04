'use client';
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import {
  assignCheckInRoom,
  cancelCheckIn,
  completeCheckIn,
  createCheckIn,
  fetchCheckIns,
  markCheckInNoShow,
  markCheckInSeen,
  type CreateCheckInPayload,
  type PatientCheckIn,
} from '@/app/features/appointments/services/patientCheckInService';
import {
  useCompanionsParentsForPrimaryOrg,
  useLoadCompanionsForPrimaryOrg,
} from '@/app/hooks/useCompanion';
import { useLoadRoomsForPrimaryOrg, useRoomsForPrimaryOrg } from '@/app/hooks/useRooms';
import { useOrgStore } from '@/app/stores/orgStore';
import { usePermissions } from '@/app/hooks/usePermissions';
import { PERMISSIONS } from '@/app/lib/permissions';
import type {
  CheckInCompanionOption,
  CheckInRoomOption,
  PatientCheckInView,
} from '@/app/features/appointments/components/CheckInBoard/CheckInBoard';

const ownerNameOf = (firstName?: string | null, lastName?: string | null): string =>
  [firstName, lastName].filter(Boolean).join(' ').trim();

const isActive = (checkIn: PatientCheckIn): boolean =>
  checkIn.status === 'WAITING' || checkIn.status === 'IN_CONSULTATION';

export interface CheckInBoardState {
  canEdit: boolean;
  entriesView: PatientCheckInView[];
  companionOptions: CheckInCompanionOption[];
  roomOptions: CheckInRoomOption[];
  loading: boolean;
  error: string | null;
  busyEntryId: string | null;
  showAll: boolean;
  setShowAll: (next: boolean) => void;
  seen: (id: string) => Promise<void>;
  complete: (id: string) => Promise<void>;
  cancel: (id: string) => Promise<void>;
  noShow: (id: string) => Promise<void>;
  assignRoom: (id: string, roomId: string) => Promise<void>;
  add: (payload: CreateCheckInPayload) => Promise<boolean>;
}

type CheckInData = {
  checkIns: PatientCheckIn[];
  setCheckIns: Dispatch<SetStateAction<PatientCheckIn[]>>;
  loading: boolean;
  error: string | null;
  setError: Dispatch<SetStateAction<string | null>>;
};

const useCheckInData = (organisationId: string | null): CheckInData => {
  const [checkIns, setCheckIns] = useState<PatientCheckIn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!organisationId) {
        setCheckIns([]);
        setError(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const data = await fetchCheckIns(organisationId);
        if (active) setCheckIns(data);
      } catch {
        if (active) {
          setCheckIns([]);
          setError('Unable to load the check-in board right now.');
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

  return { checkIns, setCheckIns, loading, error, setError };
};

const useCheckInActions = (
  organisationId: string | null,
  setCheckIns: CheckInData['setCheckIns'],
  setError: CheckInData['setError']
) => {
  const [busyEntryId, setBusyEntryId] = useState<string | null>(null);
  const runAction = async (
    id: string,
    run: (orgId: string) => Promise<PatientCheckIn>
  ): Promise<void> => {
    if (!organisationId) return;
    setBusyEntryId(id);
    try {
      await run(organisationId);
      setCheckIns(await fetchCheckIns(organisationId));
      setError(null);
    } catch {
      setError('That action could not be completed. Try again.');
    } finally {
      setBusyEntryId(null);
    }
  };
  const add = async (payload: CreateCheckInPayload): Promise<boolean> => {
    if (!organisationId) return false;
    try {
      await createCheckIn(organisationId, payload);
      setCheckIns(await fetchCheckIns(organisationId));
      setError(null);
      return true;
    } catch {
      return false;
    }
  };
  return {
    busyEntryId,
    seen: (id: string) => runAction(id, (orgId) => markCheckInSeen(orgId, id)),
    complete: (id: string) => runAction(id, (orgId) => completeCheckIn(orgId, id)),
    cancel: (id: string) => runAction(id, (orgId) => cancelCheckIn(orgId, id)),
    noShow: (id: string) => runAction(id, (orgId) => markCheckInNoShow(orgId, id)),
    assignRoom: (id: string, roomId: string) =>
      runAction(id, (orgId) => assignCheckInRoom(orgId, id, roomId)),
    add,
  };
};

/**
 * All of the check-in board container's state: it loads the primary org's
 * check-ins, resolves each row's companion/owner names and assigned-room name,
 * and exposes the seen/complete/cancel/no-show/assign-room/add actions. The
 * board defaults to active check-ins (WAITING + IN_CONSULTATION); `showAll`
 * reveals the terminal statuses too.
 */
export const useCheckInBoard = (): CheckInBoardState => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const permissions = usePermissions();
  const canEdit =
    permissions.can(PERMISSIONS.APPOINTMENTS_EDIT_ANY) ||
    permissions.can(PERMISSIONS.APPOINTMENTS_EDIT_OWN);

  useLoadCompanionsForPrimaryOrg();
  const companionsParents = useCompanionsParentsForPrimaryOrg();
  useLoadRoomsForPrimaryOrg();
  const rooms = useRoomsForPrimaryOrg();

  const { checkIns, setCheckIns, loading, error, setError } = useCheckInData(primaryOrgId);
  const actions = useCheckInActions(primaryOrgId, setCheckIns, setError);
  const [showAll, setShowAll] = useState(false);

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

  const roomNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const room of rooms) map.set(room.id, room.name);
    return map;
  }, [rooms]);

  const entriesView = useMemo<PatientCheckInView[]>(() => {
    const visible = showAll ? checkIns : checkIns.filter(isActive);
    return visible.map((entry) => {
      const meta = companionMetaById.get(entry.patientId);
      return {
        ...entry,
        companionName: meta?.name,
        ownerName: meta?.ownerName || undefined,
        roomName: entry.assignedRoomId ? roomNameById.get(entry.assignedRoomId) : undefined,
      };
    });
  }, [checkIns, showAll, companionMetaById, roomNameById]);

  const companionOptions = useMemo<CheckInCompanionOption[]>(
    () =>
      companionsParents.map(({ companion, parent }) => ({
        id: companion.id,
        name: companion.name,
        ownerName: ownerNameOf(parent.firstName, parent.lastName) || undefined,
        clientId: parent.id || undefined,
      })),
    [companionsParents]
  );

  const roomOptions = useMemo<CheckInRoomOption[]>(
    () => rooms.map((room) => ({ id: room.id, name: room.name })),
    [rooms]
  );

  return {
    canEdit,
    entriesView,
    companionOptions,
    roomOptions,
    loading,
    error,
    showAll,
    setShowAll,
    ...actions,
  };
};
