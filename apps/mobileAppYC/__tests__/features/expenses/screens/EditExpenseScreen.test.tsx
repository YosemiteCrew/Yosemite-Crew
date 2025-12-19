import React from 'react';
import {render, fireEvent, waitFor, act} from '@testing-library/react-native';
import {Alert} from 'react-native'; // Import View
import {EditExpenseScreen} from '@/features/expenses/screens/EditExpenseScreen/EditExpenseScreen';
import {useExpenseForm} from '@/features/expenses/hooks/useExpenseForm';
import type {RootState} from '@/app/store';
import {setSelectedCompanion} from '@/features/companion';

// --- Navigation Mocks ---
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
  useSelector: jest.fn(selector => mockUseSelector(selector)), // Use our specific mock implementation
}));

// --- Data Mocks ---
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
  // Mock structure expected by the form
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
jest.mock('@/features/expenses/hooks/useExpenseForm', () => ({
  useExpenseForm: jest.fn(defaultUseExpenseFormMockImplementation),
  DEFAULT_FORM: {}, // Mock if needed
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

jest.mock('@/features/companion', () => ({
  setSelectedCompanion: jest.fn(id => ({type: 'SET_COMPANION', payload: id})),
}));

// --- Component Mocks ---
jest.mock('@/shared/components/common', () => ({
  SafeArea: ({children}: {children: React.ReactNode}) => <>{children}</>,
}));

jest.mock('@/shared/components/common/Header/Header', () => {
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
import {Header} from '@/shared/components/common/Header/Header';
const MockedHeader = Header as jest.MockedFunction<typeof Header>;

jest.mock('@/features/expenses/components', () => {
  const {View: MockExpenseFormView} = require('react-native');
  return {
    ExpenseForm: (props: any) => (
      <MockExpenseFormView testID="mock-expense-form" {...props} />
    ),
  };
});

const mockDeleteSheetOpen = jest.fn();
const mockDeleteSheetClose = jest.fn();
jest.mock(
  '@/shared/components/common/DeleteDocumentBottomSheet/DeleteDocumentBottomSheet',
  () => {
    const ReactInsideMock = require('react');
    const {TouchableOpacity: MockDeleteButton} = require('react-native');

    const MockDeleteSheet = ReactInsideMock.forwardRef(
      (props: any, ref: any) => {
        ReactInsideMock.useImperativeHandle(ref, () => ({
          open: mockDeleteSheetOpen,
          close: mockDeleteSheetClose,
        }));
        // Simulate the delete button press calling onDelete
        return (
          <MockDeleteButton
            testID="mock-delete-sheet"
            onPress={props.onDelete} // Simulate press calling onDelete
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

// Mock DiscardChangesBottomSheet (needed because EditExpenseScreen uses it implicitly via useTheme)
const mockDiscardSheetOpen = jest.fn();
jest.mock(
  '@/shared/components/common/DiscardChangesBottomSheet/DiscardChangesBottomSheet',
  () => {
    const ReactInside = require('react');
    const {View: MockView} = require('react-native');
    return {
      DiscardChangesBottomSheet: ReactInside.forwardRef(
        (props: any, ref: any) => {
          ReactInside.useImperativeHandle(ref, () => ({
            open: mockDiscardSheetOpen,
          }));
          return <MockView testID="mock-discard-sheet" {...props} />;
        },
      ),
    };
  },
);

// --- Native Module Mocks (BackHandler) ---
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
    mockAppDispatch.mockReset();
    mockSetFormData.mockClear();
    mockCanGoBack.mockReturnValue(true); // Reset canGoBack mock

    // Setup mock dispatch
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

    // Initialize mockState with the theme fix
    mockState = {
      companion: {
        companions: [{id: 'comp-1', name: 'Fluffy'}] as any,
        selectedCompanionId: 'comp-1',
        loading: false,
        error: null,
      },
      auth: {user: {currency: 'CAD'}} as any,
      expenses: {loading: false} as any,
      // ---> THEME STATE FIX <---
      theme: {
        theme: 'light',
        isDark: false,
      },
      // ---> END FIX <---
    } as RootState;

    // Reset and setup useSelector mock
    mockExpenseSelectorFn.mockImplementation(() => mockExpense);
    mockUseSelector.mockImplementation((selector: Function) => {
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

  it('handles goBack press', () => {
    const {getByTestId} = renderComponent();
    const header = getByTestId('mock-header');
    fireEvent.press(header);
    expect(mockCanGoBack).toHaveBeenCalledTimes(1);
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('returns null if formData is null initially', () => {
    (useExpenseForm as jest.Mock).mockReturnValueOnce({
      ...defaultUseExpenseFormMockImplementation(),
      formData: null,
    });
    const {queryByTestId} = renderComponent();
    expect(queryByTestId('mock-header')).toBeNull();
    expect(queryByTestId('mock-expense-form')).toBeNull();
  });

  // --- Guard Clauses ---
  it('calls goBack if expense is not found', () => {
    mockExpenseSelectorFn.mockImplementation(() => null);
    renderComponent();
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('shows alert and calls goBack if expense source is not external', () => {
    mockExpenseSelectorFn.mockImplementation(() => ({
      ...mockExpense,
      source: 'synced' as const,
    }));
    renderComponent();
    expect(Alert.alert).toHaveBeenCalledWith(
      'Non editable',
      'Only expenses added from the app can be edited.',
    );
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  // --- useEffect Logic ---
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
  });

  // --- Save Flow ---
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
    fireEvent(form, 'onSave'); // Use fireEvent

    expect(mockValidate).toHaveBeenCalled();
    expect(mockUpdateExternalExpense).not.toHaveBeenCalled();
    expect(mockAppDispatch).not.toHaveBeenCalledWith(expect.any(Function));
    expect(mockNavDispatch).not.toHaveBeenCalled();
  });

  it('shows an alert if saving fails (API error)', async () => {
    mockValidate.mockReturnValue(true);
    const apiError = new Error('Update failed');
    mockUpdateExternalExpense.mockRejectedValue(apiError);

    const {getByTestId} = renderComponent();
    const form = getByTestId('mock-expense-form');
    await act(async () => {
      await form.props.onSave();
    });

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Unable to update expense',
        'Update failed',
      );
    });
    expect(mockNavDispatch).not.toHaveBeenCalled();
  });

  // --- Delete Flow ---
  it('opens the delete sheet on header right press', () => {
    renderComponent();
    const headerProps = MockedHeader.mock.calls.at(-1)?.[0];
    expect(headerProps).toBeDefined();
    act(() => {
      if (headerProps?.onRightPress) {
        headerProps.onRightPress();
      }
    });
    expect(mockDeleteSheetOpen).toHaveBeenCalledTimes(1);
  });

  it('handles deleting an expense successfully', async () => {
    const mockThunkResult = {success: true};
    mockDeleteExternalExpense.mockResolvedValue(mockThunkResult);

    const {getByTestId} = renderComponent();
    const deleteSheet = getByTestId('mock-delete-sheet');

    // Simulate pressing the delete confirmation in the sheet - Corrected
    await act(async () => {
      fireEvent.press(deleteSheet); // Simulate press on the mocked TouchableOpacity
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

    // Simulate pressing delete - Corrected
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
  });

  // --- Back Handler ---
  it('handles hardware back press when delete sheet is open', () => {
    renderComponent();
    const headerProps = MockedHeader.mock.calls.at(-1)?.[0];
    expect(headerProps).toBeDefined();

    act(() => {
      if (headerProps?.onRightPress) {
        headerProps.onRightPress();
      }
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

  it('removes BackHandler listener on unmount', () => {
    const {unmount} = renderComponent();
    expect(mockBackHandlerListeners.length).toBe(1); // Listener added on mount
    unmount();
    expect(mockBackHandlerListeners.length).toBe(0); // Listener removed on unmount
  });
});
