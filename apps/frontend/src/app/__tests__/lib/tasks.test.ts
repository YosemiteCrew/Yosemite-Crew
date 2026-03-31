import {
  normalizeTaskStatus,
  getTaskStatusLabel,
  getAllowedTaskStatusTransitions,
  canTransitionTaskStatus,
  canShowTaskStatusChangeAction,
  canRescheduleTask,
  getPreferredNextTaskStatus,
  getInvalidTaskStatusTransitionMessage,
  getTaskQuickDetails,
} from '@/app/lib/tasks';
import { Task } from '@/app/features/tasks/types/task';

describe('normalizeTaskStatus', () => {
  it('returns valid statuses as-is', () => {
    expect(normalizeTaskStatus('PENDING')).toBe('PENDING');
    expect(normalizeTaskStatus('IN_PROGRESS')).toBe('IN_PROGRESS');
    expect(normalizeTaskStatus('COMPLETED')).toBe('COMPLETED');
    expect(normalizeTaskStatus('CANCELLED')).toBe('CANCELLED');
  });

  it('returns null for unknown status', () => {
    expect(normalizeTaskStatus('UNKNOWN')).toBeNull();
  });

  it('returns null for null', () => {
    expect(normalizeTaskStatus(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(normalizeTaskStatus(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(normalizeTaskStatus('')).toBeNull();
  });
});

describe('getTaskStatusLabel', () => {
  it('returns correct labels for valid statuses', () => {
    expect(getTaskStatusLabel('PENDING')).toBe('Pending');
    expect(getTaskStatusLabel('IN_PROGRESS')).toBe('In progress');
    expect(getTaskStatusLabel('COMPLETED')).toBe('Completed');
    expect(getTaskStatusLabel('CANCELLED')).toBe('Cancelled');
  });

  it('returns "Unknown" for invalid status', () => {
    expect(getTaskStatusLabel('BOGUS')).toBe('Unknown');
  });

  it('returns "Unknown" for null', () => {
    expect(getTaskStatusLabel(null)).toBe('Unknown');
  });
});

describe('getAllowedTaskStatusTransitions', () => {
  it('PENDING allows IN_PROGRESS, COMPLETED, CANCELLED', () => {
    expect(getAllowedTaskStatusTransitions('PENDING')).toEqual([
      'IN_PROGRESS',
      'COMPLETED',
      'CANCELLED',
    ]);
  });

  it('IN_PROGRESS allows COMPLETED and CANCELLED', () => {
    expect(getAllowedTaskStatusTransitions('IN_PROGRESS')).toEqual(['COMPLETED', 'CANCELLED']);
  });

  it('COMPLETED has no transitions', () => {
    expect(getAllowedTaskStatusTransitions('COMPLETED')).toEqual([]);
  });

  it('CANCELLED has no transitions', () => {
    expect(getAllowedTaskStatusTransitions('CANCELLED')).toEqual([]);
  });

  it('returns empty for invalid status', () => {
    expect(getAllowedTaskStatusTransitions('INVALID')).toEqual([]);
  });
});

describe('canTransitionTaskStatus', () => {
  it('returns true for allowed transition', () => {
    expect(canTransitionTaskStatus('PENDING', 'IN_PROGRESS')).toBe(true);
  });

  it('returns true when transitioning to same status', () => {
    expect(canTransitionTaskStatus('PENDING', 'PENDING')).toBe(true);
  });

  it('returns false for disallowed transition', () => {
    expect(canTransitionTaskStatus('COMPLETED', 'PENDING')).toBe(false);
  });

  it('returns false for invalid current status', () => {
    expect(canTransitionTaskStatus(null, 'PENDING')).toBe(false);
  });
});

describe('canShowTaskStatusChangeAction', () => {
  it('returns true for PENDING', () => {
    expect(canShowTaskStatusChangeAction('PENDING')).toBe(true);
  });

  it('returns false for COMPLETED', () => {
    expect(canShowTaskStatusChangeAction('COMPLETED')).toBe(false);
  });

  it('returns false for CANCELLED', () => {
    expect(canShowTaskStatusChangeAction('CANCELLED')).toBe(false);
  });

  it('returns false for null', () => {
    expect(canShowTaskStatusChangeAction(null)).toBe(false);
  });
});

describe('canRescheduleTask', () => {
  it('returns true for PENDING', () => {
    expect(canRescheduleTask('PENDING')).toBe(true);
  });

  it('returns true for IN_PROGRESS', () => {
    expect(canRescheduleTask('IN_PROGRESS')).toBe(true);
  });

  it('returns false for COMPLETED', () => {
    expect(canRescheduleTask('COMPLETED')).toBe(false);
  });

  it('returns false for CANCELLED', () => {
    expect(canRescheduleTask('CANCELLED')).toBe(false);
  });

  it('returns false for null', () => {
    expect(canRescheduleTask(null)).toBe(false);
  });
});

describe('getPreferredNextTaskStatus', () => {
  it('returns IN_PROGRESS for PENDING', () => {
    expect(getPreferredNextTaskStatus('PENDING')).toBe('IN_PROGRESS');
  });

  it('returns COMPLETED for IN_PROGRESS', () => {
    expect(getPreferredNextTaskStatus('IN_PROGRESS')).toBe('COMPLETED');
  });

  it('returns null for COMPLETED', () => {
    expect(getPreferredNextTaskStatus('COMPLETED')).toBeNull();
  });

  it('returns null for invalid status', () => {
    expect(getPreferredNextTaskStatus(null)).toBeNull();
  });
});

describe('getInvalidTaskStatusTransitionMessage', () => {
  it('returns empty string when transitioning to same status', () => {
    expect(getInvalidTaskStatusTransitionMessage('PENDING', 'PENDING')).toBe('');
  });

  it('returns message for disallowed transition', () => {
    const msg = getInvalidTaskStatusTransitionMessage('COMPLETED', 'PENDING');
    expect(msg).toContain('Completed');
    expect(msg).toContain('Pending');
  });

  it('returns fallback message for invalid current status', () => {
    const msg = getInvalidTaskStatusTransitionMessage(null, 'PENDING');
    expect(msg).toContain('Cannot change task status');
  });
});

describe('getTaskQuickDetails', () => {
  it('returns detail rows for a task', () => {
    const task = {
      category: 'Health',
      description: 'Test desc',
      additionalNotes: 'Some notes',
    } as Task;

    const details = getTaskQuickDetails(task);
    expect(details).toHaveLength(3);
    expect(details[0]).toEqual({ label: 'Category', value: 'Health' });
    expect(details[1]).toEqual({ label: 'Description', value: 'Test desc' });
    expect(details[2]).toEqual({ label: 'Additional notes', value: 'Some notes' });
  });

  it('uses dash for missing fields', () => {
    const task = {} as Task;
    const details = getTaskQuickDetails(task);
    details.forEach((d) => expect(d.value).toBe('-'));
  });
});
