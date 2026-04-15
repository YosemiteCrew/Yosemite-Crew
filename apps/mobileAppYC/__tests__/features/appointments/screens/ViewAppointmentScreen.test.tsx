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
import {Alert, ActivityIndicator} from 'react-native';

// --- Relative Imports ---
import ViewAppointmentScreen, {
  buildEmployeeDisplay,
  formatAppointmentDateTime,
  formatAppointmentFormValue,
  getAppointmentFormAction,
  getAppointmentFormAnswerRows,
  getCancellationNote,
  normalizeAvatarUrl,
  resolveEmployeeAvatar,
  toImageSource,
} from '../../../../src/features/appointments/screens/ViewAppointmentScreen';
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
let mockMerckSearchState = {
  query: 'arthritis',
  entries: [{id: 'entry-1'}],
  language: 'en',
  hasSearched: true,
};

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

jest.mock('../../../../src/features/merck/components/MerckSearchWidget', () => {
  const {Text, TouchableOpacity} = require('react-native');
  return {
    MerckSearchWidget: ({onOpenFullSearch}: any) => (
      <TouchableOpacity
        testID="merck-widget"
        onPress={() => onOpenFullSearch?.(mockMerckSearchState)}>
        <Text>MSD Veterinary Manual</Text>
      </TouchableOpacity>
    ),
  };
});

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
          <Text testID="employee-avatar-uri">
            {props.employee?.avatar?.uri ?? props.employee?.avatar ?? ''}
          </Text>
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
  selectFormsForAppointment: jest.fn(),
  selectFormsLoading: jest.fn(),
  selectFormSubmitting: jest.fn(() => false),
  selectSigningStatus: jest.fn(() => false),
}));

jest.mock('../../../../src/features/tasks/thunks', () => ({
  fetchTasksForCompanion: jest.fn(() => ({type: 'FETCH_TASKS'})),
}));

jest.mock(
  '../../../../src/features/tasks/components/TaskCard/TaskCard',
  () => ({
    TaskCard: ({title, onPressView, companionName}: any) => {
      const {Text, TouchableOpacity} = require('react-native');
      return (
        <TouchableOpacity testID={`task-${title}`} onPress={onPressView}>
          <Text>{title}</Text>
          <Text>{companionName}</Text>
        </TouchableOpacity>
      );
    },
  }),
);

// Mock Selectors Stably
const emptyArray: any[] = [];
const mockSelectExpenses = jest.fn(() => emptyArray);
let mockAppointmentForms: any[] = [];
let mockFormsLoading = false;

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
    mockMerckSearchState = {
      query: 'arthritis',
      entries: [{id: 'entry-1'}],
      language: 'en',
      hasSearched: true,
    };
    jest.spyOn(Alert, 'alert');
    (useRoute as jest.Mock).mockReturnValue({
      params: {appointmentId: mockAptId},
    });
    (mockGetParent as jest.Mock).mockReturnValue({navigate: mockNavigate});

    // Reset Selector
    mockSelectExpenses.mockReturnValue(emptyArray);
    mockAppointmentForms = [];
    mockFormsLoading = false;
    const formsModule = jest.requireMock('../../../../src/features/forms');
    formsModule.selectFormsForAppointment.mockImplementation(
      (_state: any, _appointmentId: string) => mockAppointmentForms,
    );
    formsModule.selectFormsLoading.mockImplementation(
      (_state: any, _appointmentId: string) => mockFormsLoading,
    );

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

  describe('helper coverage', () => {
    it('normalizes avatar values safely', () => {
      expect(normalizeAvatarUrl(123)).toBeNull();
      expect(normalizeAvatarUrl('   ')).toBeNull();
      expect(normalizeAvatarUrl(' null ')).toBeNull();
      expect(normalizeAvatarUrl(' undefined ')).toBeNull();
      expect(normalizeAvatarUrl(' https://example.com/avatar.png ')).toBe(
        'https://example.com/avatar.png',
      );
    });

    it('converts image sources from strings and objects', () => {
      expect(toImageSource(null)).toBeUndefined();
      expect(toImageSource({uri: ' '})).toBeUndefined();
      expect(toImageSource({uri: 'https://example.com/object.png'})).toEqual({
        uri: 'https://example.com/object.png',
      });
      expect(toImageSource('https://example.com/string.png')).toEqual({
        uri: 'https://example.com/string.png',
      });
    });

    it('builds cancellation notes for cash, cancelled, and active appointments', () => {
      expect(getCancellationNote(false, false)).toBeNull();
      expect(getCancellationNote(true, true)).toContain('paid in cash');
      expect(getCancellationNote(true, false)).toContain('was cancelled');
    });

    it('resolves employee avatars from direct sources and fallback names', () => {
      expect(
        resolveEmployeeAvatar(
          {profileImage: {uri: 'https://example.com/direct.png'}},
          {},
          'Ignored Name',
        ),
      ).toEqual({uri: 'https://example.com/direct.png'});

      expect(
        resolveEmployeeAvatar(
          {},
          {employeeAvatar: 'https://example.com/apt.png'},
        ),
      ).toEqual({uri: 'https://example.com/apt.png'});

      expect(resolveEmployeeAvatar({}, {}, 'Fallback Name')).toEqual({
        uri: 'https://ui-avatars.com/api/?name=Fallback%20Name',
      });

      expect(resolveEmployeeAvatar({}, {}, '   ')).toBeUndefined();
    });

    it('builds employee display for fallback, existing, and hidden states', () => {
      const fallbackEmployee = buildEmployeeDisplay({
        employee: null,
        apt: {
          employeeId: 'emp-fallback',
          businessId: 'biz-1',
          employeeName: 'Dr. Fallback',
          employeeTitle: 'Vet',
        },
        department: 'General',
        statusFlags: {isUpcoming: true},
      });
      expect(fallbackEmployee).toMatchObject({
        id: 'emp-fallback',
        name: 'Dr. Fallback',
        title: 'Vet',
      });

      const existingEmployee = buildEmployeeDisplay({
        employee: {
          id: 'emp-1',
          name: 'Dr. Existing',
          specialization: 'Cardiology',
          profilePictureUrl: 'https://example.com/existing.png',
        },
        apt: {
          employeeTitle: 'Surgeon',
        },
        department: 'Emergency',
        statusFlags: {isUpcoming: true},
      });
      expect(existingEmployee).toMatchObject({
        id: 'emp-1',
        specialization: 'Surgeon',
        avatar: {uri: 'https://example.com/existing.png'},
      });

      expect(
        buildEmployeeDisplay({
          employee: {id: 'emp-2'},
          apt: {},
          department: null,
          statusFlags: {isUpcoming: false},
        }),
      ).toBeNull();
    });

    it('formats appointment date and time for valid and invalid inputs', () => {
      expect(
        formatAppointmentDateTime({
          date: '2024-02-01',
          time: '10:15',
        }).dateTimeLabel,
      ).toContain('10:15');

      expect(
        formatAppointmentDateTime({
          date: 'Invalid Date',
          time: 'Bad Time',
        }).dateTimeLabel,
      ).toBe('Invalid Date • Bad Time');

      expect(
        formatAppointmentDateTime({
          date: '2024-02-01',
          time: null,
          start: '2024-02-01T08:00:00.000Z',
        }).dateTimeLabel,
      ).toContain('Feb');
    });

    it('formats appointment form values across supported field types', () => {
      expect(
        formatAppointmentFormValue({id: 'x', type: 'text'} as any, null),
      ).toBe('—');
      expect(
        formatAppointmentFormValue(
          {id: 'date', type: 'date'} as any,
          new Date('2024-03-01T00:00:00.000Z'),
        ),
      ).toContain('2024');
      expect(
        formatAppointmentFormValue(
          {id: 'bad-date', type: 'date'} as any,
          'bad-date',
        ),
      ).toBe('—');
      expect(
        formatAppointmentFormValue({id: 'bool', type: 'boolean'} as any, false),
      ).toBe('No');
      expect(
        formatAppointmentFormValue({id: 'list', type: 'multiselect'} as any, [
          'one',
          'two',
        ]),
      ).toBe('one, two');
      expect(
        formatAppointmentFormValue(
          {id: 'empty-list', type: 'multiselect'} as any,
          [],
        ),
      ).toBe('—');
      expect(
        formatAppointmentFormValue({id: 'url', type: 'file'} as any, {
          url: 'https://example.com/form.pdf',
        }),
      ).toBe('https://example.com/form.pdf');
      expect(
        formatAppointmentFormValue({id: 'obj', type: 'text'} as any, {
          foo: 'bar',
        }),
      ).toBe('{"foo":"bar"}');
      expect(
        formatAppointmentFormValue({id: 'raw', type: 'text'} as any, 42),
      ).toBe('42');
    });

    it('resolves appointment form actions for each form state', () => {
      expect(
        getAppointmentFormAction({
          status: 'signed',
          submission: {_id: 'sub-1'},
          signingRequired: false,
        } as any),
      ).toEqual({label: 'View form', mode: 'view', allowSign: false});

      expect(
        getAppointmentFormAction({
          status: 'submitted',
          submission: {_id: 'sub-2'},
          signingRequired: true,
        } as any),
      ).toEqual({label: 'View & Sign', mode: 'view', allowSign: true});

      expect(
        getAppointmentFormAction({
          status: 'completed',
          submission: {_id: 'sub-3'},
          signingRequired: false,
        } as any),
      ).toEqual({label: 'View form', mode: 'view', allowSign: false});

      expect(
        getAppointmentFormAction({
          status: 'pending',
          submission: null,
          signingRequired: true,
        } as any),
      ).toEqual({label: 'Fill & Sign', mode: 'fill', allowSign: true});

      expect(
        getAppointmentFormAction({
          status: 'pending',
          submission: null,
          signingRequired: false,
        } as any),
      ).toEqual({label: 'Fill form', mode: 'fill', allowSign: false});
    });

    it('builds appointment form answer rows from schema and raw fallback answers', () => {
      expect(
        getAppointmentFormAnswerRows({
          submission: null,
        } as any),
      ).toEqual([]);

      expect(
        getAppointmentFormAnswerRows({
          form: {
            schema: [
              {
                id: 'group-1',
                type: 'group',
                fields: [
                  {id: 'notes', label: 'Notes', type: 'text'},
                  {id: 'missing', label: 'Missing', type: 'text'},
                ],
              },
              {id: 'flag', label: 'Flag', type: 'boolean'},
            ],
          },
          submission: {
            answers: {
              notes: 'Stable',
              missing: null,
              flag: true,
            },
          },
        } as any),
      ).toEqual([
        {id: 'notes', label: 'Notes', value: 'Stable'},
        {id: 'flag', label: 'Flag', value: 'Yes'},
      ]);

      expect(
        getAppointmentFormAnswerRows({
          form: {schema: [{id: 'bad', label: 'Bad', type: 'date'}]},
          submission: {
            answers: {
              bad: 'invalid',
              emergency_contact: 'Taylor',
              empty_answer: '',
            },
          },
        } as any),
      ).toEqual([
        {
          id: 'bad',
          label: 'Bad',
          value: 'invalid',
        },
        {
          id: 'emergency_contact',
          label: 'Emergency contact',
          value: 'Taylor',
        },
      ]);
    });
  });

  // --- Rendering Tests ---

  describe('Rendering Logic', () => {
    it('renders merck search widget in appointment flow', () => {
      renderScreen();
      expect(screen.getByTestId('merck-widget')).toBeTruthy();
    });

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

    it('renders cash-specific cancellation note for cancelled cash-paid appointments', () => {
      const state = clone(defaultState);
      state.appointments.items[0].status = 'CANCELLED';
      state.appointments.items[0].paymentStatus = 'PAID_CASH';
      renderScreen(state);
      expect(
        screen.getByText(/This appointment was paid in cash/),
      ).toBeTruthy();
      expect(
        screen.getByText(/contact the service provider directly/),
      ).toBeTruthy();
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

    it('falls back to requested status when the appointment status is missing', () => {
      const state = clone(defaultState);
      state.appointments.items[0].status = null;
      state.appointments.items[0].employeeId = null;
      state.businesses.employees = [];

      renderScreen(state);

      expect(screen.getByText('Requested')).toBeTruthy();
      expect(screen.getByText(/Your request is pending review/)).toBeTruthy();
    });

    it('uses generated avatar URL when no lead photo is available', () => {
      const state = clone(defaultState);
      state.appointments.items[0].employeeId = null;
      state.appointments.items[0].employeeName = 'Harsh Parmar';
      state.appointments.items[0].employeeAvatar = null;
      state.businesses.employees = [];
      renderScreen(state);
      expect(
        screen.getByTestId('employee-avatar-uri').props.children,
      ).toContain('https://ui-avatars.com/api/?name=Harsh%20Parmar');
    });

    it('renders empty documents and tasks states when none exist', () => {
      const state = clone(defaultState);
      state.documents.documents = [];

      renderScreen(state);

      expect(
        screen.getByText('No documents shared for this appointment yet.'),
      ).toBeTruthy();
      expect(
        screen.getByText('No tasks linked to this appointment.'),
      ).toBeTruthy();
    });

    it('hides employee details for non-upcoming appointments', () => {
      const state = clone(defaultState);
      state.appointments.items[0].status = 'COMPLETED';

      renderScreen(state);

      expect(screen.queryByText('Dr. Smith')).toBeNull();
    });

    it('renders attachment fallbacks when uploaded files are missing display fields', () => {
      const state = clone(defaultState);
      state.appointments.items[0].uploadedFiles = [
        {key: 'lab-result.pdf', url: 'http://file.test/lab-result.pdf'},
        {url: 'http://file.test/attachment.bin'},
      ];

      renderScreen(state);

      expect(screen.getByText('lab-result.pdf')).toBeTruthy();
      expect(screen.getByText('Attachment')).toBeTruthy();
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
      {status: 'UNKNOWN_STATUS', text: 'Unknown'},
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

    it('does not navigate to document preview when parent tab navigation is unavailable', () => {
      (mockGetParent as jest.Mock).mockReturnValue(null);

      renderScreen();
      fireEvent.press(screen.getByTestId('doc-Vaccine Record'));

      expect(mockNavigate).not.toHaveBeenCalledWith(
        'Documents',
        expect.anything(),
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

    it('shows Pay Now for requested appointment when payment is pending', () => {
      const state = clone(defaultState);
      state.appointments.items[0].status = 'REQUESTED';
      state.appointments.items[0].paymentStatus = 'UNPAID';
      renderScreen(state);

      expect(screen.getByTestId('btn-Pay Now')).toBeTruthy();
    });

    it('opens full merck search with appointment context', () => {
      renderScreen();

      fireEvent.press(screen.getByTestId('merck-widget'));

      expect(mockNavigate).toHaveBeenCalledWith('MerckManuals', {
        organisationId: 'biz-1',
        context: 'appointment',
        initialQuery: 'arthritis',
        initialEntries: [{id: 'entry-1'}],
        initialLanguage: 'en',
        initialHasSearched: true,
      });
    });

    it('omits the initial merck query when the widget opens without one', () => {
      mockMerckSearchState = {
        query: '',
        entries: [{id: 'entry-2'}],
        language: 'en',
        hasSearched: true,
      };

      renderScreen();
      fireEvent.press(screen.getByTestId('merck-widget'));

      expect(mockNavigate).toHaveBeenCalledWith('MerckManuals', {
        organisationId: 'biz-1',
        context: 'appointment',
        initialQuery: undefined,
        initialEntries: [{id: 'entry-2'}],
        initialLanguage: 'en',
        initialHasSearched: true,
      });
    });

    it('does not open full merck search when organisation id is missing', () => {
      const state = clone(defaultState);
      state.appointments.items[0].businessId = null;

      renderScreen(state);
      fireEvent.press(screen.getByTestId('merck-widget'));

      expect(mockNavigate).not.toHaveBeenCalledWith(
        'MerckManuals',
        expect.anything(),
      );
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

    it('does not render check in button when status is CHECKED_IN', () => {
      const state = clone(defaultState);
      state.appointments.items[0].status = 'CHECKED_IN';
      renderScreen(state);

      expect(screen.queryByTestId('btn-Check in')).toBeNull();
      expect(screen.queryByTestId('btn-Checked in')).toBeNull();
    });

    it('does not render check in button when status is IN_PROGRESS', () => {
      const state = clone(defaultState);
      state.appointments.items[0].status = 'IN_PROGRESS';
      renderScreen(state);

      expect(screen.queryByTestId('btn-Check in')).toBeNull();
      expect(screen.queryByTestId('btn-In progress')).toBeNull();
    });

    it('shows check in and pay now when payment is pending', () => {
      const state = clone(defaultState);
      state.appointments.items[0].status = 'UPCOMING';
      state.appointments.items[0].paymentStatus = 'UNPAID';
      renderScreen(state);

      expect(screen.getByTestId('btn-Check in')).toBeTruthy();
      expect(screen.getByTestId('btn-Pay Now')).toBeTruthy();
    });

    it('fails check in: Too Early', async () => {
      jest.setSystemTime(new Date('2023-12-25T00:00:00Z'));
      renderScreen();
      fireEvent.press(screen.getByTestId('btn-Check in'));
      expect(Alert.alert).toHaveBeenCalledWith(
        'Too early to check in',
        expect.anything(),
      );
    });

    it('uses the singular minute label for one-minute check-in buffers', async () => {
      jest.setSystemTime(new Date('2023-12-25T00:00:00Z'));
      const state = clone(defaultState);
      state.appointments.items[0].appointmentCheckInBufferMinutes = 1;

      renderScreen(state);
      fireEvent.press(screen.getByTestId('btn-Check in'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Too early to check in',
          expect.stringContaining('1 minute before your appointment'),
        );
      });
    });

    it('fails check in: Missing Business Location', async () => {
      const state = clone(defaultState);
      state.businesses.businesses[0].lat = null;
      renderScreen(state);
      fireEvent.press(screen.getByTestId('btn-Check in'));
      expect(Alert.alert).toHaveBeenCalledWith(
        'Location unavailable',
        expect.stringContaining('Provider location'),
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

    it('opens invoice from list when processing payment is false', () => {
      mockSelectExpenses.mockReturnValue([mockExpense1, mockExpense2]);

      render(
        <Provider store={createTestStore(invoiceState)}>
          <ViewAppointmentScreen />
        </Provider>,
      );

      fireEvent.press(screen.getByTestId('view-invoice-Consultation'));
      expect(mockOpenPayment).toHaveBeenCalledWith(mockExpense1);
    });

    it('does not open invoice actions from list while payment processing is in progress', () => {
      mockSelectExpenses.mockReturnValue([mockExpense1, mockExpense2]);
      (ExpensePaymentHook.useExpensePayment as jest.Mock).mockReturnValue({
        openPaymentScreen: mockOpenPayment,
        processingPayment: true,
      });

      render(
        <Provider store={createTestStore(invoiceState)}>
          <ViewAppointmentScreen />
        </Provider>,
      );

      fireEvent.press(screen.getByTestId('view-invoice-Consultation'));
      fireEvent.press(screen.getByTestId('pay-invoice-Consultation'));
      expect(mockOpenPayment).not.toHaveBeenCalled();
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

    it('shows employee for upcoming appointments even when payment is pending', () => {
      const state = clone(defaultState);
      state.appointments.items[0].status = 'UPCOMING';
      state.appointments.items[0].paymentStatus = 'UNPAID';
      renderScreen(state);
      expect(screen.getByText('Dr. Smith')).toBeTruthy();
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

    it('falls back to the secondary photo fetch when primary details have no photo url', async () => {
      mockUnwrap
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({photoUrl: 'google-fallback.jpg'});

      const state = clone(defaultState);
      state.businesses.businesses[0].photo = null;

      render(
        <Provider store={createTestStore(state)}>
          <ViewAppointmentScreen />
        </Provider>,
      );

      await waitFor(() => {
        expect(LinkedBusinessSlice.fetchBusinessDetails).toHaveBeenCalled();
        expect(LinkedBusinessSlice.fetchGooglePlacesImage).toHaveBeenCalledWith(
          'gp-1',
        );
      });
    });
  });

  describe('Forms and tasks', () => {
    it('renders activity indicator while forms are loading', () => {
      mockFormsLoading = true;

      const rendered = renderScreen();

      expect(rendered.UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    });

    it('renders signed form answers and opens the form in view mode', () => {
      mockAppointmentForms = [
        {
          status: 'signed',
          signingRequired: false,
          form: {
            _id: 'form-1',
            name: 'Consent Form',
            description: 'Review and sign',
            schema: [
              {id: 'visit_date', label: 'Visit Date', type: 'date'},
              {id: 'consent', label: 'Consent', type: 'boolean'},
              {id: 'tags', label: 'Tags', type: 'multiselect'},
              {id: 'link', label: 'Link', type: 'file'},
              {id: 'meta', label: 'Meta', type: 'text'},
              {
                id: 'group-1',
                type: 'group',
                fields: [{id: 'notes', label: 'Notes', type: 'text'}],
              },
            ],
          },
          submission: {
            _id: 'submission-1',
            answers: {
              visit_date: '2024-01-05T00:00:00.000Z',
              consent: true,
              tags: ['urgent', 'follow-up'],
              link: {url: 'https://example.com/form.pdf'},
              meta: {foo: 'bar'},
              notes: 'Patient is stable',
            },
          },
        },
      ];

      renderScreen();

      expect(screen.getByText('Signed')).toBeTruthy();
      expect(screen.getByText('Visit Date')).toBeTruthy();
      expect(screen.getByText('Yes')).toBeTruthy();
      expect(screen.getByText('urgent, follow-up')).toBeTruthy();
      expect(screen.getByText('https://example.com/form.pdf')).toBeTruthy();
      expect(screen.getByText('{"foo":"bar"}')).toBeTruthy();
      expect(screen.getByText('Patient is stable')).toBeTruthy();

      fireEvent.press(screen.getByTestId('btn-View form'));
      expect(mockNavigate).toHaveBeenCalledWith('AppointmentForm', {
        appointmentId: mockAptId,
        formId: 'form-1',
        mode: 'view',
        allowSign: false,
      });
    });

    it('renders signable submitted form and opens it with signing enabled', () => {
      mockAppointmentForms = [
        {
          status: 'submitted',
          signingRequired: true,
          form: {
            _id: 'form-2',
            name: 'Estimate Approval',
            description: '',
            schema: [],
          },
          submission: {
            _id: 'submission-2',
            answers: {approved_by: 'Alex'},
          },
        },
      ];

      renderScreen();

      expect(screen.getByText('Submitted')).toBeTruthy();
      fireEvent.press(screen.getByTestId('btn-View & Sign'));
      expect(mockNavigate).toHaveBeenCalledWith('AppointmentForm', {
        appointmentId: mockAptId,
        formId: 'form-2',
        mode: 'view',
        allowSign: true,
      });
      expect(screen.queryByText('Approved by')).toBeNull();
    });

    it('renders signature pending and non-signing fill actions', () => {
      mockAppointmentForms = [
        {
          status: 'signing',
          signingRequired: true,
          form: {
            _id: 'form-signing',
            name: 'Surgery Consent',
            description: '',
            schema: [],
          },
          submission: {
            _id: 'submission-signing',
            answers: {owner_name: 'Morgan'},
          },
        },
        {
          status: 'pending',
          signingRequired: false,
          form: {
            _id: 'form-fill',
            name: 'History Form',
            description: '',
            schema: [],
          },
          submission: null,
        },
      ];

      renderScreen();

      expect(screen.getByText('Signature pending')).toBeTruthy();
      fireEvent.press(screen.getByTestId('btn-Fill form'));
      expect(mockNavigate).toHaveBeenCalledWith('AppointmentForm', {
        appointmentId: mockAptId,
        formId: 'form-fill',
        mode: 'fill',
        allowSign: false,
      });
      expect(screen.queryByText('Owner name')).toBeNull();
    });

    it('renders fill actions for incomplete forms and raw-answer fallback summaries', () => {
      mockAppointmentForms = [
        {
          status: 'pending',
          signingRequired: true,
          form: {
            _id: 'form-3',
            name: 'Treatment Consent',
            description: 'Needs signature',
            schema: [],
          },
          submission: null,
        },
        {
          status: 'completed',
          signingRequired: false,
          form: {
            _id: 'form-4',
            name: 'Intake Questionnaire',
            description: '',
            schema: [],
          },
          submission: {
            _id: 'submission-4',
            answers: {
              emergency_contact: 'Taylor',
              blank_answer: '',
            },
          },
        },
      ];

      renderScreen();

      expect(screen.getByText('Pending')).toBeTruthy();
      expect(screen.getByText('Completed')).toBeTruthy();
      expect(screen.getByText('Emergency contact')).toBeTruthy();
      expect(screen.getByText('Taylor')).toBeTruthy();

      fireEvent.press(screen.getByTestId('btn-Fill & Sign'));
      expect(mockNavigate).toHaveBeenCalledWith('AppointmentForm', {
        appointmentId: mockAptId,
        formId: 'form-3',
        mode: 'fill',
        allowSign: true,
      });

      fireEvent.press(screen.getByTestId('btn-View form'));
      expect(mockNavigate).toHaveBeenCalledWith('AppointmentForm', {
        appointmentId: mockAptId,
        formId: 'form-4',
        mode: 'view',
        allowSign: false,
      });
    });

    it('renders no-response fallback when submission has no usable answers', () => {
      mockAppointmentForms = [
        {
          status: 'completed',
          signingRequired: false,
          form: {
            _id: 'form-5',
            name: 'Vitals',
            description: '',
            schema: [{id: 'missing', label: 'Missing', type: 'text'}],
          },
          submission: {
            _id: 'submission-5',
            answers: {
              missing: null,
            },
          },
        },
      ];

      renderScreen();

      expect(screen.getByText('No responses captured yet.')).toBeTruthy();
    });

    it('formats invalid dates, false booleans, empty arrays, and unlabeled fields safely', () => {
      mockAppointmentForms = [
        {
          status: 'completed',
          signingRequired: false,
          form: {
            _id: 'form-6',
            name: 'Edge Cases',
            description: '',
            schema: [
              {id: 'bad_date', label: 'Bad Date', type: 'date'},
              {id: 'consent_false', label: 'Consent False', type: 'boolean'},
              {id: 'empty_tags', label: 'Empty Tags', type: 'multiselect'},
              {id: 'plain_object', label: 'Plain Object', type: 'text'},
              {id: 'unlabeled_field', type: 'text'},
            ],
          },
          submission: {
            _id: 'submission-6',
            answers: {
              bad_date: 'not-a-date',
              consent_false: false,
              empty_tags: [],
              plain_object: {alpha: 1},
              unlabeled_field: 'Fallback label value',
            },
          },
        },
      ];

      renderScreen();

      expect(screen.getByText('Consent False')).toBeTruthy();
      expect(screen.getByText('No')).toBeTruthy();
      expect(screen.getByText('Plain Object')).toBeTruthy();
      expect(screen.getByText('{"alpha":1}')).toBeTruthy();
      expect(screen.getByText('unlabeled_field')).toBeTruthy();
      expect(screen.getByText('Fallback label value')).toBeTruthy();
      expect(screen.queryByText('Bad Date')).toBeNull();
      expect(screen.queryByText('Empty Tags')).toBeNull();
    });

    it('navigates to the linked task from the appointment task list', () => {
      const state = clone(defaultState);
      state.tasks.items = [
        {
          id: 'task-1',
          appointmentId: mockAptId,
          title: 'Follow up on meds',
          category: 'FOLLOW_UP',
          date: '2024-01-01',
          time: '11:00',
          status: 'OPEN',
          details: 'Call owner',
        },
      ];

      renderScreen(state);

      fireEvent.press(screen.getByTestId('task-Follow up on meds'));
      expect(mockNavigate).toHaveBeenCalledWith('Tasks', {
        screen: 'TaskView',
        params: {taskId: 'task-1'},
      });
    });

    it('uses parent tab navigation for linked tasks when available', () => {
      const mockTabNavigate = jest.fn();
      (mockGetParent as jest.Mock).mockReturnValue({navigate: mockTabNavigate});

      const state = clone(defaultState);
      state.tasks.items = [
        {
          id: 'task-2',
          appointmentId: mockAptId,
          title: 'Review lab work',
          category: 'FOLLOW_UP',
          date: '2024-01-02',
          time: '12:00',
          status: 'OPEN',
          details: 'Review results',
        },
      ];

      renderScreen(state);

      fireEvent.press(screen.getByTestId('task-Review lab work'));
      expect(mockTabNavigate).toHaveBeenCalledWith('Tasks', {
        screen: 'TaskView',
        params: {taskId: 'task-2'},
      });
    });

    it('shows the fallback companion label when a linked task has no resolved companion entity', () => {
      const state = clone(defaultState);
      state.companion.companions = [];
      state.appointments.items[0].companionId = null;
      state.tasks.items = [
        {
          id: 'task-3',
          appointmentId: mockAptId,
          title: 'Bring records',
          category: 'FOLLOW_UP',
          date: '2024-01-02',
          time: '12:00',
          status: 'OPEN',
          details: 'Bring prior records',
        },
      ];

      renderScreen(state);

      expect(screen.getByText('Companion')).toBeTruthy();
    });

    it('skips companion-scoped fetches when the appointment has no companion id', () => {
      const state = clone(defaultState);
      state.appointments.items[0].companionId = null;

      renderScreen(state);

      expect(
        require('../../../../src/features/documents/documentSlice')
          .fetchDocuments,
      ).not.toHaveBeenCalled();
      expect(
        require('../../../../src/features/expenses').fetchExpensesForCompanion,
      ).not.toHaveBeenCalled();
      expect(
        require('../../../../src/features/tasks/thunks').fetchTasksForCompanion,
      ).not.toHaveBeenCalled();
    });
  });
});
