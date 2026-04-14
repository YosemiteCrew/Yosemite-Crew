import {
  isRequestedLikeStatus,
  normalizeAppointmentStatus,
  toStatusLabel,
  getAllowedAppointmentStatusTransitions,
  canTransitionAppointmentStatus,
  getInvalidAppointmentStatusTransitionMessage,
  canShowStatusChangeAction,
  getPreferredNextAppointmentStatus,
  canAssignAppointmentRoom,
  allowReschedule,
  allowCalendarDrag,
  getClinicalNotesLabel,
  getClinicalNotesIntent,
  getAppointmentCompanionPhotoUrl,
} from '@/app/lib/appointments';

describe('isRequestedLikeStatus', () => {
  it('returns true for REQUESTED', () => {
    expect(isRequestedLikeStatus('REQUESTED')).toBe(true);
  });

  it('returns true for NO_PAYMENT', () => {
    expect(isRequestedLikeStatus('NO_PAYMENT')).toBe(true);
  });

  it('returns false for UPCOMING', () => {
    expect(isRequestedLikeStatus('UPCOMING')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isRequestedLikeStatus(null)).toBe(false);
  });
});

describe('normalizeAppointmentStatus', () => {
  it('maps NO_PAYMENT to REQUESTED', () => {
    expect(normalizeAppointmentStatus('NO_PAYMENT')).toBe('REQUESTED');
  });

  it('passes through valid statuses', () => {
    const statuses = [
      'REQUESTED',
      'UPCOMING',
      'CHECKED_IN',
      'IN_PROGRESS',
      'COMPLETED',
      'CANCELLED',
      'NO_SHOW',
    ] as const;
    statuses.forEach((s) => expect(normalizeAppointmentStatus(s)).toBe(s));
  });

  it('returns null for unknown status', () => {
    expect(normalizeAppointmentStatus('BOGUS')).toBeNull();
  });

  it('returns null for null', () => {
    expect(normalizeAppointmentStatus(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(normalizeAppointmentStatus(undefined)).toBeNull();
  });
});

describe('toStatusLabel', () => {
  it('returns correct labels', () => {
    expect(toStatusLabel('REQUESTED')).toBe('Requested');
    expect(toStatusLabel('UPCOMING')).toBe('Upcoming');
    expect(toStatusLabel('CHECKED_IN')).toBe('Checked in');
    expect(toStatusLabel('IN_PROGRESS')).toBe('In progress');
    expect(toStatusLabel('COMPLETED')).toBe('Completed');
    expect(toStatusLabel('CANCELLED')).toBe('Cancelled');
    expect(toStatusLabel('NO_SHOW')).toBe('No show');
  });

  it('returns "Unknown" for null', () => {
    expect(toStatusLabel(null)).toBe('Unknown');
  });

  it('returns "Unknown" for NO_PAYMENT (normalized to REQUESTED then labeled)', () => {
    expect(toStatusLabel('NO_PAYMENT')).toBe('Requested');
  });
});

describe('getAllowedAppointmentStatusTransitions', () => {
  it('REQUESTED allows UPCOMING and CANCELLED', () => {
    expect(getAllowedAppointmentStatusTransitions('REQUESTED')).toEqual(['UPCOMING', 'CANCELLED']);
  });

  it('UPCOMING allows CHECKED_IN, CANCELLED, NO_SHOW', () => {
    expect(getAllowedAppointmentStatusTransitions('UPCOMING')).toEqual([
      'CHECKED_IN',
      'CANCELLED',
      'NO_SHOW',
    ]);
  });

  it('CHECKED_IN allows only IN_PROGRESS', () => {
    expect(getAllowedAppointmentStatusTransitions('CHECKED_IN')).toEqual(['IN_PROGRESS']);
  });

  it('IN_PROGRESS allows only COMPLETED', () => {
    expect(getAllowedAppointmentStatusTransitions('IN_PROGRESS')).toEqual(['COMPLETED']);
  });

  it('COMPLETED has no transitions', () => {
    expect(getAllowedAppointmentStatusTransitions('COMPLETED')).toEqual([]);
  });

  it('NO_SHOW has no transitions', () => {
    expect(getAllowedAppointmentStatusTransitions('NO_SHOW')).toEqual([]);
  });

  it('returns empty for invalid status', () => {
    expect(getAllowedAppointmentStatusTransitions('INVALID')).toEqual([]);
  });
});

describe('canTransitionAppointmentStatus', () => {
  it('returns true for allowed transition', () => {
    expect(canTransitionAppointmentStatus('REQUESTED', 'UPCOMING')).toBe(true);
  });

  it('returns true when transitioning to same status', () => {
    expect(canTransitionAppointmentStatus('UPCOMING', 'UPCOMING')).toBe(true);
  });

  it('returns false for disallowed transition', () => {
    expect(canTransitionAppointmentStatus('COMPLETED', 'REQUESTED')).toBe(false);
  });

  it('returns false for invalid current status', () => {
    expect(canTransitionAppointmentStatus(null, 'UPCOMING')).toBe(false);
  });

  it('handles NO_PAYMENT as REQUESTED', () => {
    expect(canTransitionAppointmentStatus('NO_PAYMENT', 'UPCOMING')).toBe(true);
  });
});

describe('getInvalidAppointmentStatusTransitionMessage', () => {
  it('returns empty string for same-status transition', () => {
    expect(getInvalidAppointmentStatusTransitionMessage('UPCOMING', 'UPCOMING')).toBe('');
  });

  it('returns cannot move back to Requested message', () => {
    const msg = getInvalidAppointmentStatusTransitionMessage('UPCOMING', 'REQUESTED');
    expect(msg).toContain('cannot be moved back to Requested');
  });

  it('returns check-in message for UPCOMING -> IN_PROGRESS', () => {
    const msg = getInvalidAppointmentStatusTransitionMessage('UPCOMING', 'IN_PROGRESS');
    expect(msg).toContain('check in');
  });

  it('returns checked-in cannot cancel message', () => {
    const msg = getInvalidAppointmentStatusTransitionMessage('CHECKED_IN', 'CANCELLED');
    expect(msg).toContain('Checked-in');
  });

  it('returns fallback message for invalid current status', () => {
    const msg = getInvalidAppointmentStatusTransitionMessage(null, 'UPCOMING');
    expect(msg).toContain('Cannot change status');
  });

  it('returns generic message for other disallowed transitions', () => {
    const msg = getInvalidAppointmentStatusTransitionMessage('COMPLETED', 'CANCELLED');
    expect(msg).toContain('Completed');
    expect(msg).toContain('Cancelled');
  });
});

describe('canShowStatusChangeAction', () => {
  it('returns false for REQUESTED', () => {
    expect(canShowStatusChangeAction('REQUESTED')).toBe(false);
  });

  it('returns false for NO_PAYMENT', () => {
    expect(canShowStatusChangeAction('NO_PAYMENT')).toBe(false);
  });

  it('returns true for UPCOMING', () => {
    expect(canShowStatusChangeAction('UPCOMING')).toBe(true);
  });

  it('returns false for COMPLETED', () => {
    expect(canShowStatusChangeAction('COMPLETED')).toBe(false);
  });
});

describe('getPreferredNextAppointmentStatus', () => {
  it('returns UPCOMING for REQUESTED', () => {
    expect(getPreferredNextAppointmentStatus('REQUESTED')).toBe('UPCOMING');
  });

  it('returns CHECKED_IN for UPCOMING', () => {
    expect(getPreferredNextAppointmentStatus('UPCOMING')).toBe('CHECKED_IN');
  });

  it('returns null for COMPLETED', () => {
    expect(getPreferredNextAppointmentStatus('COMPLETED')).toBeNull();
  });

  it('returns null for null', () => {
    expect(getPreferredNextAppointmentStatus(null)).toBeNull();
  });
});

describe('canAssignAppointmentRoom', () => {
  it('returns true for UPCOMING, CHECKED_IN, IN_PROGRESS', () => {
    expect(canAssignAppointmentRoom('UPCOMING')).toBe(true);
    expect(canAssignAppointmentRoom('CHECKED_IN')).toBe(true);
    expect(canAssignAppointmentRoom('IN_PROGRESS')).toBe(true);
  });

  it('returns false for REQUESTED', () => {
    expect(canAssignAppointmentRoom('REQUESTED')).toBe(false);
  });

  it('returns false for COMPLETED', () => {
    expect(canAssignAppointmentRoom('COMPLETED')).toBe(false);
  });

  it('returns false for null', () => {
    expect(canAssignAppointmentRoom(null)).toBe(false);
  });
});

describe('allowReschedule', () => {
  it('returns true for NO_PAYMENT, REQUESTED, UPCOMING', () => {
    expect(allowReschedule('NO_PAYMENT')).toBe(true);
    expect(allowReschedule('REQUESTED')).toBe(true);
    expect(allowReschedule('UPCOMING')).toBe(true);
  });

  it('returns false for COMPLETED', () => {
    expect(allowReschedule('COMPLETED')).toBe(false);
  });

  it('returns false for null', () => {
    expect(allowReschedule(null)).toBe(false);
  });
});

describe('allowCalendarDrag', () => {
  it('returns true for NO_PAYMENT, REQUESTED, UPCOMING', () => {
    expect(allowCalendarDrag('NO_PAYMENT')).toBe(true);
    expect(allowCalendarDrag('REQUESTED')).toBe(true);
    expect(allowCalendarDrag('UPCOMING')).toBe(true);
  });

  it('returns false for IN_PROGRESS', () => {
    expect(allowCalendarDrag('IN_PROGRESS')).toBe(false);
  });
});

describe('getClinicalNotesLabel', () => {
  it('returns "Medical Records" for HOSPITAL', () => {
    expect(getClinicalNotesLabel('HOSPITAL')).toBe('Medical Records');
  });

  it('returns "Care" for other org types', () => {
    expect(getClinicalNotesLabel('BOARDER')).toBe('Care');
    expect(getClinicalNotesLabel(undefined)).toBe('Care');
  });
});

describe('getClinicalNotesIntent', () => {
  it('returns prescription intent for HOSPITAL', () => {
    const intent = getClinicalNotesIntent('HOSPITAL');
    expect(intent.label).toBe('prescription');
    expect(intent.subLabel).toBe('subjective');
  });

  it('returns care intent for other org types', () => {
    const intent = getClinicalNotesIntent('BOARDER');
    expect(intent.label).toBe('care');
    expect(intent.subLabel).toBe('forms');
  });

  it('returns care intent for undefined', () => {
    const intent = getClinicalNotesIntent(undefined);
    expect(intent.label).toBe('care');
  });
});

describe('getAppointmentCompanionPhotoUrl', () => {
  it('returns trimmed photo URL when available', () => {
    expect(getAppointmentCompanionPhotoUrl({ photoUrl: '  https://cdn.test/buddy.png  ' })).toBe(
      'https://cdn.test/buddy.png'
    );
  });

  it('returns empty string for missing photo URL', () => {
    expect(getAppointmentCompanionPhotoUrl({})).toBe('');
    expect(getAppointmentCompanionPhotoUrl(undefined)).toBe('');
  });
});
