import {createSelector} from '@reduxjs/toolkit';
import type {RootState} from '@/app/store';
import type {Expense} from './types';

export const selectExpensesState = (state: RootState) => state.expenses;

export const selectExpensesLoading = createSelector(
  selectExpensesState,
  expenses => expenses.loading,
);

export const selectExpensesError = createSelector(
  selectExpensesState,
  expenses => expenses.error,
);

const selectorCache = new Map<string, any>();

const getCachedSelector = <T,>(
  key: string,
  factory: () => T,
): T => {
  if (!selectorCache.has(key)) {
    selectorCache.set(key, factory());
  }
  return selectorCache.get(key) as T;
};

export const selectHasHydratedCompanion = (companionId: string | null) =>
  getCachedSelector(`hasHydrated_${companionId}`, () =>
    createSelector(selectExpensesState, expenses => {
      if (!companionId) {
        return false;
      }
      return Boolean(expenses.hydratedCompanions[companionId]);
    }),
  );

export const selectExpensesByCompanion = (companionId: string | null) =>
  getCachedSelector(`expensesByCompanion_${companionId}`, () =>
    createSelector(selectExpensesState, expenses => {
      if (!companionId) {
        return [];
      }
      return expenses.items
        .filter(item => item.companionId === companionId)
        .sort(
          (a, b) =>
            new Date(b.date).getTime() - new Date(a.date).getTime(),
        );
    }),
  );

export const selectInAppExpensesByCompanion = (companionId: string | null) =>
  getCachedSelector(`inAppExpenses_${companionId}`, () =>
    createSelector(selectExpensesByCompanion(companionId), items =>
      items.filter(item => item.source === 'inApp'),
    ),
  );

export const selectExternalExpensesByCompanion = (companionId: string | null) =>
  getCachedSelector(`externalExpenses_${companionId}`, () =>
    createSelector(selectExpensesByCompanion(companionId), items =>
      items.filter(item => item.source === 'external'),
    ),
  );

const pickRecent = (list: Expense[], limit: number) =>
  list.slice(0, limit);

export const selectRecentInAppExpenses = (
  companionId: string | null,
  limit = 2,
) =>
  getCachedSelector(`recentInApp_${companionId}_${limit}`, () =>
    createSelector(selectInAppExpensesByCompanion(companionId), list =>
      pickRecent(list, limit),
    ),
  );

export const selectRecentExternalExpenses = (
  companionId: string | null,
  limit = 2,
) =>
  getCachedSelector(`recentExternal_${companionId}_${limit}`, () =>
    createSelector(selectExternalExpensesByCompanion(companionId), list =>
      pickRecent(list, limit),
    ),
  );

export const selectExpenseById = (expenseId: string | null) =>
  getCachedSelector(`expenseById_${expenseId}`, () =>
    createSelector(selectExpensesState, expenses =>
      expenses.items.find(item => item.id === expenseId) ?? null,
    ),
  );

export const selectExpenseSummaryByCompanion = (companionId: string | null) =>
  getCachedSelector(`summary_${companionId}`, () =>
    createSelector(selectExpensesState, expenses => {
      if (!companionId) {
        return null;
      }
      return expenses.summaries[companionId] ?? null;
    }),
  );

export const selectTotalSpentForCompanion = (companionId: string | null) =>
  getCachedSelector(`totalSpent_${companionId}`, () =>
    createSelector(selectExpenseSummaryByCompanion(companionId), summary =>
      summary?.total ?? 0,
    ),
  );
