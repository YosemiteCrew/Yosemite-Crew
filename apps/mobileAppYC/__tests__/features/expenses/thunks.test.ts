import {
  fetchExpensesForCompanion,
  addExternalExpense,
  updateExternalExpense,
  deleteExternalExpense,
  markInAppExpenseStatus,
  type AddExternalExpensePayload,
} from '@/features/expenses/thunks';
import type {RootState} from '@/app/store';

jest.mock('@/utils/helpers', () => ({
  generateId: jest.fn(() => 'mock-id-123'),
}));

jest.useFakeTimers();

const getMockState = (currency: string | null = 'USD'): RootState =>
  ({
    auth: {
      user: {
        currency: currency,
      },
    },
    expenses: {
      expensesByCompanion: {},
      summariesByCompanion: {},
      hydrationByCompanion: {},
      loading: 'idle',
      error: null,
    },
    companion: {
      companions: [],
      selectedCompanionId: null,
      loading: 'idle',
      error: null,
    },
  } as any);

describe('Expense Thunks', () => {
  const mockDispatch = jest.fn();
  let dateNowSpy: jest.SpyInstance;

  beforeEach(() => {
    mockDispatch.mockClear();
    jest.clearAllMocks();
    jest.useFakeTimers();
    dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => 0);
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
  });

  describe('fetchExpensesForCompanion', () => {
    const companionId = 'comp-123';

    it('should fetch expenses and summary successfully (fulfilled)', async () => {
      const state = getMockState('EUR');
      const getState = () => state;

      const action = fetchExpensesForCompanion({companionId});
      const thunkPromise = action(mockDispatch, getState, undefined);
      jest.advanceTimersByTime(600);
      await thunkPromise;

      expect(mockDispatch.mock.calls[0][0].type).toBe(
        'expenses/fetchForCompanion/pending',
      );
      const fulfilledAction = mockDispatch.mock.calls[1][0];
      expect(fulfilledAction.type).toBe(
        'expenses/fetchForCompanion/fulfilled',
      );
      expect(fulfilledAction.payload.companionId).toBe(companionId);
      expect(fulfilledAction.payload.expenses.length).toBe(6);
      expect(fulfilledAction.payload.expenses[0].currencyCode).toBe('EUR');
      expect(fulfilledAction.payload.summary.currencyCode).toBe('EUR');
    });

    it('should use default currency "USD" if user currency is null', async () => {
      const state = getMockState(null);
      const getState = () => state;

      const action = fetchExpensesForCompanion({companionId});
      const thunkPromise = action(mockDispatch, getState, undefined);
      jest.advanceTimersByTime(600);
      await thunkPromise;

      const fulfilledAction = mockDispatch.mock.calls[1][0];
      expect(fulfilledAction.payload.expenses[0].currencyCode).toBe('USD');
      expect(fulfilledAction.payload.summary.currencyCode).toBe('USD');
    });

    it('should handle errors (rejected)', async () => {
      const error = new Error('Database failed');
      const getState = () => {
        throw error;
      };

      const action = fetchExpensesForCompanion({companionId});
      await action(mockDispatch, getState, undefined);

      const rejectedAction = mockDispatch.mock.calls[1][0];
      expect(rejectedAction.type).toBe('expenses/fetchForCompanion/rejected');
      expect(rejectedAction.payload).toBe('Database failed');
    });

    it('should handle non-Error rejections', async () => {
      const error = 'Database failed string';
      const getState = () => {
        throw error;
      };

      const action = fetchExpensesForCompanion({companionId});
      await action(mockDispatch, getState, undefined);

      const rejectedAction = mockDispatch.mock.calls[1][0];
      expect(rejectedAction.type).toBe('expenses/fetchForCompanion/rejected');
      expect(rejectedAction.payload).toBe('Failed to fetch expenses');
    });
  });

  describe('addExternalExpense', () => {
    const payload: AddExternalExpensePayload = {
      companionId: 'comp-123',
      title: 'New Vet Bill',
      category: 'health',
      subcategory: 'hospital-visits',
      visitType: 'Hospital',
      amount: 150,
      date: '2023-10-23T10:00:00.000Z',
      attachments: [],
      providerName: 'Test Vet',
    };

    it('should add an expense successfully (fulfilled)', async () => {
      const state = getMockState('JPY');
      const getState = () => state;

      const action = addExternalExpense(payload);
      const thunkPromise = action(mockDispatch, getState, undefined);
      jest.advanceTimersByTime(500);
      await thunkPromise;

      const fulfilledAction = mockDispatch.mock.calls[1][0];
      expect(fulfilledAction.type).toBe('expenses/addExternalExpense/fulfilled');
      expect(fulfilledAction.payload.title).toBe('New Vet Bill');
      expect(fulfilledAction.payload.currencyCode).toBe('JPY');
      expect(fulfilledAction.payload.id).toBe('expense_0_mock-id-123');
    });

    it('should handle errors (rejected)', async () => {
      const error = new Error('Failed to add');
      const getState = () => {
        throw error;
      };

      const action = addExternalExpense(payload);
      await action(mockDispatch, getState, undefined);

      const rejectedAction = mockDispatch.mock.calls[1][0];
      expect(rejectedAction.type).toBe('expenses/addExternalExpense/rejected');
      expect(rejectedAction.payload).toBe('Failed to add');
    });

    it('should handle non-Error rejections', async () => {
      const error = 'Failed to add string';
      const getState = () => {
        throw error;
      };

      const action = addExternalExpense(payload);
      await action(mockDispatch, getState, undefined);

      const rejectedAction = mockDispatch.mock.calls[1][0];
      expect(rejectedAction.type).toBe('expenses/addExternalExpense/rejected');
      expect(rejectedAction.payload).toBe('Failed to add expense');
    });
  });

  describe('updateExternalExpense', () => {
    const payload = {
      expenseId: 'expense-abc',
      updates: {title: 'Updated Title', amount: 200},
    };

    it('should update an expense successfully (fulfilled)', async () => {
      const getState = () => getMockState();

      const action = updateExternalExpense(payload);
      const thunkPromise = action(mockDispatch, getState, undefined);
      jest.advanceTimersByTime(400);
      await thunkPromise;

      const fulfilledAction = mockDispatch.mock.calls[1][0];
      expect(fulfilledAction.type).toBe(
        'expenses/updateExternalExpense/fulfilled',
      );
      expect(fulfilledAction.payload.expenseId).toBe('expense-abc');
      expect(fulfilledAction.payload.updates.title).toBe('Updated Title');
      expect(fulfilledAction.payload.updates.updatedAt).toBeDefined();
    });

    it('should handle errors (rejected)', async () => {
      const error = new Error('Update failed');
      jest.spyOn(globalThis, 'setTimeout').mockImplementationOnce(() => {
        throw error;
      });

      const getState = () => getMockState();
      const action = updateExternalExpense(payload);
      await action(mockDispatch, getState, undefined);

      const rejectedAction = mockDispatch.mock.calls[1][0];
      expect(rejectedAction.type).toBe(
        'expenses/updateExternalExpense/rejected',
      );
      expect(rejectedAction.payload).toBe('Update failed');
    });

    it('should handle non-Error rejections', async () => {
      const error = 'Update failed string';
      jest.spyOn(globalThis, 'setTimeout').mockImplementationOnce(() => {
        throw error;
      });

      const getState = () => getMockState();
      const action = updateExternalExpense(payload);
      await action(mockDispatch, getState, undefined);

      const rejectedAction = mockDispatch.mock.calls[1][0];
      expect(rejectedAction.type).toBe(
        'expenses/updateExternalExpense/rejected',
      );
      expect(rejectedAction.payload).toBe('Failed to update expense');
    });
  });

  describe('deleteExternalExpense', () => {
    const payload = {expenseId: 'expense-abc', companionId: 'comp-123'};

    it('should delete an expense successfully (fulfilled)', async () => {
      const getState = () => getMockState();

      const action = deleteExternalExpense(payload);
      const thunkPromise = action(mockDispatch, getState, undefined);
      jest.advanceTimersByTime(300);
      await thunkPromise;

      const fulfilledAction = mockDispatch.mock.calls[1][0];
      expect(fulfilledAction.type).toBe(
        'expenses/deleteExternalExpense/fulfilled',
      );
      expect(fulfilledAction.payload).toEqual(payload);
    });

    it('should handle errors (rejected)', async () => {
      const error = new Error('Delete failed');
      jest.spyOn(globalThis, 'setTimeout').mockImplementationOnce(() => {
        throw error;
      });

      const getState = () => getMockState();
      const action = deleteExternalExpense(payload);
      await action(mockDispatch, getState, undefined);

      const rejectedAction = mockDispatch.mock.calls[1][0];
      expect(rejectedAction.type).toBe(
        'expenses/deleteExternalExpense/rejected',
      );
      expect(rejectedAction.payload).toBe('Delete failed');
    });

    it('should handle non-Error rejections', async () => {
      const error = 'Delete failed string';
      jest.spyOn(globalThis, 'setTimeout').mockImplementationOnce(() => {
        throw error;
      });

      const getState = () => getMockState();
      const action = deleteExternalExpense(payload);
      await action(mockDispatch, getState, undefined);

      const rejectedAction = mockDispatch.mock.calls[1][0];
      expect(rejectedAction.type).toBe(
        'expenses/deleteExternalExpense/rejected',
      );
      expect(rejectedAction.payload).toBe('Failed to delete expense');
    });
  });

  describe('markInAppExpenseStatus', () => {
    const payload = {expenseId: 'expense-abc', status: 'paid' as const};

    it('should update status successfully (fulfilled)', async () => {
      const getState = () => getMockState();

      const action = markInAppExpenseStatus(payload);
      const thunkPromise = action(mockDispatch, getState, undefined);
      jest.advanceTimersByTime(350);
      await thunkPromise;

      const fulfilledAction = mockDispatch.mock.calls[1][0];
      expect(fulfilledAction.type).toBe(
        'expenses/markInAppExpenseStatus/fulfilled',
      );
      expect(fulfilledAction.payload).toEqual(payload);
    });

    it('should handle errors (rejected)', async () => {
      const error = new Error('Status update failed');
      jest.spyOn(globalThis, 'setTimeout').mockImplementationOnce(() => {
        throw error;
      });

      const getState = () => getMockState();
      const action = markInAppExpenseStatus(payload);
      await action(mockDispatch, getState, undefined);

      const rejectedAction = mockDispatch.mock.calls[1][0];
      expect(rejectedAction.type).toBe(
        'expenses/markInAppExpenseStatus/rejected',
      );
      expect(rejectedAction.payload).toBe('Status update failed');
    });

    it('should handle non-Error rejections', async () => {
      const error = 'Status update failed string';
      jest.spyOn(globalThis, 'setTimeout').mockImplementationOnce(() => {
        throw error;
      });

      const getState = () => getMockState();
      const action = markInAppExpenseStatus(payload);
      await action(mockDispatch, getState, undefined);

      const rejectedAction = mockDispatch.mock.calls[1][0];
      expect(rejectedAction.type).toBe(
        'expenses/markInAppExpenseStatus/rejected',
      );
      expect(rejectedAction.payload).toBe('Failed to update payment status'); 
    });
  });
});