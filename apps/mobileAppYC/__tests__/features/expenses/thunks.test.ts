import {
  fetchExpensesForCompanion,
  addExternalExpense,
  updateExternalExpense,
  deleteExternalExpense,
  markInAppExpenseStatus,
  type AddExternalExpensePayload,
} from '@/features/expenses/thunks';
import type {RootState} from '@/app/store';
import type {Expense, ExpenseSummary} from '@/features/expenses/types';
import expenseApi from '@/features/expenses/services/expenseService';

jest.mock('@/shared/utils/helpers', () => ({
  generateId: jest.fn(() => 'mock-id-123'),
}));

const mockGetFreshStoredTokens = jest.fn(async () => ({
  accessToken: 'test-token',
  expiresAt: Date.now() + 10000,
}));
const mockIsTokenExpired = jest.fn(() => false);

jest.mock('@/features/auth/sessionManager', () => ({
  getFreshStoredTokens: () => mockGetFreshStoredTokens(),
  isTokenExpired: () => mockIsTokenExpired(),
}));

jest.mock('@/features/expenses/services/expenseService', () => {
  const api = {
    fetchExpenses: jest.fn(),
    fetchSummary: jest.fn(),
    createExternal: jest.fn(),
    updateExternal: jest.fn(),
    deleteExpense: jest.fn(),
  };
  return {
    __esModule: true,
    default: api,
    expenseApi: api,
  };
});

const mockExpenseApi = expenseApi as jest.Mocked<typeof expenseApi>;

const baseExpense: Expense = {
  id: 'expense-1',
  companionId: 'comp-123',
  title: 'Vet Visit',
  category: 'health',
  subcategory: 'hospital-visits',
  visitType: 'Hospital',
  amount: 100,
  currencyCode: 'USD',
  status: 'PAID',
  source: 'external',
  date: '2023-10-10T00:00:00.000Z',
  createdAt: '2023-10-10T00:00:00.000Z',
  updatedAt: '2023-10-10T00:00:00.000Z',
  attachments: [],
};

const summary: ExpenseSummary = {
  total: 100,
  invoiceTotal: 0,
  externalTotal: 100,
  currencyCode: 'USD',
  lastUpdated: '2023-10-10T00:00:00.000Z',
};

const getMockState = (
  currency: string | null = 'USD',
  expenses: Expense[] = [baseExpense],
): RootState =>
  ({
    auth: {
      user: {
        id: 'user-1',
        currency,
        parentId: 'parent-1',
      },
    },
    expenses: {
      items: expenses,
      loading: false,
      error: null,
      summaries: {},
      hydratedCompanions: {},
    },
  } as any);

describe('Expense Thunks', () => {
  const mockDispatch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockDispatch.mockClear();

    mockExpenseApi.fetchExpenses.mockResolvedValue([baseExpense]);
    mockExpenseApi.fetchSummary.mockResolvedValue(summary);
    mockExpenseApi.createExternal.mockResolvedValue({
      ...baseExpense,
      id: 'expense_0_mock-id-123',
      currencyCode: 'JPY',
    });
    mockExpenseApi.updateExternal.mockResolvedValue({
      ...baseExpense,
      id: 'expense-abc',
      amount: 200,
      title: 'Updated Title',
      updatedAt: '2023-11-11T00:00:00.000Z',
    });
    mockExpenseApi.deleteExpense.mockResolvedValue(true);

    mockGetFreshStoredTokens.mockResolvedValue({
      accessToken: 'test-token',
      expiresAt: Date.now() + 10000,
    });
    mockIsTokenExpired.mockReturnValue(false);
  });

  describe('fetchExpensesForCompanion', () => {
    const companionId = 'comp-123';

    it('should fetch expenses and summary successfully (fulfilled)', async () => {
      const state = getMockState('EUR');
      const getState = () => state;

      const action = fetchExpensesForCompanion({companionId});
      const thunkPromise = action(mockDispatch, getState, undefined);
      await thunkPromise;

      expect(mockDispatch.mock.calls[0][0].type).toBe(
        'expenses/fetchForCompanion/pending',
      );
      const fulfilledAction = mockDispatch.mock.calls[1][0];
      expect(fulfilledAction.type).toBe(
        'expenses/fetchForCompanion/fulfilled',
      );
      expect(fulfilledAction.payload.companionId).toBe(companionId);
      expect(fulfilledAction.payload.expenses).toEqual([baseExpense]);
      expect(mockExpenseApi.fetchSummary).toHaveBeenCalledWith(
        expect.objectContaining({currencyCode: 'EUR'}),
      );
    });

    it('should use default currency "USD" if user currency is null', async () => {
      const state = getMockState(null);
      const getState = () => state;

      const action = fetchExpensesForCompanion({companionId});
      const thunkPromise = action(mockDispatch, getState, undefined);
      await thunkPromise;

      expect(mockExpenseApi.fetchSummary).toHaveBeenCalledWith(
        expect.objectContaining({currencyCode: 'USD'}),
      );
    });

    it('should handle errors (rejected)', async () => {
      mockGetFreshStoredTokens.mockResolvedValue(null);
      const action = fetchExpensesForCompanion({companionId});
      await action(mockDispatch, () => getMockState(), undefined);

      const rejectedAction = mockDispatch.mock.calls[1][0];
      expect(rejectedAction.type).toBe('expenses/fetchForCompanion/rejected');
      expect(rejectedAction.payload).toBe('Missing access token. Please sign in again.');
    });

    it('should handle non-Error rejections', async () => {
      mockExpenseApi.fetchExpenses.mockRejectedValue('bad');

      const action = fetchExpensesForCompanion({companionId});
      await action(mockDispatch, () => getMockState(), undefined);

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
      await thunkPromise;

      const fulfilledAction = mockDispatch.mock.calls[1][0];
      expect(fulfilledAction.type).toBe('expenses/addExternalExpense/fulfilled');
      expect(fulfilledAction.payload.currencyCode).toBe('JPY');
      expect(fulfilledAction.payload.id).toBe('expense_0_mock-id-123');
    });

    it('should handle errors (rejected)', async () => {
      mockExpenseApi.createExternal.mockRejectedValue(new Error('Failed to add'));

      const action = addExternalExpense(payload);
      await action(mockDispatch, () => getMockState(), undefined);

      const rejectedAction = mockDispatch.mock.calls[1][0];
      expect(rejectedAction.type).toBe('expenses/addExternalExpense/rejected');
      expect(rejectedAction.payload).toBe('Failed to add');
    });

    it('should handle non-Error rejections', async () => {
      mockExpenseApi.createExternal.mockRejectedValue('Failed to add string');

      const action = addExternalExpense(payload);
      await action(mockDispatch, () => getMockState(), undefined);

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
      const getState = () => getMockState('USD', [
        {...baseExpense, id: 'expense-abc', source: 'external'},
      ]);

      const action = updateExternalExpense(payload);
      const thunkPromise = action(mockDispatch, getState, undefined);
      await thunkPromise;

      const fulfilledAction = mockDispatch.mock.calls[1][0];
      expect(fulfilledAction.type).toBe(
        'expenses/updateExternalExpense/fulfilled',
      );
      expect(fulfilledAction.payload.id).toBe('expense-abc');
      expect(fulfilledAction.payload.title).toBe('Updated Title');
      expect(fulfilledAction.payload.updatedAt).toBe('2023-11-11T00:00:00.000Z');
    });

    it('should handle errors (rejected)', async () => {
      mockExpenseApi.updateExternal.mockRejectedValue(new Error('Update failed'));

      const getState = () =>
        getMockState('USD', [{...baseExpense, id: 'expense-abc', source: 'external'}]);
      const action = updateExternalExpense(payload);
      await action(mockDispatch, getState, undefined);

      const rejectedAction = mockDispatch.mock.calls[1][0];
      expect(rejectedAction.type).toBe(
        'expenses/updateExternalExpense/rejected',
      );
      expect(rejectedAction.payload).toBe('Update failed');
    });

    it('should handle non-Error rejections', async () => {
      mockExpenseApi.updateExternal.mockRejectedValue('Update failed string');

      const getState = () =>
        getMockState('USD', [{...baseExpense, id: 'expense-abc', source: 'external'}]);
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
      await thunkPromise;

      const fulfilledAction = mockDispatch.mock.calls[1][0];
      expect(fulfilledAction.type).toBe(
        'expenses/deleteExternalExpense/fulfilled',
      );
      expect(fulfilledAction.payload).toEqual(payload);
    });

    it('should handle errors (rejected)', async () => {
      mockExpenseApi.deleteExpense.mockRejectedValue(new Error('Delete failed'));

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
      mockExpenseApi.deleteExpense.mockRejectedValue('Delete failed string');

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
      await thunkPromise;

      const fulfilledAction = mockDispatch.mock.calls[1][0];
      expect(fulfilledAction.type).toBe(
        'expenses/markInAppExpenseStatus/fulfilled',
      );
      expect(fulfilledAction.payload).toEqual(payload);
    });
  });
});
