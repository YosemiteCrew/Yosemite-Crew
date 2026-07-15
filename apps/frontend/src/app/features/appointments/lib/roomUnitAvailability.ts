import type { RoomUnit } from '@yosemite-crew/types';

type RoomUnitIndexes = {
  roomUnitsById: Record<string, RoomUnit>;
  roomUnitIdsByRoomId: Record<string, string[]>;
};

type RoomLike = {
  id: string;
  name: string;
};

export const isAssignableRoomUnit = (
  unit: RoomUnit | undefined,
  currentUnitId?: string
): unit is RoomUnit => {
  if (!unit || unit.isActive === false) return false;
  return unit.isOccupied !== true || unit.id === currentUnitId;
};

export const getAssignableRoomUnits = (
  roomId: string | undefined,
  indexes: RoomUnitIndexes,
  currentUnitId?: string
): RoomUnit[] => {
  if (!roomId) return [];
  const indexedUnits = (indexes.roomUnitIdsByRoomId[roomId] ?? [])
    .map((unitId) => indexes.roomUnitsById[unitId])
    .filter((unit) => isAssignableRoomUnit(unit, currentUnitId));

  if (indexedUnits.length) return indexedUnits;

  return Object.values(indexes.roomUnitsById).filter(
    (unit) => unit.roomId === roomId && isAssignableRoomUnit(unit, currentUnitId)
  );
};

export const getFirstAssignableRoomUnitId = (
  roomId: string | undefined,
  indexes: RoomUnitIndexes,
  currentUnitId?: string
): string | undefined => getAssignableRoomUnits(roomId, indexes, currentUnitId)[0]?.id;

export const toAssignableRoomOptions = (
  rooms: RoomLike[],
  indexes: RoomUnitIndexes,
  currentRoomId?: string,
  currentUnitId?: string,
  requireAssignableUnit = false
): Array<{ label: string; value: string }> =>
  rooms.flatMap((room) => {
    const hasKnownUnits =
      (indexes.roomUnitIdsByRoomId[room.id]?.length ?? 0) > 0 ||
      Object.values(indexes.roomUnitsById).some((unit) => unit.roomId === room.id);
    const hasAssignableUnit =
      !hasKnownUnits ||
      getAssignableRoomUnits(room.id, indexes, currentUnitId).length > 0 ||
      room.id === currentRoomId;

    return !requireAssignableUnit || hasAssignableUnit
      ? [{ label: room.name, value: room.id }]
      : [];
  });
