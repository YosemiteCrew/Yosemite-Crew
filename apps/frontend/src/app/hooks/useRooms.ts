import { useEffect, useMemo } from "react";
import { useOrgStore } from "../stores/orgStore";
import { loadRoomsForOrgPrimaryOrg } from "../services/roomService";
import { OrganisationRoom } from "@yosemite-crew/types";
import { useOrganisationRoomStore } from "../stores/roomStore";

export const useLoadRoomsForPrimaryOrg = () => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);

  useEffect(() => {
    if (!primaryOrgId) return;
    void loadRoomsForOrgPrimaryOrg({ force: true });
  }, [primaryOrgId]);
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
