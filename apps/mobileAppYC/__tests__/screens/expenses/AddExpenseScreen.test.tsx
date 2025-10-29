import React from 'react';
import {render, fireEvent, waitFor} from '@testing-library/react-native';
import {Alert} from 'react-native';
import {AddExpenseScreen} from '@/features/expenses/screens/AddExpenseScreen/AddExpenseScreen';
import {
  useExpenseForm,
  DEFAULT_FORM,
} from '@/features/expenses/hooks/useExpenseForm';
import {addExternalExpense} from '@/features/expenses';
import {setSelectedCompanion} from '@/features/companion';
import type {RootState} from '@/app/store';

// --- MOCKS ---

const mockGoBack = jest.fn();
const mockCanGoBack = jest.fn(() => true);
const mockNavDispatch = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: jest.fn(() => ({
    goBack: mockGoBack,
    canGoBack: mockCanGoBack,
    dispatch: mockNavDispatch,
  })),
  CommonActions: {
    reset: jest.fn(args => ({type: 'RESET', payload: args})),
  },
}));

const mockAppDispatch = jest.fn();
jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useDispatch: jest.fn(() => mockAppDispatch),
  useSelector: jest.fn(selector => selector(mockState)),
}));

const mockValidate = jest.fn();
const mockHandleChange = jest.fn(); // Mock from the hook
const mockHandleErrorClear = jest.fn();
const mockFormData = {
  ...DEFAULT_FORM,
  title: 'Test Dinner',
  category: {id: 'cat-1', name: 'Food'},
  subcategory: {id: 'subcat-1', name: 'Restaurant'},
  visitType: {id: 'visit-1', name: 'Regular'},
  amount: '100.50',
  date: new Date('2025-10-24T10:00:00.000Z'),
  providerName: 'Test Provider',
  attachments: [],
};
const defaultUseExpenseFormMockImplementation = () => ({
  formData: mockFormData,
  errors: {},
  handleChange: mockHandleChange, // Provide the mock here
  handleErrorClear: mockHandleErrorClear,
  validate: mockValidate,
});
jest.mock('@/features/expenses/hooks/useExpenseForm', () => ({
  useExpenseForm: jest.fn(defaultUseExpenseFormMockImplementation),
  DEFAULT_FORM: {},
}));

jest.mock('@/features/expenses', () => ({
  addExternalExpense: jest.fn(payload => ({
    type: 'expenses/addExternalExpense/pending',
    payload,
    meta: {arg: payload},
  })),
}));
jest.mock('@/features/companion', () => ({
  setSelectedCompanion: jest.fn(id => ({type: 'SET_COMPANION', payload: id})),
}));

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
        title={props.title}
        {...props}
      />
    )),
  };
});

jest.mock('@/features/expenses/components', () => {
  const {View: MockInnerView} = require('react-native');
  return {
    ExpenseForm: (props: any) => (
      <MockInnerView testID="mock-expense-form" {...props} />
    ),
  };
});

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

// --- TEST SUITE ---

let mockState: RootState;

describe('AddExpenseScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    (useExpenseForm as jest.Mock).mockImplementation(
      defaultUseExpenseFormMockImplementation,
    );
    mockCanGoBack.mockReturnValue(true);

    mockState = {
      companion: {
        companions: [{id: 'comp-1', name: 'Fluffy'}],
        selectedCompanionId: 'comp-1',
        loading: false,
        error: null,
      },
      auth: {user: {currency: 'CAD'}} as any,
      expenses: {loading: false} as any,
      theme: {
        theme: 'light',
        isDark: false,
      },
    } as RootState;
  });

  afterEach(() => {
    (Alert.alert as jest.Mock).mockRestore();
  });

  const renderComponent = () => render(<AddExpenseScreen />);

  it('handles goBack press when there are no changes', () => {
    const {getByTestId} = renderComponent();
    const header = getByTestId('mock-header');
    fireEvent.press(header);

    expect(mockDiscardSheetOpen).not.toHaveBeenCalled();
    expect(mockCanGoBack).toHaveBeenCalledTimes(1);
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('opens discard sheet on goBack press when form has changes', () => {
    const {getByTestId} = renderComponent();
    const form = getByTestId('mock-expense-form');
    const header = getByTestId('mock-header');

    // Simulate the change by calling the prop passed to ExpenseForm
    fireEvent(form, 'onFormChange', 'title', 'New Title');

    // Now press back
    fireEvent.press(header);

    expect(mockDiscardSheetOpen).toHaveBeenCalledTimes(1);
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('opens discard sheet on goBack press when companion has changed', () => {
    const {getByTestId} = renderComponent();
    const form = getByTestId('mock-expense-form');
    const header = getByTestId('mock-header');

    // Simulate the change by calling the prop passed to ExpenseForm
    fireEvent(form, 'onCompanionSelect', 'comp-2');

    // Now press back
    fireEvent.press(header);

    expect(mockDiscardSheetOpen).toHaveBeenCalledTimes(1);
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('discards changes and navigates back from bottom sheet after form change', () => {
    const {getByTestId} = renderComponent();
    const form = getByTestId('mock-expense-form');
    const header = getByTestId('mock-header');
    const bottomSheet = getByTestId('mock-discard-sheet');

    // Simulate change
    fireEvent(form, 'onFormChange', 'title', 'New Title');

    // Press back
    fireEvent.press(header);
    expect(mockDiscardSheetOpen).toHaveBeenCalledTimes(1); // Sheet should open

    // Simulate discard action
    // Directly call the prop function passed to the mocked component
    bottomSheet.props.onDiscard();

    expect(mockCanGoBack).toHaveBeenCalledTimes(1);
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('discards changes and navigates back from bottom sheet after companion change', () => {
    const {getByTestId} = renderComponent();
    const form = getByTestId('mock-expense-form');
    const header = getByTestId('mock-header');
    const bottomSheet = getByTestId('mock-discard-sheet');

    // Simulate change
    fireEvent(form, 'onCompanionSelect', 'comp-2');

    // Press back
    fireEvent.press(header);
    expect(mockDiscardSheetOpen).toHaveBeenCalledTimes(1); // Sheet should open

    // Simulate discard action
    bottomSheet.props.onDiscard();

    expect(mockCanGoBack).toHaveBeenCalledTimes(1);
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('does not call goBack if navigation cannot go back (no changes)', () => {
    mockCanGoBack.mockReturnValueOnce(false);
    const {getByTestId} = renderComponent();
    const header = getByTestId('mock-header');
    fireEvent.press(header);
    expect(mockCanGoBack).toHaveBeenCalledTimes(1);
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('handles companion selection', () => {
    const {getByTestId} = renderComponent();
    const form = getByTestId('mock-expense-form');
    // Use fireEvent to call the prop
    fireEvent(form, 'onCompanionSelect', 'comp-2');
    expect(mockAppDispatch).toHaveBeenCalledWith(
      setSelectedCompanion('comp-2'),
    );
  });

  it('handles form changes', () => {
    const {getByTestId} = renderComponent();
    const form = getByTestId('mock-expense-form');
    const change = {key: 'title', value: 'New Title'};

    // Use fireEvent to call the prop
    fireEvent(form, 'onFormChange', change.key, change.value);

    // Expect the underlying mock hook function (mockHandleChange) to have been called
    // because the component's handleChangeWithTracking calls it.
    expect(mockHandleChange).toHaveBeenCalledWith(change.key, change.value);
  });

  // --- Save Logic Tests (Remain mostly the same) ---
  it('handles saving a new expense successfully', async () => {
    mockValidate.mockReturnValue(true);
    const mockThunkResult = {id: 'exp-123'};
    mockAppDispatch.mockReturnValue({
      unwrap: jest.fn().mockResolvedValue(mockThunkResult),
    });

    const {getByTestId} = renderComponent();
    const form = getByTestId('mock-expense-form');
    // Use fireEvent to trigger save
    fireEvent(form, 'onSave');

    await waitFor(() => expect(mockAppDispatch).toHaveBeenCalled());

    expect(mockValidate).toHaveBeenCalledWith('comp-1');
    expect(addExternalExpense).toHaveBeenCalledWith(
      expect.objectContaining({
        companionId: 'comp-1',
        title: 'Test Dinner', // Component trims, ensure mock data matches expected
      }),
    );
    expect(mockAppDispatch).toHaveBeenCalledWith(
      expect.objectContaining({type: 'expenses/addExternalExpense/pending'}),
    );

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
    expect(mockValidate).toHaveBeenCalledWith('comp-1');
    expect(mockAppDispatch).not.toHaveBeenCalled();
    expect(mockNavDispatch).not.toHaveBeenCalled();
  });

  it('does not save if selectedCompanionId is missing', () => {
    mockState.companion.selectedCompanionId = null;
    mockValidate.mockReturnValue(true);
    const {getByTestId} = renderComponent();
    const form = getByTestId('mock-expense-form');
    fireEvent(form, 'onSave'); // Use fireEvent

    expect(mockValidate).toHaveBeenCalledWith(null);
    expect(mockAppDispatch).not.toHaveBeenCalled();
    expect(mockNavDispatch).not.toHaveBeenCalled();
  });

  it('does not save if formData is missing', () => {
    (useExpenseForm as jest.Mock).mockReturnValueOnce({
      formData: null,
      errors: {},
      handleChange: mockHandleChange,
      handleErrorClear: mockHandleErrorClear,
      validate: mockValidate,
    });
    mockValidate.mockReturnValue(true);

    const {getByTestId} = renderComponent();
    const form = getByTestId('mock-expense-form');
    fireEvent(form, 'onSave'); // Use fireEvent

    expect(mockValidate).toHaveBeenCalledWith(
      mockState.companion.selectedCompanionId,
    );
    expect(mockAppDispatch).not.toHaveBeenCalled();
    expect(mockNavDispatch).not.toHaveBeenCalled();
  });

  it('shows an alert if saving fails (API error)', async () => {
    mockValidate.mockReturnValue(true);
    const apiError = new Error('Network request failed');
    mockAppDispatch.mockReturnValue({
      unwrap: jest.fn().mockRejectedValue(apiError),
    });

    const {getByTestId} = renderComponent();
    const form = getByTestId('mock-expense-form');
    fireEvent(form, 'onSave'); // Use fireEvent

    await waitFor(() => expect(mockAppDispatch).toHaveBeenCalled());

    expect(mockValidate).toHaveBeenCalled();
    expect(addExternalExpense).toHaveBeenCalled();
    expect(mockAppDispatch).toHaveBeenCalledWith(
      expect.objectContaining({type: 'expenses/addExternalExpense/pending'}),
    );

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Unable to save expense',
        'Network request failed',
      );
    });
    expect(mockNavDispatch).not.toHaveBeenCalled();
  });

  it('shows default alert message if saving fails with non-Error', async () => {
    mockValidate.mockReturnValue(true);
    const nonErrorRejection = 'API failed';
    mockAppDispatch.mockReturnValue({
      unwrap: jest.fn().mockRejectedValue(nonErrorRejection),
    });

    const {getByTestId} = renderComponent();
    const form = getByTestId('mock-expense-form');
    fireEvent(form, 'onSave'); // Use fireEvent

    await waitFor(() => expect(mockAppDispatch).toHaveBeenCalled());

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Unable to save expense',
        'Please try again.',
      );
    });
    expect(mockNavDispatch).not.toHaveBeenCalled();
  });

  it('uses default currency code "USD" if user currency is not available', () => {
    mockState.auth.user = null;
    const {getByTestId} = renderComponent();
    const form = getByTestId('mock-expense-form');
    expect(form.props.currencyCode).toBe('USD');
  });
});
