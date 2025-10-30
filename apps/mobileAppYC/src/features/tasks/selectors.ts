import {createSelector} from '@reduxjs/toolkit';
import type {RootState} from '@/app/store';
import type {TaskStatus, TaskCategory} from './types';

// Helper function to safely convert date to YYYY-MM-DD format (LOCAL timezone, not UTC)
const getDateString = (date: Date | string): string => {
  try {
    let dateObj: Date;

    // If it's already a Date instance
    if (date instanceof Date && !Number.isNaN(date.getTime())) {
      dateObj = date;
    }
    // If it's a plain object (serialized Date), try to create a new Date
    else if (typeof date === 'object' && date !== null) {
      dateObj = new Date(date);
      if (Number.isNaN(dateObj.getTime())) {
        return formatLocalDate(new Date());
      }
    }
    // If it's a string, return as-is (assuming it's already YYYY-MM-DD)
    else if (typeof date === 'string') {
      return date;
    } else {
      return formatLocalDate(new Date());
    }

    return formatLocalDate(dateObj);
  } catch (e) {
    console.warn('Error converting date:', date, e);
    return formatLocalDate(new Date());
  }
};

// Format date using local timezone (not UTC)
const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Base selector
const selectTasksState = (state: RootState) => state.tasks;

// Select all tasks
export const selectAllTasks = createSelector(
  [selectTasksState],
  tasks => tasks.items,
);

// Select loading state
export const selectTasksLoading = createSelector(
  [selectTasksState],
  tasks => tasks.loading,
);

// Select error state
export const selectTasksError = createSelector(
  [selectTasksState],
  tasks => tasks.error,
);

// Select if companion tasks have been hydrated
export const selectHasHydratedCompanion = (companionId: string | null) =>
  createSelector([selectTasksState], tasks =>
    companionId ? tasks.hydratedCompanions[companionId] ?? false : false,
  );

// Select tasks by companion ID
export const selectTasksByCompanion = (companionId: string | null) =>
  createSelector([selectAllTasks], tasks =>
    companionId ? tasks.filter(task => task.companionId === companionId) : [],
  );

// Select tasks by companion and date
export const selectTasksByCompanionAndDate = (
  companionId: string | null,
  date: Date,
) =>
  createSelector([selectTasksByCompanion(companionId)], tasks => {
    const dateStr = getDateString(date);
    return tasks.filter(task => {
      // task.date is already in YYYY-MM-DD format (ISO date)
      return task.date === dateStr;
    });
  });

// Select tasks by companion, date, and category
export const selectTasksByCompanionDateAndCategory = (
  companionId: string | null,
  date: Date,
  category: TaskCategory,
) =>
  createSelector(
    [selectTasksByCompanionAndDate(companionId, date)],
    tasks => tasks.filter(task => task.category === category),
  );

// Select recent tasks by category (for main screen)
export const selectRecentTasksByCategory = (
  companionId: string | null,
  date: Date,
  category: TaskCategory,
  limit: number = 1,
) =>
  createSelector(
    [selectTasksByCompanionDateAndCategory(companionId, date, category)],
    tasks => {
      const sortedTasks = [...tasks].sort((a, b) => {
        // Sort by status (pending first) and then by time
        if (a.status !== b.status) {
          return a.status === 'pending' ? -1 : 1;
        }
        if (a.time && b.time) {
          return a.time.localeCompare(b.time);
        }
        return 0;
      });
      return sortedTasks.slice(0, limit);
    },
  );

// Select all tasks by category for companion
export const selectAllTasksByCategory = (
  companionId: string | null,
  category: TaskCategory,
) =>
  createSelector([selectTasksByCompanion(companionId)], tasks =>
    tasks.filter(task => task.category === category),
  );

// Select task by ID
export const selectTaskById = (taskId: string | null) =>
  createSelector([selectAllTasks], tasks =>
    taskId ? tasks.find(task => task.id === taskId) : null,
  );

// Select tasks by status
export const selectTasksByStatus = (
  companionId: string | null,
  status: TaskStatus,
) =>
  createSelector([selectTasksByCompanion(companionId)], tasks =>
    tasks.filter(task => task.status === status),
  );

// Count tasks by category for a specific date
export const selectTaskCountByCategory = (
  companionId: string | null,
  date: Date,
  category: TaskCategory,
) =>
  createSelector(
    [selectTasksByCompanionDateAndCategory(companionId, date, category)],
    tasks => tasks.length,
  );

// Select upcoming pending tasks (today or future) for companion
export const selectUpcomingTasks = (companionId: string | null) =>
  createSelector([selectTasksByCompanion(companionId)], tasks => {
    const today = formatLocalDate(new Date());

    return tasks
      .filter(task => {
        // Only pending tasks
        if (task.status !== 'pending') return false;

        // Task date >= today
        return task.date >= today;
      })
      .sort((a, b) => {
        // Sort by date first
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;

        // Then by time if available
        if (a.time && b.time) {
          return a.time.localeCompare(b.time);
        }

        // Tasks with time come before tasks without time
        if (a.time && !b.time) return -1;
        if (!a.time && b.time) return 1;

        return 0;
      });
  });

// Select the next upcoming task for companion
export const selectNextUpcomingTask = (companionId: string | null) =>
  createSelector([selectUpcomingTasks(companionId)], tasks =>
    tasks.length > 0 ? tasks[0] : null
  );
