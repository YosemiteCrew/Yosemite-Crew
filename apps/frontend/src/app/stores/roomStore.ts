import { OrganisationRoom } from "@yosemite-crew/types";
import { create } from "zustand";

type RoomStatus = "idle" | "loading" | "loaded" | "error";

type RoomState = {
  roomsById: Record<string, OrganisationRoom>;
  roomIdsByOrgId: Record<string, string[]>;

  status: RoomStatus;
  error: string | null;
  lastFetchedAt: string | null;

  setRooms: (rooms: OrganisationRoom[]) => void;
  setRoomsForOrg: (orgId: string, items: OrganisationRoom[]) => void;
  upsertRoom: (room: OrganisationRoom) => void;

  getRoomsByOrgId: (orgId: string) => OrganisationRoom[];
  removeRoom: (id: string) => void;
  clearRooms: () => void;
  clearRoomsForOrg: (orgId: string) => void;

  startLoading: () => void;
  endLoading: () => void;
  setError: (message: string) => void;
};

export const useOrganisationRoomStore = create<RoomState>()((set, get) => ({
  roomsById: {},
  roomIdsByOrgId: {},
  status: "idle",
  error: null,
  lastFetchedAt: null,

  setRooms: (rooms) =>
    set(() => {
      const roomsById: Record<string, OrganisationRoom> = {};
      const roomIdsByOrgId: Record<string, string[]> = {};
      for (const r of rooms) {
        const id = r.id;
        const orgId = r.organisationId;
        roomsById[id] = { ...r, id };
        if (!roomIdsByOrgId[orgId]) roomIdsByOrgId[orgId] = [];
        roomIdsByOrgId[orgId].push(id);
      }
      return {
        roomsById,
        roomIdsByOrgId,
        status: "loaded",
        error: null,
        lastFetchedAt: new Date().toISOString(),
      };
    }),

  setRoomsForOrg: (orgId, items) =>
    set((state) => {
      const roomsById = { ...state.roomsById };
      const existingIds = state.roomIdsByOrgId[orgId] ?? [];
      for (const id of existingIds) delete roomsById[id];
      const newIds: string[] = [];
      for (const room of items) {
        const id = room.id;
        roomsById[id] = room;
        newIds.push(id);
      }
      return {
        roomsById,
        roomIdsByOrgId: {
          ...state.roomIdsByOrgId,
          [orgId]: newIds,
        },
        status: "loaded",
        error: null,
        lastFetchedAt: new Date().toISOString(),
      };
    }),

  upsertRoom: (room) =>
    set((state) => {
      const id = room.id;
      const orgId = room.organisationId;
      if (!id) {
        console.warn("upsertRoom: missing id:", room);
        return state;
      }
      if (!orgId) {
        console.warn("upsertRoom: missing organisationId:", room);
        return state;
      }
      const roomsById = {
        ...state.roomsById,
        [id]: {
          ...(state.roomsById[id] ?? ({} as OrganisationRoom)),
          ...room,
          id,
        },
      };
      const existingIds = state.roomIdsByOrgId[orgId] ?? [];
      const roomIdsByOrgId = {
        ...state.roomIdsByOrgId,
        [orgId]: existingIds.includes(id) ? existingIds : [...existingIds, id],
      };
      return {
        roomsById,
        roomIdsByOrgId,
        status: "loaded",
        error: null,
        lastFetchedAt: new Date().toISOString(),
      };
    }),

  getRoomsByOrgId: (orgId) => {
    const { roomsById, roomIdsByOrgId } = get();
    const ids = roomIdsByOrgId[orgId] ?? [];
    return ids
      .map((id) => roomsById[id])
      .filter((r): r is OrganisationRoom => r != null);
  },

  removeRoom: (id) =>
    set((state) => {
      const { [id]: _, ...restRoomsById } = state.roomsById;
      const roomIdsByOrgId: Record<string, string[]> = {};
      for (const [orgId, ids] of Object.entries(state.roomIdsByOrgId)) {
        roomIdsByOrgId[orgId] = ids.filter((roomId) => roomId !== id);
      }
      return {
        roomsById: restRoomsById,
        roomIdsByOrgId,
      };
    }),

  clearRoomsForOrg: (orgId: string) =>
    set((state) => {
      const ids = state.roomIdsByOrgId[orgId] ?? [];
      if (!ids.length) {
        const { [orgId]: _, ...restIdx } = state.roomIdsByOrgId;
        return { roomIdsByOrgId: restIdx };
      }
      const roomsById = { ...state.roomsById };
      for (const id of ids) delete roomsById[id];
      const { [orgId]: _, ...restIdx } = state.roomIdsByOrgId;
      return {
        roomsById,
        roomIdsByOrgId: restIdx,
        status: "loaded",
        error: null,
        lastFetchedAt: new Date().toISOString(),
      };
    }),

  clearRooms: () =>
    set(() => ({
      roomsById: {},
      roomIdsByOrgId: {},
      status: "idle",
      error: null,
      lastFetchedAt: null,
    })),

  startLoading: () =>
    set(() => ({
      status: "loading",
      error: null,
    })),

  endLoading: () =>
    set(() => ({
      status: "loaded",
      error: null,
    })),

  setError: (message) =>
    set(() => ({
      status: "error",
      error: message,
    })),
}));
