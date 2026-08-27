import {createSlice, PayloadAction} from '@reduxjs/toolkit';
import {REHYDRATE} from 'redux-persist';
import type {TasksState, Task} from './types';
import {
  fetchTasksForCompanion,
  addTask,
  updateTask,
  deleteTask,
  markTaskStatus,
} from './thunks';

import {
  markCollectionFailed,
  markCollectionHydrated,
  markCollectionPending,
} from '@/shared/store/collectionLoadState';

const initialState: TasksState = {
  items: [],
  loading: false,
  error: null,
  hydratedCompanions: {},
  failedCompanions: {},
  activeRequests: {},
  lastLoadedAt: {},
};

const tasksSlice = createSlice({
  name: 'tasks',
  initialState,
  reducers: {
    clearTaskError: state => {
      state.error = null;
    },
    resetTasksState: () => initialState,
    injectMockTasks: (
      state,
      action: PayloadAction<{companionId: string; tasks: Task[]}>,
    ) => {
      const {companionId, tasks} = action.payload;
      state.items = state.items.filter(
        item => item.companionId !== companionId,
      );
      state.items.push(...tasks);
      state.hydratedCompanions[companionId] = true;
    },
    setTaskCalendarEventId: (
      state,
      action: PayloadAction<{taskId: string; eventId: string | null}>,
    ) => {
      const task = state.items.find(item => item.id === action.payload.taskId);
      if (task) {
        task.calendarEventId = action.payload.eventId;
      }
    },
  },
  extraReducers: builder => {
    builder
      .addCase(REHYDRATE, state => {
        state.hydratedCompanions = {};
        state.loading = false;
        state.error = null;
      })
      // Fetch tasks for companion
      .addCase(fetchTasksForCompanion.pending, (state, action) => {
        state.loading = true;
        state.error = null;
        markCollectionPending(
          state,
          action.meta?.arg?.companionId,
          action.meta?.requestId,
        );
      })
      .addCase(fetchTasksForCompanion.fulfilled, (state, action) => {
        state.loading = false;
        const {companionId, tasks} = action.payload;

        if (companionId) {
          state.items = state.items.filter(
            item => item.companionId !== companionId,
          );
        } else {
          state.items = [];
        }

        state.items.push(...tasks);
        markCollectionHydrated(state, companionId);
      })
      .addCase(fetchTasksForCompanion.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unable to fetch tasks';
        markCollectionFailed(
          state,
          action.meta?.arg?.companionId,
          action.payload,
          action.meta?.requestId,
        );
      })

      // Add task
      .addCase(addTask.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addTask.fulfilled, (state, action) => {
        state.loading = false;
        state.items.push(action.payload);
        if (action.payload.companionId) {
          state.hydratedCompanions[action.payload.companionId] = true;
        }
      })
      .addCase(addTask.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unable to add task';
      })

      // Update task
      .addCase(updateTask.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateTask.fulfilled, (state, action) => {
        state.loading = false;
        const updatedTask = action.payload;
        const index = state.items.findIndex(item => item.id === updatedTask.id);
        if (index !== -1) {
          state.items[index] = updatedTask;
        }
      })
      .addCase(updateTask.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unable to update task';
      })

      // Delete task
      .addCase(deleteTask.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteTask.fulfilled, (state, action) => {
        state.loading = false;
        const deletedTask = action.payload;
        const idx = state.items.findIndex(item => item.id === deletedTask.id);
        if (idx !== -1) {
          state.items[idx] = deletedTask;
        }
      })
      .addCase(deleteTask.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unable to delete task';
      })

      // Mark task status
      .addCase(markTaskStatus.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(markTaskStatus.fulfilled, (state, action) => {
        state.loading = false;
        const updatedTask = action.payload;
        const index = state.items.findIndex(item => item.id === updatedTask.id);
        if (index !== -1) {
          state.items[index] = updatedTask;
        }
      })
      .addCase(markTaskStatus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unable to update task status';
      });
  },
});

export const {
  clearTaskError,
  injectMockTasks,
  resetTasksState,
  setTaskCalendarEventId,
} = tasksSlice.actions;

export default tasksSlice.reducer;
