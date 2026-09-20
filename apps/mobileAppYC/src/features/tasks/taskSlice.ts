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
        markCollectionHydrated(
          state,
          companionId,
          Date.now(),
          action.meta?.requestId,
        );
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
        const scope = action.meta.arg.scope ?? 'THIS';
        // A THIS-scoped write is fully described by the single row the
        // server returned. A wider scope can touch rows this response never
        // named - the thunk already refreshed the whole companion for that
        // case, so patching just this one row here would be redundant at
        // best and stale at worst.
        if (scope === 'THIS') {
          const index = state.items.findIndex(
            item => item.id === updatedTask.id,
          );
          if (index !== -1) {
            state.items[index] = updatedTask;
          }
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
        const {taskId, scope = 'THIS'} = action.meta.arg;
        // The cancel endpoint returns no body (204), so there is no updated
        // row to spread in - mark it cancelled locally. Wider scopes are
        // covered by the thunk's own companion refresh, same as above.
        if (scope === 'THIS') {
          const idx = state.items.findIndex(item => item.id === taskId);
          if (idx !== -1) {
            state.items[idx] = {...state.items[idx], status: 'CANCELLED'};
          }
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
