import tasksReducer, {
  clearTaskError,
  injectMockTasks,
} from '@/features/tasks/taskSlice';

// --- Mock the thunks module ---
// We use the relative path here as well to ensure Jest resolves it correctly
jest.mock('@/features/tasks/thunks', () => ({
  fetchTasksForCompanion: {
    pending: { type: 'tasks/fetchTasksForCompanion/pending' },
    fulfilled: { type: 'tasks/fetchTasksForCompanion/fulfilled' },
    rejected: { type: 'tasks/fetchTasksForCompanion/rejected' },
  },
  addTask: {
    pending: { type: 'tasks/addTask/pending' },
    fulfilled: { type: 'tasks/addTask/fulfilled' },
    rejected: { type: 'tasks/addTask/rejected' },
  },
  updateTask: {
    pending: { type: 'tasks/updateTask/pending' },
    fulfilled: { type: 'tasks/updateTask/fulfilled' },
    rejected: { type: 'tasks/updateTask/rejected' },
  },
  deleteTask: {
    pending: { type: 'tasks/deleteTask/pending' },
    fulfilled: { type: 'tasks/deleteTask/fulfilled' },
    rejected: { type: 'tasks/deleteTask/rejected' },
  },
  markTaskStatus: {
    pending: { type: 'tasks/markTaskStatus/pending' },
    fulfilled: { type: 'tasks/markTaskStatus/fulfilled' },
    rejected: { type: 'tasks/markTaskStatus/rejected' },
  },
}));

// Helper to create mock data
const mockTask = (
  id: string,
  companionId: string,
  status = 'pending'
): any => ({
  id,
  companionId,
  title: `Task ${id}`,
  status,
  createdAt: '2023-01-01T00:00:00.000Z',
  updatedAt: '2023-01-01T00:00:00.000Z',
});

describe('features/tasks/taskSlice', () => {
  const initialState = {
    items: [],
    loading: false,
    error: null,
    hydratedCompanions: {},
  };

  // -------------------------------------------------------------------------
  // Initial State
  // -------------------------------------------------------------------------

  it('should handle initial state', () => {
    expect(tasksReducer(undefined, { type: 'unknown' })).toEqual(initialState);
  });

  // -------------------------------------------------------------------------
  // Synchronous Reducers
  // -------------------------------------------------------------------------

  describe('reducers', () => {
    it('should handle clearTaskError', () => {
      const errorState = { ...initialState, error: 'Something went wrong' };
      const nextState = tasksReducer(errorState, clearTaskError());
      expect(nextState.error).toBeNull();
    });

    it('should handle injectMockTasks', () => {
      // Setup: Existing tasks for companion 1 and 2
      const existingState = {
        ...initialState,
        items: [mockTask('1', 'C1'), mockTask('2', 'C2')],
        hydratedCompanions: { C2: true },
      };

      const newTasks = [mockTask('3', 'C1'), mockTask('4', 'C1')];

      // Action: Inject tasks for C1 (should replace existing C1 tasks, keep C2)
      const nextState = tasksReducer(
        existingState,
        injectMockTasks({ companionId: 'C1', tasks: newTasks })
      );

      expect(nextState.items).toHaveLength(3); // 1 from C2 + 2 new from C1
      // Explicitly typed 't' as any to fix TS7006
      expect(nextState.items.find((t: any) => t.id === '1')).toBeUndefined(); // Old C1 task removed
      expect(nextState.items.find((t: any) => t.id === '2')).toBeDefined(); // C2 task kept
      expect(nextState.items.find((t: any) => t.id === '3')).toBeDefined(); // New C1 task added
      expect(nextState.hydratedCompanions.C1).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Async Thunks - Extra Reducers
  // -------------------------------------------------------------------------

  describe('fetchTasksForCompanion', () => {
    const pendingType = 'tasks/fetchTasksForCompanion/pending';
    const fulfilledType = 'tasks/fetchTasksForCompanion/fulfilled';
    const rejectedType = 'tasks/fetchTasksForCompanion/rejected';

    it('should set loading true on pending', () => {
      const nextState = tasksReducer(initialState, { type: pendingType });
      expect(nextState.loading).toBe(true);
      expect(nextState.error).toBeNull();
    });

    it('should replace tasks and set hydrated on fulfilled', () => {
      const startState = {
        ...initialState,
        loading: true,
        items: [mockTask('old1', 'C1'), mockTask('keep1', 'C2')],
      };
      const newTasks = [mockTask('new1', 'C1')];

      const action = {
        type: fulfilledType,
        payload: { companionId: 'C1', tasks: newTasks },
      };

      const nextState = tasksReducer(startState, action);

      expect(nextState.loading).toBe(false);
      expect(nextState.items).toHaveLength(2); // 1 kept + 1 new
      // Explicitly typed 't' as any to fix TS7006
      expect(
        nextState.items.find((t: any) => t.id === 'old1')
      ).toBeUndefined();
      expect(
        nextState.items.find((t: any) => t.id === 'new1')
      ).toBeDefined();
      expect(nextState.hydratedCompanions.C1).toBe(true);
    });

    it('should set error payload on rejected', () => {
      const action = {
        type: rejectedType,
        payload: 'Network Error',
      };
      const nextState = tasksReducer(
        { ...initialState, loading: true },
        action
      );
      expect(nextState.loading).toBe(false);
      expect(nextState.error).toBe('Network Error');
    });

    it('should use default error message if rejected payload is undefined', () => {
      const action = {
        type: rejectedType,
        payload: undefined,
      };
      const nextState = tasksReducer(
        { ...initialState, loading: true },
        action
      );
      expect(nextState.loading).toBe(false);
      expect(nextState.error).toBe('Unable to fetch tasks');
    });
  });

  describe('addTask', () => {
    const pendingType = 'tasks/addTask/pending';
    const fulfilledType = 'tasks/addTask/fulfilled';
    const rejectedType = 'tasks/addTask/rejected';

    it('should set loading true on pending', () => {
      const nextState = tasksReducer(initialState, { type: pendingType });
      expect(nextState.loading).toBe(true);
    });

    it('should add the new task on fulfilled', () => {
      const newTask = mockTask('1', 'C1');
      const action = { type: fulfilledType, payload: newTask };
      const nextState = tasksReducer(initialState, action);

      expect(nextState.loading).toBe(false);
      expect(nextState.items).toContainEqual(newTask);
    });

    it('should set error payload on rejected', () => {
      const action = { type: rejectedType, payload: 'Failed to add' };
      const nextState = tasksReducer(
        { ...initialState, loading: true },
        action
      );
      expect(nextState.error).toBe('Failed to add');
    });

    it('should use default error message if rejected payload is undefined', () => {
      const action = { type: rejectedType, payload: undefined };
      const nextState = tasksReducer(
        { ...initialState, loading: true },
        action
      );
      expect(nextState.error).toBe('Unable to add task');
    });
  });

  describe('updateTask', () => {
    const pendingType = 'tasks/updateTask/pending';
    const fulfilledType = 'tasks/updateTask/fulfilled';
    const rejectedType = 'tasks/updateTask/rejected';

    const startState = {
      ...initialState,
      items: [mockTask('1', 'C1', 'pending')],
    };

    it('should set loading true on pending', () => {
      const nextState = tasksReducer(startState, { type: pendingType });
      expect(nextState.loading).toBe(true);
    });

    it('should update specific fields on fulfilled', () => {
      const action = {
        type: fulfilledType,
        payload: { taskId: '1', updates: { title: 'Updated Title' } },
      };
      const nextState = tasksReducer(startState, action);

      expect(nextState.loading).toBe(false);
      expect(nextState.items[0].title).toBe('Updated Title');
      expect(nextState.items[0].status).toBe('pending');
    });

    it('should do nothing if task not found on fulfilled', () => {
      const action = {
        type: fulfilledType,
        payload: { taskId: '999', updates: { title: 'Ghost' } },
      };
      const nextState = tasksReducer(startState, action);
      expect(nextState.items).toEqual(startState.items);
    });

    it('should set error payload on rejected', () => {
      const action = { type: rejectedType, payload: 'Update failed' };
      const nextState = tasksReducer(
        { ...startState, loading: true },
        action
      );
      expect(nextState.error).toBe('Update failed');
    });

    it('should use default error message if rejected payload is undefined', () => {
      const action = { type: rejectedType, payload: undefined };
      const nextState = tasksReducer(
        { ...startState, loading: true },
        action
      );
      expect(nextState.error).toBe('Unable to update task');
    });
  });

  describe('deleteTask', () => {
    const pendingType = 'tasks/deleteTask/pending';
    const fulfilledType = 'tasks/deleteTask/fulfilled';
    const rejectedType = 'tasks/deleteTask/rejected';

    const startState = {
      ...initialState,
      items: [mockTask('1', 'C1'), mockTask('2', 'C1')],
    };

    it('should set loading true on pending', () => {
      const nextState = tasksReducer(startState, { type: pendingType });
      expect(nextState.loading).toBe(true);
    });

    it('should remove the task on fulfilled', () => {
      const action = {
        type: fulfilledType,
        payload: { taskId: '1' },
      };
      const nextState = tasksReducer(startState, action);

      expect(nextState.loading).toBe(false);
      expect(nextState.items).toHaveLength(1);
      expect(nextState.items[0].id).toBe('2');
    });

    it('should set error payload on rejected', () => {
      const action = { type: rejectedType, payload: 'Delete failed' };
      const nextState = tasksReducer(
        { ...startState, loading: true },
        action
      );
      expect(nextState.error).toBe('Delete failed');
    });

    it('should use default error message if rejected payload is undefined', () => {
      const action = { type: rejectedType, payload: undefined };
      const nextState = tasksReducer(
        { ...startState, loading: true },
        action
      );
      expect(nextState.error).toBe('Unable to delete task');
    });
  });

  describe('markTaskStatus', () => {
    const pendingType = 'tasks/markTaskStatus/pending';
    const fulfilledType = 'tasks/markTaskStatus/fulfilled';
    const rejectedType = 'tasks/markTaskStatus/rejected';

    const startState = {
      ...initialState,
      items: [mockTask('1', 'C1', 'pending')],
    };

    it('should set loading true on pending', () => {
      const nextState = tasksReducer(startState, { type: pendingType });
      expect(nextState.loading).toBe(true);
    });

    it('should update status and add completedAt when completed', () => {
      const completedDate = '2023-12-25T10:00:00.000Z';
      const action = {
        type: fulfilledType,
        payload: {
          taskId: '1',
          status: 'completed',
          completedAt: completedDate,
        },
      };
      const nextState = tasksReducer(startState, action);

      expect(nextState.loading).toBe(false);
      expect(nextState.items[0].status).toBe('completed');
      expect(nextState.items[0].completedAt).toBe(completedDate);
      expect(typeof nextState.items[0].updatedAt).toBe('string');
    });

    it('should update status and remove completedAt when not completed', () => {
      const completedState = {
        ...initialState,
        items: [
          {
            ...mockTask('1', 'C1'),
            status: 'completed',
            completedAt: 'date',
          },
        ],
      };

      const action = {
        type: fulfilledType,
        payload: { taskId: '1', status: 'pending', completedAt: undefined },
      };
      const nextState = tasksReducer(completedState, action);

      expect(nextState.items[0].status).toBe('pending');
      expect(nextState.items[0].completedAt).toBeUndefined();
    });

    it('should ignore update if task not found', () => {
      const action = {
        type: fulfilledType,
        payload: { taskId: '999', status: 'completed' },
      };
      const nextState = tasksReducer(startState, action);
      expect(nextState.items).toEqual(startState.items);
    });

    it('should set error payload on rejected', () => {
      const action = {
        type: rejectedType,
        payload: 'Status update error',
      };
      const nextState = tasksReducer(
        { ...startState, loading: true },
        action
      );
      expect(nextState.error).toBe('Status update error');
    });

    it('should use default error message if rejected payload is undefined', () => {
      const action = { type: rejectedType, payload: undefined };
      const nextState = tasksReducer(
        { ...startState, loading: true },
        action
      );
      expect(nextState.error).toBe('Unable to update task status');
    });
  });
});