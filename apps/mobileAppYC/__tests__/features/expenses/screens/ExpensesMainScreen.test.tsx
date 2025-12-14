import React from 'react';
import {render, fireEvent, waitFor} from '@testing-library/react-native';
import {ExpensesMainScreen} from '@/features/expenses/screens/ExpensesMainScreen/ExpensesMainScreen';
import {setSelectedCompanion} from '@/features/companion';
import type {ExpensePaymentStatus} from '@/features/expenses';
import {
  selectExpenseSummaryByCompanion,
  selectExpensesLoading,
  selectHasHydratedCompanion,
  selectRecentExternalExpenses,
  selectRecentInAppExpenses,
} from '@/features/expenses/selectors';
import type {RootState} from '@/app/store';
import type {AuthProvider, AuthStatus, User} from '@/features/auth';
import type {Companion} from '@/features/companion';
import type {ThemeState} from '@/features/theme';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockReplace = jest.fn();
const mockCanGoBack = jest.fn(() => true);
const mockDispatch = jest.fn();

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    replace: mockReplace,
    canGoBack: mockCanGoBack,
  }),
  useFocusEffect: jest.fn(callback => callback()),
}));

jest.mock('react-redux', () => ({
  useDispatch: () => mockDispatch,
  useSelector: jest.fn(selector => selector(mockState)),
}));

const mockTheme = {
  colors: {
    background: '#fff',
    secondary: '#000',
    primary: '#111',
    white: '#fff',
  },
  spacing: {2: 8, 3: 12, 4: 16, 6: 24, 20: 80},
  typography: {
    h3: {},
    h5: {},
    paragraph: {},
    titleSmall: {},
  },
  borderRadius: {xl: 20},
};
jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme}),
}));

jest.mock('@/shared/components/common', () => {
  const RN = jest.requireActual('react-native');
  return {
    SafeArea: ({children}: {children: React.ReactNode}) => <>{children}</>,
    YearlySpendCard: (props: any) => (
      <RN.View data-testid="yearly-spend-card" {...props} />
    ),
  };
});

jest.mock('@/shared/components/common/Header/Header', () => {
  const RN = jest.requireActual('react-native');
  return {
    Header: (props: any) => (
      <RN.View data-testid="header">
        <RN.TouchableOpacity testID="back-button" onPress={props.onBack} />
        <RN.TouchableOpacity
          testID="add-button-header"
          onPress={props.onRightPress}
        />
      </RN.View>
    ),
  };
});

jest.mock('@/shared/components/common/CompanionSelector/CompanionSelector', () => {
  const RN = jest.requireActual('react-native');
  return {
    CompanionSelector: (props: any) => (
      <RN.View data-testid="companion-selector">
        <RN.TouchableOpacity
          testID="select-c2"
          onPress={() => props.onSelect('c2')}
        />
      </RN.View>
    ),
  };
});

jest.mock('@/features/expenses/components', () => {
  const RN = jest.requireActual('react-native');
  return {
    ExpenseCard: (props: any) => (
      <RN.View data-testid="expense-card">
        <RN.TouchableOpacity testID="view-button" onPress={props.onPressView} />
        <RN.TouchableOpacity testID="edit-button" onPress={props.onPressEdit} />
        <RN.TouchableOpacity testID="pay-button" onPress={props.onPressPay} />
        <RN.TouchableOpacity
          testID="toggle-paid-button"
          onPress={props.onTogglePaidStatus}
        />
      </RN.View>
    ),
  };
});

jest.mock('@/assets/images', () => ({
  Images: {addIconDark: 'add-icon-path'},
}));

jest.mock('@/shared/utils/currency', () => ({
  resolveCurrencySymbol: jest.fn(() => '$'),
}));
jest.mock('@/features/expenses/utils/expenseLabels', () => ({
  resolveCategoryLabel: jest.fn(val => `${val}-label`),
  resolveSubcategoryLabel: jest.fn((_cat, sub) => `${sub}-label`),
  resolveVisitTypeLabel: jest.fn(val => `${val}-label`),
}));

jest.mock('@/features/expenses/selectors', () => ({
  selectExpenseSummaryByCompanion: jest.fn(),
  selectExpensesLoading: jest.fn(),
  selectHasHydratedCompanion: jest.fn(),
  selectRecentExternalExpenses: jest.fn(),
  selectRecentInAppExpenses: jest.fn(),
}));


const useSelectorMock = jest.requireMock('react-redux').useSelector;
const selectExpenseSummaryByCompanionMock =
  selectExpenseSummaryByCompanion as unknown as jest.Mock;
const selectExpensesLoadingMock = selectExpensesLoading as unknown as jest.Mock;
const selectHasHydratedCompanionMock =
  selectHasHydratedCompanion as unknown as jest.Mock;
const selectRecentExternalExpensesMock =
  selectRecentExternalExpenses as unknown as jest.Mock;
const selectRecentInAppExpensesMock =
  selectRecentInAppExpenses as unknown as jest.Mock;


const mockUser: User = {
  id: 'u1',
  email: 'test@yosemite.com',
  phone: '1234567890',
  currency: 'USD',
  firstName: undefined,
  lastName: undefined,
  dateOfBirth: undefined,
  profilePicture: undefined,
  profileToken: undefined,
  address: undefined,
};

const mockCompanions: Companion[] = [
  {
    id: 'c1',
    userId: 'u1',
    createdAt: '2030-01-01T00:00:00.000Z',
    updatedAt: '2030-01-01T00:00:00.000Z',

    category: 'dog',
    name: 'Buddy',
    breed: null,
    dateOfBirth: '2020-01-01T00:00:00.000Z',
    gender: 'male',
    currentWeight: 30,
    color: null,
    allergies: null,
    neuteredStatus: 'neutered',
    ageWhenNeutered: null,
    bloodGroup: 'DEA 1.1',
    microchipNumber: null,
    passportNumber: null,
    insuredStatus: 'not-insured',
    insuranceCompany: null,
    insurancePolicyNumber: null,
    countryOfOrigin: null,
    origin: 'breeder',
    profileImage: null,
  },
];

const mockInAppExpense = {
  id: 'e1',
  companionId: 'c1',
  title: 'In-App Vet Visit',
  category: 'health',
  subcategory: 'vet',
  visitType: 'in-person',
  date: '2030-10-25T10:00:00.000Z',
  amount: 150,
  currencyCode: 'USD',
  status: 'unpaid' as ExpensePaymentStatus,
  source: 'inApp' as const,
  attachments: [],
  createdAt: '2030-10-25T10:00:00.000Z',
  updatedAt: '2030-10-25T10:00:00.000Z',
};
const mockExternalExpense = {
  id: 'e2',
  companionId: 'c1',
  title: 'External Food Purchase',
  category: 'food',
  subcategory: 'kibble',
  visitType: 'n/a',
  currencyCode: 'USD',
  date: '2030-10-24T10:00:00.000Z',
  amount: 75,
  status: 'paid' as ExpensePaymentStatus,
  source: 'external' as const,
  attachments: [],
  createdAt: '2030-10-24T10:00:00.000Z',
  updatedAt: '2030-10-24T10:00:00.000Z',
};

const baseState: RootState = {
  companion: {
    companions: mockCompanions,
    selectedCompanionId: 'c1',
    loading: false,
    error: null,
  },
  auth: {
    user: mockUser,
    status: 'authenticated' as AuthStatus,
    error: null,
    initialized: true,
    provider: null as AuthProvider | null,
    sessionExpiry: null,
    lastRefresh: null,
    isRefreshing: false,
  },
  expenses: {
    items: [],
    loading: false,
    error: null,
    summaries: {},
    hydratedCompanions: {},
  },
  documents: {
    documents: [],
    loading: false,
    error: null,
    uploadProgress: 0,
  },
  theme: {
    theme: 'light' as ThemeState['theme'],
    isDark: false,
  },
  tasks: {
    items: [],
    loading: false,
    error: null,
    hydratedCompanions: {},
  },
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
  coParent: {
    coParents: [],
    loading: false,
    error: null,
    selectedCoParentId: null,
  },
  linkedBusinesses: {
    linkedBusinesses: [],
    loading: false,
    error: null,
  },
  _persist: {
    version: 0,
    rehydrated: true,
  },
};

let mockState: RootState;


describe('ExpensesMainScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockState = structuredClone(baseState);
    useSelectorMock.mockImplementation((selector: any) => selector(mockState));

    selectExpenseSummaryByCompanionMock.mockReturnValue(() => null);
    selectExpensesLoadingMock.mockReturnValue(false);
    selectHasHydratedCompanionMock.mockReturnValue(() => false);
    selectRecentExternalExpensesMock.mockReturnValue(() => []);
    selectRecentInAppExpensesMock.mockReturnValue(() => []);
  });

  it('should navigate to ExpensesEmpty if no companions exist', async () => {
    mockState.companion.companions = [];
    render(<ExpensesMainScreen />);
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('ExpensesEmpty');
    });
  });

  it('should dispatch setSelectedCompanion if one is not selected', async () => {
    mockState.companion.selectedCompanionId = null;
    render(<ExpensesMainScreen />);
    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledWith(setSelectedCompanion('c1'));
    });
  });

  it('should fetch expenses on focus if not hydrated', () => {
    selectHasHydratedCompanionMock.mockReturnValue(() => false);
    render(<ExpensesMainScreen />);
  });

  it('should fetch expenses in useEffect if already hydrated', () => {
    selectHasHydratedCompanionMock.mockReturnValue(() => true);
    render(<ExpensesMainScreen />);
  });

  it('should render empty state if hydrated and no expenses exist', () => {
    selectHasHydratedCompanionMock.mockReturnValue(() => true);
    const {getByText} = render(<ExpensesMainScreen />);
    expect(getByText('Zero Bucks Spent!')).toBeTruthy();
    expect(
      getByText('It seems like you and your buddy is in saving mode!'),
    ).toBeTruthy();
  });

  it('should navigate to AddExpense from empty state button', () => {
    selectHasHydratedCompanionMock.mockReturnValue(() => true);
    const {getByText} = render(<ExpensesMainScreen />);
    fireEvent.press(getByText('Add expense')); // Use press
    expect(mockNavigate).toHaveBeenCalledWith('AddExpense');
  });

  it('should render expense cards when data is available', () => {
    selectHasHydratedCompanionMock.mockReturnValue(() => true);
    selectRecentInAppExpensesMock.mockReturnValue(() => [mockInAppExpense]);
    selectRecentExternalExpensesMock.mockReturnValue(() => [
      mockExternalExpense,
    ]);
    selectExpenseSummaryByCompanionMock.mockReturnValue(() => ({
      total: 225,
      currencyCode: 'USD',
      lastUpdated: '',
    }));

    const {getByText, queryByText} = render(
      <ExpensesMainScreen />,
    );

    expect(queryByText('Zero Bucks Spent!')).toBeNull();

    expect(getByText('Recent in-app expenses')).toBeTruthy();
    expect(getByText('Recent external expenses')).toBeTruthy();
  });


  describe('Interactions', () => {
    beforeEach(() => {
      selectHasHydratedCompanionMock.mockReturnValue(() => true);
      selectRecentInAppExpensesMock.mockReturnValue(() => [mockInAppExpense]);
      selectRecentExternalExpensesMock.mockReturnValue(() => [
        mockExternalExpense,
      ]);
    });

    it('should navigate back on header back press', () => {
      const {getByTestId} = render(<ExpensesMainScreen />);
      fireEvent.press(getByTestId('back-button')); // Use press
      expect(mockGoBack).toHaveBeenCalled();
    });

    it('should navigate to AddExpense on header add press', () => {
      const {getByTestId} = render(<ExpensesMainScreen />);
      fireEvent.press(getByTestId('add-button-header')); // Use press
      expect(mockNavigate).toHaveBeenCalledWith('AddExpense');
    });

    it('should navigate to in-app ExpensesList on "View More" press', () => {
      const {getAllByText} = render(<ExpensesMainScreen />);
      // First "View More" is in-app
      fireEvent.press(getAllByText('View More')[0]); // Use press
      expect(mockNavigate).toHaveBeenCalledWith('ExpensesList', {
        mode: 'inApp',
      });
    });

    it('should navigate to external ExpensesList on "View More" press', () => {
      const {getAllByText} = render(<ExpensesMainScreen />);
      // Second "View More" is external
      fireEvent.press(getAllByText('View More')[1]); // Use press
      expect(mockNavigate).toHaveBeenCalledWith('ExpensesList', {
        mode: 'external',
      });
    });
    it('should handle view, pay, and toggle paid for in-app expense', () => {
      const {getAllByTestId} = render(<ExpensesMainScreen />);

      fireEvent.press(getAllByTestId('view-button')[0]);
      expect(mockNavigate).toHaveBeenCalledWith('ExpensePreview', {
        expenseId: 'e1',
      });

      fireEvent.press(getAllByTestId('pay-button')[0]);
      mockState.expenses.items = [
        {...mockInAppExpense, status: 'paid' as ExpensePaymentStatus},
      ];
      selectRecentInAppExpensesMock.mockReturnValue(() => [
        {...mockInAppExpense, status: 'paid' as ExpensePaymentStatus},
      ]);

      const {getAllByTestId: getAllAgain} = render(<ExpensesMainScreen />);

      fireEvent.press(getAllAgain('toggle-paid-button')[0]);
    });

    it('should handle view and edit for external expense', () => {
      const {getAllByTestId} = render(<ExpensesMainScreen />);

      fireEvent.press(getAllByTestId('view-button')[1]);
      expect(mockNavigate).toHaveBeenCalledWith('ExpensePreview', {
        expenseId: 'e2',
      });

      fireEvent.press(getAllByTestId('edit-button')[1]);
      expect(mockNavigate).toHaveBeenCalledWith('EditExpense', {
        expenseId: 'e2',
      });
    });

    it('should dispatch setSelectedCompanion on companion select', () => {
      const {getByTestId} = render(<ExpensesMainScreen />);
      fireEvent.press(getByTestId('select-c2')); // Use press
      expect(mockDispatch).toHaveBeenCalledWith(setSelectedCompanion('c2'));
    });
  });
});
