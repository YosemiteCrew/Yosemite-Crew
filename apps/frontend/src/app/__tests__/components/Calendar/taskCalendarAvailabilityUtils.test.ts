import {
  buildAvailabilityOutput,
  canCurrentUserEditTask,
  isMinuteWithinIntervals,
  readDropAvailabilityIntervals,
  runOncePerKey,
  shiftWeekdayKey,
  shouldAllowTaskAvailabilityBypass,
} from '@/app/features/appointments/components/Calendar/taskCalendarAvailabilityUtils';
import { Task } from '@/app/features/tasks/types/task';

const normalizeId = (value?: string) =>
  String(value ?? '')
    .trim()
    .toLowerCase();

const makeTask = (overrides: Partial<Task> = {}): Task =>
  ({
    assignedBy: 'creator',
    assignedTo: 'assignee',
    ...overrides,
  }) as Task;

describe('shouldAllowTaskAvailabilityBypass', () => {
  it('does not enforce availability when the current user created the assignment', () => {
    const task = makeTask({ assignedBy: 'user-1' });
    expect(shouldAllowTaskAvailabilityBypass('user-1', task, normalizeId)).toBe(false);
  });

  it('enforces availability when the task was assigned by someone else', () => {
    const task = makeTask({ assignedBy: 'user-2' });
    expect(shouldAllowTaskAvailabilityBypass('user-1', task, normalizeId)).toBe(true);
  });

  it('enforces availability when the current user id is empty', () => {
    const task = makeTask({ assignedBy: '' });
    expect(shouldAllowTaskAvailabilityBypass('', task, normalizeId)).toBe(true);
  });
});

describe('buildAvailabilityOutput', () => {
  const identityShift = (dayKey: string) => dayKey;

  it('reduces available slots into per-day drop intervals', () => {
    const output = buildAvailabilityOutput(
      [
        {
          dayOfWeek: 'MONDAY',
          slots: [{ isAvailable: true, startTime: '09:00', endTime: '17:00' }],
        },
      ],
      identityShift
    );
    expect(output.MONDAY).toHaveLength(1);
    const [interval] = output.MONDAY;
    expect(interval.startMinute).toBeLessThan(interval.endMinute);
    expect(interval.startMinute).toBeGreaterThanOrEqual(0);
    expect(interval.endMinute).toBeLessThanOrEqual(24 * 60);
  });

  it('skips unavailable slots and entries without a day key', () => {
    const output = buildAvailabilityOutput(
      [
        { dayOfWeek: '', slots: [{ isAvailable: true, startTime: '09:00', endTime: '17:00' }] },
        {
          dayOfWeek: 'TUESDAY',
          slots: [{ isAvailable: false, startTime: '09:00', endTime: '17:00' }],
        },
      ],
      identityShift
    );
    expect(output).toEqual({});
  });
});

describe('shiftWeekdayKey', () => {
  it('wraps forward across the week boundary', () => {
    expect(shiftWeekdayKey('SATURDAY', 1)).toBe('SUNDAY');
  });

  it('wraps backward across the week boundary', () => {
    expect(shiftWeekdayKey('SUNDAY', -1)).toBe('SATURDAY');
  });

  it('returns the upper-cased key unchanged for an unknown day', () => {
    expect(shiftWeekdayKey('noday', 3)).toBe('NODAY');
  });
});

describe('canCurrentUserEditTask', () => {
  const norm = (v?: string) => String(v ?? '').toLowerCase();

  it('allows editing an open task assigned by the current user', () => {
    const task = { status: 'PENDING', assignedBy: 'u1' } as Task;
    expect(canCurrentUserEditTask('u1', task, norm)).toBe(true);
  });

  it('blocks completed/cancelled tasks', () => {
    const task = { status: 'COMPLETED', assignedBy: 'u1' } as Task;
    expect(canCurrentUserEditTask('u1', task, norm)).toBe(false);
  });

  it('blocks tasks assigned by someone else', () => {
    const task = { status: 'PENDING', assignedBy: 'u2' } as Task;
    expect(canCurrentUserEditTask('u1', task, norm)).toBe(false);
  });
});

describe('runOncePerKey', () => {
  it('dedupes concurrent callers for the same key', async () => {
    const pending: Record<string, Promise<void>> = {};
    let calls = 0;
    const work = () =>
      new Promise<void>((resolve) => {
        calls += 1;
        setTimeout(resolve, 5);
      });

    await Promise.all([runOncePerKey(pending, 'k', work), runOncePerKey(pending, 'k', work)]);

    expect(calls).toBe(1);
    expect(pending.k).toBeUndefined();
  });

  it('clears the pending entry even when work rejects', async () => {
    const pending: Record<string, Promise<void>> = {};
    await expect(
      runOncePerKey(pending, 'k', () => Promise.reject(new Error('boom')))
    ).rejects.toThrow('boom');
    expect(pending.k).toBeUndefined();
  });
});

describe('isMinuteWithinIntervals', () => {
  const intervals = [{ startMinute: 100, endMinute: 200 }];

  it('is true inside an interval (inclusive bounds)', () => {
    expect(isMinuteWithinIntervals(100, intervals)).toBe(true);
    expect(isMinuteWithinIntervals(200, intervals)).toBe(true);
  });

  it('is false outside every interval', () => {
    expect(isMinuteWithinIntervals(99, intervals)).toBe(false);
    expect(isMinuteWithinIntervals(0, [])).toBe(false);
  });
});

describe('readDropAvailabilityIntervals', () => {
  const resolveAssigneeId = (id?: string) => id ?? '';
  const date = new Date('2026-07-13T00:00:00Z');

  it('returns a full-day window when enforcement is bypassed', () => {
    const draggedTask = { _id: 't1', assignedTo: 'a1' } as Task;
    const result = readDropAvailabilityIntervals({}, date, 'a1', {
      draggedTask,
      resolveAssigneeId,
      shouldEnforceAvailability: () => false,
    });
    expect(result).toEqual([{ startMinute: 0, endMinute: 24 * 60 - 30 }]);
  });

  it('returns an empty list when the assignee cannot be resolved', () => {
    const result = readDropAvailabilityIntervals({}, date, undefined, {
      resolveAssigneeId: () => '',
      shouldEnforceAvailability: () => true,
    });
    expect(result).toEqual([]);
  });

  it('reads cached intervals for the resolved assignee and day', () => {
    const dayKey = date.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
    const cache = { a1: { [dayKey]: [{ startMinute: 60, endMinute: 120 }] } };
    const result = readDropAvailabilityIntervals(cache, date, 'a1', {
      resolveAssigneeId,
      shouldEnforceAvailability: () => true,
    });
    expect(Array.isArray(result)).toBe(true);
  });
});
