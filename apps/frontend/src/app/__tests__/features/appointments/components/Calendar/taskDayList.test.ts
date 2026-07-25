import {
  buildGroupHeading,
  buildTaskDayList,
  buildTaskDaySubtitle,
  formatOverdueLabel,
  formatTaskDueTime,
  toTaskDate,
  type TaskDayEntry,
} from '@/app/features/appointments/components/Calendar/taskDayList';
import { getPreferredTimeZone, setPreferredTimeZone } from '@/app/lib/timezone';
import type { Task, TaskStatus } from '@/app/features/tasks/types/task';

/**
 * The real timezone module is used deliberately. Mocking the `getPreferredTimeZone`
 * export does nothing here: the day-key helpers call it internally, so a mocked
 * export leaves the module reading its real value and the timezone tests would
 * pass while proving nothing. Driving the genuine storage-backed setter exercises
 * the path the app actually takes.
 */
const mockZone = (zone: string) => {
  expect(setPreferredTimeZone(zone)).toBe(true);
  expect(getPreferredTimeZone()).toBe(zone);
};

const makeTask = (overrides: Partial<Task> & { _id: string; dueAt: Date }): Task => ({
  assignedTo: 'user-1',
  audience: 'EMPLOYEE_TASK',
  source: 'CUSTOM',
  category: 'GENERAL',
  name: 'Task',
  status: 'PENDING' as TaskStatus,
  ...overrides,
});

// 2026-07-16T12:00:00Z — a Thursday.
const NOW = new Date('2026-07-16T12:00:00.000Z');

beforeEach(() => {
  mockZone('UTC');
});

describe('toTaskDate', () => {
  it('passes through a valid Date', () => {
    const date = new Date('2026-07-16T09:00:00Z');
    expect(toTaskDate(date)).toBe(date);
  });

  it('rejects an invalid Date', () => {
    expect(toTaskDate(new Date('nonsense'))).toBeNull();
  });

  it('parses strings and numbers', () => {
    expect(toTaskDate('2026-07-16T09:00:00Z')?.toISOString()).toBe('2026-07-16T09:00:00.000Z');
    expect(toTaskDate(NOW.getTime())?.getTime()).toBe(NOW.getTime());
  });

  it('rejects unparseable strings and non-date values', () => {
    expect(toTaskDate('not-a-date')).toBeNull();
    expect(toTaskDate(null)).toBeNull();
    expect(toTaskDate(undefined)).toBeNull();
    expect(toTaskDate({})).toBeNull();
  });
});

describe('formatTaskDueTime', () => {
  it('formats in the preferred zone, not the browser zone', () => {
    const at = new Date('2026-07-16T12:00:00Z');
    expect(formatTaskDueTime(at)).toBe('12:00');
    mockZone('Asia/Kolkata');
    expect(formatTaskDueTime(at)).toBe('17:30');
  });

  it('pads single-digit hours and minutes', () => {
    expect(formatTaskDueTime(new Date('2026-07-16T04:05:00Z'))).toBe('04:05');
  });
});

describe('formatOverdueLabel', () => {
  it.each([
    [0, 'due now'],
    [-5, 'due now'],
    [1, '1 min overdue'],
    [26, '26 min overdue'],
    [59, '59 min overdue'],
    [60, '1 hr overdue'],
    [150, '2 hr overdue'],
    [1439, '23 hr overdue'],
    [1440, '1 day overdue'],
    [2880, '2 days overdue'],
  ])('formats %i minutes as "%s"', (minutes, expected) => {
    expect(formatOverdueLabel(minutes)).toBe(expected);
  });
});

describe('buildTaskDayList bucketing', () => {
  it('buckets overdue, today and later this week', () => {
    const list = buildTaskDayList({
      now: NOW,
      tasks: [
        makeTask({ _id: 'overdue', dueAt: new Date('2026-07-16T11:34:00Z') }),
        makeTask({ _id: 'today', dueAt: new Date('2026-07-16T15:00:00Z') }),
        makeTask({ _id: 'later', dueAt: new Date('2026-07-18T09:00:00Z') }),
      ],
    });

    expect(list.groups.map((g) => [g.id, g.label, g.count])).toEqual([
      ['overdue', 'Overdue', 1],
      ['today', 'Today', 1],
      ['later', 'Later this week', 1],
    ]);
    expect(list.totalCount).toBe(3);
    expect(list.overdueCount).toBe(1);
  });

  it('returns no groups when there is nothing to show', () => {
    const list = buildTaskDayList({ now: NOW, tasks: [] });
    expect(list.groups).toEqual([]);
    expect(list.totalCount).toBe(0);
    expect(list.overdueCount).toBe(0);
  });

  it('omits buckets that have no tasks rather than rendering empty ones', () => {
    const list = buildTaskDayList({
      now: NOW,
      tasks: [makeTask({ _id: 'today', dueAt: new Date('2026-07-16T15:00:00Z') })],
    });
    expect(list.groups.map((g) => g.id)).toEqual(['today']);
  });

  it('puts every task in Overdue when all are past due', () => {
    const list = buildTaskDayList({
      now: NOW,
      tasks: [
        makeTask({ _id: 'a', dueAt: new Date('2026-07-16T08:00:00Z') }),
        makeTask({ _id: 'b', dueAt: new Date('2026-07-15T08:00:00Z') }),
        makeTask({ _id: 'c', dueAt: new Date('2026-07-10T08:00:00Z') }),
      ],
    });
    expect(list.groups.map((g) => g.id)).toEqual(['overdue']);
    expect(list.overdueCount).toBe(3);
  });

  it('treats a task due exactly now as Today, not Overdue', () => {
    const list = buildTaskDayList({
      now: NOW,
      tasks: [makeTask({ _id: 'boundary', dueAt: new Date(NOW.getTime()) })],
    });
    expect(list.groups.map((g) => g.id)).toEqual(['today']);
    expect(list.overdueCount).toBe(0);
  });

  it('treats one millisecond before now as Overdue', () => {
    const list = buildTaskDayList({
      now: NOW,
      tasks: [makeTask({ _id: 'boundary', dueAt: new Date(NOW.getTime() - 1) })],
    });
    expect(list.groups.map((g) => g.id)).toEqual(['overdue']);
    expect(list.groups[0].entries[0].overdueMinutes).toBe(0);
  });

  it('drops tasks beyond this week', () => {
    const list = buildTaskDayList({
      now: NOW,
      tasks: [
        makeTask({ _id: 'edge', dueAt: new Date('2026-07-22T09:00:00Z') }),
        makeTask({ _id: 'beyond', dueAt: new Date('2026-07-23T09:00:00Z') }),
        makeTask({ _id: 'far', dueAt: new Date('2026-09-01T09:00:00Z') }),
      ],
    });
    expect(list.groups.map((g) => g.id)).toEqual(['later']);
    expect(list.groups[0].entries.map((e) => e.task._id)).toEqual(['edge']);
  });

  it('drops tasks with no usable due date', () => {
    const list = buildTaskDayList({
      now: NOW,
      tasks: [
        makeTask({ _id: 'bad', dueAt: new Date('nonsense') }),
        makeTask({ _id: 'good', dueAt: new Date('2026-07-16T15:00:00Z') }),
      ],
    });
    expect(list.totalCount).toBe(1);
    expect(list.groups[0].entries[0].task._id).toBe('good');
  });

  it.each<[TaskStatus]>([['COMPLETED'], ['CANCELLED']])(
    'never marks a %s task overdue',
    (status) => {
      const list = buildTaskDayList({
        now: NOW,
        tasks: [makeTask({ _id: 'done', status, dueAt: new Date('2026-07-16T08:00:00Z') })],
      });
      expect(list.overdueCount).toBe(0);
      expect(list.groups.map((g) => g.id)).toEqual(['today']);
      expect(list.groups[0].entries[0].isDone).toBe(true);
    }
  );

  it('drops settled tasks from a past day but keeps open ones as overdue', () => {
    const list = buildTaskDayList({
      now: NOW,
      tasks: [
        makeTask({
          _id: 'done-yesterday',
          status: 'COMPLETED',
          dueAt: new Date('2026-07-15T08:00:00Z'),
        }),
        makeTask({ _id: 'open-yesterday', dueAt: new Date('2026-07-15T08:00:00Z') }),
      ],
    });
    expect(list.totalCount).toBe(1);
    expect(list.groups[0].id).toBe('overdue');
    expect(list.groups[0].entries[0].task._id).toBe('open-yesterday');
  });

  it('sorts entries chronologically, then by id, regardless of input order', () => {
    const list = buildTaskDayList({
      now: NOW,
      tasks: [
        makeTask({ _id: 'z', dueAt: new Date('2026-07-16T16:00:00Z') }),
        makeTask({ _id: 'b', dueAt: new Date('2026-07-16T14:00:00Z') }),
        makeTask({ _id: 'a', dueAt: new Date('2026-07-16T14:00:00Z') }),
      ],
    });
    expect(list.groups[0].entries.map((e) => e.task._id)).toEqual(['a', 'b', 'z']);
  });

  it('falls back to the array index when a task has no id', () => {
    const list = buildTaskDayList({
      now: NOW,
      tasks: [makeTask({ _id: '', dueAt: new Date('2026-07-16T15:00:00Z') })],
    });
    expect(list.groups[0].entries[0].id).toBe('task:0');
  });

  it('computes whole minutes of lateness', () => {
    const list = buildTaskDayList({
      now: NOW,
      tasks: [makeTask({ _id: 'late', dueAt: new Date('2026-07-16T11:34:30Z') })],
    });
    expect(list.groups[0].entries[0].overdueMinutes).toBe(25);
  });
});

describe('buildTaskDayList anchoring', () => {
  it('labels the middle bucket with the day when the anchor is not today', () => {
    const anchor = new Date('2026-07-17T00:00:00Z');
    const list = buildTaskDayList({
      now: NOW,
      anchor,
      tasks: [makeTask({ _id: 'tomorrow', dueAt: new Date('2026-07-17T09:00:00Z') })],
    });
    expect(list.groups.map((g) => g.id)).toEqual(['today']);
    expect(list.groups[0].label).toBe('Fri 17 Jul');
  });

  it('keeps overdue work visible when the header steps forward a day', () => {
    // Stepping off today must not hide late work — overdue is a "now" fact, not
    // a property of the day being viewed.
    const list = buildTaskDayList({
      now: NOW,
      anchor: new Date('2026-07-17T00:00:00Z'),
      tasks: [makeTask({ _id: 'past', dueAt: new Date('2026-07-16T08:00:00Z') })],
    });
    expect(list.groups.map((g) => g.id)).toEqual(['overdue']);
    expect(list.overdueCount).toBe(1);
  });

  it('windows "later this week" from the anchor, not from now', () => {
    const list = buildTaskDayList({
      now: NOW,
      anchor: new Date('2026-07-18T00:00:00Z'),
      tasks: [makeTask({ _id: 'far', dueAt: new Date('2026-07-24T09:00:00Z') })],
    });
    expect(list.groups.map((g) => g.id)).toEqual(['later']);
  });
});

describe('buildTaskDayList timezone safety', () => {
  it('does not shift a task across days when the preferred zone is ahead of UTC', () => {
    // 22:30 UTC on the 16th is 04:00 on the 17th in Kolkata.
    const dueAt = new Date('2026-07-16T22:30:00.000Z');
    mockZone('UTC');
    expect(
      buildTaskDayList({ now: NOW, tasks: [makeTask({ _id: 't', dueAt })] }).groups[0].id
    ).toBe('today');

    mockZone('Asia/Kolkata');
    const shifted = buildTaskDayList({ now: NOW, tasks: [makeTask({ _id: 't', dueAt })] });
    // Kolkata reads `now` as the 16th 17:30 and the task as the 17th — so it is
    // tomorrow, not today. The bucket follows the preferred zone's calendar.
    expect(shifted.groups[0].id).toBe('later');
  });

  it('does not shift a task across days when the preferred zone is behind UTC', () => {
    // 02:00 UTC on the 17th is 19:00 on the 16th in Los Angeles.
    const dueAt = new Date('2026-07-17T02:00:00.000Z');
    mockZone('America/Los_Angeles');
    const list = buildTaskDayList({ now: NOW, tasks: [makeTask({ _id: 't', dueAt })] });
    expect(list.groups[0].id).toBe('today');
  });

  it('keeps overdue detection instant-based and zone-independent', () => {
    const dueAt = new Date('2026-07-16T11:00:00.000Z');
    const forZone = (zone: string) => {
      mockZone(zone);
      return buildTaskDayList({ now: NOW, tasks: [makeTask({ _id: 't', dueAt })] }).overdueCount;
    };
    expect(forZone('UTC')).toBe(1);
    expect(forZone('Asia/Kolkata')).toBe(1);
    expect(forZone('America/Los_Angeles')).toBe(1);
  });
});

describe('buildTaskDaySubtitle', () => {
  const entry = (overrides: Partial<TaskDayEntry> = {}): TaskDayEntry => ({
    id: 'task:1',
    task: makeTask({ _id: '1', dueAt: new Date('2026-07-16T14:00:00Z') }),
    at: new Date('2026-07-16T14:00:00Z'),
    status: 'PENDING',
    isDone: false,
    isOverdue: false,
    overdueMinutes: 0,
    ...overrides,
  });

  it('renders the design line for an overdue task', () => {
    expect(buildTaskDaySubtitle(entry({ isOverdue: true, overdueMinutes: 26 }), 'you')).toBe(
      'Due 14:00 · 26 min overdue · you'
    );
  });

  it('omits the overdue part when the task is not late', () => {
    expect(buildTaskDaySubtitle(entry(), 'Dr Weber')).toBe('Due 14:00 · Dr Weber');
  });

  it('omits the assignee when there is no name to show', () => {
    expect(buildTaskDaySubtitle(entry())).toBe('Due 14:00');
    expect(buildTaskDaySubtitle(entry(), '   ')).toBe('Due 14:00');
  });
});

describe('buildGroupHeading', () => {
  it('renders "Overdue · 1"', () => {
    expect(buildGroupHeading({ id: 'overdue', label: 'Overdue', count: 1, entries: [] })).toBe(
      'Overdue · 1'
    );
  });
});
