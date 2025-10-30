import {createSlice, PayloadAction} from '@reduxjs/toolkit';
import type {TasksState, Task} from './types';
import {
  fetchTasksForCompanion,
  addTask,
  updateTask,
  deleteTask,
  markTaskStatus,
} from './thunks';

const initialState: TasksState = {
  items: [],
  loading: false,
  error: null,
  hydratedCompanions: {},
};

const tasksSlice = createSlice({
  name: 'tasks',
  initialState,
  reducers: {
    clearTaskError: state => {
      state.error = null;
    },
    injectMockTasks: (
      state,
      action: PayloadAction<{companionId: string; tasks: Task[]}>,
    ) => {
      const {companionId, tasks} = action.payload;
      state.items = state.items.filter(item => item.companionId !== companionId);
      state.items.push(...tasks);
      state.hydratedCompanions[companionId] = true;
    },
  },
  extraReducers: builder => {
    builder
      // Fetch tasks for companion
      .addCase(fetchTasksForCompanion.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTasksForCompanion.fulfilled, (state, action) => {
        state.loading = false;
        const {companionId, tasks} = action.payload;

        // Remove existing tasks for this companion
        state.items = state.items.filter(
          item => item.companionId !== companionId,
        );

        // Add fetched tasks
        state.items.push(...tasks);
        state.hydratedCompanions[companionId] = true;
      })
      .addCase(fetchTasksForCompanion.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unable to fetch tasks';
      })

      // Add task
      .addCase(addTask.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addTask.fulfilled, (state, action) => {
        state.loading = false;
        state.items.push(action.payload);
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
        const {taskId, updates} = action.payload;
        const index = state.items.findIndex(item => item.id === taskId);
        if (index !== -1) {
          state.items[index] = {
            ...state.items[index],
            ...updates,
          };
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
        const {taskId} = action.payload;
        state.items = state.items.filter(item => item.id !== taskId);
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
        const {taskId, status, completedAt} = action.payload;
        const task = state.items.find(item => item.id === taskId);
        if (task) {
          task.status = status;
          task.updatedAt = new Date().toISOString();
          if (completedAt) {
            task.completedAt = completedAt;
          } else {
            delete task.completedAt;
          }
        }
      })
      .addCase(markTaskStatus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unable to update task status';
      });
  },
});

export const {clearTaskError, injectMockTasks} = tasksSlice.actions;

export default tasksSlice.reducer;
