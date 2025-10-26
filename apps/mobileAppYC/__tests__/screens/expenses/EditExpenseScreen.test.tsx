import React from 'react';
import {render, fireEvent, waitFor, act} from '@testing-library/react-native';
import {Alert} from 'react-native';
import {EditExpenseScreen} from '@/screens/expenses/EditExpenseScreen/EditExpenseScreen';
import {useExpenseForm} from '@/screens/expenses/hooks/useExpenseForm';
import type {RootState} from '@/app/store';
import {setSelectedCompanion} from '@/features/companion';

const mockGoBack = jest.fn();
const mockCanGoBack = jest.fn(() => true);
const mockNavDispatch = jest.fn();
const mockRouteParams = {expenseId: 'exp-123'};

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: jest.fn(() => ({
    goBack: mockGoBack,
    canGoBack: mockCanGoBack,
    dispatch: mockNavDispatch,
  })),
  useRoute: jest.fn(() => ({
    params: mockRouteParams,
  })),
  CommonActions: {
    reset: jest.fn(args => ({type: 'RESET', payload: args})),
  },
}));

// --- Redux Mocks ---
const mockAppDispatch = jest.fn();
const mockUseSelector = jest.fn();
jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useDispatch: jest.fn(() => mockAppDispatch),
  useSelector: jest.fn(selector => mockUseSelector(selector)),
}));

// --- Data Mocks ---
// FIX: Remove 'Expense' type annotation
const mockExpense = {
  id: 'exp-123',
  companionId: 'comp-1',
  source: 'external' as const,
  category: 'cat-1',
  subcategory: 'subcat-1',
  visitType: 'visit-1',
  title: 'Annual Checkup',
  date: '2025-10-25T10:00:00.000Z',
  amount: 150,
  attachments: [],
  providerName: 'Dr. Paw',
  createdAt: '',
};

let mockState: RootState;

// --- Hook Mocks ---
const mockValidate = jest.fn();
const mockHandleChange = jest.fn();
const mockHandleErrorClear = jest.fn();
const mockSetFormData = jest.fn();
const mockFormData = {
  category: {id: 'cat-1', name: 'Vets'},
  subcategory: {id: 'subcat-1', name: 'Checkup'},
  visitType: {id: 'visit-1', name: 'Annual'},
  title: mockExpense.title,
  date: new Date(mockExpense.date),
  amount: mockExpense.amount.toString(),
  attachments: mockExpense.attachments,
  providerName: mockExpense.providerName,
};

const defaultUseExpenseFormMockImplementation = () => ({
  formData: mockFormData,
  setFormData: mockSetFormData,
  errors: {},
  handleChange: mockHandleChange,
  handleErrorClear: mockHandleErrorClear,
  validate: mockValidate,
});
jest.mock('@/screens/expenses/hooks/useExpenseForm', () => ({
  useExpenseForm: jest.fn(defaultUseExpenseFormMockImplementation),
}));

// --- Redux Thunk/Selector Mocks ---
const mockUpdateExternalExpense = jest.fn();
const mockDeleteExternalExpense = jest.fn();
const mockExpenseSelectorFn = jest.fn(); // Stable selector function

jest.mock('@/features/expenses', () => ({
  selectExpenseById: jest.fn(() => mockExpenseSelectorFn),
  updateExternalExpense: jest.fn(
    (...args) =>
      () =>
        mockUpdateExternalExpense(...args),
  ),
  deleteExternalExpense: jest.fn(
    (...args) =>
      () =>
        mockDeleteExternalExpense(...args),
  ),
}));

// Mock companion actions module
jest.mock('@/features/companion', () => ({
  setSelectedCompanion: jest.fn(id => ({type: 'SET_COMPANION', payload: id})),
}));

// --- Component Mocks ---
jest.mock('@/components/common', () => ({
  SafeArea: ({children}: {children: React.ReactNode}) => <>{children}</>,
}));

jest.mock('@/components/common/Header/Header', () => {
  const {TouchableOpacity} = require('react-native');
  return {
    Header: jest.fn((props: any) => (
      <TouchableOpacity
        testID="mock-header"
        onPress={props.onBack}
        onRightPress={props.onRightPress}
        {...props}
      />
    )),
  };
});
import {Header} from '@/components/common/Header/Header';
const MockedHeader = Header as jest.MockedFunction<typeof Header>;

jest.mock('@/components/expenses', () => {
  const {View} = require('react-native');
  return {
    ExpenseForm: (props: any) => <View testID="mock-expense-form" {...props} />,
  };
});

const mockDeleteSheetOpen = jest.fn();
const mockDeleteSheetClose = jest.fn();
jest.mock(
  '@/components/common/DeleteDocumentBottomSheet/DeleteDocumentBottomSheet',
  () => {
    const ReactInsideMock = require('react');
    const {TouchableOpacity} = require('react-native');

    const MockDeleteSheet = ReactInsideMock.forwardRef(
      (props: any, ref: any) => {
        ReactInsideMock.useImperativeHandle(ref, () => ({
          open: mockDeleteSheetOpen,
          close: mockDeleteSheetClose,
        }));
        return (
          <TouchableOpacity
            testID="mock-delete-sheet"
            onPress={props.onDelete}
            {...props}
          />
        );
      },
    );

    MockDeleteSheet.displayName = 'MockDeleteDocumentBottomSheet';

    return {
      DeleteDocumentBottomSheet: MockDeleteSheet,
    };
  },
);

// --- Native Module Mocks ---
const mockBackHandlerListeners: {
  event: string;
  cb: () => boolean | null | undefined;
}[] = [];
jest.mock('react-native/Libraries/Utilities/BackHandler', () => {
  const addEventListener = jest.fn((event, cb) => {
    const listener = {event, cb};
    mockBackHandlerListeners.push(listener);
    return {
      remove: jest.fn(() => {
        const index = mockBackHandlerListeners.indexOf(listener);
        if (index > -1) {
          mockBackHandlerListeners.splice(index, 1);
        }
      }),
    };
  });

  return {
    __esModule: true,
    default: {
      addEventListener,
      removeEventListener: jest.fn(),
      exitApp: jest.fn(),
    },
  };
});
const fireBackPress = () => {
  const pressCallback = mockBackHandlerListeners.find(
    l => l.event === 'hardwareBackPress',
  )?.cb;
  let result: boolean = false;
  act(() => {
    if (pressCallback) {
      const cbResult = pressCallback();
      result = cbResult === true;
    }
  });
  return result;
};

// --- Test Suite ---
describe('EditExpenseScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    (useExpenseForm as jest.Mock).mockImplementation(
      defaultUseExpenseFormMockImplementation,
    );
    mockBackHandlerListeners.length = 0;

    mockUpdateExternalExpense.mockReset();
    mockDeleteExternalExpense.mockReset();

    mockAppDispatch.mockImplementation(action => {
      if (typeof action === 'function') {
        const promise = action(mockAppDispatch, () => mockState, undefined);
        const resultPromise = Promise.resolve(promise);
        return Object.assign(resultPromise, {
          unwrap: () => resultPromise,
        });
      }
      return Promise.resolve(action);
    });

    mockState = {
      companion: {
        companions: [{id: 'comp-1', name: 'Fluffy'}] as any, // FIX: 'as any' for complex type
        selectedCompanionId: 'comp-1',
        loading: false,
        error: null,
      },
      auth: {user: {currency: 'CAD'}} as any, // FIX: Add 'as any' for AuthState
      expenses: {loading: false} as any,
    };

    // Reset selector mock implementation
    mockExpenseSelectorFn.mockImplementation(() => mockExpense);
    mockUseSelector.mockImplementation(selector => {
      // Check against the stable selector function reference
      if (selector === mockExpenseSelectorFn) {
        return mockExpenseSelectorFn();
      }
      return selector(mockState);
    });
  });

  afterEach(() => {
    (Alert.alert as jest.Mock).mockRestore();
  });

  const renderComponent = () => render(<EditExpenseScreen />);

  it('renders the header and form correctly populated', () => {
    const {getByTestId} = renderComponent();

    expect(MockedHeader).toHaveBeenCalled();
    const headerProps = MockedHeader.mock.calls.at(-1)?.[0];
    expect(headerProps).toBeDefined();
    expect(headerProps!.title).toBe('Edit');
    expect(headerProps!.showBackButton).toBe(true);
    expect(headerProps!.rightIcon).toBeDefined();

    const form = getByTestId('mock-expense-form');
    expect(form).toBeTruthy();
    expect(form.props.companions).toEqual(mockState.companion.companions);
    expect(form.props.selectedCompanionId).toBe('comp-1');
    expect(form.props.formData).toEqual(mockFormData);
    expect(form.props.loading).toBe(false);
    expect(form.props.currencyCode).toBe('CAD');
    expect(form.props.saveButtonText).toBe('Save');

    expect(mockSetFormData).toHaveBeenCalledWith({
      category: mockExpense.category,
      subcategory: mockExpense.subcategory,
      visitType: mockExpense.visitType,
      title: mockExpense.title,
      date: new Date(mockExpense.date),
      amount: mockExpense.amount.toString(),
      attachments: mockExpense.attachments,
      providerName: mockExpense.providerName,
    });
  });

  it('handles goBack press', () => {
    const {getByTestId} = renderComponent();
    const header = getByTestId('mock-header');
    fireEvent.press(header);
    expect(mockCanGoBack).toHaveBeenCalledTimes(1);
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('returns null if formData is null', () => {
    (useExpenseForm as jest.Mock).mockReturnValueOnce({
      ...defaultUseExpenseFormMockImplementation(),
      formData: null,
    });
    const {queryByTestId} = renderComponent();
    expect(queryByTestId('mock-header')).toBeNull();
    expect(queryByTestId('mock-expense-form')).toBeNull();
  }); // --- Guard Clauses ---

  it('calls goBack if expense is not found', () => {
    mockExpenseSelectorFn.mockImplementation(() => null); // Override selector return
    renderComponent();
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('shows alert and calls goBack if expense source is not external', () => {
    mockExpenseSelectorFn.mockImplementation(() => ({
      ...mockExpense,
      source: 'synced' as const, // Override selector return
    }));

    renderComponent();
    expect(Alert.alert).toHaveBeenCalledWith(
      'Non editable',
      'Only expenses added from the app can be edited.',
    );
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  }); // --- useEffect Logic ---

  it('dispatches setSelectedCompanion if IDs do not match', () => {
    mockState.companion.selectedCompanionId = 'comp-2';
    renderComponent();
    expect(mockAppDispatch).toHaveBeenCalledWith(
      setSelectedCompanion(mockExpense.companionId),
    );
  });

  it('does not dispatch setSelectedCompanion if IDs match', () => {
    mockState.companion.selectedCompanionId = 'comp-1';
    renderComponent();
    expect(mockAppDispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({type: 'SET_COMPANION'}),
    );
  }); // --- Save Flow ---

  it('handles saving an updated expense successfully', async () => {
    mockValidate.mockReturnValue(true);
    const mockThunkResult = {id: 'exp-123'};
    mockUpdateExternalExpense.mockResolvedValue(mockThunkResult);

    const {getByTestId} = renderComponent();
    const form = getByTestId('mock-expense-form');

    await act(async () => {
      await form.props.onSave();
    });

    expect(mockValidate).toHaveBeenCalled();
    // FIX: Expect the full objects, not just IDs
    expect(mockUpdateExternalExpense).toHaveBeenCalledWith({
      expenseId: mockExpense.id,
      updates: {
        category: mockFormData.category,
        subcategory: mockFormData.subcategory,
        visitType: mockFormData.visitType,
        title: mockFormData.title.trim(),
        date: mockFormData.date.toISOString(),
        amount: Number(mockFormData.amount),
        attachments: mockFormData.attachments,
        providerName: mockFormData.providerName,
      },
    });

    await waitFor(() => {
      expect(mockNavDispatch).toHaveBeenCalledWith({
        type: 'RESET',
        payload: {index: 0, routes: [{name: 'ExpensesMain'}]},
      });
    });
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('does not save if validation fails', () => {
    mockValidate.mockReturnValue(false);
    const {getByTestId} = renderComponent();
    const form = getByTestId('mock-expense-form');
    form.props.onSave();

    expect(mockValidate).toHaveBeenCalled();
    expect(mockUpdateExternalExpense).not.toHaveBeenCalled();
    expect(mockNavDispatch).not.toHaveBeenCalled();
  });

  it('shows an alert if saving fails (API error)', async () => {
    mockValidate.mockReturnValue(true);
    const apiError = new Error('Update failed');
    mockUpdateExternalExpense.mockRejectedValue(apiError);

    const {getByTestId} = renderComponent();
    const form = getByTestId('mock-expense-form');
    await act(async () => {
      await form.props.onSave(); // FIX: Removed stray underscore '_'
    });

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Unable to update expense',
        'Update failed',
      );
    });
    expect(mockNavDispatch).not.toHaveBeenCalled();
  }); // --- Delete Flow ---

  it('opens the delete sheet on header right press', () => {
    renderComponent();
    const headerProps = MockedHeader.mock.calls.at(-1)?.[0];
    expect(headerProps).toBeDefined(); // FIX: Add guard for TypeScript
    act(() => {
      headerProps!.onRightPress(); // Use non-null assertion
    });
    expect(mockDeleteSheetOpen).toHaveBeenCalledTimes(1);
  });

  it('handles deleting an expense successfully', async () => {
    const mockThunkResult = {success: true};
    mockDeleteExternalExpense.mockResolvedValue(mockThunkResult);

    const {getByTestId} = renderComponent();
    const deleteSheet = getByTestId('mock-delete-sheet');

    await act(async () => {
      fireEvent.press(deleteSheet);
    });

    expect(mockDeleteExternalExpense).toHaveBeenCalledWith({
      expenseId: mockExpense.id,
      companionId: mockExpense.companionId,
    });

    await waitFor(() => {
      expect(mockNavDispatch).toHaveBeenCalledWith({
        type: 'RESET',
        payload: {index: 0, routes: [{name: 'ExpensesMain'}]},
      });
    });
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('shows an alert if deleting fails (API error)', async () => {
    const apiError = new Error('Delete failed');
    mockDeleteExternalExpense.mockRejectedValue(apiError);

    const {getByTestId} = renderComponent();
    const deleteSheet = getByTestId('mock-delete-sheet');
    await act(async () => {
      fireEvent.press(deleteSheet);
    });

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Unable to delete expense',
        'Delete failed',
      );
    });
    expect(mockNavDispatch).not.toHaveBeenCalled();
  }); // --- Back Handler ---

  it('handles hardware back press when delete sheet is open', () => {
    renderComponent();
    const headerProps = MockedHeader.mock.calls.at(-1)?.[0];
    expect(headerProps).toBeDefined(); // FIX: Add guard for TypeScript
    act(() => {
      headerProps!.onRightPress();
    });
    expect(mockDeleteSheetOpen).toHaveBeenCalledTimes(1);

    const result = fireBackPress();

    expect(mockDeleteSheetClose).toHaveBeenCalledTimes(1);
    expect(result).toBe(true);
  });

  it('does not handle hardware back press when delete sheet is closed', () => {
    renderComponent();
    const result = fireBackPress();
    expect(mockDeleteSheetClose).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });

  // FIX: Rewritten test for unmount
  it('removes BackHandler listener on unmount', () => {
    // FIX: Remove useless assignment
    const {unmount} = renderComponent();
    // useEffect in component adds the listener
    expect(mockBackHandlerListeners.length).toBe(1);
    unmount();
    // Cleanup function in useEffect removes the listener
    expect(mockBackHandlerListeners.length).toBe(0);
  });
});
