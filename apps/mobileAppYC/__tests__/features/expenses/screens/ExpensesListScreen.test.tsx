import React from 'react';
import {render, act} from '@testing-library/react-native'; // Removed unused fireEvent
import {Provider} from 'react-redux';
import configureStore from 'redux-mock-store';
// 1. Import Thunk types
import {thunk} from 'redux-thunk';
import {
  useNavigation,
  useRoute,
  useFocusEffect,
} from '@react-navigation/native';
// 2. Import AnyAction
import {ExpensesListScreen} from '@/features/expenses/screens/ExpensesListScreen/ExpensesListScreen';
import * as expensesSlice from '@/features/expenses';
import * as companionSlice from '@/features/companion';
import {useTheme} from '@/hooks';
// 3. Import real RootState, AppDispatch, and Expense types
import type {AppDispatch, RootState} from '@/app/store';
import type {Expense, ExpensePaymentStatus} from '@/features/expenses';

// --- Mocks ---

// Mock React Navigation
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: jest.fn(),
  useRoute: jest.fn(),
  useFocusEffect: jest.fn(),
}));
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
(useNavigation as jest.Mock).mockReturnValue({
  navigate: mockNavigate,
  goBack: mockGoBack,
  canGoBack: () => true,
});
const mockUseRoute = useRoute as jest.Mock;
const mockUseFocusEffect = useFocusEffect as jest.Mock;

// Mock custom hooks
jest.mock('@/hooks', () => ({
  useTheme: jest.fn(),
}));
(useTheme as jest.Mock).mockReturnValue({
  theme: {
    colors: {
      background: '#FFFFFF',
      secondary: '#000000',
      textSecondary: '#666666',
    },
    spacing: {2: 2, 3: 3, 4: 4, 10: 10, 24: 24},
    typography: {h5: {}, paragraph: {}},
  },
});

// FIX 4: Move 'RN' import inside each mock factory & use PascalCase
jest.mock('@/shared/components/common', () => {
  const RN = jest.requireActual('react-native');
  // Use PascalCase for mock component names
  const MockYearlySpendCard = (props: any) => (
    <RN.View testID="mock-YearlySpendCard" {...props} />
  );
  return {
    SafeArea: (props: any) => <>{props.children}</>,
    YearlySpendCard: MockYearlySpendCard,
  };
});
jest.mock('@/shared/components/common/Header/Header', () => {
  const RN = jest.requireActual('react-native');
  const MockHeader = (props: any) => (
    <RN.View testID="mock-Header" {...props} />
  );
  return {
    Header: MockHeader,
  };
});
jest.mock('@/shared/components/common/CompanionSelector/CompanionSelector', () => {
  const RN = jest.requireActual('react-native');
  const MockCompanionSelector = (props: any) => (
    <RN.View testID="mock-CompanionSelector" {...props} />
  );
  return {
    CompanionSelector: MockCompanionSelector,
  };
});
jest.mock('@/features/expenses/components', () => {
  const RN = jest.requireActual('react-native');
  const MockExpenseCard = (props: any) => (
    <RN.View testID="mock-ExpenseCard" {...props} />
  );
  return {
    ExpenseCard: MockExpenseCard,
  };
});
// --- End of Fix 4 ---

// Mock utils
jest.mock('@/features/expenses/utils/expenseLabels', () => ({
  resolveCategoryLabel: (c: string) => `cat:${c}`,
  resolveSubcategoryLabel: (c: string, s: string) => `sub:${s}`,
  resolveVisitTypeLabel: (v: string) => `visit:${v}`,
}));
jest.mock('@/shared/utils/currency', () => ({
  resolveCurrencySymbol: () => '$',
}));

// Mock Redux actions
const fetchExpensesAction = {type: 'expenses/fetchExpensesForCompanion'};
// FIX 5: Create real mock functions for actions to fix type errors
const markStatusAction = (payload: {
  expenseId: string;
  status: ExpensePaymentStatus;
}) => ({
  type: 'expenses/markInAppExpenseStatus',
  payload,
});
const setCompanionAction = (payload: string | null) => ({
  type: 'companion/setSelectedCompanion',
  payload,
});
// --- End of Fix 5 ---

jest.mock('@/features/expenses', () => {
  const actualExpenses = jest.requireActual('@/features/expenses');
  return {
    ...actualExpenses,
    __esModule: true,
    selectExternalExpensesByCompanion:
      actualExpenses.selectExternalExpensesByCompanion,
    selectExpenseSummaryByCompanion:
      actualExpenses.selectExpenseSummaryByCompanion,
    selectInAppExpensesByCompanion:
      actualExpenses.selectInAppExpensesByCompanion,
    selectHasHydratedCompanion: actualExpenses.selectHasHydratedCompanion,
    // Cast mocks to jest.Mock to satisfy AsyncThunk types
    fetchExpensesForCompanion: jest.fn(() => fetchExpensesAction) as jest.Mock,
    markInAppExpenseStatus: jest.fn(markStatusAction) as jest.Mock,
  };
});

jest.mock('@/features/companion', () => {
  const actualCompanion = jest.requireActual('@/features/companion');
  return {
    ...actualCompanion,
    __esModule: true,
    // Cast mock to jest.Mock to satisfy ActionCreator types
    setSelectedCompanion: jest.fn(setCompanionAction) as jest.Mock,
  };
});

// --- Mock Store Setup ---

// FIX 6: Add correct types for ThunkMiddleware
// Cast middlewares to 'any' to resolve final ThunkMiddleware type conflict
const middlewares = [thunk] as any;
const mockStore = configureStore<RootState, AppDispatch>(middlewares);
// --- End of Fix 6 ---

// --- Mock Data ---
// (Expense type is imported from features)

const mockExternalExpense: Expense = {
  id: 'ext-1',
  title: 'External Vet Visit',
  category: 'vet',
  subcategory: 'checkup',
  visitType: 'routine',
  date: '2025-10-25',
  amount: 150,
  status: 'paid',
  companionId: 'companion-1',
  attachments: [],
  currencyCode: 'USD',
  source: 'external',
  createdAt: '2025-10-25T10:00:00.000Z',
  updatedAt: '2025-10-25T10:00:00.000Z',
};

const mockInAppExpenseUnpaid: Expense = {
  id: 'inapp-1',
  title: 'In-App Booking',
  category: 'booking',
  subcategory: 'daycare',
  visitType: 'scheduled',
  date: '2025-10-24',
  amount: 75,
  status: 'unpaid',
  companionId: 'companion-1',
  attachments: [],
  currencyCode: 'USD',
  source: 'inApp',
  createdAt: '2025-10-24T10:00:00.000Z',
  updatedAt: '2025-10-24T10:00:00.000Z',
};

const mockInAppExpensePaid: Expense = {
  id: 'inapp-2',
  title: 'Paid Booking',
  category: 'booking',
  subcategory: 'grooming',
  visitType: 'scheduled',
  date: '2025-10-23',
  amount: 50,
  status: 'paid',
  companionId: 'companion-1',
  attachments: [],
  currencyCode: 'USD',
  source: 'inApp',
  createdAt: '2025-10-23T10:00:00.000Z',
  updatedAt: '2025-10-23T10:00:00.000Z',
};

// FIX 7: Explicitly type baseState as Partial<RootState> and cast properties to 'any'
const baseState: Partial<RootState> = {
  auth: {user: {currency: 'USD'}} as any,
  companion: {
    companions: [{id: 'companion-1', name: 'Fido'} as any],
    selectedCompanionId: 'companion-1',
  } as any,
  expenses: {
    items: [mockExternalExpense, mockInAppExpenseUnpaid, mockInAppExpensePaid],
    summaries: {
      'companion-1': {total: 275, currencyCode: 'USD', lastUpdated: ''},
    },
    byCompanion: {
      'companion-1': {
        inApp: ['inapp-1', 'inapp-2'],
        external: ['ext-1'],
        hasHydrated: false,
      },
    },
    hydratedCompanions: {
      'companion-1': false,
    },
    loading: false,
    error: null,
  } as any,
};
// --- End of Fix 7 ---

// --- Test Render Helper ---

let store: ReturnType<typeof mockStore>;

const renderComponent = (
  mode: 'inApp' | 'external',
  initialState = baseState,
) => {
  store = mockStore(initialState as RootState);
  store.dispatch = jest.fn();

  mockUseRoute.mockReturnValue({
    params: {mode},
  });

  mockUseFocusEffect.mockImplementation(callback => callback());

  (useNavigation as jest.Mock).mockReturnValue({
    navigate: mockNavigate,
    goBack: mockGoBack,
    canGoBack: () => true,
  });

  return render(
    <Provider store={store}>
      <ExpensesListScreen />
    </Provider>,
  );
};

// --- Tests ---

describe('ExpensesListScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (
      expensesSlice.fetchExpensesForCompanion as unknown as jest.Mock
    ).mockClear();
    (expensesSlice.markInAppExpenseStatus as unknown as jest.Mock).mockClear();
    (companionSlice.setSelectedCompanion as unknown as jest.Mock).mockClear();
    mockNavigate.mockClear();
    mockGoBack.mockClear();
  });

  describe('Data Fetching', () => {
    it('dispatches fetchExpensesForCompanion on focus if not hydrated', () => {
      renderComponent('external', baseState);
      expect(store.dispatch).toHaveBeenCalledWith(fetchExpensesAction);
      expect(expensesSlice.fetchExpensesForCompanion).toHaveBeenCalledWith({
        companionId: 'companion-1',
      });
    });

    it('dispatches fetchExpensesForCompanion on mount if already hydrated', () => {
      // FIX 8: Use structuredClone
      const hydratedState = structuredClone(baseState);
      hydratedState.expenses!.hydratedCompanions['companion-1'] = true;

      renderComponent('external', hydratedState);
      expect(store.dispatch).toHaveBeenCalledWith(fetchExpensesAction);
      expect(expensesSlice.fetchExpensesForCompanion).toHaveBeenCalledWith({
        companionId: 'companion-1',
      });
    });

    it('does not dispatch fetch if no companion is selected', () => {
      const noCompanionState = structuredClone(baseState);
      noCompanionState.companion!.selectedCompanionId = null;
      noCompanionState.expenses = {
        items: [],
        summaries: {},
        hydratedCompanions: {},
        loading: false,
        error: null,
      };

      renderComponent('external', noCompanionState);
      expect(store.dispatch).not.toHaveBeenCalledWith(fetchExpensesAction);
      expect(expensesSlice.fetchExpensesForCompanion).not.toHaveBeenCalled();
    });
  });

  describe('External Mode (mode="external")', () => {
    it('renders the correct title and list of external expenses', () => {
      const {getByText, queryByText, getAllByTestId} = renderComponent(
        'external',
        baseState,
      );

      expect(getByText('External expenses')).toBeTruthy();
      const cards = getAllByTestId('mock-ExpenseCard');
      const externalCards = cards.filter(
        card => card.props.showEditAction === true,
      );
      expect(externalCards.length).toBe(1);
      expect(externalCards[0].props.title).toBe('External Vet Visit');

      expect(queryByText('In-App Booking')).toBeNull();
      expect(queryByText('Paid Booking')).toBeNull();
    });

    it('passes correct props to ExpenseCard for external items', () => {
      const {getAllByTestId} = renderComponent('external', baseState);
      const externalCards = getAllByTestId('mock-ExpenseCard').filter(
        card => card.props.showEditAction === true,
      );
      expect(externalCards.length).toBe(1);
      const card = externalCards[0];

      expect(card.props.title).toBe('External Vet Visit');
      expect(card.props.amount).toBe(150);
      expect(card.props.showEditAction).toBe(true);
      expect(card.props.onPressEdit).toBeDefined();
      expect(card.props.showPayButton).toBe(false);
      expect(card.props.isPaid).toBe(true);
      expect(card.props.onPressPay).toBeUndefined();
      expect(card.props.onTogglePaidStatus).toBeUndefined();
    });

    it('navigates to EditExpense when edit is pressed', () => {
      const {getAllByTestId} = renderComponent('external', baseState);
      const externalCards = getAllByTestId('mock-ExpenseCard').filter(
        card => card.props.showEditAction === true,
      );
      expect(externalCards.length).toBe(1);
      const card = externalCards[0];

      act(() => {
        if (typeof card.props.onPressEdit === 'function') {
          card.props.onPressEdit();
        } else {
          // FIX 9: Use new TypeError
          throw new TypeError(
            'onPressEdit prop is not a function or is undefined',
          );
        }
      });

      expect(mockNavigate).toHaveBeenCalledWith('EditExpense', {
        expenseId: 'ext-1',
      });
    });
  });

  describe('In-App Mode (mode="inApp")', () => {
    it('renders the correct title and list of in-app expenses', () => {
      const {getByText, queryByText, getAllByTestId} = renderComponent(
        'inApp',
        baseState,
      );

      expect(getByText('In-app expenses')).toBeTruthy();
      const cards = getAllByTestId('mock-ExpenseCard');
      const inAppCards = cards.filter(
        card => card.props.showEditAction === false,
      );
      expect(inAppCards.length).toBe(2);
      expect(inAppCards[0].props.title).toBe('In-App Booking');
      expect(inAppCards[1].props.title).toBe('Paid Booking');

      expect(queryByText('External Vet Visit')).toBeNull();
    });

    it('passes correct props to ExpenseCard for an unpaid in-app item', () => {
      const {getAllByTestId} = renderComponent('inApp', baseState);
      const inAppCards = getAllByTestId('mock-ExpenseCard').filter(
        card => card.props.showEditAction === false,
      );
      const unpaidCard = inAppCards.find(
        card => card.props.title === 'In-App Booking',
      );

      expect(unpaidCard).toBeDefined();
      if (!unpaidCard) return;

      expect(unpaidCard.props.amount).toBe(75);
      expect(unpaidCard.props.showEditAction).toBe(false);
      expect(unpaidCard.props.onPressEdit).toBeUndefined();
      expect(unpaidCard.props.showPayButton).toBe(false);
      expect(unpaidCard.props.isPaid).toBe(false);
      expect(unpaidCard.props.onPressPay).toBeUndefined();
      expect(unpaidCard.props.onTogglePaidStatus).toBeUndefined();
    });

    it('passes correct props to ExpenseCard for a paid in-app item', () => {
      const {getAllByTestId} = renderComponent('inApp', baseState);
      const inAppCards = getAllByTestId('mock-ExpenseCard').filter(
        card => card.props.showEditAction === false,
      );
      const paidCard = inAppCards.find(
        card => card.props.title === 'Paid Booking',
      );

      expect(paidCard).toBeDefined();
      if (!paidCard) return;

      expect(paidCard.props.amount).toBe(50);
      expect(paidCard.props.showEditAction).toBe(false);
      expect(paidCard.props.onPressEdit).toBeUndefined();
      expect(paidCard.props.showPayButton).toBe(false);
      expect(paidCard.props.isPaid).toBe(true);
      expect(paidCard.props.onPressPay).toBeUndefined();
      expect(paidCard.props.onTogglePaidStatus).toBeUndefined();
    });
  });

  describe('General Interactions', () => {
    it('renders empty state when no expenses exist for the mode', () => {
      const emptyState = structuredClone(baseState) as Partial<RootState>;
      emptyState.expenses!.items = baseState.expenses!.items.filter(
        item => item.id !== 'ext-1',
      );

      const {getByText, queryByTestId} = renderComponent(
        'external',
        emptyState,
      );
      expect(getByText('No expenses to show yet.')).toBeTruthy();
      expect(queryByTestId('mock-ExpenseCard')).toBeNull();
    });

    it('navigates back when header back button is pressed', () => {
      const {getByTestId} = renderComponent('external', baseState);
      const header = getByTestId('mock-Header');

      act(() => {
        if (typeof header.props.onBack === 'function') {
          header.props.onBack();
        } else {
          throw new TypeError('onBack prop is not a function or is undefined');
        }
      });

      expect(mockGoBack).toHaveBeenCalled();
    });

    it('navigates to ExpensePreview when view is pressed', () => {
      const {getAllByTestId} = renderComponent('external', baseState);
      const externalCards = getAllByTestId('mock-ExpenseCard').filter(
        card => card.props.showEditAction === true,
      );
      expect(externalCards.length).toBe(1);
      const card = externalCards[0];

      act(() => {
        if (typeof card.props.onPressView === 'function') {
          card.props.onPressView();
        } else {
          throw new TypeError(
            'onPressView prop is not a function or is undefined',
          );
        }
      });

      expect(mockNavigate).toHaveBeenCalledWith('ExpensePreview', {
        expenseId: 'ext-1',
      });
    });

    it('dispatches setSelectedCompanion when companion is changed', () => {
      const {getByTestId} = renderComponent('external', baseState);
      const selector = getByTestId('mock-CompanionSelector');

      act(() => {
        if (typeof selector.props.onSelect === 'function') {
          selector.props.onSelect('companion-2');
        } else {
          throw new TypeError(
            'onSelect prop is not a function or is undefined',
          );
        }
      });

      const expectedPayload = 'companion-2';
      expect(store.dispatch).toHaveBeenCalledWith(
        setCompanionAction(expectedPayload),
      );
      expect(companionSlice.setSelectedCompanion).toHaveBeenCalledWith(
        expectedPayload,
      );
    });

    it('renders the correct yearly summary', () => {
      const {getByTestId} = renderComponent('external', baseState);
      const summaryCard = getByTestId('mock-YearlySpendCard');

      expect(summaryCard.props.amount).toBe(275);
      expect(summaryCard.props.currencyCode).toBe('USD');
      expect(summaryCard.props.currencySymbol).toBe('$');
    });

    it('does not navigate back if navigation.canGoBack() is false', () => {
      (useNavigation as jest.Mock).mockReturnValueOnce({
        navigate: mockNavigate,
        goBack: mockGoBack,
        canGoBack: () => false,
      });

      const {getByTestId} = renderComponent('external', baseState);
      const header = getByTestId('mock-Header');

      act(() => {
        if (typeof header.props.onBack === 'function') {
          header.props.onBack();
        } else {
          throw new TypeError('onBack prop is not a function or is undefined');
        }
      });

      expect(mockGoBack).not.toHaveBeenCalled();
    });

    it('renders 0 for yearly summary if summary is null', () => {
      const noSummaryState = structuredClone(baseState); // This is now Partial<RootState>
      (noSummaryState.expenses!.summaries as any)['companion-1'] = null;

      const {getByTestId} = renderComponent('external', noSummaryState);
      const summaryCard = getByTestId('mock-YearlySpendCard');

      expect(summaryCard.props.amount).toBe(0);
    });
  });
});
