import {createSlice, PayloadAction} from '@reduxjs/toolkit';
import type {ExpensesState, Expense} from './types';
import {
  addExternalExpense,
  deleteExternalExpense,
  fetchExpensesForCompanion,
  markInAppExpenseStatus,
  updateExternalExpense,
} from './thunks';

const initialState: ExpensesState = {
  items: [],
  loading: false,
  error: null,
  summaries: {},
  hydratedCompanions: {},
};

const recalculateSummary = (state: ExpensesState, companionId: string) => {
  const expenses = state.items.filter(item => item.companionId === companionId);

  if (expenses.length === 0) {
    delete state.summaries[companionId];
    return;
  }

  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const currencyCode = expenses[0].currencyCode;

  state.summaries[companionId] = {
    total,
    currencyCode,
    lastUpdated: new Date().toISOString(),
  };
};

const expensesSlice = createSlice({
  name: 'expenses',
  initialState,
  reducers: {
    clearExpenseError: state => {
      state.error = null;
    },
    injectMockExpenses: (state, action: PayloadAction<{companionId: string; expenses: Expense[]}>) => {
      const {companionId, expenses} = action.payload;
      state.items = state.items.filter(item => item.companionId !== companionId);
      state.items.push(...expenses);
      recalculateSummary(state, companionId);
      state.hydratedCompanions[companionId] = true;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchExpensesForCompanion.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchExpensesForCompanion.fulfilled, (state, action) => {
        state.loading = false;
  const {companionId, expenses} = action.payload;

        // Keep any existing items for this companion that are external and
        // were added locally (e.g., via addExternalExpense) but are not
        // present in the fetched mock data. We'll merge fetched items and
        // preserve any external items with ids that don't collide.
        const existingForCompanion = state.items.filter(
          item => item.companionId === companionId,
        );

        // Build a map of fetched expense ids for quick lookup
        const fetchedIds = new Set(expenses.map(e => e.id));

        // Preserve existing external expenses that are not present in fetched
        const preserved = existingForCompanion.filter(
          item => item.source === 'external' && !fetchedIds.has(item.id),
        );

        // Remove all items for this companion and replace with fetched + preserved
        state.items = state.items.filter(item => item.companionId !== companionId);
        state.items.push(...expenses);
        if (preserved.length > 0) {
          state.items.push(...preserved);
        }

  // Recalculate summary from the merged items so any preserved local
  // external expenses are included in totals.
  recalculateSummary(state, companionId);
        state.hydratedCompanions[companionId] = true;
      })
      .addCase(fetchExpensesForCompanion.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unable to fetch expenses';
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
        const {expenseId, updates} = action.payload;
        const index = state.items.findIndex(item => item.id === expenseId);
        if (index !== -1) {
          const existing = state.items[index];
          const updated: Expense = {
            ...existing,
            ...updates,
          };
          state.items[index] = updated;
          recalculateSummary(state, updated.companionId);
        }
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
      });
  },
});

export const {clearExpenseError, injectMockExpenses} = expensesSlice.actions;

export default expensesSlice.reducer;
