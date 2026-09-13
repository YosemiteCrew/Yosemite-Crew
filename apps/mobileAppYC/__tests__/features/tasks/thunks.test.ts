import type {Task} from '../../../src/features/tasks/types';
let fetchTasksForCompanion: any;
let addTask: any;
let updateTask: any;
let deleteTask: any;
let markTaskStatus: any;

// Mock the API service
const mockTaskApi = {
  list: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  changeStatus: jest.fn(),
};

jest.mock('../../../src/features/tasks/services/taskService', () => ({
  __esModule: true,
  taskApi: mockTaskApi,
}));
jest.mock('@/features/tasks/services/taskService', () => ({
  __esModule: true,
  taskApi: mockTaskApi,
}));

describe('features/tasks/thunks', () => {
  beforeAll(() => {
    ({
      fetchTasksForCompanion,
      addTask,
      updateTask,
      deleteTask,
      markTaskStatus,
    } = require('../../../src/features/tasks/thunks'));
  });
  const mockDispatch = jest.fn();
  const mockGetState = jest.fn();

  // Helper to create a mock task
  const createMockTask = (overrides?: Partial<Task>): Task => ({
    id: 'test-uuid',
    companionId: 'c1',
    category: 'custom',
    subcategory: 'none',
    title: 'Test Task',
    date: '2023-01-01',
    frequency: 'once',
    reminderEnabled: false,
    reminderOptions: null,
    syncWithCalendar: false,
    attachDocuments: false,
    attachments: [],
    status: 'PENDING',
    createdAt: '2023-01-01T12:00:00.000Z',
    updatedAt: '2023-01-01T12:00:00.000Z',
    details: {},
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup API mocks to resolve successfully by default
    mockTaskApi.list.mockResolvedValue([]);
    mockTaskApi.create.mockResolvedValue(createMockTask());
    mockTaskApi.update.mockResolvedValue(createMockTask());
    mockTaskApi.remove.mockResolvedValue(undefined);
    mockTaskApi.changeStatus.mockResolvedValue(createMockTask());
    // A bare jest.fn() dispatch has no .unwrap() - give it one so the
    // thunks' internal companion-refresh dispatch resolves instead of
    // throwing (which the thunk under test already swallows on purpose).
    mockDispatch.mockReturnValue({
      unwrap: jest.fn().mockResolvedValue(undefined),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Helper to execute thunks
  const callThunk = async (thunk: any, arg: any) => {
    const actionCreator = thunk(arg);
    return await actionCreator(mockDispatch, mockGetState, undefined);
  };

  // ===========================================================================
  // 1. fetchTasksForCompanion
  // ===========================================================================
  describe('fetchTasksForCompanion', () => {
    beforeEach(() => {
      // Mock getState to return proper state for condition checks
      mockGetState.mockReturnValue({
        tasks: {loading: false},
      });
    });

    it('success: returns data with empty tasks list', async () => {
      mockTaskApi.list.mockResolvedValue([]);
      const result = await callThunk(fetchTasksForCompanion, {
        companionId: '1',
      });
      expect(result.type).toBe('tasks/fetchTasksForCompanion/fulfilled');
      expect(result.payload).toEqual({companionId: '1', tasks: []});
      expect(mockTaskApi.list).toHaveBeenCalledWith({companionId: '1'});
    });

    it('success: returns data with tasks', async () => {
      const mockTasks = [
        createMockTask({id: 'task-1', companionId: '1'}),
        createMockTask({id: 'task-2', companionId: '1'}),
      ];
      mockTaskApi.list.mockResolvedValue(mockTasks);
      const result = await callThunk(fetchTasksForCompanion, {
        companionId: '1',
      });
      expect(result.type).toBe('tasks/fetchTasksForCompanion/fulfilled');
      expect(result.payload).toEqual({companionId: '1', tasks: mockTasks});
    });

    it('failure: handles Error object', async () => {
      mockTaskApi.list.mockRejectedValue(new Error('Fetch Failed'));
      const result = await callThunk(fetchTasksForCompanion, {
        companionId: '1',
      });
      expect(result.type).toBe('tasks/fetchTasksForCompanion/rejected');
      expect(result.payload).toBe('Fetch Failed');
    });

    it('failure: handles non-Error object (fallback message)', async () => {
      mockTaskApi.list.mockRejectedValue('Unknown String Error');
      const result = await callThunk(fetchTasksForCompanion, {
        companionId: '1',
      });
      expect(result.type).toBe('tasks/fetchTasksForCompanion/rejected');
      expect(result.payload).toBe('Failed to fetch tasks');
    });
  });

  // ===========================================================================
  // 2. addTask
  // ===========================================================================
  describe('addTask', () => {
    it('success: returns new task', async () => {
      const taskData = {
        companionId: 'c1',
        category: 'CUSTOM' as const,
        name: 'Task 1',
        description: 'Desc',
        dueAt: '2023-01-01T12:00:00.000Z',
      };
      const mockTask = createMockTask({
        id: 'new-task-id',
        companionId: 'c1',
        title: 'Task 1',
        description: 'Desc',
      });
      mockTaskApi.create.mockResolvedValue(mockTask);

      const result = await callThunk(addTask, taskData);

      expect(result.type).toBe('tasks/addTask/fulfilled');
      expect(result.payload).toEqual(mockTask);
      expect(mockTaskApi.create).toHaveBeenCalledWith(taskData);
    });

    it('failure: handles Error object', async () => {
      mockTaskApi.create.mockRejectedValue(new Error('Create Failed'));
      const result = await callThunk(addTask, {
        companionId: 'c1',
        category: 'CUSTOM' as const,
        name: 'Task',
        dueAt: '2023-01-01T12:00:00.000Z',
      });
      expect(result.type).toBe('tasks/addTask/rejected');
      expect(result.payload).toBe('Create Failed');
    });

    it('failure: handles non-Error object', async () => {
      mockTaskApi.create.mockRejectedValue('String Error');
      const result = await callThunk(addTask, {
        companionId: 'c1',
        category: 'CUSTOM' as const,
        name: 'Task',
        dueAt: '2023-01-01T12:00:00.000Z',
      });
      expect(result.type).toBe('tasks/addTask/rejected');
      expect(result.payload).toBe('Failed to add task');
    });
  });

  // ===========================================================================
  // 3. updateTask
  // ===========================================================================
  describe('updateTask', () => {
    it('success: returns updated task', async () => {
      const mockUpdatedTask = createMockTask({
        id: '1',
        title: 'New Title',
        updatedAt: '2023-01-01T12:00:01.000Z',
      });
      mockTaskApi.update.mockResolvedValue(mockUpdatedTask);

      const result = await callThunk(updateTask, {
        taskId: '1',
        updates: {name: 'New Title'},
      });

      expect(result.type).toBe('tasks/updateTask/fulfilled');
      expect(result.payload).toEqual(mockUpdatedTask);
      // No scope argument defaults to THIS - the common single-occurrence case.
      expect(mockTaskApi.update).toHaveBeenCalledWith(
        '1',
        {name: 'New Title'},
        'THIS',
      );
    });

    it('failure: handles Error object', async () => {
      mockTaskApi.update.mockRejectedValue(new Error('Update Failed'));
      const result = await callThunk(updateTask, {taskId: '1', updates: {}});
      expect(result.type).toBe('tasks/updateTask/rejected');
      expect(result.payload).toBe('Update Failed');
    });

    it('failure: handles non-Error object', async () => {
      mockTaskApi.update.mockRejectedValue('String Error');
      const result = await callThunk(updateTask, {taskId: '1', updates: {}});
      expect(result.type).toBe('tasks/updateTask/rejected');
      expect(result.payload).toBe('Failed to update task');
    });

    // createAsyncThunk's own pending/fulfilled/rejected dispatches are plain
    // objects; a nested `dispatch(fetchTasksForCompanion(...))` call passes a
    // thunk FUNCTION instead, since callThunk drives the action creator
    // directly rather than through real thunk middleware. That difference in
    // kind is what distinguishes "refreshed the companion" from "did not".
    const dispatchedAThunkFunction = () =>
      mockDispatch.mock.calls.some(call => typeof call[0] === 'function');

    it('passes an explicit THIS scope through to the API call unchanged', async () => {
      await callThunk(updateTask, {
        taskId: '1',
        updates: {name: 'New Title'},
        scope: 'THIS',
        companionId: 'c1',
      });
      expect(mockTaskApi.update).toHaveBeenCalledWith(
        '1',
        {name: 'New Title'},
        'THIS',
      );
      // A single-occurrence write never needs a companion-wide refresh.
      expect(dispatchedAThunkFunction()).toBe(false);
    });

    it('passes an explicit ALL scope through and refreshes the companion afterward', async () => {
      await callThunk(updateTask, {
        taskId: '1',
        updates: {name: 'New Title'},
        scope: 'ALL',
        companionId: 'c1',
      });
      expect(mockTaskApi.update).toHaveBeenCalledWith(
        '1',
        {name: 'New Title'},
        'ALL',
      );
      expect(dispatchedAThunkFunction()).toBe(true);
    });

    it('does not surface a save failure when only the post-ALL companion refresh rejects', async () => {
      mockDispatch.mockReturnValue({
        unwrap: jest.fn().mockRejectedValue(new Error('refresh failed')),
      });

      const result = await callThunk(updateTask, {
        taskId: '1',
        updates: {name: 'New Title'},
        scope: 'ALL',
        companionId: 'c1',
      });

      // The scoped write itself already succeeded server-side; a stale cache
      // is recoverable and must not be reported as "unable to save".
      expect(result.type).toBe('tasks/updateTask/fulfilled');
    });
  });

  // ===========================================================================
  // 4. deleteTask
  // ===========================================================================
  describe('deleteTask', () => {
    it('success: cancels via the scope-aware endpoint, defaulting to THIS', async () => {
      const result = await callThunk(deleteTask, {
        taskId: '1',
        companionId: 'c1',
      });
      expect(result.type).toBe('tasks/deleteTask/fulfilled');
      expect(mockTaskApi.remove).toHaveBeenCalledWith('1', 'THIS');
    });

    it('failure: handles Error object', async () => {
      mockTaskApi.remove.mockRejectedValue(new Error('Delete Failed'));
      const result = await callThunk(deleteTask, {
        taskId: '1',
        companionId: 'c1',
      });
      expect(result.type).toBe('tasks/deleteTask/rejected');
      expect(result.payload).toBe('Delete Failed');
    });

    it('failure: handles non-Error object', async () => {
      mockTaskApi.remove.mockRejectedValue('String Error');
      const result = await callThunk(deleteTask, {
        taskId: '1',
        companionId: 'c1',
      });
      expect(result.type).toBe('tasks/deleteTask/rejected');
      expect(result.payload).toBe('Failed to delete task');
    });

    const dispatchedAThunkFunction = () =>
      mockDispatch.mock.calls.some(call => typeof call[0] === 'function');

    it('passes an explicit THIS scope through without a companion refresh', async () => {
      await callThunk(deleteTask, {
        taskId: '1',
        companionId: 'c1',
        scope: 'THIS',
      });
      expect(mockTaskApi.remove).toHaveBeenCalledWith('1', 'THIS');
      expect(dispatchedAThunkFunction()).toBe(false);
    });

    it('passes an explicit ALL scope through and refreshes the companion afterward', async () => {
      await callThunk(deleteTask, {
        taskId: '1',
        companionId: 'c1',
        scope: 'ALL',
      });
      expect(mockTaskApi.remove).toHaveBeenCalledWith('1', 'ALL');
      expect(dispatchedAThunkFunction()).toBe(true);
    });

    it('does not surface a delete failure when only the post-ALL companion refresh rejects', async () => {
      mockDispatch.mockReturnValue({
        unwrap: jest.fn().mockRejectedValue(new Error('refresh failed')),
      });

      const result = await callThunk(deleteTask, {
        taskId: '1',
        companionId: 'c1',
        scope: 'ALL',
      });

      // The cancel itself already persisted server-side; a stale cache is
      // recoverable and must not be reported as "unable to delete".
      expect(result.type).toBe('tasks/deleteTask/fulfilled');
    });
  });

  // ===========================================================================
  // 5. markTaskStatus
  // ===========================================================================
  describe('markTaskStatus', () => {
    it('success: completed status sets completedAt', async () => {
      const completedTime = '2023-01-01T12:00:00.400Z';
      const mockCompletedTask = createMockTask({
        id: '1',
        status: 'COMPLETED',
        completedAt: completedTime,
      });
      mockTaskApi.changeStatus.mockResolvedValue(mockCompletedTask);

      const result = await callThunk(markTaskStatus, {
        taskId: '1',
        status: 'completed',
      });

      expect(result.type).toBe('tasks/markTaskStatus/fulfilled');
      expect(result.payload).toEqual(mockCompletedTask);
      expect(mockTaskApi.changeStatus).toHaveBeenCalledWith(
        '1',
        'COMPLETED',
        undefined,
      );
    });

    it('success: pending status', async () => {
      const mockPendingTask = createMockTask({
        id: '1',
        status: 'PENDING',
        completedAt: undefined,
      });
      mockTaskApi.changeStatus.mockResolvedValue(mockPendingTask);

      const result = await callThunk(markTaskStatus, {
        taskId: '1',
        status: 'pending',
      });

      expect(result.type).toBe('tasks/markTaskStatus/fulfilled');
      expect(result.payload).toEqual(mockPendingTask);
      expect(mockTaskApi.changeStatus).toHaveBeenCalledWith(
        '1',
        'PENDING',
        undefined,
      );
    });

    it('success: in_progress status', async () => {
      const mockInProgressTask = createMockTask({
        id: '1',
        status: 'IN_PROGRESS',
      });
      mockTaskApi.changeStatus.mockResolvedValue(mockInProgressTask);

      const result = await callThunk(markTaskStatus, {
        taskId: '1',
        status: 'in_progress',
      });

      expect(result.type).toBe('tasks/markTaskStatus/fulfilled');
      expect(result.payload).toEqual(mockInProgressTask);
      expect(mockTaskApi.changeStatus).toHaveBeenCalledWith(
        '1',
        'IN_PROGRESS',
        undefined,
      );
    });

    it('success: passes completion data when provided', async () => {
      const completionData = {notes: 'Task completed successfully'};
      const mockCompletedTask = createMockTask({
        id: '1',
        status: 'COMPLETED',
        completedAt: '2023-01-01T12:00:00.400Z',
      });
      mockTaskApi.changeStatus.mockResolvedValue(mockCompletedTask);

      const result = await callThunk(markTaskStatus, {
        taskId: '1',
        status: 'completed',
        completion: completionData,
      });

      expect(result.type).toBe('tasks/markTaskStatus/fulfilled');
      expect(result.payload).toEqual(mockCompletedTask);
      expect(mockTaskApi.changeStatus).toHaveBeenCalledWith(
        '1',
        'COMPLETED',
        completionData,
      );
    });

    it('failure: handles Error object', async () => {
      mockTaskApi.changeStatus.mockRejectedValue(new Error('Status Failed'));
      const result = await callThunk(markTaskStatus, {
        taskId: '1',
        status: 'completed',
      });
      expect(result.type).toBe('tasks/markTaskStatus/rejected');
      expect(result.payload).toBe('Status Failed');
    });

    it('failure: handles non-Error object', async () => {
      mockTaskApi.changeStatus.mockRejectedValue('String Error');
      const result = await callThunk(markTaskStatus, {
        taskId: '1',
        status: 'completed',
      });
      expect(result.type).toBe('tasks/markTaskStatus/rejected');
      expect(result.payload).toBe('Failed to update task status');
    });
  });
});
