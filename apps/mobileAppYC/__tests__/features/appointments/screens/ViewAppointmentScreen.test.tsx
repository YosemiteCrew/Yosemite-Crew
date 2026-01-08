import React from 'react';
import {
  render,
  fireEvent,
  screen,
  act,
  waitFor,
} from '@testing-library/react-native';
import {Provider} from 'react-redux';
import {configureStore} from '@reduxjs/toolkit';
import {Alert} from 'react-native';

// --- Relative Imports ---
import ViewAppointmentScreen from '../../../../src/features/appointments/screens/ViewAppointmentScreen';
import * as AppointmentSlice from '../../../../src/features/appointments/appointmentsSlice';
import * as LinkedBusinessSlice from '../../../../src/features/linkedBusinesses';
import LocationService from '../../../../src/shared/services/LocationService';
import * as GeoDistance from '../../../../src/shared/utils/geoDistance';
import {useRoute} from '@react-navigation/native';
import * as ExpensePaymentHook from '../../../../src/features/expenses/hooks/useExpensePayment';
import {mockTheme} from '../../../setup/mockTheme';

// --- Helper: Deep Clone (Lint compliant & Type Safe) ---
const clone = <T,>(obj: T): T => {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(obj);
  }
  return structuredClone(obj);
};

// --- Mocks ---

// 1. Navigation
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockGetParent = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native');
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: mockNavigate,
      goBack: mockGoBack,
      getParent: mockGetParent,
    }),
    useRoute: jest.fn(),
    useFocusEffect: (cb: any) => cb(),
  };
});

// 2. Redux Dispatch & Unwrap
const mockUnwrap = jest.fn();
const mockDispatch = jest.fn();

jest.mock('react-redux', () => {
  const actualReactRedux = jest.requireActual('react-redux');
  return {
    ...actualReactRedux,
    useDispatch: () => mockDispatch,
  };
});

// 3. Location Service
jest.mock('../../../../src/shared/services/LocationService', () => ({
  __esModule: true,
  default: {
    getLocationWithRetry: jest.fn(),
  },
}));

// 4. Geo Utils
jest.mock('../../../../src/shared/utils/geoDistance', () => ({
  distanceBetweenCoordsMeters: jest.fn(),
}));

// 5. Hooks
jest.mock('../../../../src/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

// 6. Components
jest.mock('../../../../src/shared/components/common', () => {
  const {View} = require('react-native');
  return {
    SafeArea: ({children}: any) => <View>{children}</View>,
  };
});

jest.mock('../../../../src/shared/components/common/Header/Header', () => {
  const {View, Text, TouchableOpacity} = require('react-native');
  return {
    Header: ({title, onBack}: any) => (
      <View testID="header">
        <Text>{title}</Text>
        <TouchableOpacity testID="header-back" onPress={onBack} />
      </View>
    ),
  };
});

jest.mock(
  '../../../../src/shared/components/common/LiquidGlassButton/LiquidGlassButton',
  () => {
    const {Text, TouchableOpacity} = require('react-native');
    return {
      LiquidGlassButton: ({title, onPress, disabled}: any) => (
        <TouchableOpacity
          testID={`btn-${title}`}
          onPress={onPress}
          disabled={disabled}>
          <Text>{title}</Text>
        </TouchableOpacity>
      ),
    };
  },
);

jest.mock(
  '../../../../src/features/appointments/components/SummaryCards/SummaryCards',
  () => {
    const {View, Text} = require('react-native');
    return {
      SummaryCards: (props: any) => (
        <View testID="summary-cards">
          <Text>{props.businessSummary?.name}</Text>
          <Text>{props.serviceName}</Text>
          <Text>{props.employee?.name}</Text>
          <Text testID="emp-fallback-title">{props.employee?.title}</Text>
        </View>
      ),
    };
  },
);

jest.mock(
  '../../../../src/features/appointments/components/CancelAppointmentBottomSheet',
  () => {
    // eslint-disable-next-line @typescript-eslint/no-shadow
    const React = require('react');
    const {View, TouchableOpacity, Text} = require('react-native');
    return {
      CancelAppointmentBottomSheet: React.forwardRef((props: any, ref: any) => {
        React.useImperativeHandle(ref, () => ({
          open: jest.fn(),
          close: jest.fn(),
        }));
        return (
          <View testID="cancel-sheet">
            <TouchableOpacity onPress={props.onConfirm} testID="confirm-cancel">
              <Text>Confirm Cancel</Text>
            </TouchableOpacity>
          </View>
        );
      }),
    };
  },
);

jest.mock(
  '../../../../src/features/appointments/components/InfoBottomSheet/RescheduledInfoSheet',
  () => {
    // eslint-disable-next-line @typescript-eslint/no-shadow
    const React = require('react');
    const {View} = require('react-native');
    // @ts-ignore
    return React.forwardRef((_props: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({
        open: jest.fn(),
        close: jest.fn(),
      }));
      return <View testID="rescheduled-sheet" />;
    });
  },
);

jest.mock(
  '../../../../src/features/documents/components/DocumentAttachmentViewer',
  () => {
    const {View, Text} = require('react-native');
    return (props: any) => (
      <View testID="attachment-viewer">
        <Text>{props.documentTitle}</Text>
        {props.attachments?.map((a: any) => (
          <Text key={a.id}>{a.name}</Text>
        ))}
      </View>
    );
  },
);

jest.mock(
  '../../../../src/shared/components/common/DocumentCard/DocumentCard',
  () => {
    const {Text, TouchableOpacity} = require('react-native');
    return {
      DocumentCard: ({title, onPress}: any) => {
        return (
          <TouchableOpacity testID={`doc-${title}`} onPress={onPress}>
            <Text>{title}</Text>
          </TouchableOpacity>
        );
      },
    };
  },
);

jest.mock('../../../../src/features/expenses/components', () => {
  const {View, Text, TouchableOpacity} = require('react-native');
  return {
    ExpenseCard: ({title, onPressView, onPressPay, showPayButton}: any) => {
      return (
        <View testID={`expense-${title}`}>
          <Text>{title}</Text>
          <TouchableOpacity
            onPress={onPressView}
            testID={`view-invoice-${title}`}>
            <Text>View</Text>
          </TouchableOpacity>
          {showPayButton && (
            <TouchableOpacity
              onPress={onPressPay}
              testID={`pay-invoice-${title}`}>
              <Text>Pay</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    },
  };
});

// 7. Mock Services/Thunks
jest.mock('../../../../src/features/appointments/appointmentsSlice', () => ({
  fetchAppointmentById: jest.fn(() => ({type: 'FETCH_APT'})),
  fetchAppointmentsForCompanion: jest.fn(() => ({type: 'FETCH_COMP'})),
  cancelAppointment: jest.fn(() => ({type: 'CANCEL'})),
  checkInAppointment: jest.fn(() => ({type: 'CHECK_IN'})),
  fetchInvoiceForAppointment: jest.fn(() => ({type: 'FETCH_INVOICE'})),
}));

jest.mock('../../../../src/features/documents/documentSlice', () => ({
  fetchDocuments: jest.fn(() => ({type: 'FETCH_DOCS'})),
}));

jest.mock('../../../../src/features/linkedBusinesses', () => ({
  fetchBusinessDetails: jest.fn(() => ({type: 'BIZ_DETAILS'})),
  fetchGooglePlacesImage: jest.fn(() => ({type: 'GOOGLE_IMG'})),
}));

jest.mock('../../../../src/features/forms', () => ({
  fetchAppointmentForms: jest.fn(() => ({type: 'FETCH_FORMS'})),
  selectFormsForAppointment: jest.fn(() => []),
  selectFormsLoading: jest.fn(() => false),
  selectFormSubmitting: jest.fn(() => false),
  selectSigningStatus: jest.fn(() => false),
}));

jest.mock('../../../../src/features/tasks/thunks', () => ({
  fetchTasksForCompanion: jest.fn(() => ({type: 'FETCH_TASKS'})),
}));

// Mock Selectors Stably
const emptyArray: any[] = [];
const mockSelectExpenses = jest.fn(() => emptyArray);

jest.mock('../../../../src/features/expenses', () => ({
  fetchExpensesForCompanion: jest.fn(() => ({type: 'FETCH_EXPENSES'})),
  selectExpensesByCompanion: jest.fn(() => mockSelectExpenses),
  selectHasHydratedCompanion: jest.fn(() => () => false),
}));

jest.mock('../../../../src/features/expenses/hooks/useExpensePayment', () => ({
  useExpensePayment: jest.fn(),
}));

jest.mock('../../../../src/features/appointments/utils/photoUtils', () => ({
  isDummyPhoto: jest.fn(() => false),
}));

// --- Test Setup ---
const createTestStore = (state: any) =>
  configureStore({
    reducer: (s = state) => s,
    preloadedState: state,
  });

describe('ViewAppointmentScreen', () => {
  const mockAptId = 'apt-1';
  const mockCompanionId = 'comp-1';

  const defaultState: any = {
    appointments: {
      items: [
        {
          id: mockAptId,
          businessId: 'biz-1',
          serviceId: 'srv-1',
          companionId: mockCompanionId,
          status: 'UPCOMING',
          date: '2023-12-25',
          time: '10:00',
          type: 'General',
          uploadedFiles: [{id: 'file-1', name: 'File1.pdf'}],
          organisationName: 'Fallback Org',
          organisationAddress: 'Fallback Addr',
          employeeId: 'emp-1',
          invoiceId: null,
          employeeName: null,
          employeeTitle: null,
          businessGooglePlacesId: null,
          businessPhoto: null,
          businessLat: null,
          businessLng: null,
        },
      ],
    },
    businesses: {
      businesses: [
        {
          id: 'biz-1',
          name: 'Test Vet',
          address: '123 Test St',
          lat: 10,
          lng: 10,
          googlePlacesId: 'gp-1',
          photo: 'http://biz.jpg',
        },
      ],
      services: [{id: 'srv-1', name: 'Checkup', specialty: 'Vet'}],
      employees: [{id: 'emp-1', name: 'Dr. Smith'}],
    },
    companion: {
      companions: [{id: mockCompanionId, name: 'Buddy'}],
    },
    documents: {
      documents: [
        {id: 'doc-1', title: 'Vaccine Record', appointmentId: mockAptId},
      ],
    },
    expenses: {
      expenses: [],
    },
    tasks: {
      items: [],
      hydratedCompanions: {},
    },
    forms: {
      byAppointmentId: {},
      loadingByAppointment: {},
      submittingByForm: {},
      signingBySubmission: {},
      error: null,
      formsCache: {},
    },
  };

  const mockOpenPayment = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert');
    (useRoute as jest.Mock).mockReturnValue({
      params: {appointmentId: mockAptId},
    });
    (mockGetParent as jest.Mock).mockReturnValue({navigate: mockNavigate});

    // Reset Selector
    mockSelectExpenses.mockReturnValue(emptyArray);

    // Hooks
    (ExpensePaymentHook.useExpensePayment as jest.Mock).mockReturnValue({
      openPaymentScreen: mockOpenPayment,
      processingPayment: false,
    });

    // Reset unwrap to success by default
    mockUnwrap.mockResolvedValue({photoUrl: 'http://photo.com'});
    mockDispatch.mockReturnValue({unwrap: mockUnwrap});
  });

  const renderScreen = (customState = defaultState) =>
    render(
      <Provider store={createTestStore(customState)}>
        <ViewAppointmentScreen />
      </Provider>,
    );

  // --- Rendering Tests ---

  describe('Rendering Logic', () => {
    it('renders full appointment details', () => {
      renderScreen();
      expect(screen.getAllByText('Appointment Details')).toHaveLength(2);
      expect(screen.getAllByText('Test Vet').length).toBeGreaterThan(0);
      expect(screen.getByText('Checkup')).toBeTruthy();
      expect(screen.getByText('Upcoming')).toBeTruthy();
      expect(screen.getByText('Vaccine Record')).toBeTruthy();
      expect(screen.getByText('File1.pdf')).toBeTruthy();
      expect(screen.getByText('123 Test St')).toBeTruthy();
    });

    it('displays fallback business info if business entity is missing', () => {
      const state = clone(defaultState);
      state.businesses.businesses = [];
      renderScreen(state);
      expect(screen.getAllByText('Fallback Org').length).toBeGreaterThan(0);
      expect(screen.getByText('Fallback Addr')).toBeTruthy();
    });

    it('renders cancellation note if cancelled', () => {
      const state = clone(defaultState);
      state.appointments.items[0].status = 'CANCELLED';
      renderScreen(state);
      expect(screen.getByText(/This appointment was cancelled/)).toBeTruthy();
    });

    it('renders status help text for pending requests', () => {
      const state = clone(defaultState);
      state.appointments.items[0].status = 'REQUESTED';
      state.appointments.items[0].employeeId = null;
      state.businesses.employees = [];
      renderScreen(state);
      expect(screen.getByText(/Your request is pending review/)).toBeTruthy();
    });

    it('handles various date formats (invalid date)', () => {
      const state = clone(defaultState);
      state.appointments.items[0].date = 'Invalid Date String';
      state.appointments.items[0].time = 'Bad Time';
      renderScreen(state);
      expect(screen.getByText(/Invalid Date String/)).toBeTruthy();
    });
  });

  // --- Status Variations (Branch Coverage) ---

  describe('Status Display', () => {
    const statuses = [
      {status: 'UPCOMING', text: 'Upcoming'},
      {status: 'CHECKED_IN', text: 'Checked in'},
      {status: 'IN_PROGRESS', text: 'In progress'},
      {status: 'REQUESTED', text: 'Requested'},
      {status: 'NO_PAYMENT', text: 'Payment pending'},
      {status: 'AWAITING_PAYMENT', text: 'Payment pending'},
      {status: 'PAYMENT_FAILED', text: 'Payment failed'},
      {status: 'PAID', text: 'Paid'},
      {status: 'CONFIRMED', text: 'Scheduled'},
      {status: 'SCHEDULED', text: 'Scheduled'},
      {status: 'COMPLETED', text: 'Completed'},
      {status: 'CANCELLED', text: 'Cancelled'},
      {status: 'RESCHEDULED', text: 'Rescheduled'},
      {status: 'UNKNOWN_STATUS', text: 'UNKNOWN_STATUS'},
    ];

    for (const {status, text} of statuses) {
      it(`renders correct text for status: ${status}`, () => {
        const state = clone(defaultState);
        state.appointments.items[0].status = status;
        render(
          <Provider store={createTestStore(state)}>
            <ViewAppointmentScreen />
          </Provider>,
        );
        expect(screen.getAllByText(text).length).toBeGreaterThan(0);
      });
    }
  });

  // --- Interactions ---

  describe('Interactions', () => {
    it('navigates back on header press', () => {
      renderScreen();
      fireEvent.press(screen.getByTestId('header-back'));
      expect(mockGoBack).toHaveBeenCalled();
    });

    it('opens document on press', () => {
      renderScreen();
      fireEvent.press(screen.getByTestId('doc-Vaccine Record'));
      expect(mockNavigate).toHaveBeenCalledWith(
        'Documents',
        expect.objectContaining({
          screen: 'DocumentPreview',
          params: {documentId: 'doc-1'},
        }),
      );
    });

    it('navigates to Edit Appointment', () => {
      const state = clone(defaultState);
      state.appointments.items[0].status = 'REQUESTED';
      renderScreen(state);

      fireEvent.press(screen.getByTestId('btn-Edit Appointment'));
      expect(mockNavigate).toHaveBeenCalledWith('EditAppointment', {
        appointmentId: mockAptId,
      });
    });
  });

  // --- Check-In Flow ---

  describe('Check-In Flow', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2023-12-25T09:56:00Z'));
      // Fix: Access the mock directly on the imported object (which is the default export)
      (LocationService.getLocationWithRetry as jest.Mock).mockResolvedValue({
        latitude: 10,
        longitude: 10,
      });
      (GeoDistance.distanceBetweenCoordsMeters as jest.Mock).mockReturnValue(
        50,
      );
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('successfully checks in', async () => {
      renderScreen();
      const checkInBtn = screen.getByTestId('btn-Check in');
      await act(async () => {
        fireEvent.press(checkInBtn);
      });
      expect(mockDispatch).toHaveBeenCalled();
      expect(AppointmentSlice.checkInAppointment).toHaveBeenCalled();
    });

    it('fails check in: Too Early', async () => {
      jest.setSystemTime(new Date('2023-12-25T09:00:00Z'));
      renderScreen();
      fireEvent.press(screen.getByTestId('btn-Check in'));
      expect(Alert.alert).toHaveBeenCalledWith(
        'Too early to check in',
        expect.anything(),
      );
    });

    it('fails check in: Missing Business Location', async () => {
      const state = clone(defaultState);
      state.businesses.businesses[0].lat = null;
      renderScreen(state);
      fireEvent.press(screen.getByTestId('btn-Check in'));
      expect(Alert.alert).toHaveBeenCalledWith(
        'Location unavailable',
        expect.stringContaining('Clinic location'),
      );
    });

    it('fails check in: User Location Failed', async () => {
      (LocationService.getLocationWithRetry as jest.Mock).mockResolvedValue(
        null,
      );
      renderScreen();
      await act(async () => {
        fireEvent.press(screen.getByTestId('btn-Check in'));
      });
      expect(AppointmentSlice.checkInAppointment).not.toHaveBeenCalled();
    });

    it('fails check in: Distance Calculation Error', async () => {
      (GeoDistance.distanceBetweenCoordsMeters as jest.Mock).mockReturnValue(
        null,
      );
      renderScreen();
      await act(async () => {
        fireEvent.press(screen.getByTestId('btn-Check in'));
      });
      expect(Alert.alert).toHaveBeenCalledWith(
        'Location unavailable',
        expect.stringContaining('Unable to determine distance'),
      );
    });

    it('fails check in: Too Far', async () => {
      (GeoDistance.distanceBetweenCoordsMeters as jest.Mock).mockReturnValue(
        500,
      );
      renderScreen();
      await act(async () => {
        fireEvent.press(screen.getByTestId('btn-Check in'));
      });
      expect(Alert.alert).toHaveBeenCalledWith(
        'Too far to check in',
        expect.anything(),
      );
    });

    it('handles Check In API failure', async () => {
      mockUnwrap.mockRejectedValueOnce(new Error('Network'));

      renderScreen();
      await act(async () => {
        fireEvent.press(screen.getByTestId('btn-Check in'));
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Check-in failed',
          expect.anything(),
        );
      });
    });
  });

  // --- Payment & Invoices ---

  describe('Payment & Invoices', () => {
    const invoiceState = clone(defaultState);
    const mockExpense1 = {
      id: 'exp-1',
      title: 'Consultation',
      amount: 50,
      appointmentId: mockAptId,
      invoiceId: 'inv-1',
      source: 'inApp',
      status: 'PENDING',
      category: 'Medical',
    };
    const mockExpense2 = {
      id: 'exp-2',
      title: 'Labs',
      amount: 20,
      appointmentId: mockAptId,
      invoiceId: 'inv-2',
      source: 'inApp',
      status: 'PENDING',
    };

    it('renders multiple invoices list when > 1 invoice', () => {
      mockSelectExpenses.mockReturnValue([mockExpense1, mockExpense2]);
      render(
        <Provider store={createTestStore(invoiceState)}>
          <ViewAppointmentScreen />
        </Provider>,
      );
      expect(screen.getByTestId('expense-Consultation')).toBeTruthy();
      expect(screen.getByTestId('expense-Labs')).toBeTruthy();
    });

    it('deduplicates invoices in useAppointmentInvoicesData', () => {
      const duplicateState = [
        mockExpense1,
        {...mockExpense1, id: 'exp-1-duplicate'},
      ];
      mockSelectExpenses.mockReturnValue(duplicateState);

      const state = clone(invoiceState);
      state.appointments.items[0].status = 'AWAITING_PAYMENT';
      state.appointments.items[0].invoiceId = 'inv-1';

      render(
        <Provider store={createTestStore(state)}>
          <ViewAppointmentScreen />
        </Provider>,
      );
      // Dedupe logic works: 1 invoice -> list hidden, Pay Now button shown
      expect(screen.queryByTestId('expense-Consultation')).toBeNull();
      expect(screen.getByTestId('btn-Pay Now')).toBeTruthy();
    });

    it('shows Pay Now BUTTON (Main) when exactly 1 invoice and pending', () => {
      mockSelectExpenses.mockReturnValue([mockExpense1]);

      const state = clone(invoiceState);
      state.appointments.items[0].status = 'AWAITING_PAYMENT';
      state.appointments.items[0].invoiceId = 'inv-1';

      render(
        <Provider store={createTestStore(state)}>
          <ViewAppointmentScreen />
        </Provider>,
      );
      expect(screen.getByTestId('btn-Pay Now')).toBeTruthy();
      expect(screen.queryByTestId('expense-Consultation')).toBeNull();
    });

    it('handles Pay Now main button press', () => {
      mockSelectExpenses.mockReturnValue([mockExpense1]);

      const state = clone(invoiceState);
      state.appointments.items[0].status = 'AWAITING_PAYMENT';

      render(
        <Provider store={createTestStore(state)}>
          <ViewAppointmentScreen />
        </Provider>,
      );
      fireEvent.press(screen.getByTestId('btn-Pay Now'));
      expect(mockNavigate).toHaveBeenCalledWith(
        'PaymentInvoice',
        expect.anything(),
      );
    });

    it('handles Invoice Fetch error gracefully', async () => {
      mockUnwrap.mockRejectedValueOnce(new Error('Fail'));

      const state = clone(invoiceState);
      state.appointments.items[0].status = 'PAID';

      mockSelectExpenses.mockReturnValue([mockExpense1]);

      render(
        <Provider store={createTestStore(state)}>
          <ViewAppointmentScreen />
        </Provider>,
      );

      await act(async () => {
        fireEvent.press(screen.getByTestId('btn-View Invoice'));
      });
      // Even if fetch fails, navigation should attempt (or app handles gracefully)
      expect(mockNavigate).toHaveBeenCalled();
    });

    it('handles paying specific invoice from list', () => {
      mockSelectExpenses.mockReturnValue([mockExpense1, mockExpense2]);

      render(
        <Provider store={createTestStore(invoiceState)}>
          <ViewAppointmentScreen />
        </Provider>,
      );

      fireEvent.press(screen.getByTestId('pay-invoice-Consultation'));
      expect(mockOpenPayment).toHaveBeenCalledWith(mockExpense1);
    });
  });

  // --- Cancellation & Employee ---

  describe('Cancellation', () => {
    it('successfully cancels', async () => {
      renderScreen();
      fireEvent.press(screen.getByTestId('btn-Cancel Appointment'));

      await act(async () => {
        fireEvent.press(screen.getByTestId('confirm-cancel'));
      });

      expect(mockDispatch).toHaveBeenCalled();

      await waitFor(() => {
        expect(mockGoBack).toHaveBeenCalled();
      });
    });

    it('handles Cancellation error', async () => {
      mockUnwrap.mockRejectedValueOnce(new Error('Cancel Fail'));
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      renderScreen();
      fireEvent.press(screen.getByTestId('btn-Cancel Appointment'));
      await act(async () => {
        fireEvent.press(screen.getByTestId('confirm-cancel'));
      });

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Cancel failed'),
          expect.anything(),
        );
      });
      consoleSpy.mockRestore();
    });
  });

  describe('Employee Display Logic', () => {
    it('shows fallback employee info if employee entity missing but fields exist', () => {
      const state = clone(defaultState);
      state.businesses.employees = [];
      state.appointments.items[0].employeeName = 'Dr. Fallback';
      state.appointments.items[0].employeeTitle = 'Vet';

      renderScreen(state);
      expect(screen.getByTestId('emp-fallback-title')).toHaveTextContent('Vet');
    });

    it('hides employee if payment is pending (privacy/logic)', () => {
      const state = clone(defaultState);
      state.appointments.items[0].status = 'AWAITING_PAYMENT';
      renderScreen(state);
      expect(screen.queryByText('Dr. Smith')).toBeNull();
    });
  });

  describe('Photo Fetching', () => {
    it('fetches business photo if missing', async () => {
      const state = clone(defaultState);
      state.businesses.businesses[0].photo = null;
      render(
        <Provider store={createTestStore(state)}>
          <ViewAppointmentScreen />
        </Provider>,
      );

      await waitFor(() => {
        expect(LinkedBusinessSlice.fetchBusinessDetails).toHaveBeenCalled();
      });
    });

    it('handles secondary photo fetch if primary fails', async () => {
      mockUnwrap
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValueOnce({photoUrl: 'google.jpg'});

      const state = clone(defaultState);
      state.businesses.businesses[0].photo = null;

      render(
        <Provider store={createTestStore(state)}>
          <ViewAppointmentScreen />
        </Provider>,
      );

      await waitFor(() => {
        expect(LinkedBusinessSlice.fetchGooglePlacesImage).toHaveBeenCalled();
      });
    });
  });
});
