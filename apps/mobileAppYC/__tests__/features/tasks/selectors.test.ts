// Using relative paths to fix "Cannot find module" errors
import {
  selectAllTasks,
  selectTasksLoading,
  selectTasksError,
  selectHasHydratedCompanion,
  selectTasksByCompanion,
  selectTasksByCompanionAndDate,
  selectTasksByCompanionDateAndCategory,
  selectRecentTasksByCategory,
  selectAllTasksByCategory,
  selectTaskById,
  selectTasksByStatus,
  selectTaskCountByCategory,
  selectUpcomingTasks,
  selectNextUpcomingTask,
  taskOccursOnDate,
} from '../../../src/features/tasks/selectors';
import type {RootState} from '../../../src/app/store';
import type {Task} from '../../../src/features/tasks/types';

// Helper to create state
// FIX 1: Cast to 'unknown' first to bypass missing '_persist' property error from Redux Persist
const createState = (
  items: Task[] = [],
  loading = false,
  error: string | null = null,
  hydratedCompanions: Record<string, boolean> = {},
): RootState =>
  ({
    tasks: {
      items,
      loading,
      error,
      hydratedCompanions,
    },
  }) as unknown as RootState;

describe('features/tasks/selectors', () => {
  const mockDate = new Date('2023-10-15T12:00:00Z');

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(mockDate);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  // FIX 2: Add missing required properties to taskBase to satisfy Task type
  const taskBase = {
    companionId: 'c1',
    userId: 'user-1', // Added generic user ID
    title: 'Task',
    description: 'Desc',
    createdAt: '2023-01-01',
    updatedAt: '2023-01-01',
    frequency: {type: 'daily'}, // Added required frequency object
    isArchived: false,
  };

  // FIX 3: Stronger casting (as any) to prevent partial mismatch errors during mock creation
  const tasks: Task[] = [
    {
      ...taskBase,
      id: '1',
      category: 'medication',
      status: 'pending',
      date: '2023-10-15',
      time: '10:00',
    } as any,
    {
      ...taskBase,
      id: '2',
      category: 'medication',
      status: 'completed',
      date: '2023-10-15',
      time: '09:00',
    } as any,
    {
      ...taskBase,
      id: '3',
      category: 'general',
      status: 'pending',
      date: '2023-10-16',
      time: '11:00',
    } as any,
    {
      ...taskBase,
      id: '4',
      companionId: 'c2',
      category: 'medication',
      status: 'pending',
      date: '2023-10-15',
    } as any,
    {
      ...taskBase,
      id: '5',
      category: 'medication',
      status: 'pending',
      date: '2023-10-15',
      time: '08:00',
    } as any,
    {
      ...taskBase,
      id: '6',
      category: 'medication',
      status: 'pending',
      date: '2023-10-15',
    } as any,
  ];

  const state = createState(tasks, false, null, {c1: true});

  // --- Basic Selectors ---

  it('selectAllTasks returns all items', () => {
    expect(selectAllTasks(state)).toEqual(tasks);
  });

  it('selectTasksLoading returns loading state', () => {
    expect(selectTasksLoading(createState([], true))).toBe(true);
  });

  it('selectTasksError returns error state', () => {
    expect(selectTasksError(createState([], false, 'Error'))).toBe('Error');
  });

  // --- Hydration ---

  it('selectHasHydratedCompanion returns correct status', () => {
    expect(selectHasHydratedCompanion('c1')(state)).toBe(true);
    expect(selectHasHydratedCompanion('c2')(state)).toBe(false); // Not in record
    expect(selectHasHydratedCompanion(null)(state)).toBe(false);
  });

  // --- Filtering by Companion ---

  it('selectTasksByCompanion filters by ID', () => {
    const result = selectTasksByCompanion('c1')(state);
    expect(result).toHaveLength(5);
    expect(result.find((t: Task) => t.companionId === 'c2')).toBeUndefined();
  });

  it('selectTasksByCompanion returns empty if null id', () => {
    expect(selectTasksByCompanion(null)(state)).toEqual([]);
  });

  // --- Date Formatting & Date Selection Logic ---

  describe('selectTasksByCompanionAndDate (and getDateString helper)', () => {
    it('filters by Date object', () => {
      const dateObj = new Date('2023-10-15T00:00:00');
      const result = selectTasksByCompanionAndDate('c1', dateObj)(state);
      expect(result).toHaveLength(4);
      expect(result.map((t: Task) => t.id).sort()).toEqual([
        '1',
        '2',
        '5',
        '6',
      ]);
    });

    it('filters by serialized Date string logic (fallback in helper)', () => {
      const d = new Date('2023-10-16T10:00:00');
      const res = selectTasksByCompanionAndDate('c1', d)(state);
      expect(res[0].id).toBe('3');
    });

    it('handles errors in date conversion gracefully (catch block)', () => {
      const consoleSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => {});
      const badDate = new Date();
      jest.spyOn(badDate, 'getTime').mockImplementation(() => {
        throw new Error('Boom');
      });

      const result = selectTasksByCompanionAndDate('c1', badDate)(state);

      expect(result.length).toBeGreaterThan(0);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error converting date:'),
        badDate,
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });

    it('handles invalid Date object (NaN)', () => {
      const invalidDate = new Date('invalid-date-string');
      const result = selectTasksByCompanionAndDate('c1', invalidDate)(state);
      expect(result).toHaveLength(4); // Matches today's tasks (default)
    });

    it('handles serialized date object wrapper (plain object case)', () => {
      const result = selectTasksByCompanionAndDate(
        'c1',
        '2023-10-16' as any,
      )(state);
      expect(result).toHaveLength(1);
    });

    it('falls back to today for a value that is neither a Date, object, nor string', () => {
      const result = selectTasksByCompanionAndDate('c1', 123 as any)(state);
      // mockDate is frozen at 2023-10-15, matching tasks 1/2/5/6.
      expect(result).toHaveLength(4);
    });

    it('falls back to today for a plain object that does not parse into a valid Date', () => {
      const result = selectTasksByCompanionAndDate('c1', {foo: 'bar'} as any)(
        state,
      );
      // mockDate is frozen at 2023-10-15, matching tasks 1/2/5/6.
      expect(result).toHaveLength(4);
    });

    it('resolves a plain object that parses into a valid Date via its own timestamp', () => {
      const dateLikeObject = {
        valueOf: () => new Date('2023-10-16').getTime(),
      };
      const result = selectTasksByCompanionAndDate(
        'c1',
        dateLikeObject as any,
      )(state);
      // Task '3' is the only c1 task dated 2023-10-16.
      expect(result).toHaveLength(1);
    });
  });

  // --- Category Logic ---

  it('selectTasksByCompanionDateAndCategory filters correctly', () => {
    const date = new Date('2023-10-15');
    // FIX 4: Cast category string to 'any' to satisfy TaskCategory union type
    const result = selectTasksByCompanionDateAndCategory(
      'c1',
      date,
      'medication' as any,
    )(state);
    expect(result).toHaveLength(4);
  });

  it('selectAllTasksByCategory filters by category regardless of date', () => {
    // FIX 4: Cast category string to 'any'
    const result = selectAllTasksByCategory('c1', 'general' as any)(state);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('3');
  });

  it('selectAllTasksByCategory sorts pending/active before completed before cancelled, then by date, then by time', () => {
    const sortTasks: Task[] = [
      {
        ...taskBase,
        id: 's-completed',
        category: 'medication',
        status: 'completed',
        date: '2023-10-15',
        time: '09:00',
      } as any,
      {
        ...taskBase,
        id: 's-cancelled',
        category: 'medication',
        status: 'cancelled',
        date: '2023-10-15',
        time: '09:00',
      } as any,
      {
        ...taskBase,
        id: 's-in-progress-older-date',
        category: 'medication',
        status: 'in_progress',
        date: '2023-10-14',
        time: '09:00',
      } as any,
      {
        ...taskBase,
        id: 's-overdue-newer-date',
        category: 'medication',
        status: 'overdue',
        date: '2023-10-16',
        time: '10:00',
      } as any,
      {
        ...taskBase,
        id: 's-no-time',
        category: 'medication',
        status: 'pending',
        date: '2023-10-16',
        time: undefined,
      } as any,
      {
        ...taskBase,
        id: 's-earlier-time',
        category: 'medication',
        status: 'pending',
        date: '2023-10-16',
        time: '08:00',
      } as any,
    ];
    const sortState = createState(sortTasks, false, null, {c1: true});

    const result = selectAllTasksByCategory(
      'c1',
      'medication' as any,
    )(sortState);

    // Active statuses (pending/in_progress/overdue) sort before completed,
    // which sorts before cancelled; within a priority tier, newest date
    // first, then tasks with a time before those without, then ascending time.
    expect(result.map(t => t.id)).toEqual([
      's-earlier-time',
      's-overdue-newer-date',
      's-no-time',
      's-in-progress-older-date',
      's-completed',
      's-cancelled',
    ]);
  });

  it('selectAllTasksByCategory treats an unrecognized status as equal priority to completed', () => {
    const weirdTasks: Task[] = [
      {
        ...taskBase,
        id: 's-weird-status',
        category: 'medication',
        status: 'some_weird_status',
        date: '2023-10-15',
      } as any,
      {
        ...taskBase,
        id: 's-pending',
        category: 'medication',
        status: 'pending',
        date: '2023-10-14',
      } as any,
    ];
    const weirdState = createState(weirdTasks, false, null, {c1: true});

    const result = selectAllTasksByCategory(
      'c1',
      'medication' as any,
    )(weirdState);

    // Pending (priority 0) sorts before the unrecognized status (falls back
    // to priority 1, same tier as completed), regardless of date order.
    expect(result.map(t => t.id)).toEqual(['s-pending', 's-weird-status']);
  });

  it('selectAllTasksByCategory keeps original relative order when date and time are both absent', () => {
    const noTimeTasks: Task[] = [
      {
        ...taskBase,
        id: 's-tie-1',
        category: 'medication',
        status: 'pending',
        date: '2023-10-15',
        time: undefined,
      } as any,
      {
        ...taskBase,
        id: 's-tie-2',
        category: 'medication',
        status: 'pending',
        date: '2023-10-15',
        time: undefined,
      } as any,
    ];
    const noTimeState = createState(noTimeTasks, false, null, {c1: true});

    const result = selectAllTasksByCategory(
      'c1',
      'medication' as any,
    )(noTimeState);

    expect(result.map(t => t.id)).toEqual(['s-tie-1', 's-tie-2']);
  });

  it('selectTaskCountByCategory counts correctly', () => {
    const date = new Date('2023-10-15');
    // FIX 4: Cast category string to 'any'
    const count = selectTaskCountByCategory(
      'c1',
      date,
      'medication' as any,
    )(state);
    expect(count).toBe(4);
  });

  // --- Single Item Selectors ---

  it('selectTaskById finds task', () => {
    expect(selectTaskById('3')(state)).toEqual(tasks[2]);
    expect(selectTaskById('999')(state)).toBeUndefined();
    expect(selectTaskById(null)(state)).toBeNull();
  });

  it('selectTasksByStatus filters by status', () => {
    const completed = selectTasksByStatus('c1', 'completed')(state);
    expect(completed).toHaveLength(1);
    expect(completed[0].id).toBe('2');
  });

  // --- Complex Sorting Selectors ---

  describe('selectRecentTasksByCategory', () => {
    it('sorts pending first, then by time', () => {
      const date = new Date('2023-10-15');
      // FIX 4: Cast category string to 'any'
      const result = selectRecentTasksByCategory(
        'c1',
        date,
        'medication' as any,
        10,
      )(state);

      const ids = result.map((t: Task) => t.id);
      expect(ids[ids.length - 1]).toBe('2');
      expect(ids.indexOf('5')).toBeLessThan(ids.indexOf('1'));
    });

    it('respects the limit', () => {
      const date = new Date('2023-10-15');
      // FIX 4: Cast category string to 'any'
      const result = selectRecentTasksByCategory(
        'c1',
        date,
        'medication' as any,
        1,
      )(state);
      expect(result).toHaveLength(1);
    });

    it('defaults the limit to 1 when omitted', () => {
      const date = new Date('2023-10-15');
      const result = selectRecentTasksByCategory(
        'c1',
        date,
        'medication' as any,
      )(state);
      expect(result).toHaveLength(1);
    });
  });

  describe('selectUpcomingTasks (Sorting & Filtering)', () => {
    it('filters correctly and sorts by date/time', () => {
      const result = selectUpcomingTasks('c1')(state);
      const ids = result.map((t: Task) => t.id);
      expect(ids).toEqual(['5', '1', '6', '3']);
    });

    it('selectNextUpcomingTask returns the first one', () => {
      const result = selectNextUpcomingTask('c1')(state);
      expect(result?.id).toBe('5');
    });

    it('selectNextUpcomingTask returns null if empty', () => {
      const emptyState = createState([], false);
      expect(selectNextUpcomingTask('c1')(emptyState)).toBeNull();
    });

    // **Branch Coverage for Sorters**

    it('Sorting Branch: Date Comparison (Different Dates)', () => {
      const tA = {
        ...taskBase,
        id: 'A',
        status: 'pending',
        date: '2023-10-15',
      } as any;
      const tB = {
        ...taskBase,
        id: 'B',
        status: 'pending',
        date: '2023-10-16',
      } as any;
      const localState = createState([tB, tA]);
      const res = selectUpcomingTasks('c1')(localState);
      expect(res[0].id).toBe('A');
    });

    it('Sorting Branch: Same Date, Both have time', () => {
      const tA = {
        ...taskBase,
        id: 'A',
        status: 'pending',
        date: '2023-10-15',
        time: '10:00',
      } as any;
      const tB = {
        ...taskBase,
        id: 'B',
        status: 'pending',
        date: '2023-10-15',
        time: '09:00',
      } as any;
      const localState = createState([tA, tB]);
      const res = selectUpcomingTasks('c1')(localState);
      expect(res[0].id).toBe('B');
    });

    it('Sorting Branch: Same Date, A has time, B does not', () => {
      const tA = {
        ...taskBase,
        id: 'A',
        status: 'pending',
        date: '2023-10-15',
        time: '10:00',
      } as any;
      const tB = {
        ...taskBase,
        id: 'B',
        status: 'pending',
        date: '2023-10-15',
      } as any; // no time
      const localState = createState([tB, tA]);
      const res = selectUpcomingTasks('c1')(localState);
      expect(res[0].id).toBe('A');
    });

    it('Sorting Branch: Same Date, A no time, B has time', () => {
      const tA = {
        ...taskBase,
        id: 'A',
        status: 'pending',
        date: '2023-10-15',
      } as any; // no time
      const tB = {
        ...taskBase,
        id: 'B',
        status: 'pending',
        date: '2023-10-15',
        time: '10:00',
      } as any;
      const localState = createState([tA, tB]);
      const res = selectUpcomingTasks('c1')(localState);
      expect(res[0].id).toBe('B');
    });

    it('Sorting Branch: Same Date, No times', () => {
      const tA = {
        ...taskBase,
        id: 'A',
        status: 'pending',
        date: '2023-10-15',
      } as any;
      const tB = {
        ...taskBase,
        id: 'B',
        status: 'pending',
        date: '2023-10-15',
      } as any;
      const localState = createState([tA, tB]);
      const res = selectUpcomingTasks('c1')(localState);
      expect(res).toHaveLength(2);
    });
  });

  // --- taskOccursOnDate ---

  describe('taskOccursOnDate', () => {
    const base = {
      companionId: 'c1',
      date: '2026-06-10',
      status: 'PENDING',
      details: {},
    } as any;

    it('once task: matches only on start date', () => {
      const t = {...base, frequency: 'once'} as any;
      expect(taskOccursOnDate(t, '2026-06-10')).toBe(true);
      expect(taskOccursOnDate(t, '2026-06-11')).toBe(false);
      expect(taskOccursOnDate(t, '2026-06-09')).toBe(false);
    });

    it('daily task: matches on start date and every subsequent day', () => {
      const t = {...base, frequency: 'daily'} as any;
      expect(taskOccursOnDate(t, '2026-06-10')).toBe(true);
      expect(taskOccursOnDate(t, '2026-06-11')).toBe(true);
      expect(taskOccursOnDate(t, '2026-07-01')).toBe(true);
      expect(taskOccursOnDate(t, '2026-06-09')).toBe(false); // before start
    });

    it('daily task with endDate: does not match after end', () => {
      const t = {
        ...base,
        frequency: 'daily',
        recurrenceEndDate: '2026-06-15',
      } as any;
      expect(taskOccursOnDate(t, '2026-06-15')).toBe(true);
      expect(taskOccursOnDate(t, '2026-06-16')).toBe(false);
    });

    it('weekly task: matches same day of week only', () => {
      // 2026-06-10 is a Wednesday
      const t = {...base, frequency: 'weekly'} as any;
      expect(taskOccursOnDate(t, '2026-06-10')).toBe(true); // Wed
      expect(taskOccursOnDate(t, '2026-06-17')).toBe(true); // next Wed
      expect(taskOccursOnDate(t, '2026-06-24')).toBe(true); // Wed after
      expect(taskOccursOnDate(t, '2026-06-11')).toBe(false); // Thu
      expect(taskOccursOnDate(t, '2026-06-09')).toBe(false); // before start
    });

    it('monthly task: matches same day-of-month only', () => {
      const t = {...base, frequency: 'monthly'} as any;
      expect(taskOccursOnDate(t, '2026-06-10')).toBe(true);
      expect(taskOccursOnDate(t, '2026-07-10')).toBe(true);
      expect(taskOccursOnDate(t, '2026-08-10')).toBe(true);
      expect(taskOccursOnDate(t, '2026-07-11')).toBe(false);
      expect(taskOccursOnDate(t, '2026-06-09')).toBe(false); // before start
    });

    it('unrecognised frequency falls back to exact date match', () => {
      const t = {...base, frequency: {type: 'daily'}} as any;
      expect(taskOccursOnDate(t, '2026-06-10')).toBe(true);
      expect(taskOccursOnDate(t, '2026-06-11')).toBe(false);
    });
  });

  // --- selectTasksByCompanionAndDate with recurring tasks ---

  describe('selectTasksByCompanionAndDate — recurring', () => {
    const recurringTask: Task = {
      id: 'r1',
      companionId: 'c1',
      category: 'hygiene',
      title: 'Give bath',
      date: '2026-06-10',
      frequency: 'daily',
      reminderEnabled: false,
      reminderOptions: null,
      syncWithCalendar: false,
      attachDocuments: false,
      attachments: [],
      status: 'PENDING',
      createdAt: '2026-06-10T00:00:00Z',
      updatedAt: '2026-06-10T00:00:00Z',
      details: {taskType: 'give-bath'},
    } as any;

    it('shows a daily task on its start date', () => {
      const s = createState([recurringTask]);
      const res = selectTasksByCompanionAndDate(
        'c1',
        new Date('2026-06-10T00:00:00'),
      )(s);
      expect(res).toHaveLength(1);
    });

    it('shows a daily task on a future date', () => {
      const s = createState([recurringTask]);
      const res = selectTasksByCompanionAndDate(
        'c1',
        new Date('2026-06-25T00:00:00'),
      )(s);
      expect(res).toHaveLength(1);
    });

    it('does not show a daily task before its start date', () => {
      const s = createState([recurringTask]);
      const res = selectTasksByCompanionAndDate(
        'c1',
        new Date('2026-06-09T00:00:00'),
      )(s);
      expect(res).toHaveLength(0);
    });

    it('respects recurrenceEndDate — hides task after end', () => {
      const bounded = {
        ...recurringTask,
        recurrenceEndDate: '2026-06-15',
      } as any;
      const s = createState([bounded]);
      expect(
        selectTasksByCompanionAndDate('c1', new Date('2026-06-15T00:00:00'))(s),
      ).toHaveLength(1);
      expect(
        selectTasksByCompanionAndDate('c1', new Date('2026-06-16T00:00:00'))(s),
      ).toHaveLength(0);
    });
  });
});
