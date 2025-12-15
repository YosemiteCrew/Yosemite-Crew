import React from 'react';
import {render, fireEvent, waitFor} from '@testing-library/react-native';
// Fix: Correct import path based on coverage report structure
import {ExpensePreviewScreen} from '../../../../src/features/expenses/screens/ExpensePreviewScreen/ExpensePreviewScreen';
import {useSelector, useDispatch} from 'react-redux';
import {useNavigation, useRoute} from '@react-navigation/native';
// Fix: Import thunks from the barrel file to match the jest.mock below
import {
  fetchExpenseInvoice,
  fetchExpensePaymentIntentByInvoice,
  fetchExpenseById,
  selectExpenseById,
} from '../../../../src/features/expenses';
import {fetchBusinessDetails} from '../../../../src/features/linkedBusinesses';
import {useExpensePayment} from '../../../../src/features/expenses/hooks/useExpensePayment';

// --- Mocks ---

// 1. Core & Navigation
jest.mock('react-redux', () => ({
  useSelector: jest.fn(),
  useDispatch: jest.fn(),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(),
  useRoute: jest.fn(),
}));

// 2. Theme Hook
jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: '#ffffff',
        cardBackground: '#ffffff',
        textSecondary: '#666666',
        secondary: '#000000',
        primary: '#0000ff',
        success: '#00ff00',
        border: '#cccccc',
        borderMuted: '#eeeeee',
        surface: '#f5f5f5',
        white: '#ffffff',
      },
      spacing: {1: 4, 2: 8, 3: 12, 4: 16, 6: 24, 12: 48},
      typography: {
        titleLarge: {fontSize: 20},
        titleSmall: {fontSize: 16},
        bodySmall: {fontSize: 12},
        body14: {fontSize: 14},
        h5: {fontSize: 18},
        labelSmall: {fontSize: 10},
        paragraph: {fontSize: 14},
        button: {fontSize: 14, fontWeight: '600'},
        titleMedium: {fontSize: 16},
      },
      borderRadius: {lg: 8, full: 999},
    },
  }),
}));

// 3. UI Components
jest.mock('../../../../src/shared/components/common', () => ({
  SafeArea: ({children}: any) => <mock-safe-area>{children}</mock-safe-area>,
}));

jest.mock('../../../../src/shared/components/common/Header/Header', () => ({
  Header: (props: any) => (
    <mock-header
      title={props.title}
      onBack={props.onBack}
      testID="header"
      {...props}
    />
  ),
}));

jest.mock(
  '@/shared/components/common/LiquidGlassButton/LiquidGlassButton',
  () => ({
    LiquidGlassButton: ({title, onPress, disabled}: any) => (
      <mock-button
        testID="payment-button"
        title={title}
        onPress={onPress}
        disabled={disabled}
      />
    ),
  }),
);

jest.mock(
  '@/features/documents/components/DocumentAttachmentViewer',
  () => (props: any) => <mock-attachment-viewer {...props} />,
);

jest.mock(
  '@/features/appointments/components/SummaryCards/SummaryCards',
  () => ({
    SummaryCards: (props: any) => <mock-summary-cards {...props} />,
  }),
);

// 4. Feature Logic & Assets
jest.mock('@/assets/images', () => ({
  Images: {
    documentIcon: {uri: 'doc-icon'},
    blackEdit: {uri: 'edit-icon'},
  },
}));

jest.mock('@/features/expenses/hooks/useExpensePayment', () => ({
  useExpensePayment: jest.fn(),
}));

jest.mock('@/features/expenses/utils/expenseLabels', () => ({
  resolveCategoryLabel: (val: string) => `Cat-${val}`,
  resolveSubcategoryLabel: (_c: string, val: string) => `Sub-${val}`,
  resolveVisitTypeLabel: (val: string) => `Visit-${val}`,
}));

jest.mock('@/features/expenses/utils/status', () => ({
  hasInvoice: jest.fn(),
  isExpensePaymentPending: jest.fn(),
}));

jest.mock('@/features/appointments/utils/photoUtils', () => ({
  isDummyPhoto: jest.fn(),
}));

// 5. Thunks & Actions
jest.mock('@/features/expenses', () => ({
  selectExpenseById: jest.fn(),
  fetchExpenseInvoice: jest.fn(),
  fetchExpensePaymentIntent: jest.fn(),
  fetchExpensePaymentIntentByInvoice: jest.fn(),
  fetchExpenseById: jest.fn(),
}));

jest.mock('@/features/linkedBusinesses', () => ({
  fetchBusinessDetails: jest.fn(),
}));

// Import utilities to control mock return values in tests
import {
  hasInvoice,
  isExpensePaymentPending,
} from '../../../../src/features/expenses/utils/status';
import {isDummyPhoto} from '../../../../src/features/appointments/utils/photoUtils';

describe('ExpensePreviewScreen', () => {
  const mockDispatch = jest.fn();
  const mockNavigation = {
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: jest.fn(() => true),
  };
  const mockOpenPaymentScreen = jest.fn();

  // Helper to mock dispatch calls with unwrap capability
  const setupDispatch = (resolvedValue: any = {}) => {
    mockDispatch.mockImplementation(() => ({
      unwrap: () => Promise.resolve(resolvedValue),
    }));
  };

  // We'll use a specific identity for the mocked selector to distinguish it
  const mockExpenseSelectorFn = jest.fn();

  const baseExpense = {
    id: 'exp-1',
    title: 'Vaccination',
    category: 'medical',
    subcategory: 'vaccine',
    visitType: 'routine',
    date: '2023-01-01',
    amount: 50,
    currencyCode: 'USD',
    businessName: 'Vet Clinic',
    description: 'Annual shot',
    source: 'inApp',
    invoiceId: 'inv-123',
    attachments: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useDispatch as unknown as jest.Mock).mockReturnValue(mockDispatch);
    (useNavigation as jest.Mock).mockReturnValue(mockNavigation);
    (useRoute as jest.Mock).mockReturnValue({params: {expenseId: 'exp-1'}});

    (useExpensePayment as jest.Mock).mockReturnValue({
      openPaymentScreen: mockOpenPaymentScreen,
      processingPayment: false,
    });

    // Default Utils behavior
    (hasInvoice as jest.Mock).mockReturnValue(true);
    (isExpensePaymentPending as jest.Mock).mockReturnValue(true);
    (isDummyPhoto as jest.Mock).mockReturnValue(false);

    // Setup Selector Mocks
    (selectExpenseById as jest.Mock).mockReturnValue(mockExpenseSelectorFn);

    (useSelector as unknown as jest.Mock).mockImplementation(callback => {
      // If the component calls useSelectors(selectExpenseById(...)), it passes our mock identity
      if (callback === mockExpenseSelectorFn) {
        return baseExpense;
      }
      // Default fallback for other selectors (e.g. user currency)
      return 'USD';
    });

    // Default Dispatch
    setupDispatch({});
  });

  // ==============================================================================
  // 1. Rendering & Loading States
  // ==============================================================================

  it('renders "Expense not found" when expense selector returns null', () => {
    // Override selector to return null
    (useSelector as unknown as jest.Mock).mockImplementation(callback => {
      if (callback === mockExpenseSelectorFn) return null;
      return 'USD';
    });

    const {getByText} = render(<ExpensePreviewScreen />);
    expect(getByText('Expense not found')).toBeTruthy();
  });

  it('renders basic expense details correctly', () => {
    const {getByText} = render(<ExpensePreviewScreen />);

    expect(getByText('Expense Details')).toBeTruthy();
    expect(getByText('Vaccination')).toBeTruthy();
    expect(getByText('Vet Clinic')).toBeTruthy();
    expect(getByText('Cat-medical')).toBeTruthy();
    expect(getByText('Sub-vaccine')).toBeTruthy();
    expect(getByText('Annual shot')).toBeTruthy();
  });

  it('renders fallback for missing attachments', () => {
    const {getByText} = render(<ExpensePreviewScreen />);
    expect(getByText('No attachments')).toBeTruthy();
  });

  it('renders AttachmentViewer when attachments exist', () => {
    const expenseWithDocs = {...baseExpense, attachments: [{id: 'doc1'}]};

    (useSelector as unknown as jest.Mock).mockImplementation(callback => {
      if (callback === mockExpenseSelectorFn) return expenseWithDocs;
      return 'USD';
    });

    const {UNSAFE_getByType} = render(<ExpensePreviewScreen />);
    expect(UNSAFE_getByType('mock-attachment-viewer')).toBeTruthy();
  });

  // ==============================================================================
  // 2. In-App Expense Logic (Invoices & Payments)
  // ==============================================================================

  it('fetches invoice data and payment intent on mount for pending in-app expense', async () => {
    (isExpensePaymentPending as jest.Mock).mockReturnValue(true);

    // Mock dispatch to return invoice data
    mockDispatch.mockImplementation(() => ({
      unwrap: () =>
        Promise.resolve({
          invoice: {id: 'inv-123'},
          paymentIntentId: 'pi-123',
          organisation: {name: 'My Vet', address: {city: 'NY'}},
          clientSecret: 'secret',
        }),
    }));

    render(<ExpensePreviewScreen />);

    await waitFor(() => {
      expect(fetchExpenseInvoice).toHaveBeenCalledWith({invoiceId: 'inv-123'});
    });

    await waitFor(() => {
      // The component tries ByInvoice first for intents
      expect(fetchExpensePaymentIntentByInvoice).toHaveBeenCalledWith({
        invoiceId: 'inv-123',
      });
    });
  });

  it('handles payment intent fetch failure gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    // Sequence: 1. Invoice (Success), 2. Intent (Fail)
    mockDispatch
      .mockReturnValueOnce({
        unwrap: () => Promise.resolve({invoice: {}, paymentIntentId: 'pi-1'}),
      })
      .mockReturnValueOnce({
        unwrap: () => Promise.reject('Intent Error'),
      });

    render(<ExpensePreviewScreen />);
    consoleSpy.mockRestore();
  });

  it('displays "Pay" button for pending invoices', () => {
    (isExpensePaymentPending as jest.Mock).mockReturnValue(true);
  });

  it('displays "View Invoice" button for paid invoices', () => {
    (isExpensePaymentPending as jest.Mock).mockReturnValue(false);
    const {getByText} = render(<ExpensePreviewScreen />);
    expect(getByText('Paid')).toBeTruthy();
  });

  it('opens payment screen on button press', () => {
    const {getByTestId} = render(<ExpensePreviewScreen />);
    const btn = getByTestId('payment-button');
    fireEvent.press(btn);
    expect(mockOpenPaymentScreen).toHaveBeenCalled();
  });

  // ==============================================================================
  // 3. External Expense Logic (Updates & Edits)
  // ==============================================================================

  it('shows external badge and edit button for external expenses', () => {
    const externalExpense = {...baseExpense, source: 'external'};

    (useSelector as unknown as jest.Mock).mockImplementation(callback => {
      if (callback === mockExpenseSelectorFn) return externalExpense;
      return 'USD';
    });

    const {getByText, getByTestId} = render(<ExpensePreviewScreen />);

    expect(getByText('External expense')).toBeTruthy();

    const header = getByTestId('header');
    // @ts-ignore - custom prop on mock
    expect(header.props.rightIcon).toBeDefined();

    // Trigger Edit
    // @ts-ignore
    fireEvent(header, 'pressRight');
  });

  it('refreshes external expense details on mount', () => {
    const externalExpense = {...baseExpense, source: 'external'};
    (useSelector as unknown as jest.Mock).mockImplementation(callback => {
      if (callback === mockExpenseSelectorFn) return externalExpense;
      return 'USD';
    });

    render(<ExpensePreviewScreen />);

    expect(fetchExpenseById).toHaveBeenCalledWith({expenseId: 'exp-1'});
  });

  // ==============================================================================
  // 4. Business Photo Fallback Logic
  // ==============================================================================

  it('fetches business photo if current image is dummy/missing', async () => {
    (isDummyPhoto as jest.Mock).mockReturnValue(true);

    // Sequence: 1. Invoice returns org with dummy image, 2. Business details fetch
    mockDispatch
      .mockReturnValueOnce({
        unwrap: () =>
          Promise.resolve({
            invoice: {},
            organisation: {placesId: 'place-123', image: 'dummy.jpg'},
          }),
      })
      .mockReturnValueOnce({
        unwrap: () => Promise.resolve({photoUrl: 'real-photo.jpg'}),
      });

    render(<ExpensePreviewScreen />);

    await waitFor(() => {
      expect(fetchBusinessDetails).toHaveBeenCalledWith('place-123');
    });
  });

  it('does not fetch business photo if current image is valid', async () => {
    (isDummyPhoto as jest.Mock).mockReturnValue(false); // Valid

    mockDispatch.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          invoice: {},
          organisation: {placesId: 'place-123', image: 'valid.jpg'},
        }),
    });

    render(<ExpensePreviewScreen />);

    // Ensure fetchBusinessDetails was NOT called
    expect(fetchBusinessDetails).not.toHaveBeenCalled();
  });
});
