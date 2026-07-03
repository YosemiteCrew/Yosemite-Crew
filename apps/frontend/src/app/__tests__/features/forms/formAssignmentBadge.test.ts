import {
  getFormAssignmentBadge,
  type FormAssignmentBadgeCategory,
} from '@/app/features/forms/lib/formAssignmentBadge';
import type { FormAssignmentLifecycleStatus } from '@/app/features/forms/types/forms';

describe('getFormAssignmentBadge', () => {
  const cases: Array<[FormAssignmentLifecycleStatus, FormAssignmentBadgeCategory]> = [
    ['SENT', 'pending'],
    ['VIEWED', 'pending'],
    ['SUBMITTED', 'pending'],
    ['SIGNED', 'signed'],
    ['EXPIRED', 'expired'],
    ['CANCELLED', 'cancelled'],
  ];

  it.each(cases)('maps %s to the %s badge category', (status, category) => {
    expect(getFormAssignmentBadge(status).category).toBe(category);
  });

  it('labels the pending bucket "Pending" for all three pending statuses', () => {
    expect(getFormAssignmentBadge('SENT').label).toBe('Pending');
    expect(getFormAssignmentBadge('VIEWED').label).toBe('Pending');
    expect(getFormAssignmentBadge('SUBMITTED').label).toBe('Pending');
  });

  it('uses a success tone only for signed', () => {
    expect(getFormAssignmentBadge('SIGNED').tone).toBe('success');
    expect(getFormAssignmentBadge('SENT').tone).not.toBe('success');
  });

  it('falls back to pending for an unknown status', () => {
    const badge = getFormAssignmentBadge('WHAT' as FormAssignmentLifecycleStatus);
    expect(badge.category).toBe('pending');
    expect(badge.label).toBe('Pending');
  });
});
