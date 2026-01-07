import {createAsyncThunk} from '@reduxjs/toolkit';
import type {Task, TaskStatus, TaskStatusApi} from './types';
import {taskApi, type TaskDraftPayload} from './services/taskService';

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
  {rejectValue: string}
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

export const updateTask = createAsyncThunk<
  Task,
  {taskId: string; updates: Partial<TaskDraftPayload>},
  {rejectValue: string}
>('tasks/updateTask', async ({taskId, updates}, {rejectWithValue}) => {
  try {
    const updatedTask = await taskApi.update(taskId, updates);
    return updatedTask;
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : 'Failed to update task',
    );
  }
});

export const deleteTask = createAsyncThunk<
  Task,
  {taskId: string; companionId?: string},
  {rejectValue: string}
>('tasks/deleteTask', async ({taskId}, {rejectWithValue}) => {
  try {
    const cancelled = await taskApi.changeStatus(taskId, 'CANCELLED');
    return cancelled;
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : 'Failed to delete task',
    );
  }
});

export const markTaskStatus = createAsyncThunk<
  Task,
  {taskId: string; status: TaskStatus; completion?: any},
  {rejectValue: string}
>('tasks/markTaskStatus', async ({taskId, status, completion}, {rejectWithValue}) => {
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
});
