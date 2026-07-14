import {
  VISIT_TYPE_OPTIONS,
  computeEstimate,
  getInitials,
  hasUnsavedCentralChanges,
} from '@/app/features/appointments/components/AppointmentCentralModal/appointmentCentralModalUtils';
import { Appointment } from '@yosemite-crew/types';

describe('appointmentCentralModalUtils', () => {
  describe('VISIT_TYPE_OPTIONS', () => {
    it('exposes outpatient and inpatient options', () => {
      expect(VISIT_TYPE_OPTIONS).toEqual([
        { label: 'Outpatient', value: 'Outpatient' },
        { label: 'Inpatient', value: 'Inpatient' },
      ]);
    });
  });

  describe('computeEstimate', () => {
    it('returns the numeric cost when positive', () => {
      expect(computeEstimate(42)).toBe(42);
    });

    it('returns 0 for negative numbers', () => {
      expect(computeEstimate(-5)).toBe(0);
    });

    it('returns 0 for non-numeric input', () => {
      expect(computeEstimate('abc')).toBe(0);
    });

    it('returns 0 for undefined', () => {
      expect(computeEstimate(undefined)).toBe(0);
    });

    it('parses numeric strings', () => {
      expect(computeEstimate('15.5')).toBe(15.5);
    });
  });

  describe('getInitials', () => {
    it('returns empty string when name is blank', () => {
      expect(getInitials('   ')).toBe('');
    });

    it('returns single initial for a single-word name', () => {
      expect(getInitials('madonna')).toBe('M');
    });

    it('returns first and last initials for multi-word names', () => {
      expect(getInitials('John Smith')).toBe('JS');
    });

    it('uses first and last of multiple middle names', () => {
      expect(getInitials('  John  Middle  Smith  ')).toBe('JS');
    });
  });

  describe('hasUnsavedCentralChanges', () => {
    const baseFormData = {
      companion: {},
      appointmentType: undefined,
      concern: '',
      lead: undefined,
      supportStaff: [],
      isEmergency: false,
    } as unknown as Appointment;

    it('returns false when nothing is filled in', () => {
      expect(hasUnsavedCentralChanges(baseFormData, null)).toBe(false);
    });

    it('returns true when a companion id is set', () => {
      const formData = { ...baseFormData, companion: { id: 'c1' } } as unknown as Appointment;
      expect(hasUnsavedCentralChanges(formData, null)).toBe(true);
    });

    it('returns true when appointmentType speciality id is set', () => {
      const formData = {
        ...baseFormData,
        appointmentType: { speciality: { id: 's1' } },
      } as unknown as Appointment;
      expect(hasUnsavedCentralChanges(formData, null)).toBe(true);
    });

    it('returns true when appointmentType id is set', () => {
      const formData = { ...baseFormData, appointmentType: { id: 'a1' } } as unknown as Appointment;
      expect(hasUnsavedCentralChanges(formData, null)).toBe(true);
    });

    it('returns true when concern has trimmed text', () => {
      const formData = { ...baseFormData, concern: '  hi  ' } as unknown as Appointment;
      expect(hasUnsavedCentralChanges(formData, null)).toBe(true);
    });

    it('returns true when a slot is selected', () => {
      expect(hasUnsavedCentralChanges(baseFormData, { id: 'slot-1' } as never)).toBe(true);
    });

    it('returns true when a lead id is set', () => {
      const formData = { ...baseFormData, lead: { id: 'lead-1' } } as unknown as Appointment;
      expect(hasUnsavedCentralChanges(formData, null)).toBe(true);
    });

    it('returns true when support staff is non-empty', () => {
      const formData = { ...baseFormData, supportStaff: [{ id: 's1' }] } as unknown as Appointment;
      expect(hasUnsavedCentralChanges(formData, null)).toBe(true);
    });

    it('returns true when isEmergency is set', () => {
      const formData = { ...baseFormData, isEmergency: true } as unknown as Appointment;
      expect(hasUnsavedCentralChanges(formData, null)).toBe(true);
    });
  });
});
