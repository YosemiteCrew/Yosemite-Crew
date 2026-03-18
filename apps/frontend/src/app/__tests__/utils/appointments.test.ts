import {
  allowCalendarDrag,
  allowReschedule,
  canAssignAppointmentRoom,
  canShowStatusChangeAction,
  canTransitionAppointmentStatus,
  getAllowedAppointmentStatusTransitions,
  getClinicalNotesIntent,
  getClinicalNotesLabel,
  getInvalidAppointmentStatusTransitionMessage,
  isRequestedLikeStatus,
  normalizeAppointmentStatus,
  toStatusLabel,
} from '@/app/lib/appointments';

describe('appointments utilities', () => {
  describe('allowReschedule', () => {
    it('returns true for REQUESTED status', () => {
      const result = allowReschedule('REQUESTED');
      expect(result).toBe(true);
    });

    it('returns true for UPCOMING status', () => {
      const result = allowReschedule('UPCOMING');
      expect(result).toBe(true);
    });

    it('returns false for COMPLETED status', () => {
      const result = allowReschedule('COMPLETED');
      expect(result).toBe(false);
    });

    it('returns false for CANCELLED status', () => {
      const result = allowReschedule('CANCELLED');
      expect(result).toBe(false);
    });

    it('returns false for NO_SHOW status', () => {
      const result = allowReschedule('NO_SHOW');
      expect(result).toBe(false);
    });

    it('returns true for IN_PROGRESS status', () => {
      const result = allowReschedule('IN_PROGRESS');
      expect(result).toBe(false);
    });

    it('returns true for unknown status', () => {
      const result = allowReschedule('UNKNOWN' as any);
      expect(result).toBe(false);
    });
  });

  it('normalizes and labels status values', () => {
    expect(normalizeAppointmentStatus('REQUESTED')).toBe('REQUESTED');
    expect(normalizeAppointmentStatus('BAD')).toBeNull();
    expect(toStatusLabel('CHECKED_IN')).toBe('Checked in');
    expect(toStatusLabel('BAD')).toBe('Unknown');
  });

  it('returns allowed transitions and transition checks', () => {
    expect(getAllowedAppointmentStatusTransitions('UPCOMING')).toEqual([
      'CHECKED_IN',
      'CANCELLED',
      'NO_SHOW',
    ]);
    expect(canTransitionAppointmentStatus('UPCOMING', 'CHECKED_IN')).toBe(true);
    expect(canTransitionAppointmentStatus('UPCOMING', 'IN_PROGRESS')).toBe(false);
    expect(canTransitionAppointmentStatus('BAD', 'IN_PROGRESS')).toBe(false);
    expect(canTransitionAppointmentStatus('IN_PROGRESS', 'IN_PROGRESS')).toBe(true);
  });

  it('returns invalid transition messages for key cases', () => {
    expect(getInvalidAppointmentStatusTransitionMessage(null, 'COMPLETED')).toContain(
      'Cannot change status'
    );
    expect(getInvalidAppointmentStatusTransitionMessage('UPCOMING', 'UPCOMING')).toBe('');
    expect(getInvalidAppointmentStatusTransitionMessage('UPCOMING', 'REQUESTED')).toContain(
      'cannot be moved back to Requested'
    );
    expect(getInvalidAppointmentStatusTransitionMessage('CHECKED_IN', 'NO_SHOW')).toContain(
      'cannot be cancelled or marked as no-show'
    );
    expect(getInvalidAppointmentStatusTransitionMessage('UPCOMING', 'IN_PROGRESS')).toContain(
      'Please check in'
    );
  });

  it('covers action and room assignment guards', () => {
    expect(isRequestedLikeStatus('REQUESTED')).toBe(true);
    expect(isRequestedLikeStatus('NO_PAYMENT')).toBe(true);
    expect(isRequestedLikeStatus('UPCOMING')).toBe(false);
    expect(canShowStatusChangeAction('REQUESTED')).toBe(false);
    expect(canShowStatusChangeAction('COMPLETED')).toBe(false);
    expect(canShowStatusChangeAction('UPCOMING')).toBe(true);
    expect(canAssignAppointmentRoom('UPCOMING')).toBe(true);
    expect(canAssignAppointmentRoom('IN_PROGRESS')).toBe(true);
    expect(canAssignAppointmentRoom('COMPLETED')).toBe(false);
  });

  it('supports calendar drag and clinical-note copy', () => {
    expect(allowCalendarDrag('REQUESTED')).toBe(true);
    expect(allowCalendarDrag('NO_PAYMENT')).toBe(true);
    expect(allowCalendarDrag('CANCELLED')).toBe(false);
    expect(getClinicalNotesLabel('HOSPITAL')).toBe('Prescription');
    expect(getClinicalNotesLabel('CLINIC')).toBe('Care');
    expect(getClinicalNotesIntent('HOSPITAL')).toEqual({
      label: 'prescription',
      subLabel: 'subjective',
    });
    expect(getClinicalNotesIntent('CLINIC')).toEqual({
      label: 'care',
      subLabel: 'forms',
    });
  });
});
