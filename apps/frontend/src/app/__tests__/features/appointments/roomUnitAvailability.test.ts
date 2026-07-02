import {
  getAssignableRoomUnits,
  getFirstAssignableRoomUnitId,
  isAssignableRoomUnit,
  toAssignableRoomOptions,
} from '@/app/features/appointments/lib/roomUnitAvailability';

const indexes = {
  roomUnitsById: {
    'unit-1': {
      id: 'unit-1',
      organisationId: 'org-1',
      roomId: 'room-1',
      code: '1',
      displayName: 'Unit 1',
      isActive: true,
      isOccupied: true,
    },
    'unit-2': {
      id: 'unit-2',
      organisationId: 'org-1',
      roomId: 'room-1',
      code: '2',
      displayName: 'Unit 2',
      isActive: true,
      isOccupied: false,
    },
    'unit-3': {
      id: 'unit-3',
      organisationId: 'org-1',
      roomId: 'room-2',
      code: '3',
      displayName: 'Unit 3',
      isActive: true,
      isOccupied: true,
    },
    'unit-4': {
      id: 'unit-4',
      organisationId: 'org-1',
      roomId: 'room-3',
      code: '4',
      displayName: 'Unit 4',
      isActive: false,
      isOccupied: false,
    },
  },
  roomUnitIdsByRoomId: {
    'room-1': ['unit-1', 'unit-2'],
    'room-2': ['unit-3'],
    'room-3': ['unit-4'],
  },
};

describe('roomUnitAvailability', () => {
  it('filters inactive and occupied units while preserving the current unit', () => {
    expect(isAssignableRoomUnit(indexes.roomUnitsById['unit-1'])).toBe(false);
    expect(isAssignableRoomUnit(indexes.roomUnitsById['unit-1'], 'unit-1')).toBe(true);
    expect(getAssignableRoomUnits('room-1', indexes).map((unit) => unit.id)).toEqual(['unit-2']);
    expect(getAssignableRoomUnits('room-1', indexes, 'unit-1').map((unit) => unit.id)).toEqual([
      'unit-1',
      'unit-2',
    ]);
  });

  it('returns the first assignable unit instead of an occupied unit', () => {
    expect(getFirstAssignableRoomUnitId('room-1', indexes)).toBe('unit-2');
    expect(getFirstAssignableRoomUnitId('room-2', indexes)).toBeUndefined();
  });

  it('removes fully occupied inpatient rooms unless they are current', () => {
    const rooms = [
      { id: 'room-1', name: 'Room 1' },
      { id: 'room-2', name: 'Room 2' },
      { id: 'room-3', name: 'Room 3' },
    ];

    expect(toAssignableRoomOptions(rooms, indexes, undefined, undefined, true)).toEqual([
      { label: 'Room 1', value: 'room-1' },
    ]);
    expect(toAssignableRoomOptions(rooms, indexes, 'room-2', 'unit-3', true)).toEqual([
      { label: 'Room 1', value: 'room-1' },
      { label: 'Room 2', value: 'room-2' },
    ]);
  });
});
