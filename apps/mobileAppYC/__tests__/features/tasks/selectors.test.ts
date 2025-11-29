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
  } as unknown as RootState);

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
    {...taskBase, id: '1', category: 'medication', status: 'pending', date: '2023-10-15', time: '10:00'} as any,
    {...taskBase, id: '2', category: 'medication', status: 'completed', date: '2023-10-15', time: '09:00'} as any,
    {...taskBase, id: '3', category: 'general', status: 'pending', date: '2023-10-16', time: '11:00'} as any,
    {...taskBase, id: '4', companionId: 'c2', category: 'medication', status: 'pending', date: '2023-10-15'} as any,
    {...taskBase, id: '5', category: 'medication', status: 'pending', date: '2023-10-15', time: '08:00'} as any,
    {...taskBase, id: '6', category: 'medication', status: 'pending', date: '2023-10-15'} as any,
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
      expect(result.map((t: Task) => t.id).sort()).toEqual(['1', '2', '5', '6']);
    });

    it('filters by serialized Date string logic (fallback in helper)', () => {
        const d = new Date('2023-10-16T10:00:00');
        const res = selectTasksByCompanionAndDate('c1', d)(state);
        expect(res[0].id).toBe('3');
    });

    it('handles errors in date conversion gracefully (catch block)', () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const badDate = new Date();
        jest.spyOn(badDate, 'getTime').mockImplementation(() => {
            throw new Error('Boom');
        });

        const result = selectTasksByCompanionAndDate('c1', badDate)(state);

        expect(result.length).toBeGreaterThan(0);
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Error converting date:'), badDate, expect.any(Error));
        consoleSpy.mockRestore();
    });

    it('handles invalid Date object (NaN)', () => {
        const invalidDate = new Date('invalid-date-string');
        const result = selectTasksByCompanionAndDate('c1', invalidDate)(state);
        expect(result).toHaveLength(4); // Matches today's tasks (default)
    });

    it('handles serialized date object wrapper (plain object case)', () => {
        const result = selectTasksByCompanionAndDate('c1', '2023-10-16' as any)(state);
        expect(result).toHaveLength(1);
    });
  });

  // --- Category Logic ---

  it('selectTasksByCompanionDateAndCategory filters correctly', () => {
    const date = new Date('2023-10-15');
    // FIX 4: Cast category string to 'any' to satisfy TaskCategory union type
    const result = selectTasksByCompanionDateAndCategory('c1', date, 'medication' as any)(state);
    expect(result).toHaveLength(4);
  });

  it('selectAllTasksByCategory filters by category regardless of date', () => {
    // FIX 4: Cast category string to 'any'
    const result = selectAllTasksByCategory('c1', 'general' as any)(state);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('3');
  });

  it('selectTaskCountByCategory counts correctly', () => {
    const date = new Date('2023-10-15');
    // FIX 4: Cast category string to 'any'
    const count = selectTaskCountByCategory('c1', date, 'medication' as any)(state);
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
      const result = selectRecentTasksByCategory('c1', date, 'medication' as any, 10)(state);

      const ids = result.map((t: Task) => t.id);
      expect(ids[ids.length - 1]).toBe('2');
      expect(ids.indexOf('5')).toBeLessThan(ids.indexOf('1'));
    });

    it('respects the limit', () => {
      const date = new Date('2023-10-15');
      // FIX 4: Cast category string to 'any'
      const result = selectRecentTasksByCategory('c1', date, 'medication' as any, 1)(state);
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
        const tA = {...taskBase, id: 'A', status: 'pending', date: '2023-10-15'} as any;
        const tB = {...taskBase, id: 'B', status: 'pending', date: '2023-10-16'} as any;
        const localState = createState([tB, tA]);
        const res = selectUpcomingTasks('c1')(localState);
        expect(res[0].id).toBe('A');
    });

    it('Sorting Branch: Same Date, Both have time', () => {
        const tA = {...taskBase, id: 'A', status: 'pending', date: '2023-10-15', time: '10:00'} as any;
        const tB = {...taskBase, id: 'B', status: 'pending', date: '2023-10-15', time: '09:00'} as any;
        const localState = createState([tA, tB]);
        const res = selectUpcomingTasks('c1')(localState);
        expect(res[0].id).toBe('B');
    });

    it('Sorting Branch: Same Date, A has time, B does not', () => {
        const tA = {...taskBase, id: 'A', status: 'pending', date: '2023-10-15', time: '10:00'} as any;
        const tB = {...taskBase, id: 'B', status: 'pending', date: '2023-10-15'} as any; // no time
        const localState = createState([tB, tA]);
        const res = selectUpcomingTasks('c1')(localState);
        expect(res[0].id).toBe('A');
    });

    it('Sorting Branch: Same Date, A no time, B has time', () => {
        const tA = {...taskBase, id: 'A', status: 'pending', date: '2023-10-15'} as any; // no time
        const tB = {...taskBase, id: 'B', status: 'pending', date: '2023-10-15', time: '10:00'} as any;
        const localState = createState([tA, tB]);
        const res = selectUpcomingTasks('c1')(localState);
        expect(res[0].id).toBe('B');
    });

    it('Sorting Branch: Same Date, No times', () => {
        const tA = {...taskBase, id: 'A', status: 'pending', date: '2023-10-15'} as any;
        const tB = {...taskBase, id: 'B', status: 'pending', date: '2023-10-15'} as any;
        const localState = createState([tA, tB]);
        const res = selectUpcomingTasks('c1')(localState);
        expect(res).toHaveLength(2);
    });
  });
});