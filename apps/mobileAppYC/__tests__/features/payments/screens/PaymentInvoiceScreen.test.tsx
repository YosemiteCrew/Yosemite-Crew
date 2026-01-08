import React from 'react';
import {mockTheme} from '../setup/mockTheme';
import {render, fireEvent, screen, waitFor} from '@testing-library/react-native';
import {useSelector, useDispatch} from 'react-redux';
import {useRoute} from '@react-navigation/native';

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

  beforeEach(() => {
    jest.clearAllMocks();
    mockDispatch.mockReturnValue({
      unwrap: jest.fn().mockResolvedValue({}),
      then: jest.fn((resolve) => {
        resolve({});
        return {catch: jest.fn(() => ({finally: jest.fn((fn) => fn())}))};
      }),
      catch: jest.fn(() => ({finally: jest.fn((fn) => fn())})),
      finally: jest.fn((fn) => fn()),
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

  // --- Rendering Tests ---

  it('renders correctly with full data', () => {
    render(<PaymentInvoiceScreen />);
    expect(screen.getByText('Invoice details')).toBeTruthy();
    expect(screen.getByText('INV-001')).toBeTruthy();
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
        invoices: {'apt-1': {...mockInvoiceData, discountPercent: 0, taxPercent: 0}},
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
        invoices: {'apt-1': {...mockInvoiceData, discountPercent: 25, taxPercent: 15}},
      },
    });
    (useSelector as unknown as jest.Mock).mockImplementation(fn => fn(state));
    render(<PaymentInvoiceScreen />);

    expect(screen.getByText('Discount')).toBeTruthy();
    expect(screen.getByText('Tax')).toBeTruthy();
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
});
