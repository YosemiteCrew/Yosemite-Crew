import {
  appointmentIdsMatch,
  getAppointmentByIdFromList,
  getCompanionNameFromAppointments,
  getParentNameFromAppointments,
  normalizeAppointmentId,
} from '@/app/lib/invoice';

const mockAppointments = [
  {
    id: 'appt-1',
    companion: {
      name: 'Max',
      parent: { name: 'John Doe' },
    },
  },
  {
    id: 'appt-2',
    companion: {
      name: 'Bella',
      parent: { name: 'Jane Smith' },
    },
  },
  {
    id: 'appt-3',
    companion: {
      name: 'Charlie',
    },
  },
  {
    id: 'appt-4',
  },
] as any[];

describe('invoice utilities', () => {
  describe('normalizeAppointmentId', () => {
    it('returns undefined for empty input', () => {
      expect(normalizeAppointmentId('')).toBeUndefined();
    });

    it('extracts id from Appointment/<id> reference', () => {
      expect(normalizeAppointmentId('Appointment/appt-1')).toBe('appt-1');
    });

    it('extracts id from URL references', () => {
      expect(normalizeAppointmentId('https://x.y/Appointment/appt-1?foo=1')).toBe('appt-1');
    });
  });

  describe('appointmentIdsMatch', () => {
    it('matches plain id against Appointment/<id>', () => {
      expect(appointmentIdsMatch('appt-1', 'Appointment/appt-1')).toBe(true);
    });

    it('returns false for mismatched ids', () => {
      expect(appointmentIdsMatch('appt-1', 'appt-2')).toBe(false);
    });
  });

  describe('getAppointmentByIdFromList', () => {
    it('returns appointment when found', () => {
      const result = getAppointmentByIdFromList(mockAppointments, 'appt-1');
      expect(result).toEqual(mockAppointments[0]);
    });

    it('returns appointment when id is a FHIR reference', () => {
      const result = getAppointmentByIdFromList(mockAppointments, 'Appointment/appt-1');
      expect(result).toEqual(mockAppointments[0]);
    });

    it('returns undefined when appointment not found', () => {
      const result = getAppointmentByIdFromList(mockAppointments, 'non-existent');
      expect(result).toBeUndefined();
    });

    it('returns undefined when appointmentId is undefined', () => {
      const result = getAppointmentByIdFromList(mockAppointments, undefined);
      expect(result).toBeUndefined();
    });

    it('returns undefined when appointmentId is empty string', () => {
      const result = getAppointmentByIdFromList(mockAppointments, '');
      expect(result).toBeUndefined();
    });

    it('returns undefined when appointments list is empty', () => {
      const result = getAppointmentByIdFromList([], 'appt-1');
      expect(result).toBeUndefined();
    });
  });

  describe('getCompanionNameFromAppointments', () => {
    it('returns companion name when found', () => {
      const result = getCompanionNameFromAppointments(mockAppointments, 'appt-1');
      expect(result).toBe('Max');
    });

    it('returns companion name for different appointment', () => {
      const result = getCompanionNameFromAppointments(mockAppointments, 'appt-2');
      expect(result).toBe('Bella');
    });

    it('returns dash when appointment not found', () => {
      const result = getCompanionNameFromAppointments(mockAppointments, 'non-existent');
      expect(result).toBe('-');
    });

    it('returns dash when appointmentId is undefined', () => {
      const result = getCompanionNameFromAppointments(mockAppointments, undefined);
      expect(result).toBe('-');
    });

    it('returns dash when companion is missing', () => {
      const result = getCompanionNameFromAppointments(mockAppointments, 'appt-4');
      expect(result).toBe('-');
    });
  });

  describe('getParentNameFromAppointments', () => {
    it('returns parent name when found', () => {
      const result = getParentNameFromAppointments(mockAppointments, 'appt-1');
      expect(result).toBe('John Doe');
    });

    it('returns parent name for different appointment', () => {
      const result = getParentNameFromAppointments(mockAppointments, 'appt-2');
      expect(result).toBe('Jane Smith');
    });

    it('returns dash when appointment not found', () => {
      const result = getParentNameFromAppointments(mockAppointments, 'non-existent');
      expect(result).toBe('-');
    });

    it('returns dash when appointmentId is undefined', () => {
      const result = getParentNameFromAppointments(mockAppointments, undefined);
      expect(result).toBe('-');
    });

    it('returns dash when parent is missing', () => {
      const result = getParentNameFromAppointments(mockAppointments, 'appt-3');
      expect(result).toBe('-');
    });

    it('returns dash when companion is missing', () => {
      const result = getParentNameFromAppointments(mockAppointments, 'appt-4');
      expect(result).toBe('-');
    });
  });
});
