import { OrganisationRoom, RoomUnit, RoomUnitGroup } from '@yosemite-crew/types';
import { create } from 'zustand';

type RoomStatus = 'idle' | 'loading' | 'loaded' | 'error';

type RoomState = {
  roomsById: Record<string, OrganisationRoom>;
  roomIdsByOrgId: Record<string, string[]>;
  roomUnitGroupsById: Record<string, RoomUnitGroup>;
  roomUnitGroupIdsByRoomId: Record<string, string[]>;
  roomUnitsById: Record<string, RoomUnit>;
  roomUnitIdsByRoomId: Record<string, string[]>;
  roomUnitIdsByGroupId: Record<string, string[]>;

  status: RoomStatus;
  error: string | null;
  lastFetchedAt: string | null;

  setRooms: (rooms: OrganisationRoom[]) => void;
  setRoomsForOrg: (orgId: string, items: OrganisationRoom[]) => void;
  upsertRoom: (room: OrganisationRoom) => void;
  setRoomUnitGroupsForOrg: (orgId: string, items: RoomUnitGroup[]) => void;
  setRoomUnitsForOrg: (orgId: string, items: RoomUnit[]) => void;
  setRoomUnitGroupsForRoom: (roomId: string, items: RoomUnitGroup[]) => void;
  setRoomUnitsForRoom: (roomId: string, items: RoomUnit[]) => void;
  upsertRoomUnitGroup: (unitGroup: RoomUnitGroup) => void;
  upsertRoomUnit: (unit: RoomUnit) => void;
  setRoomUnitOccupied: (unitId: string | undefined, isOccupied: boolean) => void;

  getRoomsByOrgId: (orgId: string) => OrganisationRoom[];
  getRoomUnitGroupsByRoomId: (roomId: string) => RoomUnitGroup[];
  getRoomUnitsByRoomId: (roomId: string) => RoomUnit[];
  getRoomUnitsByGroupId: (groupId: string) => RoomUnit[];
  removeRoom: (id: string) => void;
  removeRoomUnitGroup: (id: string) => void;
  removeRoomUnit: (id: string) => void;
  clearRooms: () => void;
  clearRoomsForOrg: (orgId: string) => void;

  startLoading: () => void;
  endLoading: () => void;
  setError: (message: string) => void;
};

const pruneIdsForOrg = (
  index: Record<string, string[]>,
  roomUnitsById: Record<string, RoomUnit>,
  orgId: string
) => {
  for (const [key, ids] of Object.entries(index)) {
    const retained = ids.filter((id) => roomUnitsById[id]?.organisationId !== orgId);
    if (retained.length) index[key] = retained;
    else delete index[key];
  }
};

const appendUnitId = (index: Record<string, string[]>, key: string, unitId: string) => {
  const ids = index[key] ?? [];
  index[key] = ids.includes(unitId) ? ids : [...ids, unitId];
};

const syncRoomUnitsForOrg = (
  state: Pick<RoomState, 'roomUnitsById' | 'roomUnitIdsByRoomId' | 'roomUnitIdsByGroupId'>,
  orgId: string,
  items: RoomUnit[]
) => {
  const roomUnitsById = { ...state.roomUnitsById };
  const roomUnitIdsByRoomId = { ...state.roomUnitIdsByRoomId };
  const roomUnitIdsByGroupId = { ...state.roomUnitIdsByGroupId };
  pruneIdsForOrg(roomUnitIdsByRoomId, roomUnitsById, orgId);
  pruneIdsForOrg(roomUnitIdsByGroupId, roomUnitsById, orgId);
  for (const [id, unit] of Object.entries(roomUnitsById)) {
    if (unit.organisationId === orgId) delete roomUnitsById[id];
  }
  for (const unit of items) {
    roomUnitsById[unit.id] = unit;
    appendUnitId(roomUnitIdsByRoomId, unit.roomId, unit.id);
    if (unit.unitGroupId) {
      appendUnitId(roomUnitIdsByGroupId, unit.unitGroupId, unit.id);
    }
  }
  return { roomUnitsById, roomUnitIdsByRoomId, roomUnitIdsByGroupId };
};

export const useOrganisationRoomStore = create<RoomState>()((set, get) => ({
  roomsById: {},
  roomIdsByOrgId: {},
  roomUnitGroupsById: {},
  roomUnitGroupIdsByRoomId: {},
  roomUnitsById: {},
  roomUnitIdsByRoomId: {},
  roomUnitIdsByGroupId: {},
  status: 'idle',
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
        status: 'loaded',
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
        status: 'loaded',
        error: null,
        lastFetchedAt: new Date().toISOString(),
      };
    }),

  upsertRoom: (room) =>
    set((state) => {
      const id = room.id;
      const orgId = room.organisationId;
      if (!id) {
        console.warn('upsertRoom: missing id:', room);
        return state;
      }
      if (!orgId) {
        console.warn('upsertRoom: missing organisationId:', room);
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
        status: 'loaded',
        error: null,
        lastFetchedAt: new Date().toISOString(),
      };
    }),

  setRoomUnitGroupsForOrg: (orgId, items) =>
    set((state) => {
      const roomUnitGroupsById = { ...state.roomUnitGroupsById };
      const roomUnitGroupIdsByRoomId = { ...state.roomUnitGroupIdsByRoomId };
      for (const [roomId, ids] of Object.entries(roomUnitGroupIdsByRoomId)) {
        const retained = ids.filter((id) => roomUnitGroupsById[id]?.organisationId !== orgId);
        if (retained.length) roomUnitGroupIdsByRoomId[roomId] = retained;
        else delete roomUnitGroupIdsByRoomId[roomId];
      }
      for (const [id, group] of Object.entries(roomUnitGroupsById)) {
        if (group.organisationId === orgId) delete roomUnitGroupsById[id];
      }
      for (const group of items) {
        roomUnitGroupsById[group.id] = group;
        const ids = roomUnitGroupIdsByRoomId[group.roomId] ?? [];
        roomUnitGroupIdsByRoomId[group.roomId] = ids.includes(group.id) ? ids : [...ids, group.id];
      }
      return { roomUnitGroupsById, roomUnitGroupIdsByRoomId };
    }),

  setRoomUnitsForOrg: (orgId, items) => set((state) => syncRoomUnitsForOrg(state, orgId, items)),

  setRoomUnitGroupsForRoom: (roomId, items) =>
    set((state) => {
      const roomUnitGroupsById = { ...state.roomUnitGroupsById };
      for (const id of state.roomUnitGroupIdsByRoomId[roomId] ?? []) {
        delete roomUnitGroupsById[id];
      }
      for (const group of items) roomUnitGroupsById[group.id] = group;
      return {
        roomUnitGroupsById,
        roomUnitGroupIdsByRoomId: {
          ...state.roomUnitGroupIdsByRoomId,
          [roomId]: items.map((group) => group.id),
        },
      };
    }),

  setRoomUnitsForRoom: (roomId, items) =>
    set((state) => {
      const roomUnitsById = { ...state.roomUnitsById };
      const roomUnitIdsByGroupId = { ...state.roomUnitIdsByGroupId };
      for (const id of state.roomUnitIdsByRoomId[roomId] ?? []) {
        const unit = roomUnitsById[id];
        if (unit?.unitGroupId) {
          roomUnitIdsByGroupId[unit.unitGroupId] =
            roomUnitIdsByGroupId[unit.unitGroupId]?.filter((unitId) => unitId !== id) ?? [];
        }
        delete roomUnitsById[id];
      }
      for (const unit of items) {
        roomUnitsById[unit.id] = unit;
        if (unit.unitGroupId) {
          const ids = roomUnitIdsByGroupId[unit.unitGroupId] ?? [];
          roomUnitIdsByGroupId[unit.unitGroupId] = ids.includes(unit.id) ? ids : [...ids, unit.id];
        }
      }
      return {
        roomUnitsById,
        roomUnitIdsByGroupId,
        roomUnitIdsByRoomId: {
          ...state.roomUnitIdsByRoomId,
          [roomId]: items.map((unit) => unit.id),
        },
      };
    }),

  upsertRoomUnitGroup: (unitGroup) =>
    set((state) => {
      const ids = state.roomUnitGroupIdsByRoomId[unitGroup.roomId] ?? [];
      return {
        roomUnitGroupsById: {
          ...state.roomUnitGroupsById,
          [unitGroup.id]: unitGroup,
        },
        roomUnitGroupIdsByRoomId: {
          ...state.roomUnitGroupIdsByRoomId,
          [unitGroup.roomId]: ids.includes(unitGroup.id) ? ids : [...ids, unitGroup.id],
        },
      };
    }),

  upsertRoomUnit: (unit) =>
    set((state) => {
      const roomIds = state.roomUnitIdsByRoomId[unit.roomId] ?? [];
      const roomUnitIdsByGroupId = { ...state.roomUnitIdsByGroupId };
      if (unit.unitGroupId) {
        const groupIds = roomUnitIdsByGroupId[unit.unitGroupId] ?? [];
        roomUnitIdsByGroupId[unit.unitGroupId] = groupIds.includes(unit.id)
          ? groupIds
          : [...groupIds, unit.id];
      }
      return {
        roomUnitsById: {
          ...state.roomUnitsById,
          [unit.id]: unit,
        },
        roomUnitIdsByRoomId: {
          ...state.roomUnitIdsByRoomId,
          [unit.roomId]: roomIds.includes(unit.id) ? roomIds : [...roomIds, unit.id],
        },
        roomUnitIdsByGroupId,
      };
    }),

  setRoomUnitOccupied: (unitId, isOccupied) =>
    set((state) => {
      if (!unitId || !state.roomUnitsById[unitId]) return {};
      return {
        roomUnitsById: {
          ...state.roomUnitsById,
          [unitId]: {
            ...state.roomUnitsById[unitId],
            isOccupied,
          },
        },
      };
    }),

  getRoomsByOrgId: (orgId) => {
    const { roomsById, roomIdsByOrgId } = get();
    const ids = roomIdsByOrgId[orgId] ?? [];
    return ids.map((id) => roomsById[id]).filter((r): r is OrganisationRoom => r != null);
  },

  getRoomUnitGroupsByRoomId: (roomId) => {
    const { roomUnitGroupsById, roomUnitGroupIdsByRoomId } = get();
    return (roomUnitGroupIdsByRoomId[roomId] ?? [])
      .map((id) => roomUnitGroupsById[id])
      .filter((group): group is RoomUnitGroup => group != null);
  },

  getRoomUnitsByRoomId: (roomId) => {
    const { roomUnitsById, roomUnitIdsByRoomId } = get();
    return (roomUnitIdsByRoomId[roomId] ?? [])
      .map((id) => roomUnitsById[id])
      .filter((unit): unit is RoomUnit => unit != null);
  },

  getRoomUnitsByGroupId: (groupId) => {
    const { roomUnitsById, roomUnitIdsByGroupId } = get();
    return (roomUnitIdsByGroupId[groupId] ?? [])
      .map((id) => roomUnitsById[id])
      .filter((unit): unit is RoomUnit => unit != null);
  },

  removeRoom: (id) =>
    set((state) => {
      const { [id]: _, ...restRoomsById } = state.roomsById;
      const roomUnitGroupsById = { ...state.roomUnitGroupsById };
      const roomUnitsById = { ...state.roomUnitsById };
      for (const groupId of state.roomUnitGroupIdsByRoomId[id] ?? []) {
        delete roomUnitGroupsById[groupId];
      }
      for (const unitId of state.roomUnitIdsByRoomId[id] ?? []) {
        delete roomUnitsById[unitId];
      }
      const roomIdsByOrgId: Record<string, string[]> = {};
      for (const [orgId, ids] of Object.entries(state.roomIdsByOrgId)) {
        roomIdsByOrgId[orgId] = ids.filter((roomId) => roomId !== id);
      }
      const { [id]: __, ...roomUnitGroupIdsByRoomId } = state.roomUnitGroupIdsByRoomId;
      const { [id]: ___, ...roomUnitIdsByRoomId } = state.roomUnitIdsByRoomId;
      return {
        roomsById: restRoomsById,
        roomIdsByOrgId,
        roomUnitGroupsById,
        roomUnitGroupIdsByRoomId,
        roomUnitsById,
        roomUnitIdsByRoomId,
      };
    }),

  removeRoomUnitGroup: (id) =>
    set((state) => {
      const { [id]: removed, ...roomUnitGroupsById } = state.roomUnitGroupsById;
      const roomUnitGroupIdsByRoomId = { ...state.roomUnitGroupIdsByRoomId };
      if (removed?.roomId) {
        roomUnitGroupIdsByRoomId[removed.roomId] =
          roomUnitGroupIdsByRoomId[removed.roomId]?.filter((groupId) => groupId !== id) ?? [];
      }
      return { roomUnitGroupsById, roomUnitGroupIdsByRoomId };
    }),

  removeRoomUnit: (id) =>
    set((state) => {
      const { [id]: removed, ...roomUnitsById } = state.roomUnitsById;
      const roomUnitIdsByRoomId = { ...state.roomUnitIdsByRoomId };
      const roomUnitIdsByGroupId = { ...state.roomUnitIdsByGroupId };
      if (removed?.roomId) {
        roomUnitIdsByRoomId[removed.roomId] =
          roomUnitIdsByRoomId[removed.roomId]?.filter((unitId) => unitId !== id) ?? [];
      }
      if (removed?.unitGroupId) {
        roomUnitIdsByGroupId[removed.unitGroupId] =
          roomUnitIdsByGroupId[removed.unitGroupId]?.filter((unitId) => unitId !== id) ?? [];
      }
      return { roomUnitsById, roomUnitIdsByRoomId, roomUnitIdsByGroupId };
    }),

  clearRoomsForOrg: (orgId: string) =>
    set((state) => {
      const ids = state.roomIdsByOrgId[orgId] ?? [];
      if (!ids.length) {
        const { [orgId]: _, ...restIdx } = state.roomIdsByOrgId;
        return { roomIdsByOrgId: restIdx };
      }
      const roomsById = { ...state.roomsById };
      const roomUnitGroupsById = { ...state.roomUnitGroupsById };
      const roomUnitGroupIdsByRoomId = { ...state.roomUnitGroupIdsByRoomId };
      const roomUnitsById = { ...state.roomUnitsById };
      const roomUnitIdsByRoomId = { ...state.roomUnitIdsByRoomId };
      const roomUnitIdsByGroupId = { ...state.roomUnitIdsByGroupId };
      for (const id of ids) delete roomsById[id];
      for (const [groupId, group] of Object.entries(roomUnitGroupsById)) {
        if (group.organisationId === orgId) {
          delete roomUnitGroupsById[groupId];
          delete roomUnitIdsByGroupId[groupId];
        }
      }
      for (const [unitId, unit] of Object.entries(roomUnitsById)) {
        if (unit.organisationId === orgId) delete roomUnitsById[unitId];
      }
      for (const id of ids) {
        delete roomUnitGroupIdsByRoomId[id];
        delete roomUnitIdsByRoomId[id];
      }
      const { [orgId]: _, ...restIdx } = state.roomIdsByOrgId;
      return {
        roomsById,
        roomIdsByOrgId: restIdx,
        roomUnitGroupsById,
        roomUnitGroupIdsByRoomId,
        roomUnitsById,
        roomUnitIdsByRoomId,
        roomUnitIdsByGroupId,
        status: 'loaded',
        error: null,
        lastFetchedAt: new Date().toISOString(),
      };
    }),

  clearRooms: () =>
    set(() => ({
      roomsById: {},
      roomIdsByOrgId: {},
      roomUnitGroupsById: {},
      roomUnitGroupIdsByRoomId: {},
      roomUnitsById: {},
      roomUnitIdsByRoomId: {},
      roomUnitIdsByGroupId: {},
      status: 'idle',
      error: null,
      lastFetchedAt: null,
    })),

  startLoading: () =>
    set(() => ({
      status: 'loading',
      error: null,
    })),

  endLoading: () =>
    set(() => ({
      status: 'loaded',
      error: null,
    })),

  setError: (message) =>
    set(() => ({
      status: 'error',
      error: message,
    })),
}));
