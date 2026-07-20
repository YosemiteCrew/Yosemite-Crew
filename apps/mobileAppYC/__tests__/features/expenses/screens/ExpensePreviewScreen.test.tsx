import React from 'react';
import {ActivityIndicator} from 'react-native';
import {mockTheme} from '../setup/mockTheme';
import {render, fireEvent, waitFor, act} from '@testing-library/react-native';
// Fix: Correct import path based on coverage report structure
import {ExpensePreviewScreen} from '../../../../src/features/expenses/screens/ExpensePreviewScreen/ExpensePreviewScreen';
import {useSelector, useDispatch} from 'react-redux';
import {useNavigation, useRoute} from '@react-navigation/native';
// Fix: Import thunks from the barrel file to match the jest.mock below
import {
  fetchExpensePaymentIntent,
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
  useTheme: () => ({theme: mockTheme, isDark: false}),
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
    companionId: 'companion-1',
    invoiceId: 'inv-123',
    attachments: [],
  };

  const selectorState = {
    auth: {user: {currency: 'USD'}},
    companion: {
      companions: [{id: 'companion-1', name: 'Buddy'}],
    },
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
      return callback(selectorState);
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
      return callback(selectorState);
    });

    const {getByText} = render(<ExpensePreviewScreen />);
    expect(getByText('Expense not found')).toBeTruthy();
  });

  it('renders basic expense details correctly', () => {
    const {getByText} = render(<ExpensePreviewScreen />);

    // Warm-bone preview: hero (amount + title + date) then a DetailsCard with
    // Provider/Companion/Category/Sub category/Visit type/Description rows.
    // The "Expense Details" heading was replaced by the hero block.
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
      return callback(selectorState);
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

    // Sequence: 1. Invoice (Success), 2. latest intent (Fail),
    // 3. legacy intent fallback (Fail)
    mockDispatch
      .mockReturnValueOnce({
        unwrap: () => Promise.resolve({invoice: {}, paymentIntentId: 'pi-1'}),
      })
      .mockReturnValueOnce({
        unwrap: () => Promise.reject('Intent Error'),
      })
      .mockReturnValueOnce({
        unwrap: () => Promise.reject('Legacy Intent Error'),
      });

    render(<ExpensePreviewScreen />);

    await waitFor(() => {
      expect(fetchExpensePaymentIntent).toHaveBeenCalledWith({
        paymentIntentId: 'pi-1',
      });
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to fetch payment intent:',
        'Legacy Intent Error',
      );
    });

    consoleSpy.mockRestore();
  });

  it('falls back to fetching payment intent by id when invoice lookup fails', async () => {
    mockDispatch
      .mockReturnValueOnce({
        unwrap: () => Promise.resolve({invoice: {}, paymentIntentId: 'pi-1'}),
      })
      .mockReturnValueOnce({
        unwrap: () => Promise.reject('Intent lookup unavailable'),
      })
      .mockReturnValueOnce({
        unwrap: () => Promise.resolve({id: 'pi-1', clientSecret: 'secret'}),
      });

    render(<ExpensePreviewScreen />);

    await waitFor(() => {
      expect(fetchExpensePaymentIntent).toHaveBeenCalledWith({
        paymentIntentId: 'pi-1',
      });
    });
  });

  it('logs invoice fetch failures', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    mockDispatch.mockReturnValueOnce({
      unwrap: () => Promise.reject('Invoice Error'),
    });

    render(<ExpensePreviewScreen />);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to fetch invoice:',
        'Invoice Error',
      );
    });

    consoleSpy.mockRestore();
  });

  it('displays "Pay" button for pending invoices', () => {
    (isExpensePaymentPending as jest.Mock).mockReturnValue(true);
    const {getByTestId} = render(<ExpensePreviewScreen />);
    expect(getByTestId('payment-button').props.title).toBe('Pay $50');
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
      return callback(selectorState);
    });

    const {getByText, getByTestId} = render(<ExpensePreviewScreen />);

    expect(getByText('External expense')).toBeTruthy();

    const header = getByTestId('header');
    // @ts-ignore - custom prop on mock
    expect(header.props.rightIcon).toBeDefined();

    fireEvent(header, 'pressRight');
    header.props.onRightPress();
    expect(mockNavigation.navigate).toHaveBeenCalledWith('EditExpense', {
      expenseId: 'exp-1',
    });
  });

  it('refreshes external expense details on mount', () => {
    const externalExpense = {...baseExpense, source: 'external'};
    (useSelector as unknown as jest.Mock).mockImplementation(callback => {
      if (callback === mockExpenseSelectorFn) return externalExpense;
      return callback(selectorState);
    });

    render(<ExpensePreviewScreen />);

    expect(fetchExpenseById).toHaveBeenCalledWith({expenseId: 'exp-1'});
  });

  it('uses fallback currency and header back guard behavior', () => {
    const noCurrencyExpense = {
      ...baseExpense,
      currencyCode: undefined,
    };
    (useSelector as unknown as jest.Mock).mockImplementation(callback => {
      if (callback === mockExpenseSelectorFn) return noCurrencyExpense;
      return callback({
        ...selectorState,
        auth: {user: null},
      });
    });

    const {getByTestId} = render(<ExpensePreviewScreen />);
    const header = getByTestId('header');

    header.props.onBack();
    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);

    mockNavigation.canGoBack.mockReturnValueOnce(false);
    header.props.onBack();
    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('updates pdf interaction state from attachment viewer callbacks', () => {
    const expenseWithDocs = {...baseExpense, attachments: [{id: 'doc1'}]};

    (useSelector as unknown as jest.Mock).mockImplementation(callback => {
      if (callback === mockExpenseSelectorFn) return expenseWithDocs;
      return callback(selectorState);
    });

    const {UNSAFE_getByType} = render(<ExpensePreviewScreen />);
    const viewer = UNSAFE_getByType('mock-attachment-viewer');

    act(() => {
      viewer.props.onPdfTouchStart();
      viewer.props.onPdfTouchEnd();
    });
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

  it('logs debug output when business photo fallback fails', async () => {
    const debugSpy = jest.spyOn(console, 'debug').mockImplementation();
    (isDummyPhoto as jest.Mock).mockReturnValue(true);

    mockDispatch
      .mockReturnValueOnce({
        unwrap: () =>
          Promise.resolve({
            invoice: {},
            organisation: {placesId: 'place-123', image: 'dummy.jpg'},
          }),
      })
      .mockReturnValueOnce({
        unwrap: () => Promise.reject(new Error('No photo')),
      });

    render(<ExpensePreviewScreen />);

    await waitFor(() => {
      expect(debugSpy).toHaveBeenCalledWith(
        '[ExpensePreview] Could not fetch places image for placesId:',
        'place-123',
      );
    });

    debugSpy.mockRestore();
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

  it('does not overwrite the fallback photo when business details lack a photoUrl', async () => {
    (isDummyPhoto as jest.Mock).mockReturnValue(true);

    // 1. Invoice resolves an org with a dummy image + placesId, 2. business
    // details resolves nothing usable -> the `res?.photoUrl` guard is false.
    mockDispatch
      .mockReturnValueOnce({
        unwrap: () =>
          Promise.resolve({
            invoice: {},
            organisation: {placesId: 'place-123', image: 'dummy.jpg'},
          }),
      })
      .mockReturnValueOnce({
        unwrap: () => Promise.resolve(undefined),
      });

    render(<ExpensePreviewScreen />);

    await waitFor(() => {
      expect(fetchBusinessDetails).toHaveBeenCalledWith('place-123');
    });
  });

  // ==============================================================================
  // 5. Category Hero Visuals (getCategoryVisual switch)
  // ==============================================================================

  const renderWithExpense = (overrides: Record<string, unknown>) => {
    const expense = {...baseExpense, ...overrides};
    (useSelector as unknown as jest.Mock).mockImplementation(callback => {
      if (callback === mockExpenseSelectorFn) return expense;
      return callback(selectorState);
    });
    return render(<ExpensePreviewScreen />);
  };

  it('renders the hygiene-maintenance category icon', () => {
    const {getByTestId} = renderWithExpense({category: 'hygiene-maintenance'});
    expect(getByTestId('icon-cut-outline')).toBeTruthy();
  });

  it('renders the dietary-plans category icon', () => {
    const {getByTestId} = renderWithExpense({category: 'dietary-plans'});
    expect(getByTestId('icon-nutrition-outline')).toBeTruthy();
  });

  it('renders the admin category icon', () => {
    const {getByTestId} = renderWithExpense({category: 'admin'});
    expect(getByTestId('icon-document-text-outline')).toBeTruthy();
  });

  it('renders the others category icon', () => {
    const {getByTestId} = renderWithExpense({category: 'others'});
    expect(getByTestId('icon-pricetag-outline')).toBeTruthy();
  });

  // ==============================================================================
  // 6. Additional Branch Coverage
  // ==============================================================================

  it('shows a loading spinner while the payment intent is still resolving', async () => {
    (isExpensePaymentPending as jest.Mock).mockReturnValue(true);

    // Invoice resolves with an intent id (so loadingPayment flips true), then the
    // by-invoice intent lookup never settles -> loadingPayment stays true.
    mockDispatch
      .mockReturnValueOnce({
        unwrap: () => Promise.resolve({invoice: {}, paymentIntentId: 'pi-1'}),
      })
      .mockReturnValueOnce({
        unwrap: () => new Promise(() => {}),
      });

    const {UNSAFE_getByType, queryByTestId} = render(<ExpensePreviewScreen />);

    await waitFor(() => {
      expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    });
    // While loading, the pressable button is replaced by the spinner.
    expect(queryByTestId('payment-button')).toBeNull();
  });

  it('falls back to an empty expenseId when the route param is missing', () => {
    (useRoute as jest.Mock).mockReturnValue({params: undefined});

    const {getByText} = render(<ExpensePreviewScreen />);

    // Still renders the (selector-provided) expense; the fetch-by-id effect is
    // skipped because expenseId resolved to ''.
    expect(getByText('Vaccination')).toBeTruthy();
    expect(fetchExpenseById).not.toHaveBeenCalled();
  });

  it('hides the companion row when the expense has no companion', () => {
    const {queryByText} = renderWithExpense({companionId: undefined});
    // companion selector returns null -> companion?.name ?? '' -> row hidden.
    expect(queryByText('Buddy')).toBeNull();
  });

  it('hides the description row when the expense has no description', () => {
    const {queryByText} = renderWithExpense({description: ''});
    // expense.description || '' -> '' and the row is hidden.
    expect(queryByText('Annual shot')).toBeNull();
  });

  it('does not open the payment screen while a payment is processing', () => {
    (useExpensePayment as jest.Mock).mockReturnValue({
      openPaymentScreen: mockOpenPaymentScreen,
      processingPayment: true,
    });

    const {getByTestId} = render(<ExpensePreviewScreen />);
    const btn = getByTestId('payment-button');
    expect(btn.props.disabled).toBe(true);

    fireEvent.press(btn);
    // handleOpenInvoice guards on !processingPayment, so nothing happens.
    expect(mockOpenPaymentScreen).not.toHaveBeenCalled();
  });
});
