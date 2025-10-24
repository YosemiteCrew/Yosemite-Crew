import React from 'react';
import {render, fireEvent, waitFor} from '@testing-library/react-native';
import {Alert} from 'react-native';
import {AddExpenseScreen} from '@/screens/expenses/AddExpenseScreen/AddExpenseScreen';
import {
  useExpenseForm,
  DEFAULT_FORM,
} from '@/screens/expenses/hooks/useExpenseForm';
import {addExternalExpense} from '@/features/expenses';
import {setSelectedCompanion} from '@/features/companion';
import type {RootState} from '@/app/store';

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
const mockHandleChange = jest.fn();
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
  handleChange: mockHandleChange,
  handleErrorClear: mockHandleErrorClear,
  validate: mockValidate,
});
jest.mock('@/screens/expenses/hooks/useExpenseForm', () => ({
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
        title={props.title}
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

let mockState: RootState;

describe('AddExpenseScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    (useExpenseForm as jest.Mock).mockImplementation(
      defaultUseExpenseFormMockImplementation,
    );

    mockState = {
      companion: {
        companions: [{id: 'comp-1', name: 'Fluffy'}],
        selectedCompanionId: 'comp-1',
        loading: false,
        error: null,
      },
      auth: {user: {currency: 'CAD'}} as any,
      expenses: {loading: false} as any,
    } as RootState;
  });

  afterEach(() => {
    (Alert.alert as jest.Mock).mockRestore();
  });

  const renderComponent = () => render(<AddExpenseScreen />);

  it('renders the header and expense form correctly', () => {
    const {getByTestId} = renderComponent();

    expect(MockedHeader).toHaveBeenCalled();
    const lastCallProps = MockedHeader.mock.calls.at(-1)?.[0];

    expect(lastCallProps).toBeDefined();

    const headerElement = getByTestId('mock-header');
    expect(headerElement).toBeTruthy();

    const form = getByTestId('mock-expense-form');
    expect(form).toBeTruthy();
    expect(form.props.companions).toEqual(mockState.companion.companions);
    expect(form.props.selectedCompanionId).toBe('comp-1');
    expect(form.props.formData).toEqual(mockFormData);
    expect(form.props.loading).toBe(false);
    expect(form.props.currencyCode).toBe('CAD');
    expect(form.props.saveButtonText).toBe('Save');
  });

  it('handles goBack press', () => {
    const {getByTestId} = renderComponent();
    const header = getByTestId('mock-header');
    fireEvent.press(header);
    expect(mockCanGoBack).toHaveBeenCalledTimes(1);
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('does not call goBack if navigation cannot go back', () => {
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
    form.props.onCompanionSelect('comp-2');
    expect(mockAppDispatch).toHaveBeenCalledWith(
      setSelectedCompanion('comp-2'),
    );
  });

  it('handles form changes', () => {
    const {getByTestId} = renderComponent();
    const form = getByTestId('mock-expense-form');
    const change = {key: 'title', value: 'New Title'};
    form.props.onFormChange(change.key, change.value);
    expect(mockHandleChange).toHaveBeenCalledWith(change.key, change.value);
  });

  it('handles saving a new expense successfully', async () => {
    mockValidate.mockReturnValue(true);
    const mockThunkResult = {id: 'exp-123'};
    mockAppDispatch.mockReturnValue({
      unwrap: jest.fn().mockResolvedValue(mockThunkResult),
    });

    const {getByTestId} = renderComponent();
    const form = getByTestId('mock-expense-form');
    form.props.onSave();

    await waitFor(() => expect(mockAppDispatch).toHaveBeenCalled());

    expect(mockValidate).toHaveBeenCalledWith('comp-1');
    expect(addExternalExpense).toHaveBeenCalledWith({
      companionId: 'comp-1',
      title: 'Test Dinner',
      category: mockFormData.category,
      subcategory: mockFormData.subcategory,
      visitType: mockFormData.visitType,
      amount: 100.5,
      date: '2025-10-24T10:00:00.000Z',
      attachments: [],
      providerName: 'Test Provider',
    });
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
    form.props.onSave();
    expect(mockValidate).toHaveBeenCalledWith('comp-1');
    expect(mockAppDispatch).not.toHaveBeenCalled();
    expect(mockNavDispatch).not.toHaveBeenCalled();
  });

  it('does not save if selectedCompanionId is missing', () => {
    mockState.companion.selectedCompanionId = null;
    mockValidate.mockReturnValue(true);
    const {getByTestId} = renderComponent();
    const form = getByTestId('mock-expense-form');
    form.props.onSave();
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
    form.props.onSave();

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
    form.props.onSave();

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
    form.props.onSave();

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
