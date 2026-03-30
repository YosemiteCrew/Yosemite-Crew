import {
  normalizeAppointmentId,
  appointmentIdsMatch,
  getAppointmentByIdFromList,
  getCompanionNameFromAppointments,
  getParentNameFromAppointments,
} from '@/app/lib/invoice';
import { Appointment } from '@yosemite-crew/types';

const makeAppt = (id: string, companionName?: string, parentName?: string): Appointment =>
  ({
    id,
    companion: companionName
      ? { name: companionName, parent: parentName ? { name: parentName } : undefined }
      : undefined,
  }) as unknown as Appointment;

describe('normalizeAppointmentId', () => {
  it('returns plain IDs as-is', () => {
    expect(normalizeAppointmentId('abc123')).toBe('abc123');
  });

  it('extracts the trailing segment from path-style IDs', () => {
    expect(normalizeAppointmentId('Appointment/123')).toBe('123');
  });

  it('extracts from full URLs', () => {
    expect(normalizeAppointmentId('https://api.example.com/appointments/456')).toBe('456');
  });

  it('strips query strings', () => {
    expect(normalizeAppointmentId('Appointment/789?foo=bar')).toBe('789');
  });

  it('strips hash fragments', () => {
    expect(normalizeAppointmentId('Appointment/789#section')).toBe('789');
  });

  it('returns undefined for undefined', () => {
    expect(normalizeAppointmentId(undefined)).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(normalizeAppointmentId('')).toBeUndefined();
  });

  it('returns undefined for whitespace-only string', () => {
    expect(normalizeAppointmentId('   ')).toBeUndefined();
  });
});

describe('appointmentIdsMatch', () => {
  it('returns true for matching plain IDs', () => {
    expect(appointmentIdsMatch('123', '123')).toBe(true);
  });

  it('returns true when one is path-style', () => {
    expect(appointmentIdsMatch('Appointment/123', '123')).toBe(true);
  });

  it('returns false for different IDs', () => {
    expect(appointmentIdsMatch('123', '456')).toBe(false);
  });

  it('returns false for undefined left', () => {
    expect(appointmentIdsMatch(undefined, '123')).toBe(false);
  });

  it('returns false for undefined right', () => {
    expect(appointmentIdsMatch('123', undefined)).toBe(false);
  });
});

describe('getAppointmentByIdFromList', () => {
  const appointments = [makeAppt('Appointment/1', 'Luna'), makeAppt('Appointment/2', 'Max')];

  it('finds an appointment by plain ID', () => {
    expect(getAppointmentByIdFromList(appointments, '1')?.companion?.name).toBe('Luna');
  });

  it('finds an appointment by path-style ID', () => {
    expect(getAppointmentByIdFromList(appointments, 'Appointment/2')?.companion?.name).toBe('Max');
  });

  it('returns undefined for missing ID', () => {
    expect(getAppointmentByIdFromList(appointments, '999')).toBeUndefined();
  });

  it('returns undefined for undefined ID', () => {
    expect(getAppointmentByIdFromList(appointments, undefined)).toBeUndefined();
  });
});

describe('getCompanionNameFromAppointments', () => {
  const appointments = [makeAppt('1', 'Luna')];

  it('returns companion name for matching appointment', () => {
    expect(getCompanionNameFromAppointments(appointments, '1')).toBe('Luna');
  });

  it('returns dash for no match', () => {
    expect(getCompanionNameFromAppointments(appointments, '999')).toBe('-');
  });

  it('returns dash for undefined appointment ID', () => {
    expect(getCompanionNameFromAppointments(appointments, undefined)).toBe('-');
  });
});

describe('getParentNameFromAppointments', () => {
  const appointments = [makeAppt('1', 'Luna', 'Alice')];

  it('returns parent name for matching appointment', () => {
    expect(getParentNameFromAppointments(appointments, '1')).toBe('Alice');
  });

  it('returns dash for no match', () => {
    expect(getParentNameFromAppointments(appointments, '999')).toBe('-');
  });
});
