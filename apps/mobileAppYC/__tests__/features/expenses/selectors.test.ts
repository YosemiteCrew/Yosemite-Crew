import {
  selectExpensesState,
  selectExpensesLoading,
  selectExpensesError,
  selectHasHydratedCompanion,
  selectExpensesByCompanion,
  selectInAppExpensesByCompanion,
  selectExternalExpensesByCompanion,
  selectRecentInAppExpenses,
  selectRecentExternalExpenses,
  selectExpenseById,
  selectExpenseSummaryByCompanion,
  selectTotalSpentForCompanion,
} from '@/features/expenses/selectors';
import type {RootState} from '@/app/store';
import type {
  Expense,
  ExpensesState,
  ExpenseSummary,
} from '@/features/expenses/types';

const mockExp1: Expense = {
  id: 'exp1',
  companionId: 'comp1',
  amount: 100,
  source: 'inApp',
  date: '2023-10-03T10:00:00.000Z',
  status: 'paid',
  category: 'health',
  subcategory: 'vaccination-parasite',
  visitType: 'Hospital',
  title: 'Annual Checkup',
  currencyCode: 'USD',
  createdAt: '2023-10-03T10:00:00.000Z',
  updatedAt: '2023-10-03T10:00:00.000Z',
  attachments: [],
};

const mockExp2: Expense = {
  ...mockExp1,
  id: 'exp2',
  amount: 50,
  source: 'inApp',
  date: '2023-10-01T10:00:00.000Z',
  currencyCode: 'USD',
};

const mockExp3: Expense = {
  ...mockExp1,
  id: 'exp3',
  amount: 75,
  source: 'external',
  date: '2023-10-02T10:00:00.000Z',
  currencyCode: 'USD',
};

const mockExp4: Expense = {
  ...mockExp1,
  id: 'exp4',
  companionId: 'comp2',
  amount: 200,
  date: '2023-10-04T10:00:00.000Z',
  currencyCode: 'USD',
};

const mockSummary1: ExpenseSummary = {
  total: 225,
  currencyCode: 'USD',
  lastUpdated: '2023-01-01T00:00:00.000Z',
};

const mockSummary2: ExpenseSummary = {
  total: 200,
  currencyCode: 'USD',
  lastUpdated: '2023-01-01T00:00:00.000Z',
};

const mockExpensesState: ExpensesState = {
  items: [mockExp1, mockExp2, mockExp3, mockExp4],
  loading: true,
  error: 'An error occurred',
  summaries: {
    comp1: mockSummary1,
    comp2: mockSummary2,
  },
  hydratedCompanions: {
    comp1: true,
  },
};

const mockRootState: RootState = {
  expenses: mockExpensesState,
  auth: {} as any,
  companion: {} as any,
  theme: {} as any,
  documents: {} as any,
  tasks: {} as any,
  appointments: {
    items: [],
    invoices: [],
    loading: false,
    error: null,
    hydratedCompanions: {},
  },
  businesses: {
    businesses: [],
    employees: [],
    availability: [],
    loading: false,
    error: null,
  },
  _persist: { version: -1, rehydrated: true },
};

describe('Expense Selectors', () => {
  it('should select the expenses state', () => {
    expect(selectExpensesState(mockRootState)).toEqual(mockExpensesState);
  });

  it('should select expenses loading', () => {
    expect(selectExpensesLoading(mockRootState)).toBe(true);
  });

  it('should select expenses error', () => {
    expect(selectExpensesError(mockRootState)).toBe('An error occurred');
  });

  describe('selectHasHydratedCompanion', () => {
    it('should return true if companion is hydrated', () => {
      expect(selectHasHydratedCompanion('comp1')(mockRootState)).toBe(true);
    });

    it('should return false if companion is not hydrated', () => {
      expect(selectHasHydratedCompanion('comp2')(mockRootState)).toBe(false);
    });

    it('should return false if companion ID is null', () => {
      expect(selectHasHydratedCompanion(null)(mockRootState)).toBe(false);
    });
  });

  describe('selectExpensesByCompanion', () => {
    it('should return sorted expenses for a specific companion', () => {
      const result = selectExpensesByCompanion('comp1')(mockRootState);
      expect(result).toHaveLength(3);
      expect(result[0]).toBe(mockExp1);
      expect(result[1]).toBe(mockExp3);
      expect(result[2]).toBe(mockExp2);
    });

    it('should return an empty array for a companion with no expenses', () => {
      expect(selectExpensesByCompanion('comp-none')(mockRootState)).toEqual([]);
    });

    it('should return an empty array if companionId is null', () => {
      expect(selectExpensesByCompanion(null)(mockRootState)).toEqual([]);
    });
  });

  describe('selectInAppExpensesByCompanion', () => {
    it('should return only inApp expenses, sorted', () => {
      const result = selectInAppExpensesByCompanion('comp1')(mockRootState);
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(mockExp1);
      expect(result[1]).toBe(mockExp2);
    });

    it('should return an empty array if no inApp expenses', () => {
      const stateWithoutInApp = {
        ...mockRootState,
        expenses: {
          ...mockExpensesState,
          items: [mockExp3],
        },
      };
      expect(selectInAppExpensesByCompanion('comp1')(stateWithoutInApp)).toEqual(
        [],
      );
    });
  });

  describe('selectExternalExpensesByCompanion', () => {
    it('should return only external expenses, sorted', () => {
      const result = selectExternalExpensesByCompanion('comp1')(mockRootState);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(mockExp3);
    });

    it('should return an empty array if no external expenses', () => {
      const stateWithoutExternal = {
        ...mockRootState,
        expenses: {
          ...mockExpensesState,
          items: [mockExp1, mockExp2],
        },
      };
      expect(
        selectExternalExpensesByCompanion('comp1')(stateWithoutExternal),
      ).toEqual([]);
    });
  });

  describe('selectRecentInAppExpenses', () => {
    it('should return the most recent 2 (default) inApp expenses', () => {
      const result = selectRecentInAppExpenses('comp1')(mockRootState);
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(mockExp1);
      expect(result[1]).toBe(mockExp2);
    });

    it('should return the most recent 1 inApp expense when limited', () => {
      const result = selectRecentInAppExpenses('comp1', 1)(mockRootState);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(mockExp1);
    });
  });

  describe('selectRecentExternalExpenses', () => {
    it('should return the most recent 2 (default) external expenses', () => {
      const result = selectRecentExternalExpenses('comp1')(mockRootState);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(mockExp3);
    });

    it('should return an empty array if no external expenses', () => {
      const result = selectRecentExternalExpenses('comp2')(mockRootState);
      expect(result).toHaveLength(0);
    });
  });

  describe('selectExpenseById', () => {
    it('should find an expense by its ID', () => {
      expect(selectExpenseById('exp1')(mockRootState)).toBe(mockExp1);
      expect(selectExpenseById('exp4')(mockRootState)).toBe(mockExp4);
    });

    it('should return null if expense ID is not found', () => {
      expect(selectExpenseById('not-found')(mockRootState)).toBeNull();
    });

    it('should return null if expense ID is null', () => {
      expect(selectExpenseById(null)(mockRootState)).toBeNull();
    });
  });

  describe('selectExpenseSummaryByCompanion', () => {
    it('should return the summary for a specific companion', () => {
      expect(selectExpenseSummaryByCompanion('comp1')(mockRootState)).toBe(
        mockSummary1,
      );
      expect(selectExpenseSummaryByCompanion('comp2')(mockRootState)).toBe(
        mockSummary2,
      );
    });

    it('should return null if no summary exists for the companion', () => {
      expect(
        selectExpenseSummaryByCompanion('comp-none')(mockRootState),
      ).toBeNull();
    });

    it('should return null if companionId is null', () => {
      expect(selectExpenseSummaryByCompanion(null)(mockRootState)).toBeNull();
    });
  });

  describe('selectTotalSpentForCompanion', () => {
    it('should return the total from the summary', () => {
      expect(selectTotalSpentForCompanion('comp1')(mockRootState)).toBe(225);
      expect(selectTotalSpentForCompanion('comp2')(mockRootState)).toBe(200);
    });

    it('should return 0 if no summary is found', () => {
      expect(selectTotalSpentForCompanion('comp-none')(mockRootState)).toBe(0);
    });

    it('should return 0 if companionId is null', () => {
      expect(selectTotalSpentForCompanion(null)(mockRootState)).toBe(0);
    });
  });
});
