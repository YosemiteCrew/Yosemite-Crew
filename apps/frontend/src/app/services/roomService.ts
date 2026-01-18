import {
  fromOrganisationRoomRequestDTO,
  OrganisationRoom,
  OrganisationRoomResponseDTO,
  toOrganisationRoomResponseDTO,
} from "@yosemite-crew/types";
import { useOrgStore } from "../stores/orgStore";
import { useOrganisationRoomStore } from "../stores/roomStore";
import { deleteData, getData, postData, putData } from "./axios";

export const loadRoomsForOrgPrimaryOrg = async (opts?: {
  silent?: boolean;
  force?: boolean;
}): Promise<void> => {
  const { startLoading, status, setRoomsForOrg } =
    useOrganisationRoomStore.getState();
  const primaryOrgId = useOrgStore.getState().primaryOrgId;
  if (!primaryOrgId) {
    console.warn("No primary organization selected. Cannot load specialities.");
    return;
  }
  if (!shouldFetchRooms(status, opts)) return;
  if (!opts?.silent) startLoading();
  try {
    const res = await getData<OrganisationRoomResponseDTO[]>(
      "/fhir/v1/organisation-room/organization/" + primaryOrgId
    );
    const rooms = res.data.map((fhirRoom) =>
      fromOrganisationRoomRequestDTO(fhirRoom)
    );
    setRoomsForOrg(primaryOrgId, rooms);
  } catch (err) {
    console.error("Failed to load specialities:", err);
    throw err;
  }
};

const shouldFetchRooms = (
  status: ReturnType<typeof useOrganisationRoomStore.getState>["status"],
  opts?: { force?: boolean }
) => {
  if (opts?.force) return true;
  return status === "idle" || status === "error";
};

export const createRoom = async (room: OrganisationRoom) => {
  const { upsertRoom } = useOrganisationRoomStore.getState();
  const { primaryOrgId } = useOrgStore.getState();
  if (!primaryOrgId) {
    console.warn("No primary organization selected. Cannot load companions.");
    return;
  }
  try {
    const payload: OrganisationRoom = {
      ...room,
      organisationId: primaryOrgId
    };
    const fhirRoom = toOrganisationRoomResponseDTO(payload);
    const res = await postData<OrganisationRoomResponseDTO>(
      "/fhir/v1/organisation-room",
      fhirRoom
    );
    const normalRoom = fromOrganisationRoomRequestDTO(res.data);
    upsertRoom(normalRoom);
  } catch (err) {
    console.error("Failed to create service:", err);
    throw err;
  }
};

export const updateRoom = async (payload: OrganisationRoom) => {
  const { upsertRoom } = useOrganisationRoomStore.getState();
  const { primaryOrgId } = useOrgStore.getState();
  if (!primaryOrgId) {
    console.warn("No primary organization selected. Cannot load companions.");
    return;
  }
  try {
    const fhirRoom = toOrganisationRoomResponseDTO(payload);
    const res = await putData<OrganisationRoomResponseDTO>(
      "/fhir/v1/organisation-room/" + payload.id,
      fhirRoom
    );
    const normalRoom = fromOrganisationRoomRequestDTO(res.data);
    upsertRoom(normalRoom);
  } catch (err) {
    console.error("Failed to create service:", err);
    throw err;
  }
};

export const deleteRoom = async (room: OrganisationRoom) => {
  const { removeRoom } = useOrganisationRoomStore.getState();
  try {
    const id = room.id;
    if (!id) {
      throw new Error("Room ID is missing.");
    }
    await deleteData("/fhir/v1/organisation-room/" + id);
    removeRoom(id);
  } catch (err) {
    console.error("Failed to delete room:", err);
    throw err;
  }
};