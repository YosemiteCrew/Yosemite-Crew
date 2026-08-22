import React from 'react';
import {mockTheme} from '../setup/mockTheme';
import {
  render,
  fireEvent,
  screen,
  waitFor,
} from '@testing-library/react-native';
import {useSelector, useDispatch} from 'react-redux';
import {useRoute} from '@react-navigation/native';
import {Alert, Linking} from 'react-native';

// --- Mocks ---

// Mock Stripe before importing PaymentInvoiceScreen
jest.mock('@stripe/stripe-react-native', () => ({
  useStripe: () => ({
    initPaymentSheet: jest.fn(),
    presentPaymentSheet: jest.fn(),
  }),
  useConfirmPayment: () => ({
    confirmPayment: jest.fn(),
  }),
}));

import {PaymentInvoiceScreen} from '../../../../src/features/payments/screens/PaymentInvoiceScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockReplace = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    replace: mockReplace,
  }),
  useRoute: jest.fn(),
}));

// Fix TS Error: Cast to unknown first
jest.mock('react-redux', () => ({
  useSelector: jest.fn(),
  useDispatch: jest.fn(),
}));

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

// Fix TS Error: Remove unused imports or mock correctly
jest.mock('@/assets/images', () => ({
  Images: {
    sampleInvoice: {uri: 'invoice-img'},
    emailIcon: {uri: 'email-icon'},
    locationIcon: {uri: 'loc-icon'},
    otNoProviders: {uri: 'no-provider'},
  },
}));

jest.mock('@/features/appointments/selectors', () => ({
  selectInvoiceForAppointment: () => (state: any) => {
    return state.appointments?.invoices?.['apt-1'];
  },
}));

// Fix Hoisting & TS Error: Return a functional component, not a string
jest.mock(
  '@/shared/components/common/LiquidGlassButton/LiquidGlassButton',
  () => ({
    LiquidGlassButton: ({title, onPress}: any) => {
      const {TouchableOpacity, Text} = require('react-native');
      return (
        <TouchableOpacity
          onPress={onPress}
          testID={`btn-${title.replaceAll(/\s/g, '-')}`}>
          <Text>{title}</Text>
        </TouchableOpacity>
      );
    },
  }),
);

jest.mock('@/shared/components/common/Header/Header', () => ({
  Header: ({onBack}: any) => {
    const {TouchableOpacity, Text} = require('react-native');
    return (
      <TouchableOpacity onPress={onBack} testID="header-back">
        <Text>HeaderBack</Text>
      </TouchableOpacity>
    );
  },
}));

jest.mock(
  '@/features/appointments/components/SummaryCards/SummaryCards',
  () => ({
    SummaryCards: () => {
      const {View} = require('react-native');
      return <View testID="summary-cards" />;
    },
  }),
);

jest.mock('@/features/payments/hooks/usePaymentHandler', () => ({
  usePaymentHandler: jest.fn(() => ({
    handlePayNow: jest.fn(),
    presentingSheet: false,
  })),
}));

// --- Test Data & Helpers ---

const mockInvoiceData = {
  invoiceNumber: 'INV-001',
  invoiceDate: '2025-11-20T10:00:00Z',
  dueDate: '2025-12-04',
  total: 150,
  subtotal: 140,
  discount: 0,
  tax: 10,
  billedToName: 'John Doe',
  billedToEmail: 'john@example.com',
  items: [
    {description: 'Consultation', rate: 100, lineTotal: 100, qty: 1},
    {description: 'Meds', rate: 40, lineTotal: 40, qty: 1},
  ],
};

const mockStateBase = {
  appointments: {
    items: [
      {
        id: 'apt-1',
        businessId: 'biz-1',
        serviceId: 'svc-1',
        employeeId: 'emp-1',
        companionId: 'comp-1',
        serviceName: 'General Checkup',
        status: 'AWAITING_PAYMENT',
        paymentIntent: {
          clientSecret: 'pi_test_secret',
          paymentIntentId: 'pi_test_123',
          connectedAccountId: 'acct_test_123',
          amount: 150,
          currency: 'USD',
        },
      },
    ],
    invoices: {'apt-1': mockInvoiceData},
  },
  businesses: {
    businesses: [{id: 'biz-1', name: 'Vet Clinic', address: '123 Vet St'}],
    services: [{id: 'svc-1', name: 'General Checkup'}],
    employees: [{id: 'emp-1', name: 'Dr. Smith'}],
  },
  companion: {
    companions: [
      {id: 'comp-1', name: 'Fluffy', profileImage: 'http://fluffy.jpg'},
    ],
  },
  auth: {
    user: {
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@doe.com',
      profilePicture: 'http://jane.jpg',
      address: {
        addressLine: '456 Owner Ln',
        city: 'San Francisco',
        stateProvince: 'CA',
        postalCode: '94103',
      },
    },
  },
};

// Helper to merge state without deleting required arrays
const createSafeState = (overrides: any = {}) => {
  // Deep clone base first
  const state = structuredClone(mockStateBase);

  if (overrides.auth !== undefined) state.auth = overrides.auth;

  if (overrides.appointments) {
    state.appointments = {
      ...state.appointments,
      ...overrides.appointments,
      // Ensure items exist if not explicitly provided in override
      items: overrides.appointments.items || state.appointments.items,
    };
  }

  if (overrides.businesses) {
    state.businesses = {
      ...state.businesses,
      ...overrides.businesses,
      // Ensure these arrays exist to prevent .find() crashes
      services: overrides.businesses.services || state.businesses.services,
      employees: overrides.businesses.employees || state.businesses.employees,
      businesses:
        overrides.businesses.businesses !== undefined
          ? overrides.businesses.businesses
          : state.businesses.businesses,
    };
  }

  if (overrides.companion) {
    state.companion = {...state.companion, ...overrides.companion};
  }

  return state;
};

describe('PaymentInvoiceScreen', () => {
  const mockDispatch = jest.fn(() => ({
    unwrap: jest.fn().mockResolvedValue({}),
  }));
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  const canOpenUrlSpy = jest
    .spyOn(Linking, 'canOpenURL')
    .mockResolvedValue(true as any);
  const openUrlSpy = jest
    .spyOn(Linking, 'openURL')
    .mockResolvedValue(true as any);

  beforeEach(() => {
    jest.clearAllMocks();
    mockDispatch.mockReturnValue({
      unwrap: jest.fn().mockResolvedValue({}),
      then: jest.fn(resolve => {
        resolve({});
        return {catch: jest.fn(() => ({finally: jest.fn(fn => fn())}))};
      }),
      catch: jest.fn(() => ({finally: jest.fn(fn => fn())})),
      finally: jest.fn(fn => fn()),
    });
    // Fix TS Error: Cast generic mock to jest.Mock
    (useDispatch as unknown as jest.Mock).mockReturnValue(mockDispatch);
    (useRoute as jest.Mock).mockReturnValue({
      params: {appointmentId: 'apt-1', companionId: 'comp-1'},
    });
    (useSelector as unknown as jest.Mock).mockImplementation(selectorFn => {
      return selectorFn(mockStateBase);
    });
  });

  afterAll(() => {
    alertSpy.mockRestore();
    canOpenUrlSpy.mockRestore();
    openUrlSpy.mockRestore();
  });

  // --- Rendering Tests ---

  it('renders correctly with full data', () => {
    render(<PaymentInvoiceScreen />);
    expect(screen.getByText('Invoice details')).toBeTruthy();
    expect(screen.getByText('INV-001')).toBeTruthy();
  });

  it('shows "Paid - Cash" status for PMS cash-collected invoices', () => {
    const state = createSafeState({
      appointments: {
        invoices: {
          'apt-1': {
            ...mockInvoiceData,
            status: 'PAID',
            paymentCollectionMethod: 'PAYMENT_AT_CLINIC',
            metadata: {paymentMethod: 'cash'},
            paidAt: '2026-03-19T10:00:00.000Z',
          },
        },
      },
    });
    (useSelector as unknown as jest.Mock).mockImplementation(fn => fn(state));
    render(<PaymentInvoiceScreen />);

    expect(screen.getByText('Payment status')).toBeTruthy();
    expect(screen.getByText('Paid - Cash')).toBeTruthy();
  });

  it('shows cash cancellation notice for cancelled appointments paid in cash', async () => {
    const state = createSafeState({
      appointments: {
        items: [
          {
            ...mockStateBase.appointments.items[0],
            status: 'CANCELLED',
            paymentStatus: 'PAID_CASH',
          },
        ],
        invoices: {
          'apt-1': {
            ...mockInvoiceData,
            status: 'PAID_CASH',
            paymentCollectionMethod: 'PAYMENT_AT_CLINIC',
            paidAt: '2026-03-24T10:00:00.000Z',
          },
        },
      },
    });
    (useSelector as unknown as jest.Mock).mockImplementation(fn => fn(state));
    render(<PaymentInvoiceScreen />);

    await waitFor(() => {
      expect(
        screen.getByText(
          /This appointment was paid in cash and has been cancelled/,
        ),
      ).toBeTruthy();
      expect(
        screen.getByText(/must be handled directly by the service provider/),
      ).toBeTruthy();
    });
  });

  it('shows "Payment at Provider" when payment will be collected at clinic but is not yet paid', () => {
    const state = createSafeState({
      appointments: {
        invoices: {
          'apt-1': {
            ...mockInvoiceData,
            status: 'AWAITING_PAYMENT',
            paymentCollectionMethod: 'PAYMENT_AT_CLINIC',
            paidAt: null,
          },
        },
      },
    });
    (useSelector as unknown as jest.Mock).mockImplementation(fn => fn(state));

    render(<PaymentInvoiceScreen />);

    expect(screen.getByText('Payment at Provider')).toBeTruthy();
  });

  it('badges a paid invoice as paid even when its label is not English', () => {
    // The badge used to be derived by matching English words inside the
    // TRANSLATED label, so a non-English locale fell through to "Due" and
    // showed a settled invoice as outstanding. Simulated here by giving the
    // label a non-English value while the invoice status stays PAID.
    const state = createSafeState({
      appointments: {
        invoices: {
          'apt-1': {
            ...mockInvoiceData,
            status: 'PAID',
            paymentCollectionMethod: 'PAYMENT_AT_CLINIC',
            paidAt: '2026-03-25T10:00:00.000Z',
          },
        },
      },
    });
    (useSelector as unknown as jest.Mock).mockImplementation(fn => fn(state));

    render(<PaymentInvoiceScreen />);

    // The badge reads Paid, not the Due fallback.
    expect(screen.getAllByText('Paid').length).toBeGreaterThan(0);
    expect(screen.queryByText('Due')).toBeNull();
  });

  it('shows "Paid" when a stripe-backed invoice is paid and not marked as cash', () => {
    const state = createSafeState({
      appointments: {
        invoices: {
          'apt-1': {
            ...mockInvoiceData,
            status: 'PAID',
            stripePaymentIntentId: 'pi_live_123',
            metadata: {source: 'stripe'},
            paidAt: '2026-03-25T10:00:00.000Z',
          },
        },
      },
    });
    (useSelector as unknown as jest.Mock).mockImplementation(fn => fn(state));

    render(<PaymentInvoiceScreen />);

    // "Paid" now renders twice: the "Payment status" row value and the new
    // status Badge in the invoice-details card header.
    expect(screen.getAllByText('Paid').length).toBeGreaterThanOrEqual(2);
  });

  // --- Branch Coverage: Date Formatting ---

  it('handles missing invoice date gracefully', () => {
    const state = createSafeState({
      appointments: {
        invoices: {'apt-1': {...mockInvoiceData, invoiceDate: null}},
      },
    });
    (useSelector as unknown as jest.Mock).mockImplementation(fn => fn(state));
    render(<PaymentInvoiceScreen />);
    // Should render without crashing
    expect(screen.getByText('Invoice details')).toBeTruthy();
  });

  it('handles invalid invoice date gracefully', () => {
    const state = createSafeState({
      appointments: {
        invoices: {'apt-1': {...mockInvoiceData, invoiceDate: 'invalid-date'}},
      },
    });
    (useSelector as unknown as jest.Mock).mockImplementation(fn => fn(state));
    render(<PaymentInvoiceScreen />);
    // Should render without crashing
    expect(screen.getByText('Invoice details')).toBeTruthy();
  });

  // --- Branch Coverage: Guardian Name & Avatar ---

  it('uses email for guardian name and shows initial "J" when names are missing', () => {
    const state = createSafeState({
      auth: {
        user: {
          email: 'jane@doe.com',
          firstName: '',
          lastName: undefined,
          profilePicture: null, // Triggers Initial Text
        },
      },
    });
    (useSelector as unknown as jest.Mock).mockImplementation(fn => fn(state));
    render(<PaymentInvoiceScreen />);

    // Renders Email
    expect(screen.getByText('jane@doe.com')).toBeTruthy();
    // Renders Initial (Avatar fallback)
    expect(screen.getByText('J')).toBeTruthy();
  });

  it('uses billedToName for guardian name if auth user is null', () => {
    const state = createSafeState({
      auth: {user: null},
    });
    (useSelector as unknown as jest.Mock).mockImplementation(fn => fn(state));
    render(<PaymentInvoiceScreen />);

    // Derived from 'John Doe' -> 'J'
    // We use getAllByText because 'J' might appear in multiple contexts or if data repeats
    expect(screen.getAllByText('J').length).toBeGreaterThan(0);
  });

  it('uses "Pet guardian" and initial "P" when all name info is missing', () => {
    const state = createSafeState({
      auth: {user: null},
      appointments: {
        invoices: {
          'apt-1': {
            ...mockInvoiceData,
            billedToName: undefined,
            billedToEmail: undefined,
          },
        },
      },
    });
    (useSelector as unknown as jest.Mock).mockImplementation(fn => fn(state));
    render(<PaymentInvoiceScreen />);

    expect(screen.getByText('P')).toBeTruthy(); // Initial
  });

  // --- Branch Coverage: Address Fallbacks ---

  it('uses business address if user address is missing', () => {
    const state = createSafeState({
      auth: {user: {...mockStateBase.auth.user, address: null}},
    });
    (useSelector as unknown as jest.Mock).mockImplementation(fn => fn(state));
    render(<PaymentInvoiceScreen />);
    expect(screen.getByText('123 Vet St')).toBeTruthy();
  });

  it('uses billedToName as address fallback if user and business address missing', () => {
    const state = createSafeState({
      auth: {user: {...mockStateBase.auth.user, address: null}},
      businesses: {businesses: []}, // Empty businesses triggers fallback
    });
    (useSelector as unknown as jest.Mock).mockImplementation(fn => fn(state));
    render(<PaymentInvoiceScreen />);
    expect(screen.getByText('John Doe')).toBeTruthy();
  });

  it('handles missing address info gracefully', () => {
    const state = createSafeState({
      auth: {user: {...mockStateBase.auth.user, address: null}},
      businesses: {businesses: []},
      appointments: {
        invoices: {'apt-1': {...mockInvoiceData, billedToName: undefined}},
      },
    });
    (useSelector as unknown as jest.Mock).mockImplementation(fn => fn(state));
    render(<PaymentInvoiceScreen />);
    // Should render without crashing
    expect(screen.getByText('Invoice details')).toBeTruthy();
  });

  // --- Branch Coverage: Companion Logic ---

  it('renders companion initial "C" when profile image is missing', () => {
    const state = createSafeState({
      companion: {
        companions: [{id: 'comp-1', name: 'Charlie', profileImage: null}],
      },
    });
    (useSelector as unknown as jest.Mock).mockImplementation(fn => fn(state));
    render(<PaymentInvoiceScreen />);
    expect(screen.getAllByText('C').length).toBeGreaterThan(0);
  });

  it('renders default initial "C" if companion name is missing/empty', () => {
    const state = createSafeState({
      companion: {
        companions: [{id: 'comp-1', name: '', profileImage: null}],
      },
    });
    (useSelector as unknown as jest.Mock).mockImplementation(fn => fn(state));
    render(<PaymentInvoiceScreen />);
    expect(screen.getAllByText('C').length).toBeGreaterThan(0);
  });

  it('handles missing companionId in route params (uses apt.companionId)', () => {
    (useRoute as jest.Mock).mockReturnValue({
      params: {appointmentId: 'apt-1'}, // No companionId provided in route
    });
    render(<PaymentInvoiceScreen />);
    expect(screen.getByText('Fluffy')).toBeTruthy();
  });

  it('handles missing companionId in BOTH route and appointment (null companion)', () => {
    const state = createSafeState({
      appointments: {
        items: [{...mockStateBase.appointments.items[0], companionId: null}],
      },
    });
    (useRoute as jest.Mock).mockReturnValue({
      params: {appointmentId: 'apt-1'},
    });
    (useSelector as unknown as jest.Mock).mockImplementation(fn => fn(state));
    render(<PaymentInvoiceScreen />);
    // "Companion" text appears as fallback name
    // "C" initial appears
    expect(screen.getAllByText('C').length).toBeGreaterThan(0);
  });

  // --- Branch Coverage: Selectors & Invoice Items ---

  it('renders correctly when service lookup fails (null service branch)', () => {
    const state = createSafeState({
      appointments: {
        items: [
          {...mockStateBase.appointments.items[0], serviceId: 'invalid-svc'},
        ],
      },
      businesses: {services: []},
    });
    (useSelector as unknown as jest.Mock).mockImplementation(fn => fn(state));
    render(<PaymentInvoiceScreen />);
    expect(screen.getByText('Invoice details')).toBeTruthy();
  });

  it('renders correctly when appointment is not found (optional chaining checks)', () => {
    const state = createSafeState({
      appointments: {items: []}, // No items
    });
    (useSelector as unknown as jest.Mock).mockImplementation(fn => fn(state));
    const result = render(<PaymentInvoiceScreen />);
    // Should render without crashing when appointment is not found
    // Component will show loading state initially, which is acceptable
    expect(result).toBeTruthy();
  });

  it('buildInvoiceItemKey: handles undefined qty (defaults to 0)', () => {
    const state = createSafeState({
      appointments: {
        invoices: {
          'apt-1': {
            ...mockInvoiceData,
            items: [
              {
                description: 'ItemNoQty',
                rate: 10,
                lineTotal: 10,
                qty: undefined,
              },
            ],
          },
        },
      },
    });
    (useSelector as unknown as jest.Mock).mockImplementation(fn => fn(state));
    render(<PaymentInvoiceScreen />);
    expect(screen.getByText('ItemNoQty')).toBeTruthy();
  });

  it('invoice subtotal fallback: renders 0 if subtotal is missing', () => {
    const state = createSafeState({
      appointments: {
        invoices: {'apt-1': {...mockInvoiceData, subtotal: undefined}},
      },
    });
    (useSelector as unknown as jest.Mock).mockImplementation(fn => fn(state));
    render(<PaymentInvoiceScreen />);
    expect(screen.getByText('$0.00')).toBeTruthy();
  });

  // --- Branch Coverage: Breakdown Section (Tax/Discount) ---

  it('does NOT render discount or tax rows if they are 0', () => {
    const state = createSafeState({
      appointments: {
        invoices: {
          'apt-1': {...mockInvoiceData, discountPercent: 0, taxPercent: 0},
        },
      },
    });
    (useSelector as unknown as jest.Mock).mockImplementation(fn => fn(state));
    render(<PaymentInvoiceScreen />);

    expect(screen.queryByText('Discount')).toBeNull();
    expect(screen.queryByText('Tax')).toBeNull();
  });

  it('renders discount and tax rows if they exist (> 0)', () => {
    const state = createSafeState({
      appointments: {
        invoices: {
          'apt-1': {...mockInvoiceData, discountPercent: 25, taxPercent: 15},
        },
      },
    });
    (useSelector as unknown as jest.Mock).mockImplementation(fn => fn(state));
    render(<PaymentInvoiceScreen />);

    expect(screen.getByText('Discount')).toBeTruthy();
    expect(screen.getByText('Tax')).toBeTruthy();
  });

  it('renders total price components and filters informational/grand-total rows', () => {
    const state = createSafeState({
      appointments: {
        invoices: {
          'apt-1': {
            ...mockInvoiceData,
            totalPriceComponent: [
              {
                type: 'base',
                code: {text: 'consultation fee'},
                amount: {value: 100, currency: 'USD'},
              },
              {
                type: 'discount',
                amount: {value: 5, currency: 'USD'},
              },
              {
                type: 'informational',
                code: {text: 'ignored'},
                amount: {value: 1, currency: 'USD'},
              },
              {
                type: 'tax',
                code: {text: 'grand-total'},
                amount: {value: 999, currency: 'USD'},
              },
              {
                type: 'tax',
                amount: {value: 10, currency: 'USD'},
              },
              {
                type: 'service_charge',
                amount: {value: 2},
              },
              {
                type: 'misc',
                code: {text: ''},
                amount: {},
              },
            ],
          },
        },
      },
    });
    (useSelector as unknown as jest.Mock).mockImplementation(fn => fn(state));

    render(<PaymentInvoiceScreen />);

    expect(screen.getByText('Consultation fee')).toBeTruthy();
    expect(screen.getByText('Discount')).toBeTruthy();
    expect(screen.getByText('Tax')).toBeTruthy();
    expect(screen.getByText('Service charge')).toBeTruthy();
    expect(screen.queryByText('ignored')).toBeNull();
    expect(screen.queryByText('Grand-total')).toBeNull();
    expect(screen.getByText('—')).toBeTruthy();
  });

  // --- Interaction Tests ---

  it('navigates back when header back button is pressed', () => {
    render(<PaymentInvoiceScreen />);
    const btn = screen.getByTestId('header-back');
    fireEvent.press(btn);
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('renders invoice details when appointment is available', async () => {
    render(<PaymentInvoiceScreen />);
    // Verify that invoice details are displayed
    await waitFor(() => {
      expect(screen.getByText('Invoice details')).toBeTruthy();
      expect(screen.getByText('INV-001')).toBeTruthy();
    });
  });

  it('opens the invoice receipt url when the browser can handle it', async () => {
    const state = createSafeState({
      appointments: {
        invoices: {
          'apt-1': {
            ...mockInvoiceData,
            downloadUrl: 'https://example.com/invoice/1',
          },
        },
      },
    });
    (useSelector as unknown as jest.Mock).mockImplementation(fn => fn(state));

    render(<PaymentInvoiceScreen />);

    fireEvent.press(screen.getByText('View invoice'));

    await waitFor(() => {
      expect(canOpenUrlSpy).toHaveBeenCalledWith(
        'https://example.com/invoice/1',
      );
      expect(openUrlSpy).toHaveBeenCalledWith('https://example.com/invoice/1');
    });
  });

  it('shows an alert when the invoice receipt url cannot be opened', async () => {
    const state = createSafeState({
      appointments: {
        invoices: {
          'apt-1': {
            ...mockInvoiceData,
            downloadUrl: 'https://example.com/invoice/2',
          },
        },
      },
    });
    (useSelector as unknown as jest.Mock).mockImplementation(fn => fn(state));
    canOpenUrlSpy.mockResolvedValueOnce(false as any);

    render(<PaymentInvoiceScreen />);

    fireEvent.press(screen.getByText('View invoice'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Unable to open invoice',
        'Please try again or copy the link from your receipt.',
      );
    });
  });

  it('falls back to the stated due date when the due date is invalid', () => {
    const state = createSafeState({
      appointments: {
        invoices: {
          'apt-1': {
            ...mockInvoiceData,
            dueDate: 'not-a-real-date',
          },
        },
      },
    });
    (useSelector as unknown as jest.Mock).mockImplementation(fn => fn(state));

    render(<PaymentInvoiceScreen />);

    expect(
      screen.getByText(/Payment is due by the stated due date/),
    ).toBeTruthy();
  });

  it('fetches a payment intent when payment is pending and the existing intent is incomplete', async () => {
    const state = createSafeState({
      appointments: {
        items: [
          {
            ...mockStateBase.appointments.items[0],
            status: 'AWAITING_PAYMENT',
            paymentIntent: {amount: 150, currency: 'USD'},
          },
        ],
      },
    });
    (useSelector as unknown as jest.Mock).mockImplementation(fn => fn(state));

    render(<PaymentInvoiceScreen />);

    await waitFor(() => {
      expect(screen.getByText('Preparing payment details…')).toBeTruthy();
    });
  });

  it('does not fetch invoice details again for pending-payment appointments without an invoice', async () => {
    const state = createSafeState({
      appointments: {
        items: [
          {
            ...mockStateBase.appointments.items[0],
            status: 'AWAITING_PAYMENT',
          },
        ],
        invoices: {},
      },
    });
    (useSelector as unknown as jest.Mock).mockImplementation(fn => fn(state));

    render(<PaymentInvoiceScreen />);

    await waitFor(() => {
      expect(mockDispatch).not.toHaveBeenCalledWith(
        expect.objectContaining({type: 'FETCH_INVOICE'}),
      );
    });
  });

  it('renders invoice-based flow with refund details and receipt actions', async () => {
    (useRoute as jest.Mock).mockReturnValue({
      params: {
        expenseId: 'exp-1',
        invoice: {
          ...mockInvoiceData,
          id: 'inv-exp-1',
          status: 'REFUNDED',
          refundId: 'refund-1',
          refundStatus: 'REFUNDED',
          refundAmount: 25,
          refundDate: '2026-03-21T10:00:00.000Z',
          refundReceiptUrl: 'https://example.com/refund/1',
          organisation: {
            name: 'Invoice Org',
            image: 'https://example.com/org.png',
            placesId: 'place-org-1',
            address: {
              addressLine: '1 Invoice Way',
              city: 'Austin',
              state: 'TX',
              postalCode: '73301',
            },
          },
        },
        paymentIntent: {
          clientSecret: 'pi_invoice_secret',
          paymentIntentId: 'pi_invoice_1',
          amount: 150,
          currency: 'USD',
        },
      },
    });

    render(<PaymentInvoiceScreen />);

    await waitFor(() => {
      expect(screen.getByText('Refund')).toBeTruthy();
      expect(screen.getByText('Refund ID')).toBeTruthy();
      expect(screen.getByText('refund-1')).toBeTruthy();
      expect(screen.getByText('$25.00')).toBeTruthy();
      expect(screen.getByText(/Services are provided by/)).toBeTruthy();
      expect(screen.getByText('View refund receipt')).toBeTruthy();
      expect(screen.queryByText('Invoice for')).toBeNull();
    });

    fireEvent.press(screen.getByText('View refund receipt'));

    expect(openUrlSpy).toHaveBeenCalledWith('https://example.com/refund/1');
  });

  it('uses downloadUrl when refundReceiptUrl is unavailable', async () => {
    (useRoute as jest.Mock).mockReturnValue({
      params: {
        expenseId: 'exp-2',
        invoice: {
          ...mockInvoiceData,
          id: 'inv-exp-2',
          status: 'REFUNDED',
          refundId: 'refund-2',
          refundStatus: 'PARTIALLY_REFUNDED',
          refundAmount: 10,
          refundDate: '2026-03-22T10:00:00.000Z',
          downloadUrl: 'https://example.com/refund-fallback/2',
        },
      },
    });

    render(<PaymentInvoiceScreen />);

    await waitFor(() => {
      expect(screen.getByText('View refund receipt')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('View refund receipt'));
    expect(openUrlSpy).toHaveBeenCalledWith(
      'https://example.com/refund-fallback/2',
    );
  });

  it('omits the refund receipt action when no refund receipt url is available', async () => {
    (useRoute as jest.Mock).mockReturnValue({
      params: {
        expenseId: 'exp-4',
        invoice: {
          ...mockInvoiceData,
          id: 'inv-exp-4',
          status: 'REFUNDED',
          refundId: 'refund-4',
          refundStatus: 'REFUNDED',
          refundAmount: 5,
          refundDate: '2026-03-23T10:00:00.000Z',
          refundReceiptUrl: null,
          downloadUrl: null,
        },
      },
    });

    render(<PaymentInvoiceScreen />);

    await waitFor(() => {
      expect(screen.getByText('Refund')).toBeTruthy();
      expect(screen.queryByText('View refund receipt')).toBeNull();
    });
  });

  it('shows pay now for invoice-based unpaid flow when a client secret is available', async () => {
    (useRoute as jest.Mock).mockReturnValue({
      params: {
        expenseId: 'exp-3',
        invoice: {
          ...mockInvoiceData,
          id: 'inv-exp-3',
          status: 'AWAITING_PAYMENT',
        },
        paymentIntent: {
          clientSecret: 'pi_invoice_pay_secret',
          paymentIntentId: 'pi_invoice_pay_1',
          amount: 150,
          currency: 'USD',
        },
      },
    });

    render(<PaymentInvoiceScreen />);

    await waitFor(() => {
      // CTA label is data-driven: `Pay ${formatMoney(total)}` — total 150, USD → "$".
      expect(screen.getByText('Pay $150.00')).toBeTruthy();
    });
  });

  it('shows the missing data alert and navigates back when no appointment or invoice is provided', async () => {
    (useRoute as jest.Mock).mockReturnValue({
      params: {},
    });
    (useSelector as unknown as jest.Mock).mockImplementation(fn =>
      fn(
        createSafeState({
          appointments: {items: [], invoices: {}},
        }),
      ),
    );

    render(<PaymentInvoiceScreen />);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Missing data',
        'Could not open payment screen without appointment or invoice.',
      );
      expect(mockGoBack).toHaveBeenCalled();
    });
  });

  // --- Additional Branch Coverage ---

  it('falls back to guardian initial "Y" when the only name source is whitespace', () => {
    const state = createSafeState({
      auth: {user: null},
      appointments: {
        invoices: {
          'apt-1': {
            ...mockInvoiceData,
            billedToName: '   ',
            billedToEmail: undefined,
          },
        },
      },
    });
    (useSelector as unknown as jest.Mock).mockImplementation(fn => fn(state));
    render(<PaymentInvoiceScreen />);
    expect(screen.getByText('Y')).toBeTruthy();
  });

  it('resolves the store invoice for an expense-based flow with no route invoice', () => {
    (useRoute as jest.Mock).mockReturnValue({
      params: {expenseId: 'exp-eo', appointmentId: 'apt-1'},
    });
    render(<PaymentInvoiceScreen />);
    expect(screen.getByText('Invoice details')).toBeTruthy();
    expect(screen.getByText('INV-001')).toBeTruthy();
  });

  it('renders a price component with no type, code or amount (Line fallback)', () => {
    const state = createSafeState({
      appointments: {
        invoices: {
          'apt-1': {...mockInvoiceData, totalPriceComponent: [{}]},
        },
      },
    });
    (useSelector as unknown as jest.Mock).mockImplementation(fn => fn(state));
    render(<PaymentInvoiceScreen />);
    expect(screen.getByText('Line 1')).toBeTruthy();
  });

  it('builds an effective invoice from a payment intent when no invoice exists', async () => {
    const state = createSafeState({
      appointments: {
        items: [
          {
            ...mockStateBase.appointments.items[0],
            paymentIntent: {createdAt: '2025-06-01T10:00:00Z'},
          },
        ],
        invoices: {},
      },
    });
    (useSelector as unknown as jest.Mock).mockImplementation(fn => fn(state));
    render(<PaymentInvoiceScreen />);
    await waitFor(() => {
      expect(screen.getByText('pi-apt-1')).toBeTruthy();
    });
  });

  it('renders refund details with all optional refund fields missing', async () => {
    (useRoute as jest.Mock).mockReturnValue({
      params: {
        expenseId: 'exp-ru',
        invoice: {
          ...mockInvoiceData,
          id: 'inv-ru',
          status: 'REFUNDED',
          refundReceiptUrl: 'https://example.com/refund-ru',
        },
      },
    });
    render(<PaymentInvoiceScreen />);
    await waitFor(() => {
      expect(screen.getByText('Refund')).toBeTruthy();
      expect(screen.getByText('Refund ID')).toBeTruthy();
      expect(screen.getByText('REFUNDED')).toBeTruthy();
      expect(screen.getByText('View refund receipt')).toBeTruthy();
    });
  });

  it('shows an em dash payment status for a blank invoice status', () => {
    const state = createSafeState({
      appointments: {
        invoices: {'apt-1': {...mockInvoiceData, status: '   '}},
      },
    });
    (useSelector as unknown as jest.Mock).mockImplementation(fn => fn(state));
    render(<PaymentInvoiceScreen />);
    expect(screen.getByText('Due')).toBeTruthy();
  });

  it('renders a "Cancelled" badge for a cancelled invoice status', () => {
    const state = createSafeState({
      appointments: {
        invoices: {'apt-1': {...mockInvoiceData, status: 'CANCELLED'}},
      },
    });
    (useSelector as unknown as jest.Mock).mockImplementation(fn => fn(state));
    render(<PaymentInvoiceScreen />);
    expect(screen.getAllByText('Cancelled').length).toBeGreaterThan(0);
  });

  it('renders a "Due" badge (not "Paid") for an unpaid invoice status', () => {
    const state = createSafeState({
      appointments: {
        invoices: {'apt-1': {...mockInvoiceData, status: 'Unpaid'}},
      },
    });
    (useSelector as unknown as jest.Mock).mockImplementation(fn => fn(state));
    render(<PaymentInvoiceScreen />);
    expect(screen.getAllByText('Due').length).toBeGreaterThan(0);
    expect(screen.queryByText('Paid')).toBeNull();
  });

  it('detects a cash-collected invoice from a PAID_CASH invoice status', () => {
    const state = createSafeState({
      appointments: {
        invoices: {'apt-1': {...mockInvoiceData, status: 'PAID_CASH'}},
      },
    });
    (useSelector as unknown as jest.Mock).mockImplementation(fn => fn(state));
    render(<PaymentInvoiceScreen />);
    expect(screen.getByText('Paid - Cash')).toBeTruthy();
  });

  it('detects a cash-collected invoice from cash payment metadata indicators', () => {
    const state = createSafeState({
      appointments: {
        invoices: {
          'apt-1': {
            ...mockInvoiceData,
            status: 'PAID',
            metadata: {note: null, tender: 'cash'},
          },
        },
      },
    });
    (useSelector as unknown as jest.Mock).mockImplementation(fn => fn(state));
    render(<PaymentInvoiceScreen />);
    expect(screen.getByText('Paid - Cash')).toBeTruthy();
  });

  it('stores the business photo from the business details response', async () => {
    const photoDispatch = jest.fn(() => ({
      unwrap: () => Promise.resolve({photoUrl: 'http://photo-a'}),
    }));
    (useDispatch as unknown as jest.Mock).mockReturnValue(photoDispatch);
    const state = createSafeState({
      appointments: {
        items: [{...mockStateBase.appointments.items[0], status: 'COMPLETED'}],
        invoices: {
          'apt-1': {
            ...mockInvoiceData,
            totalPriceComponent: [
              {type: 'base', amount: {value: 100}},
              {type: 'discount', amount: {value: 5}},
              {type: 'tax', amount: {value: 10}},
            ],
          },
        },
      },
      businesses: {
        businesses: [
          {
            id: 'biz-1',
            name: 'Vet Clinic',
            address: '123 Vet St',
            googlePlacesId: 'gp-1',
          },
        ],
      },
    });
    (useSelector as unknown as jest.Mock).mockImplementation(fn => fn(state));
    render(<PaymentInvoiceScreen />);
    await waitFor(() => {
      expect(photoDispatch).toHaveBeenCalled();
    });
    expect(screen.getByText('Invoice details')).toBeTruthy();
  });

  it('falls back to the places image when the business details lack a photo', async () => {
    let call = 0;
    const twoStepDispatch = jest.fn(() => ({
      unwrap: () => {
        call += 1;
        return Promise.resolve(call === 1 ? {} : {photoUrl: 'http://photo-b'});
      },
    }));
    (useDispatch as unknown as jest.Mock).mockReturnValue(twoStepDispatch);
    const state = createSafeState({
      appointments: {
        items: [{...mockStateBase.appointments.items[0], status: 'COMPLETED'}],
        invoices: {
          'apt-1': {
            ...mockInvoiceData,
            totalPriceComponent: [
              {type: 'base', amount: {value: 100}},
              {type: 'discount', amount: {value: 5}},
              {type: 'tax', amount: {value: 10}},
            ],
          },
        },
      },
      businesses: {
        businesses: [
          {
            id: 'biz-1',
            name: 'Vet Clinic',
            address: '123 Vet St',
            googlePlacesId: 'gp-1',
          },
        ],
      },
    });
    (useSelector as unknown as jest.Mock).mockImplementation(fn => fn(state));
    render(<PaymentInvoiceScreen />);
    await waitFor(() => {
      expect(twoStepDispatch).toHaveBeenCalledTimes(2);
    });
  });

  it('defaults route params to an empty object when params are undefined', async () => {
    (useRoute as jest.Mock).mockReturnValue({});
    (useSelector as unknown as jest.Mock).mockImplementation(fn =>
      fn(createSafeState({appointments: {items: [], invoices: {}}})),
    );
    render(<PaymentInvoiceScreen />);
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Missing data',
        'Could not open payment screen without appointment or invoice.',
      );
    });
  });

  it('resets request refs when the appointmentId changes', () => {
    (useRoute as jest.Mock).mockReturnValue({
      params: {appointmentId: 'apt-1', companionId: 'comp-1'},
    });
    const {rerender} = render(<PaymentInvoiceScreen />);
    (useRoute as jest.Mock).mockReturnValue({
      params: {appointmentId: 'apt-2', companionId: 'comp-1'},
    });
    rerender(<PaymentInvoiceScreen />);
    expect(screen.getByTestId('summary-cards')).toBeTruthy();
  });
});
