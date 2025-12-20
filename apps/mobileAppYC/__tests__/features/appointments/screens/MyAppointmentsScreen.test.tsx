import React from 'react';
import {mockTheme} from '../setup/mockTheme';
import {render, fireEvent, act, screen} from '@testing-library/react-native';
import {Provider} from 'react-redux';
import configureStore from 'redux-mock-store';
import MyAppointmentsScreen from '@/features/appointments/screens/MyAppointmentsScreen';
import {useNavigation} from '@react-navigation/native';
import {handleChatActivation} from '@/features/appointments/utils/chatActivation';
import {openMapsToAddress, openMapsToPlaceId} from '@/shared/utils/openMaps';
import {usePermissions} from '@/shared/hooks/usePermissions';
import {fetchAppointmentsForCompanion} from '@/features/appointments/appointmentsSlice';
import {setSelectedCompanion} from '@/features/companion';
import {showPermissionDeniedToast} from '@/shared/utils/permissionToast';

// ----------------------------------------------------------------------
// 1. Mocks: Navigation & Core
// ----------------------------------------------------------------------
jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(),
  useFocusEffect: jest.fn(cb => cb()),
}));

// Suppress specific warnings for native modules
jest.mock('@react-native-documents/picker', () => ({
  pick: jest.fn(),
  types: {allFiles: 'allFiles', images: 'images', pdf: 'pdf'},
}));

// ----------------------------------------------------------------------
// 2. Mocks: Custom Hooks & Logic
// ----------------------------------------------------------------------
jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

jest.mock('@/shared/hooks/usePermissions', () => ({
  usePermissions: jest.fn(),
}));

jest.mock('@/shared/hooks/useAutoSelectCompanion', () => ({
  useAutoSelectCompanion: jest.fn(),
}));

jest.mock('@/features/appointments/hooks/useBusinessPhotoFallback', () => ({
  useBusinessPhotoFallback: () => ({
    businessFallbacks: {},
    requestBusinessPhoto: jest.fn(),
    handleAvatarError: jest.fn(),
  }),
}));

jest.mock('@/features/appointments/hooks/useFetchPhotoFallbacks', () => ({
  useFetchPhotoFallbacks: jest.fn(),
}));

jest.mock('@/features/appointments/hooks/useAppointmentDataMaps', () => ({
  useAppointmentDataMaps: () => ({
    businessMap: new Map([
      ['biz-1', {id: 'biz-1', category: 'hospital'}],
      ['biz-2', {id: 'biz-2', category: 'groomer'}],
    ]),
    employeeMap: new Map([['emp-1', {id: 'emp-1', name: 'Dr. Smith'}]]),
    serviceMap: new Map(),
  }),
}));

const mockHandleCheckIn = jest.fn();
jest.mock('@/features/appointments/hooks/useCheckInHandler', () => ({
  useCheckInHandler: () => ({
    handleCheckIn: mockHandleCheckIn,
  }),
}));

// Mock Worker for Ratings defined outside to prevent nesting depth issues
const mockFetchOrgWorker: any = jest.fn();
let capturedSetOrgRatings: any = null;

jest.mock('@/features/appointments/hooks/useOrganisationRating', () => ({
  useFetchOrgRatingIfNeeded: ({setOrgRatings}: any) => {
    capturedSetOrgRatings = setOrgRatings;
    return mockFetchOrgWorker;
  },
}));

// ----------------------------------------------------------------------
// 3. Mocks: Utilities (Status Logic)
// ----------------------------------------------------------------------
jest.mock('@/features/appointments/utils/appointmentCardData', () => ({
  transformAppointmentCardData: (item: any) => {
    const isApt2 = item.id === 'apt-2';

    // Dynamic flags
    const isPaymentFailed = item.status === 'PAYMENT_FAILED';
    const isCancelled = item.status === 'CANCELLED';
    const isUnknown = item.status === 'UNKNOWN';
    const needsPayment =
      isApt2 || ['NO_PAYMENT', 'AWAITING_PAYMENT'].includes(item.status);

    // FIX S3358: Removed nested ternary
    let checkInLabel = 'Check in';
    if (item.status === 'CHECKED_IN') {
      checkInLabel = 'Checked in';
    } else if (item.status === 'IN_PROGRESS') {
      checkInLabel = 'In progress';
    }

    return {
      cardTitle: 'Dr. Test',
      cardSubtitle: 'General',
      businessName:
        item.businessId === 'biz-2' ? 'Grooming Salon' : 'Vet Clinic',
      businessAddress: item.businessId === 'biz-2' ? '456 Rd' : '123 St',
      googlePlacesId: item.businessId === 'biz-2' ? null : 'gp-1',

      needsPayment,
      isPaymentFailed,
      isCancelled,
      isUnknown,

      statusAllowsActions: true,
      checkInLabel,
      checkInDisabled: false,
      isRequested: item.status === 'REQUESTED',
      isCheckedIn: item.status === 'CHECKED_IN',
      isInProgress: item.status === 'IN_PROGRESS',

      petName: 'Buddy',
      assignmentNote: 'Test Note',
    };
  },
}));

jest.mock('@/shared/utils/openMaps', () => ({
  openMapsToAddress: jest.fn(),
  openMapsToPlaceId: jest.fn(),
}));

jest.mock('@/features/appointments/utils/chatActivation', () => ({
  handleChatActivation: jest.fn(),
}));

jest.mock('@/shared/utils/permissionToast', () => ({
  showPermissionDeniedToast: jest.fn(),
}));

jest.mock('@/features/appointments/utils/businessCoordinates', () => ({
  getBusinessCoordinates: jest.fn(() => ({lat: 10, lng: 20})),
}));

jest.mock('@/features/appointments/utils/timeFormatting', () => ({
  formatDateLocale: (d: string) => d,
  formatTimeLocale: (_d: string, t: string) => t,
}));

jest.mock('@/assets/images', () => ({
  Images: {
    cat: {uri: 'cat'},
    addIconDark: {uri: 'add'},
    starSolid: {uri: 'star'},
  },
}));

// ----------------------------------------------------------------------
// 4. Mocks: UI Components
// ----------------------------------------------------------------------
// Use 'any' type for props to avoid DetailedHTMLProps conflicts in TS
jest.mock('@/shared/components/common/Header/Header', () => {
  const {View, TouchableOpacity, Text} = require('react-native');
  return {
    Header: ({onRightPress, title}: any) => (
      <View>
        <Text>{title}</Text>
        <TouchableOpacity onPress={onRightPress} testID="header-right-btn">
          <Text>Add</Text>
        </TouchableOpacity>
      </View>
    ),
  };
});

jest.mock('@/shared/components/common/AppointmentCard/AppointmentCard', () => {
  const {View, TouchableOpacity, Text} = require('react-native');
  return {
    AppointmentCard: ({
      onChat,
      onCheckIn,
      onGetDirections,
      doctorName,
      hospital,
      footer,
      checkInLabel,
    }: any) => (
      <View testID={`card-${doctorName}`}>
        <Text>{doctorName}</Text>
        <Text>{hospital}</Text>
        <Text testID="lbl-checkin-status">{checkInLabel}</Text>
        <TouchableOpacity onPress={onChat} testID="btn-chat">
          <Text>Chat</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onCheckIn} testID="btn-checkin">
          <Text>CheckIn</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onGetDirections} testID="btn-directions">
          <Text>Directions</Text>
        </TouchableOpacity>
        {footer}
      </View>
    ),
  };
});

jest.mock('@/shared/components/common/LiquidGlassCard/LiquidGlassCard', () => {
  const {View} = require('react-native');
  return {LiquidGlassCard: (props: any) => <View {...props} />};
});

jest.mock(
  '@/shared/components/common/LiquidGlassButton/LiquidGlassButton',
  () => {
    const {TouchableOpacity, Text} = require('react-native');
    return {
      LiquidGlassButton: ({title, onPress}: any) => (
        <TouchableOpacity onPress={onPress}>
          <Text>{title}</Text>
        </TouchableOpacity>
      ),
    };
  },
);

jest.mock(
  '@/shared/components/common/CompanionSelector/CompanionSelector',
  () => {
    const {View} = require('react-native');
    return {CompanionSelector: () => <View />};
  },
);

// ----------------------------------------------------------------------
// 5. Redux & Data Setup
// ----------------------------------------------------------------------
jest.mock('@/features/appointments/appointmentsSlice', () => ({
  fetchAppointmentsForCompanion: jest.fn(() => ({type: 'appointments/fetch'})),
}));

jest.mock('@/features/companion', () => ({
  setSelectedCompanion: jest.fn(id => ({
    type: 'companion/setSelected',
    payload: id,
  })),
}));

const mockUpcomingData = [
  {
    id: 'apt-1',
    businessId: 'biz-1',
    date: '2023-12-25',
    time: '10:00',
    status: 'CONFIRMED',
    companionId: 'c1',
  },
  {
    id: 'apt-2',
    businessId: 'biz-1',
    date: '2023-12-24',
    time: '09:00',
    status: 'CHECKED_IN',
    companionId: 'c1',
  },
  {
    id: 'apt-3',
    businessId: 'biz-2',
    date: '2023-12-26',
    time: '14:00',
    status: 'IN_PROGRESS',
    companionId: 'c1',
  },
];

const mockPastData = [
  {
    id: 'apt-past-1',
    businessId: 'biz-1',
    date: '2023-01-01',
    status: 'COMPLETED',
    companionId: 'c1',
  },
];

jest.mock('@/features/appointments/selectors', () => ({
  createSelectUpcomingAppointments: () =>
    jest.fn(state => state.appointments.upcomingOverride || mockUpcomingData),
  createSelectPastAppointments: () =>
    jest.fn(state => state.appointments.pastOverride || mockPastData),
}));

// ----------------------------------------------------------------------
// Tests
// ----------------------------------------------------------------------

describe('MyAppointmentsScreen', () => {
  const mockStore = configureStore([]);
  let store: any;
  const mockNavigate = jest.fn();

  // Helper to fix SonarQube S2004 (Nesting Depth)
  // Logic extracted from individual tests to keep nesting shallow
  const simulateOrgRatingUpdate = (payload: any) => {
    act(() => {
      if (capturedSetOrgRatings) {
        capturedSetOrgRatings((prev: any) => ({
          ...prev,
          'biz-1': payload,
        }));
      }
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    capturedSetOrgRatings = null;
    (useNavigation as jest.Mock).mockReturnValue({navigate: mockNavigate});
    (usePermissions as jest.Mock).mockReturnValue({
      canUseAppointments: true,
      canUseChat: true,
    });

    // Clear the mock worker
    mockFetchOrgWorker.mockClear();

    store = mockStore({
      // Provide name to prevent charAt crash
      companion: {
        companions: [{id: 'c1', name: 'Buddy', identifier: [{value: 'c1'}]}],
        selectedCompanionId: 'c1',
      },
      appointments: {
        upcomingOverride: null,
        pastOverride: null,
      },
    });
  });

  const renderScreen = () => {
    return render(
      <Provider store={store}>
        <MyAppointmentsScreen />
      </Provider>,
    );
  };

  it('renders correctly and fetches appointments on mount', () => {
    renderScreen();
    expect(screen.getByText('My Appointments')).toBeTruthy();
    expect(fetchAppointmentsForCompanion).toHaveBeenCalledWith({
      companionId: 'c1',
    });
  });

  it('handles navigation to Add Business screen via Header button', () => {
    renderScreen();
    const addBtn = screen.getByTestId('header-right-btn');
    fireEvent.press(addBtn);
    expect(mockNavigate).toHaveBeenCalledWith('BrowseBusinesses');
  });

  describe('Filtering', () => {
    it('filters list when pills are pressed', () => {
      renderScreen();
      // 'Vet Clinic' is hospital. 'Grooming Salon' is groomer.
      expect(screen.getAllByText('Vet Clinic').length).toBeGreaterThan(0);
      expect(screen.getByText('Grooming Salon')).toBeTruthy();

      fireEvent.press(screen.getByText('Groomer'));

      expect(screen.queryByText('Vet Clinic')).toBeNull();
      expect(screen.getByText('Grooming Salon')).toBeTruthy();
    });
  });

  describe('Interactions via Mocked AppointmentCard', () => {
    it('executes Chat callback', () => {
      renderScreen();
      const chatBtns = screen.getAllByTestId('btn-chat');
      fireEvent.press(chatBtns[0]);
      expect(handleChatActivation).toHaveBeenCalled();
    });

    it('executes CheckIn callback on correct item', () => {
      renderScreen();
      // apt-2 (Dec 24) is first, apt-1 (Dec 25) is second
      const checkInBtns = screen.getAllByTestId('btn-checkin');
      fireEvent.press(checkInBtns[0]);

      expect(mockHandleCheckIn).toHaveBeenCalled();
      expect(mockHandleCheckIn.mock.calls[0][0].appointment.id).toBe('apt-2');
    });

    it('executes Directions callback (Place ID)', () => {
      renderScreen();
      // apt-1 (index 1) has googlePlacesId 'gp-1'
      const dirBtns = screen.getAllByTestId('btn-directions');
      fireEvent.press(dirBtns[1]);
      expect(openMapsToPlaceId).toHaveBeenCalledWith('gp-1', '123 St');
    });

    it('executes Directions callback (Address fallback)', () => {
      renderScreen();
      // apt-3 (index 2) uses biz-2 -> '456 Rd'
      const dirBtns = screen.getAllByTestId('btn-directions');
      fireEvent.press(dirBtns[2]);
      expect(openMapsToAddress).toHaveBeenCalledWith('456 Rd');
    });
  });

  describe('Payment and Permissions', () => {
    it('handles Pay Now navigation', () => {
      renderScreen();
      const payBtn = screen.getByText('Pay now');
      fireEvent.press(payBtn);

      expect(mockNavigate).toHaveBeenCalledWith('PaymentInvoice', {
        appointmentId: 'apt-2',
        companionId: 'c1',
      });
    });

    it('shows toast when permission denied', () => {
      (usePermissions as jest.Mock).mockReturnValue({
        canUseAppointments: false,
      });
      renderScreen();

      expect(screen.queryByTestId('card-Dr. Test')).toBeNull();
      expect(showPermissionDeniedToast).toHaveBeenCalledWith('appointments');
    });

    it('resolves Check In label correctly', () => {
      renderScreen();
      // Index 0: apt-2 (CHECKED_IN)
      expect(
        screen.getAllByTestId('lbl-checkin-status')[0].props.children,
      ).toBe('Checked in');
      // Index 2: apt-3 (IN_PROGRESS)
      expect(
        screen.getAllByTestId('lbl-checkin-status')[2].props.children,
      ).toBe('In progress');
    });
  });

  describe('Past Appointments', () => {
    it('navigates to Review on press after state update', async () => {
      renderScreen();

      // Trigger state update using helper to avoid nesting error S2004
      simulateOrgRatingUpdate({loading: false, isRated: false, rating: null});

      const reviewBtn = await screen.findByText('Review');
      fireEvent.press(reviewBtn);

      expect(mockNavigate).toHaveBeenCalledWith('Review', {
        appointmentId: 'apt-past-1',
      });
    });

    it('shows rating score if already rated', async () => {
      renderScreen();

      // Trigger state update using helper to avoid nesting error S2004
      simulateOrgRatingUpdate({loading: false, isRated: true, rating: 5});

      const ratingText = await screen.findByText('5/5');
      expect(ratingText).toBeTruthy();
    });

    it('covers all status formatting cases', () => {
      // We create a store with all distinct statuses to hit switch cases
      // We ensure "PAYMENT_FAILED" is included to hit the footer text logic
      const statuses = ['NO_PAYMENT', 'PAYMENT_FAILED', 'CANCELLED', 'UNKNOWN'];
      const pastOverride = statuses.map((s, i) => ({
        id: `p-${i}`,
        businessId: 'biz-1',
        date: '2023-01-01',
        status: s,
        companionId: 'c1',
      }));

      store = mockStore({
        companion: {
          companions: [{id: 'c1', name: 'Buddy'}],
          selectedCompanionId: 'c1',
        },
        appointments: {upcomingOverride: [], pastOverride},
      });

      renderScreen();

      // NO_PAYMENT results in 'Payment pending'
      expect(screen.getAllByText('Payment pending').length).toBeGreaterThan(0);

      // PAYMENT_FAILED results in 'Payment failed' logic (mock sets flag isPaymentFailed=true)
      expect(screen.getByText('Payment failed')).toBeTruthy();

      // CANCELLED results in 'Cancelled'
      expect(screen.getByText('Cancelled')).toBeTruthy();

      // UNKNOWN results in 'UNKNOWN' (default)
      expect(screen.getByText('UNKNOWN')).toBeTruthy();
    });
  });

  describe('Logic Branches', () => {
    it('selects first companion if none selected', () => {
      const localStore = configureStore([])({
        companion: {
          companions: [
            {id: 'c99', name: 'NewPet', identifier: [{value: 'c99'}]},
          ],
          selectedCompanionId: null,
        },
        appointments: {upcomingOverride: [], pastOverride: []},
      });

      render(
        <Provider store={localStore}>
          <MyAppointmentsScreen />
        </Provider>,
      );

      expect(setSelectedCompanion).toHaveBeenCalledWith('c99');
    });
  });
});
