import expensesReducer, {
  clearExpenseError,
  injectMockExpenses,
} from '@/features/expenses/expenseSlice';
import {
  fetchExpensesForCompanion,
  addExternalExpense,
  updateExternalExpense,
  deleteExternalExpense,
  markInAppExpenseStatus,
} from '@/features/expenses/thunks';
import type {ExpensesState, Expense, ExpenseSummary} from '@/features/expenses/types';

// Mock the date for consistent snapshots
jest.useFakeTimers().setSystemTime(new Date('2023-01-01T00:00:00.000Z'));

const initialState: ExpensesState = {
  items: [],
  loading: false,
  error: null,
  summaries: {},
  hydratedCompanions: {},
};

// --- MOCK DATA ---
const mockExpense1: Expense = {
  id: 'exp1',
  companionId: 'comp1',
  title: 'Vet Visit',
  category: 'health',
  subcategory: 'hospital-visits',
  visitType: 'Hospital',
  amount: 100,
  currencyCode: 'USD',
  status: 'paid',
  source: 'inApp',
  date: '2023-01-01T00:00:00.000Z',
  createdAt: '2023-01-01T00:00:00.000Z',
  updatedAt: '2023-01-01T00:00:00.000Z',
  attachments: [],
};

const mockExpense2: Expense = {
  ...mockExpense1,
  id: 'exp2',
  title: 'Grooming',
  category: 'hygiene-maintenance',
  amount: 50,
  status: 'unpaid',
};

const mockExternalExpense: Expense = {
  ...mockExpense1,
  id: 'exp-external',
  source: 'external',
  amount: 200,
};

const mockSummary: ExpenseSummary = {
  total: 100,
  currencyCode: 'USD',
  lastUpdated: '2023-01-01T00:00:00.000Z',
};
// --- END MOCK DATA ---

describe('expensesSlice', () => {
  it('should return the initial state', () => {
    expect(expensesReducer(undefined, {type: ''})).toEqual(initialState);
  });

  describe('reducers', () => {
    it('should handle clearExpenseError', () => {
      const state: ExpensesState = {...initialState, error: 'An error'};
      const nextState = expensesReducer(state, clearExpenseError());
      expect(nextState.error).toBeNull();
    });

    it('should handle injectMockExpenses', () => {
      const state: ExpensesState = {
        ...initialState,
        items: [{...mockExpense1, id: 'old-exp', companionId: 'comp1'}],
      };
      const newExpenses = [mockExpense1, mockExpense2];
      const action = injectMockExpenses({
        companionId: 'comp1',
        expenses: newExpenses,
      });
      const nextState = expensesReducer(state, action);

      expect(nextState.items).toEqual(newExpenses);
      expect(nextState.summaries.comp1.total).toBe(150); // <<< LINT FIX
      expect(nextState.hydratedCompanions.comp1).toBe(true); // <<< LINT FIX
    });
  });

  describe('extraReducers - fetchExpensesForCompanion', () => {
    it('should set loading on pending', () => {
      const action = {type: fetchExpensesForCompanion.pending.type};
      const state = expensesReducer(initialState, action);
      expect(state.loading).toBe(true);
      expect(state.error).toBeNull();
    });

    it('should set expenses and summary on fulfilled', () => {
      const payload = {
        companionId: 'comp1',
        expenses: [mockExpense1, mockExpense2],
        summary: {...mockSummary, total: 150},
      };
      const action = {type: fetchExpensesForCompanion.fulfilled.type, payload};
      const state = expensesReducer(initialState, action);

      expect(state.loading).toBe(false);
      expect(state.items).toEqual([mockExpense1, mockExpense2]);
      expect(state.summaries.comp1).toEqual(payload.summary); // <<< LINT FIX
      expect(state.hydratedCompanions.comp1).toBe(true); // <<< LINT FIX
    });

    it('should merge existing external expenses on fulfilled', () => {
      const initialStateWithExternal: ExpensesState = {
        ...initialState,
        items: [mockExternalExpense], // Existing external expense
      };

      const payload = {
        companionId: 'comp1',
        expenses: [mockExpense1, mockExpense2], // Fetched in-app expenses
        summary: {...mockSummary, total: 150}, // Summary from thunk (will be recalculated)
      };
      const action = {type: fetchExpensesForCompanion.fulfilled.type, payload};
      const state = expensesReducer(initialStateWithExternal, action);

      expect(state.loading).toBe(false);
      expect(state.items).toHaveLength(3);
      expect(state.items).toContain(mockExpense1);
      expect(state.items).toContain(mockExpense2);
      expect(state.items).toContain(mockExternalExpense);
      expect(state.summaries.comp1.total).toBe(350); // <<< LINT FIX (100 + 50 + 200)
      expect(state.hydratedCompanions.comp1).toBe(true); // <<< LINT FIX
    });

    it('should not preserve external expense if ID collides', () => {
      const collidingExternal = {...mockExternalExpense, id: 'exp1'}; // Same ID as mockExpense1
      const initialStateWithExternal: ExpensesState = {
        ...initialState,
        items: [collidingExternal],
      };

      const payload = {
        companionId: 'comp1',
        expenses: [mockExpense1, mockExpense2],
        summary: {...mockSummary, total: 150},
      };
      const action = {type: fetchExpensesForCompanion.fulfilled.type, payload};
      const state = expensesReducer(initialStateWithExternal, action);

      expect(state.items).toHaveLength(2);
      expect(state.items).toContain(mockExpense1);
      expect(state.items).toContain(mockExpense2);
      expect(state.summaries.comp1.total).toBe(150); // <<< LINT FIX (100 + 50)
    });

    it('should set error on rejected', () => {
      const error = 'Unable to fetch';
      const action = {type: fetchExpensesForCompanion.rejected.type, payload: error};
      const state = expensesReducer(initialState, action);
      expect(state.loading).toBe(false);
      expect(state.error).toBe(error);
    });

    it('should set default error on rejected if no payload', () => {
      const action = {type: fetchExpensesForCompanion.rejected.type, payload: undefined};
      const state = expensesReducer(initialState, action);
      expect(state.error).toBe('Unable to fetch expenses');
    });
  });

  describe('extraReducers - addExternalExpense', () => {
    it('should set loading on pending', () => {
      const action = {type: addExternalExpense.pending.type};
      const state = expensesReducer(initialState, action);
      expect(state.loading).toBe(true);
    });

    it('should add expense and update summary on fulfilled', () => {
      const action = {type: addExternalExpense.fulfilled.type, payload: mockExpense1};
      const state = expensesReducer(initialState, action);

      expect(state.loading).toBe(false);
      expect(state.items).toEqual([mockExpense1]);
      expect(state.summaries.comp1.total).toBe(100); // <<< LINT FIX
      expect(state.summaries.comp1.currencyCode).toBe('USD'); // <<< LINT FIX
    });

    it('should set error on rejected', () => {
      const error = 'Unable to add';
      const action = {type: addExternalExpense.rejected.type, payload: error};
      const state = expensesReducer(initialState, action);
      expect(state.loading).toBe(false);
      expect(state.error).toBe(error);
    });

    it('should set default error on rejected if no payload', () => {
      const action = {type: addExternalExpense.rejected.type, payload: undefined};
      const state = expensesReducer(initialState, action);
      expect(state.error).toBe('Unable to add expense');
    });
  });

  describe('extraReducers - updateExternalExpense', () => {
    const initialStateWithItem: ExpensesState = {
      ...initialState,
      items: [mockExpense1],
      summaries: {comp1: mockSummary},
    };

    it('should set loading on pending', () => {
      const action = {type: updateExternalExpense.pending.type};
      const state = expensesReducer(initialStateWithItem, action);
      expect(state.loading).toBe(true);
    });

    it('should update expense and summary on fulfilled', () => {
      const updates = {amount: 150, title: 'New Title'};
      const payload = {
        expenseId: 'exp1',
        updates: {...updates, updatedAt: '2023-01-02T00:00:00.000Z'},
      };
      const action = {type: updateExternalExpense.fulfilled.type, payload};
      const state = expensesReducer(initialStateWithItem, action);

      expect(state.loading).toBe(false);
      expect(state.items[0].amount).toBe(150);
      expect(state.items[0].title).toBe('New Title');
      expect(state.items[0].updatedAt).toBe('2023-01-02T00:00:00.000Z');
      expect(state.summaries.comp1.total).toBe(150); // <<< LINT FIX
    });

    it('should not update if expenseId is not found', () => {
      const updates = {amount: 150};
      const payload = {expenseId: 'exp-not-found', updates};
      const action = {type: updateExternalExpense.fulfilled.type, payload};
      const state = expensesReducer(initialStateWithItem, action);

      expect(state.items[0].amount).toBe(100); // Unchanged
      expect(state.summaries.comp1.total).toBe(100); // <<< LINT FIX (Unchanged)
    });

    it('should set error on rejected', () => {
      const error = 'Unable to update';
      const action = {type: updateExternalExpense.rejected.type, payload: error};
      const state = expensesReducer(initialStateWithItem, action);
      expect(state.loading).toBe(false);
      expect(state.error).toBe(error);
    });

    it('should set default error on rejected if no payload', () => {
      const action = {type: updateExternalExpense.rejected.type, payload: undefined};
      const state = expensesReducer(initialStateWithItem, action);
      expect(state.error).toBe('Unable to update expense');
    });
  });

  describe('extraReducers - deleteExternalExpense', () => {
    const initialStateWithItem: ExpensesState = {
      ...initialState,
      items: [mockExpense1],
      summaries: {comp1: mockSummary},
    };

    it('should set loading on pending', () => {
      const action = {type: deleteExternalExpense.pending.type};
      const state = expensesReducer(initialStateWithItem, action);
      expect(state.loading).toBe(true);
    });

    it('should delete expense and summary on fulfilled', () => {
      const payload = {expenseId: 'exp1', companionId: 'comp1'};
      const action = {type: deleteExternalExpense.fulfilled.type, payload};
      const state = expensesReducer(initialStateWithItem, action);

      expect(state.loading).toBe(false);
      expect(state.items).toEqual([]);
      expect(state.summaries.comp1).toBeUndefined(); // <<< LINT FIX (Summary should be deleted)
    });

    it('should delete expense and recalculate summary if others remain', () => {
      const initialStateWithItems: ExpensesState = {
        ...initialState,
        items: [mockExpense1, mockExpense2], // Both for 'comp1'
        summaries: {comp1: {...mockSummary, total: 150}},
      };
      const payload = {expenseId: 'exp1', companionId: 'comp1'};
      const action = {type: deleteExternalExpense.fulfilled.type, payload};
      const state = expensesReducer(initialStateWithItems, action);

      expect(state.items).toEqual([mockExpense2]);
      expect(state.summaries.comp1.total).toBe(50); // <<< LINT FIX (Recalculated)
    });

    it('should set error on rejected', () => {
      const error = 'Unable to delete';
      const action = {type: deleteExternalExpense.rejected.type, payload: error};
      const state = expensesReducer(initialStateWithItem, action);
      expect(state.loading).toBe(false);
      expect(state.error).toBe(error);
    });

    it('should set default error on rejected if no payload', () => {
      const action = {type: deleteExternalExpense.rejected.type, payload: undefined};
      const state = expensesReducer(initialStateWithItem, action);
      expect(state.error).toBe('Unable to delete expense');
    });
  });

  describe('extraReducers - markInAppExpenseStatus', () => {
    const initialStateWithItem: ExpensesState = {
      ...initialState,
      items: [mockExpense2], // mockExpense2 is 'unpaid'
      summaries: {comp1: {...mockSummary, total: 50}},
    };

    it('should set loading on pending', () => {
      const action = {type: markInAppExpenseStatus.pending.type};
      const state = expensesReducer(initialStateWithItem, action);
      expect(state.loading).toBe(true);
    });

    it('should update status on fulfilled', () => {
      const payload = {expenseId: 'exp2', status: 'paid' as const};
      const action = {type: markInAppExpenseStatus.fulfilled.type, payload};
      const state = expensesReducer(initialStateWithItem, action);

      expect(state.loading).toBe(false);
      expect(state.items[0].status).toBe('paid');
      expect(state.items[0].updatedAt).toBe('2023-01-01T00:00:00.000Z');
      expect(state.summaries.comp1.total).toBe(50); // <<< LINT FIX
    });

    it('should not update if expenseId is not found', () => {
      const payload = {expenseId: 'exp-not-found', status: 'paid' as const};
      const action = {type: markInAppExpenseStatus.fulfilled.type, payload};
      const state = expensesReducer(initialStateWithItem, action);

      expect(state.items[0].status).toBe('unpaid'); // Unchanged
    });

    it('should set error on rejected', () => {
      const error = 'Unable to update status';
      const action = {type: markInAppExpenseStatus.rejected.type, payload: error};
      const state = expensesReducer(initialStateWithItem, action);
      expect(state.loading).toBe(false);
      expect(state.error).toBe(error);
    });

    it('should set default error on rejected if no payload', () => {
      const action = {
        type: markInAppExpenseStatus.rejected.type,
        payload: undefined,
      };
      const state = expensesReducer(initialStateWithItem, action);
      expect(state.error).toBe('Unable to update payment status');
    });
  });
});