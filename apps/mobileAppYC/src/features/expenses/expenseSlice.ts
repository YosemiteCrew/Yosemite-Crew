import {createSlice, PayloadAction} from '@reduxjs/toolkit';
import type {ExpensesState, Expense, ExpenseSummary} from './types';
import {
  addExternalExpense,
  deleteExternalExpense,
  fetchExpensesForCompanion,
  fetchExpenseById,
  fetchExpenseSummary,
  markInAppExpenseStatus,
  updateExternalExpense,
} from './thunks';

import {
  markCollectionFailed,
  markCollectionHydrated,
  markCollectionPending,
} from '@/shared/store/collectionLoadState';

const initialState: ExpensesState = {
  items: [],
  loading: false,
  error: null,
  summaries: {},
  hydratedCompanions: {},
  failedCompanions: {},
  activeRequests: {},
};

const buildSummary = (
  expenses: Expense[],
  override?: ExpenseSummary,
): ExpenseSummary => {
  const totals = expenses.reduce(
    (acc, expense) => {
      acc.total += expense.amount;
      if (expense.source === 'inApp') {
        acc.invoiceTotal += expense.amount;
      } else {
        acc.externalTotal += expense.amount;
      }
      return acc;
    },
    {total: 0, invoiceTotal: 0, externalTotal: 0},
  );

  return {
    total: override?.total ?? totals.total,
    invoiceTotal: override?.invoiceTotal ?? totals.invoiceTotal,
    externalTotal: override?.externalTotal ?? totals.externalTotal,
    currencyCode: override?.currencyCode ?? expenses[0]?.currencyCode ?? 'USD',
    lastUpdated: new Date().toISOString(),
  };
};

const recalculateSummary = (
  state: ExpensesState,
  companionId: string,
  summaryOverride?: ExpenseSummary | null,
) => {
  const expenses = state.items.filter(item => item.companionId === companionId);

  if (expenses.length === 0) {
    if (summaryOverride) {
      state.summaries[companionId] = {
        ...summaryOverride,
        lastUpdated: new Date().toISOString(),
      };
    } else {
      delete state.summaries[companionId];
    }
    return;
  }

  state.summaries[companionId] = buildSummary(
    expenses,
    summaryOverride ?? undefined,
  );
};

const expensesSlice = createSlice({
  name: 'expenses',
  initialState,
  reducers: {
    clearExpenseError: state => {
      state.error = null;
    },
    resetExpensesState: () => initialState,
    injectMockExpenses: (
      state,
      action: PayloadAction<{companionId: string; expenses: Expense[]}>,
    ) => {
      const {companionId, expenses} = action.payload;
      state.items = state.items.filter(
        item => item.companionId !== companionId,
      );
      state.items.push(...expenses);
      recalculateSummary(state, companionId);
      state.hydratedCompanions[companionId] = true;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchExpensesForCompanion.pending, (state, action) => {
        state.loading = true;
        state.error = null;
        markCollectionPending(
          state,
          action.meta?.arg?.companionId,
          action.meta?.requestId,
        );
      })
      .addCase(fetchExpensesForCompanion.fulfilled, (state, action) => {
        state.loading = false;
        const {companionId, expenses, summary} = action.payload;

        state.items = state.items.filter(
          item => item.companionId !== companionId,
        );
        state.items.push(...expenses);
        recalculateSummary(state, companionId, summary);
        markCollectionHydrated(state, companionId);
      })
      .addCase(fetchExpensesForCompanion.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unable to fetch expenses';
        markCollectionFailed(
          state,
          action.meta?.arg?.companionId,
          action.payload,
          action.meta?.requestId,
        );
      })
      .addCase(addExternalExpense.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addExternalExpense.fulfilled, (state, action) => {
        state.loading = false;
        state.items.push(action.payload);
        recalculateSummary(state, action.payload.companionId);
      })
      .addCase(addExternalExpense.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unable to add expense';
      })
      .addCase(updateExternalExpense.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateExternalExpense.fulfilled, (state, action) => {
        state.loading = false;
        const updatedExpense = action.payload;
        const index = state.items.findIndex(
          item => item.id === updatedExpense.id,
        );
        if (index !== -1) {
          state.items[index] = updatedExpense;
        }
        recalculateSummary(state, updatedExpense.companionId);
      })
      .addCase(updateExternalExpense.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unable to update expense';
      })
      .addCase(deleteExternalExpense.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteExternalExpense.fulfilled, (state, action) => {
        state.loading = false;
        const {expenseId, companionId} = action.payload;
        state.items = state.items.filter(item => item.id !== expenseId);
        recalculateSummary(state, companionId);
      })
      .addCase(deleteExternalExpense.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unable to delete expense';
      })
      .addCase(markInAppExpenseStatus.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(markInAppExpenseStatus.fulfilled, (state, action) => {
        state.loading = false;
        const {expenseId, status} = action.payload;
        const expense = state.items.find(item => item.id === expenseId);
        if (expense) {
          expense.status = status;
          expense.updatedAt = new Date().toISOString();
          recalculateSummary(state, expense.companionId);
        }
      })
      .addCase(markInAppExpenseStatus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unable to update payment status';
      })
      .addCase(fetchExpenseById.fulfilled, (state, action) => {
        const expense = action.payload;
        const index = state.items.findIndex(item => item.id === expense.id);
        if (index >= 0) {
          state.items[index] = expense;
        } else {
          state.items.push(expense);
        }
        recalculateSummary(state, expense.companionId);
      })
      // fetchExpenseSummary marks the companion hydrated, and Home's readiness
      // gate waits on that flag. It previously had ONLY a fulfilled reducer, so
      // a rejected summary wrote no failure anywhere: hydration stayed false,
      // the gate never saw a failure to settle on, and the opaque Home loader
      // sat there until its 12s timeout. That is the exact symptom this branch
      // set out to remove, surviving in the one thunk that had no error path.
      .addCase(fetchExpenseSummary.pending, (state, action) => {
        markCollectionPending(
          state,
          action.meta?.arg?.companionId,
          action.meta?.requestId,
        );
      })
      .addCase(fetchExpenseSummary.fulfilled, (state, action) => {
        const {companionId, summary} = action.payload;
        state.summaries[companionId] = {
          ...summary,
          lastUpdated: new Date().toISOString(),
        };
        markCollectionHydrated(state, companionId);
      })
      .addCase(fetchExpenseSummary.rejected, (state, action) => {
        const message = action.payload ?? 'Unable to fetch expense summary';
        state.error = message;
        markCollectionFailed(
          state,
          action.meta?.arg?.companionId,
          message,
          action.meta?.requestId,
        );
      });
  },
});

export const {clearExpenseError, resetExpensesState, injectMockExpenses} =
  expensesSlice.actions;

export default expensesSlice.reducer;
