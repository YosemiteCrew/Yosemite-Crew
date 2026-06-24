import {
  getAppointmentRoomDisplay,
  getAppointmentUnitLabel,
} from '@/app/lib/appointmentRoomDisplay';

describe('appointmentRoomDisplay', () => {
  it('uses room only for outpatient appointments', () => {
    const appointment = {
      id: 'appt-1',
      appointmentKind: 'OUTPATIENT',
      room: { name: 'Exam 1', unitName: 'Kennel A' },
    } as any;

    expect(getAppointmentRoomDisplay(appointment)).toEqual({
      label: 'Room',
      roomName: 'Exam 1',
      unitLabel: '',
      value: 'Exam 1',
    });
  });

  it('uses inline room unit labels for inpatient appointments', () => {
    const appointment = {
      id: 'appt-2',
      appointmentKind: 'INPATIENT',
      room: { name: 'Ward 1', unitName: 'Kennel A' },
    } as any;

    expect(getAppointmentRoomDisplay(appointment)).toEqual({
      label: 'Room / Unit',
      roomName: 'Ward 1',
      unitLabel: 'Kennel A',
      value: 'Ward 1 / Kennel A',
    });
  });

  it('falls back to encounter unit id and room unit lookup for inpatient appointments', () => {
    const appointment = {
      id: 'appt-3',
      appointmentKind: 'INPATIENT',
      room: { name: 'Ward 2' },
    } as any;

    expect(
      getAppointmentUnitLabel(
        appointment,
        { 'appt-3': { unitId: 'unit-1' } },
        { 'unit-1': { displayName: 'Run 12', code: 'R12' } }
      )
    ).toBe('Run 12');
  });

  it.each([
    [{ room: { name: 'Ward', roomUnitName: 'Room unit name' } }, 'Room unit name'],
    [{ room: { name: 'Ward', unit: { displayName: 'Nested display' } } }, 'Nested display'],
    [{ room: { name: 'Ward', unit: { name: 'Nested name' } } }, 'Nested name'],
    [{ room: { name: 'Ward', unit: { code: 'Nested code' } } }, 'Nested code'],
    [{ room: { name: 'Ward' }, roomUnitName: 'Direct room unit name' }, 'Direct room unit name'],
    [{ room: { name: 'Ward' }, unitName: 'Direct unit name' }, 'Direct unit name'],
    [{ room: { name: 'Ward' }, unit: { displayName: 'Direct display' } }, 'Direct display'],
    [{ room: { name: 'Ward' }, unit: { name: 'Direct name' } }, 'Direct name'],
    [{ room: { name: 'Ward' }, unit: { code: 'Direct code' } }, 'Direct code'],
  ])('resolves inpatient unit labels from inline source %#', (patch, expected) => {
    const appointment = {
      id: 'appt-inline',
      appointmentKind: 'INPATIENT',
      ...patch,
    } as any;

    expect(getAppointmentUnitLabel(appointment)).toBe(expected);
  });

  it('falls back to room unit code and then unit id from lookup data', () => {
    const appointment = {
      id: 'appt-4',
      appointmentKind: 'INPATIENT',
      room: { name: 'Ward 3' },
    } as any;

    expect(
      getAppointmentUnitLabel(
        appointment,
        { 'appt-4': { unitId: 'unit-2' } },
        { 'unit-2': { code: 'R13' } }
      )
    ).toBe('R13');

    expect(getAppointmentUnitLabel(appointment, { 'appt-4': { unitId: 'unit-3' } }, {})).toBe(
      'unit-3'
    );
  });

  it('resolves unit ids from appointment fields before workspace encounter state', () => {
    const appointment = {
      id: 'appt-6',
      appointmentKind: 'INPATIENT',
      room: { name: 'Ward 4', roomUnitId: 'unit-room' },
      unitId: 'unit-direct',
    } as any;

    expect(
      getAppointmentUnitLabel(
        appointment,
        { 'appt-6': { unitId: 'unit-encounter' } },
        {
          'unit-room': { displayName: 'Room unit' },
          'unit-direct': { displayName: 'Direct unit' },
          'unit-encounter': { displayName: 'Encounter unit' },
        }
      )
    ).toBe('Room unit');
  });

  it('falls through alternate unit id sources and empty lookup names', () => {
    const appointment = {
      id: 'appt-7',
      appointmentKind: 'INPATIENT',
      room: { name: 'Ward 5', unit: { id: 'unit-nested' } },
    } as any;

    expect(
      getAppointmentUnitLabel(appointment, {}, { 'unit-nested': { displayName: '', code: '' } })
    ).toBe('unit-nested');

    expect(
      getAppointmentUnitLabel(
        { id: 'appt-8', appointmentKind: 'INPATIENT', unit: { id: 'unit-direct' } } as any,
        {},
        { 'unit-direct': { displayName: 'Direct lookup' } }
      )
    ).toBe('Direct lookup');
  });

  it('returns an empty unit label when no unit source exists', () => {
    expect(
      getAppointmentUnitLabel({
        id: 'appt-9',
        appointmentKind: 'INPATIENT',
        room: { name: 'Ward 6' },
      } as any)
    ).toBe('');
  });

  it('uses dash fallback for missing room and keeps inpatient label as room only without a unit', () => {
    const appointment = {
      id: 'appt-5',
      appointmentKind: 'INPATIENT',
    } as any;

    expect(getAppointmentRoomDisplay(appointment)).toEqual({
      label: 'Room',
      roomName: '-',
      unitLabel: '',
      value: '-',
    });
  });
});
