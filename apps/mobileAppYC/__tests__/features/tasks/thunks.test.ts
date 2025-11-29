import {
  fetchTasksForCompanion,
  addTask,
  updateTask,
  deleteTask,
  markTaskStatus,
} from '../../../src/features/tasks/thunks';
import {v4 as uuidv4} from 'uuid';

// --- Mocks ---
jest.mock('uuid', () => ({
  v4: jest.fn(),
}));

describe('features/tasks/thunks', () => {
  const mockDispatch = jest.fn();
  const mockGetState = jest.fn();
  // Base time: 2023-01-01 12:00:00.000
  const fixedDate = new Date('2023-01-01T12:00:00.000Z');

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset timers and system time before each test
    jest.useFakeTimers();
    jest.setSystemTime(fixedDate);
    (uuidv4 as jest.Mock).mockReturnValue('test-uuid');
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // Helper to execute thunks
  const callThunk = async (thunk: any, arg: any) => {
    const actionCreator = thunk(arg);
    const promise = actionCreator(mockDispatch, mockGetState, undefined);

    // We run timers to advance the internal delay().
    // If the implementation is mocked to throw synchronously (in error tests),
    // this will simply do nothing, which is safe.
    jest.runAllTimers();

    return await promise;
  };

  // Helper to mock setTimeout failures
  const mockTimeoutFailure = (errorToThrow: any) => {
    jest.spyOn(globalThis, 'setTimeout').mockImplementationOnce(() => {
      throw errorToThrow;
    });
  };

  // ===========================================================================
  // 1. fetchTasksForCompanion
  // ===========================================================================
  describe('fetchTasksForCompanion', () => {
    it('success: returns data', async () => {
      const result = await callThunk(fetchTasksForCompanion, { companionId: '1' });
      expect(result.type).toBe('tasks/fetchTasksForCompanion/fulfilled');
      expect(result.payload).toEqual({ companionId: '1', tasks: [] });
    });

    it('failure: handles Error object', async () => {
      mockTimeoutFailure(new Error('Fetch Failed'));
      const result = await callThunk(fetchTasksForCompanion, { companionId: '1' });
      expect(result.type).toBe('tasks/fetchTasksForCompanion/rejected');
      expect(result.payload).toBe('Fetch Failed');
    });

    it('failure: handles non-Error object (fallback message)', async () => {
      mockTimeoutFailure("Unknown String Error");
      const result = await callThunk(fetchTasksForCompanion, { companionId: '1' });
      expect(result.type).toBe('tasks/fetchTasksForCompanion/rejected');
      expect(result.payload).toBe('Failed to fetch tasks');
    });
  });

  // ===========================================================================
  // 2. addTask
  // ===========================================================================
  describe('addTask', () => {
    it('success: returns new task with generated data', async () => {
      const taskData = { title: 'Task 1', description: 'Desc', companionId: 'c1' };
      const result = await callThunk(addTask, taskData);

      // Delay is 600ms, so time advances by 600ms
      const expectedTime = '2023-01-01T12:00:00.600Z';

      expect(result.type).toBe('tasks/addTask/fulfilled');
      expect(result.payload).toEqual({
        ...taskData,
        id: 'test-uuid',
        status: 'pending',
        createdAt: expectedTime,
        updatedAt: expectedTime,
      });
    });

    // For addTask, we can mock uuidv4 to fail instead of setTimeout to vary the tests,
    // ensuring the try/catch block works for any error in the block.
    it('failure: handles Error object', async () => {
      (uuidv4 as jest.Mock).mockImplementationOnce(() => { throw new Error('UUID Error'); });
      const result = await callThunk(addTask, { title: 'T' });
      expect(result.payload).toBe('UUID Error');
    });

    it('failure: handles non-Error object', async () => {
      (uuidv4 as jest.Mock).mockImplementationOnce(() => { throw "String Error"; });
      const result = await callThunk(addTask, { title: 'T' });
      expect(result.payload).toBe('Failed to add task');
    });
  });

  // ===========================================================================
  // 3. updateTask
  // ===========================================================================
  describe('updateTask', () => {
    it('success: returns updated data', async () => {
      const result = await callThunk(updateTask, { taskId: '1', updates: { title: 'New' } });
      // Delay 600ms
      const expectedTime = '2023-01-01T12:00:00.600Z';

      expect(result.type).toBe('tasks/updateTask/fulfilled');
      expect(result.payload).toEqual({
        taskId: '1',
        updates: { title: 'New', updatedAt: expectedTime },
      });
    });

    it('failure: handles Error object', async () => {
      mockTimeoutFailure(new Error('Update Failed'));
      const result = await callThunk(updateTask, { taskId: '1', updates: {} });
      expect(result.payload).toBe('Update Failed');
    });

    it('failure: handles non-Error object', async () => {
      mockTimeoutFailure("String Error");
      const result = await callThunk(updateTask, { taskId: '1', updates: {} });
      expect(result.payload).toBe('Failed to update task');
    });
  });

  // ===========================================================================
  // 4. deleteTask
  // ===========================================================================
  describe('deleteTask', () => {
    it('success: returns IDs', async () => {
      const result = await callThunk(deleteTask, { taskId: '1', companionId: 'c1' });
      expect(result.type).toBe('tasks/deleteTask/fulfilled');
      expect(result.payload).toEqual({ taskId: '1', companionId: 'c1' });
    });

    it('failure: handles Error object', async () => {
      mockTimeoutFailure(new Error('Delete Failed'));
      const result = await callThunk(deleteTask, { taskId: '1', companionId: 'c1' });
      expect(result.payload).toBe('Delete Failed');
    });

    it('failure: handles non-Error object', async () => {
      mockTimeoutFailure("String Error");
      const result = await callThunk(deleteTask, { taskId: '1', companionId: 'c1' });
      expect(result.payload).toBe('Failed to delete task');
    });
  });

  // ===========================================================================
  // 5. markTaskStatus
  // ===========================================================================
  describe('markTaskStatus', () => {
    it('success: completed status sets completedAt', async () => {
      const result = await callThunk(markTaskStatus, { taskId: '1', status: 'completed' });
      // Delay 400ms
      const expectedTime = '2023-01-01T12:00:00.400Z';

      expect(result.type).toBe('tasks/markTaskStatus/fulfilled');
      expect(result.payload).toEqual({
        taskId: '1',
        status: 'completed',
        completedAt: expectedTime,
      });
    });

    it('success: pending status removes completedAt', async () => {
      const result = await callThunk(markTaskStatus, { taskId: '1', status: 'pending' });
      expect(result.payload).toEqual({
        taskId: '1',
        status: 'pending',
        completedAt: undefined,
      });
    });

    it('failure: handles Error object', async () => {
      mockTimeoutFailure(new Error('Status Failed'));
      const result = await callThunk(markTaskStatus, { taskId: '1', status: 'completed' });
      expect(result.payload).toBe('Status Failed');
    });

    it('failure: handles non-Error object', async () => {
      mockTimeoutFailure("String Error");
      const result = await callThunk(markTaskStatus, { taskId: '1', status: 'completed' });
      expect(result.payload).toBe('Failed to update task status');
    });
  });
});