import { useEffect, useMemo } from 'react';
import { useOrgStore } from '@/app/stores/orgStore';
import { loadRoomsForOrgPrimaryOrg } from '@/app/features/organization/services/roomService';
import { OrganisationRoom } from '@yosemite-crew/types';
import { useOrganisationRoomStore } from '@/app/stores/roomStore';

export const useLoadRoomsForPrimaryOrg = () => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const roomIdsByOrgId = useOrganisationRoomStore((s) => s.roomIdsByOrgId);

  useEffect(() => {
    if (!primaryOrgId) return;
    if (useOrganisationRoomStore.getState().status === 'loading') return;
    if (Object.hasOwn(roomIdsByOrgId, primaryOrgId)) return;
    void loadRoomsForOrgPrimaryOrg();
  }, [primaryOrgId, roomIdsByOrgId]);
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
