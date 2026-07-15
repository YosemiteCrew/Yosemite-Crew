import { useEffect, useMemo } from 'react';
import { useOrgStore } from '@/app/stores/orgStore';
import { loadRoomsForOrgPrimaryOrg } from '@/app/features/organization/services/roomService';
import { OrganisationRoom } from '@yosemite-crew/types';
import { useOrganisationRoomStore } from '@/app/stores/roomStore';

type LoadRoomsHookOptions = {
  force?: boolean;
  silent?: boolean;
};

export const useLoadRoomsForPrimaryOrg = (opts?: LoadRoomsHookOptions) => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);

  useEffect(() => {
    if (!primaryOrgId) return;
    const state = useOrganisationRoomStore.getState();
    if (state.status === 'loading') return;
    if (!opts?.force && Object.hasOwn(state.roomIdsByOrgId ?? {}, primaryOrgId)) return;
    loadRoomsForOrgPrimaryOrg({ force: opts?.force, silent: opts?.silent }).catch(() => undefined);
  }, [opts?.force, opts?.silent, primaryOrgId]);
};

export const useRoomsForPrimaryOrg = (): OrganisationRoom[] => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const roomsById = useOrganisationRoomStore((s) => s.roomsById);

  const roomIdsByOrgId = useOrganisationRoomStore((s) => s.roomIdsByOrgId);

  return useMemo(() => {
    if (!primaryOrgId) return [];
    const ids = roomIdsByOrgId[primaryOrgId] ?? [];
    return ids.map((id) => roomsById[id]).filter(Boolean);
  }, [primaryOrgId, roomsById, roomIdsByOrgId]);
};
