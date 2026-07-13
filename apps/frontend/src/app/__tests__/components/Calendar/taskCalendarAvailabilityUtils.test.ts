import {
  buildAvailabilityOutput,
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
