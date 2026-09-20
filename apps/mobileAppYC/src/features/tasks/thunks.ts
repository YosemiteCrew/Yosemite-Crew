import {createAsyncThunk, nanoid} from '@reduxjs/toolkit';
import type {
  Task,
  TaskStatus,
  TaskStatusApi,
  TaskRecurrenceScope,
} from './types';
import {taskApi, type TaskDraftPayload} from './services/taskService';
import type {AppDispatch, RootState} from '@/app/store';

const normalizeStatusForApi = (status: TaskStatus): TaskStatusApi => {
  const upper = String(status).toUpperCase();
  if (upper === 'PENDING') return 'PENDING';
  if (upper === 'IN_PROGRESS' || upper === 'INPROGRESS') return 'IN_PROGRESS';
  if (upper === 'COMPLETED' || upper === 'COMPLETE') return 'COMPLETED';
  if (upper === 'CANCELLED' || upper === 'CANCELED') return 'CANCELLED';
  return 'PENDING';
};

export const fetchTasksForCompanion = createAsyncThunk<
  {companionId: string; tasks: Task[]},
  {companionId?: string},
  {state: RootState; rejectValue: string}
>(
  'tasks/fetchTasksForCompanion',
  async ({companionId}, {rejectWithValue}) => {
    try {
      const tasks = await taskApi.list({companionId});
      return {companionId: companionId ?? '', tasks};
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to fetch tasks',
      );
    }
  },
  {
    condition: ({companionId}, {getState}) => {
      if (!companionId) {
        return false;
      }
      const state = getState();
      // Avoid firing multiple requests while a fetch is already in progress
      return state.tasks.loading === false;
    },
  },
);

export const addTask = createAsyncThunk<
  Task,
  TaskDraftPayload,
  {rejectValue: string}
>('tasks/addTask', async (taskData, {rejectWithValue}) => {
  try {
    const newTask = await taskApi.create(taskData);
    return newTask;
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : 'Failed to add task',
    );
  }
});

// updateTask/deleteTask are themselves in flight (their own `.pending` case
// already set `state.tasks.loading = true`) when they need this refresh, and
// `fetchTasksForCompanion`'s `condition` refuses to start a fetch while that
// same flag is true - dispatching the thunk here would be silently dropped
// (a `ConditionError` the callers already swallow), never refreshing wider
// scopes. Calling the API directly and dispatching the plain `.fulfilled`
// action bypasses that guard while still going through the exact reducer
// case a normal fetch would.
const refreshCompanionTasks = async (
  dispatch: AppDispatch,
  companionId: string,
): Promise<void> => {
  const tasks = await taskApi.list({companionId});
  dispatch(
    fetchTasksForCompanion.fulfilled({companionId, tasks}, nanoid(), {
      companionId,
    }),
  );
};

// Both thunks below resolve to just the server response (a Task, or nothing
// for the 204 cancel) so existing `.unwrap()` call sites keep working
// unchanged. The scope this call used is recovered from `action.meta.arg` in
// the reducer rather than folded into the payload.
export const updateTask = createAsyncThunk<
  Task,
  {
    taskId: string;
    updates: Partial<TaskDraftPayload>;
    scope?: TaskRecurrenceScope;
    companionId?: string;
  },
  {dispatch: AppDispatch; rejectValue: string}
>(
  'tasks/updateTask',
  async (
    {taskId, updates, scope = 'THIS', companionId},
    {rejectWithValue, dispatch},
  ) => {
    try {
      const updatedTask = await taskApi.update(taskId, updates, scope);

      // A scoped write can touch rows this response does not describe (the
      // server returns only the row named in the URL), so refresh the whole
      // companion from source rather than guessing which cached rows moved.
      // A refresh failure here must not turn an already-persisted mutation
      // into a reported save failure - the cache just goes stale until the
      // next natural fetch.
      if (scope !== 'THIS' && companionId) {
        try {
          await refreshCompanionTasks(dispatch, companionId);
        } catch {
          // Intentionally swallowed - see comment above.
        }
      }

      return updatedTask;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to update task',
      );
    }
  },
);

export const deleteTask = createAsyncThunk<
  void,
  {taskId: string; companionId?: string; scope?: TaskRecurrenceScope},
  {dispatch: AppDispatch; rejectValue: string}
>(
  'tasks/deleteTask',
  async (
    {taskId, companionId, scope = 'THIS'},
    {rejectWithValue, dispatch},
  ) => {
    try {
      await taskApi.remove(taskId, scope);

      if (scope !== 'THIS' && companionId) {
        try {
          await refreshCompanionTasks(dispatch, companionId);
        } catch {
          // See updateTask above: the cancel already persisted server-side.
        }
      }
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to delete task',
      );
    }
  },
);

export const markTaskStatus = createAsyncThunk<
  Task,
  {taskId: string; status: TaskStatus; completion?: any},
  {rejectValue: string}
>(
  'tasks/markTaskStatus',
  async ({taskId, status, completion}, {rejectWithValue}) => {
    try {
      const updated = await taskApi.changeStatus(
        taskId,
        normalizeStatusForApi(status),
        completion,
      );
      return updated;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to update task status',
      );
    }
  },
);
