import {createAsyncThunk} from '@reduxjs/toolkit';
import {v4 as uuidv4} from 'uuid';
import type {Task, TaskStatus} from './types';

// Simulate API delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Mock API: Fetch tasks for a companion
export const fetchTasksForCompanion = createAsyncThunk<
  {companionId: string; tasks: Task[]},
  {companionId: string},
  {rejectValue: string}
>(
  'tasks/fetchTasksForCompanion',
  async ({companionId}, {rejectWithValue}) => {
    try {
      await delay(800);

    // Mock data - in production, this would be an API call
    const mockTasks: Task[] = [];

      return {companionId, tasks: mockTasks};
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to fetch tasks',
      );
    }
  },
);

// Mock API: Add a new task
export const addTask = createAsyncThunk<
  Task,
  Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'completedAt'>,
  {rejectValue: string}
>('tasks/addTask', async (taskData, {rejectWithValue}) => {
  try {
    await delay(600);

    const newTask: Task = {
      ...taskData,
      id: uuidv4(),
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return newTask;
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : 'Failed to add task',
    );
  }
});

// Mock API: Update an existing task
export const updateTask = createAsyncThunk<
  {taskId: string; updates: Partial<Task>},
  {taskId: string; updates: Partial<Task>},
  {rejectValue: string}
>('tasks/updateTask', async ({taskId, updates}, {rejectWithValue}) => {
  try {
    await delay(600);

    const updatedData = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    return {taskId, updates: updatedData};
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : 'Failed to update task',
    );
  }
});

// Mock API: Delete a task
export const deleteTask = createAsyncThunk<
  {taskId: string; companionId: string},
  {taskId: string; companionId: string},
  {rejectValue: string}
>('tasks/deleteTask', async ({taskId, companionId}, {rejectWithValue}) => {
  try {
    await delay(400);

    return {taskId, companionId};
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : 'Failed to delete task',
    );
  }
});

// Mock API: Mark task as completed/pending
export const markTaskStatus = createAsyncThunk<
  {taskId: string; status: TaskStatus; completedAt?: string},
  {taskId: string; status: TaskStatus},
  {rejectValue: string}
>('tasks/markTaskStatus', async ({taskId, status}, {rejectWithValue}) => {
  try {
    await delay(400);

    return {
      taskId,
      status,
      completedAt: status === 'completed' ? new Date().toISOString() : undefined,
    };
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : 'Failed to update task status',
    );
  }
});
