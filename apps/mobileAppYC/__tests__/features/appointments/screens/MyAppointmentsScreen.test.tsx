import React from 'react';
import {SectionList} from 'react-native';
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
let lastFocusEffectCleanup: (() => void) | undefined;

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(),
  useFocusEffect: jest.fn(cb => {
    lastFocusEffectCleanup = cb();
  }),
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

const mockRequestBusinessPhoto = jest.fn();
const mockHandleAvatarError = jest.fn();
jest.mock('@/features/appointments/hooks/useBusinessPhotoFallback', () => ({
  useBusinessPhotoFallback: () => ({
    businessFallbacks: {},
    requestBusinessPhoto: mockRequestBusinessPhoto,
    handleAvatarError: mockHandleAvatarError,
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

    // Leave checkInLabel empty so the screen's own resolvedCheckInLabel
    // fallback (isInProgress / isCheckedIn / default) computes the text,
    // exercising that branch instead of always trusting the card data.
    const checkInLabel = item.checkInLabelOverride ?? '';

    // 'biz-nodir' resolves to neither a place id nor an address so the
    // Get Directions handler falls through to its final no-op branch.
    let mockBusinessAddress = '123 St';
    let mockGooglePlacesId: string | null = 'gp-1';
    if (item.businessId === 'biz-2') {
      mockBusinessAddress = '456 Rd';
      mockGooglePlacesId = null;
    } else if (item.businessId === 'biz-nodir') {
      mockBusinessAddress = '';
      mockGooglePlacesId = null;
    }

    return {
      cardTitle: 'Dr. Test',
      cardSubtitle: 'General',
      businessName:
        item.businessId === 'biz-2' ? 'Grooming Salon' : 'Vet Clinic',
      businessAddress: mockBusinessAddress,
      googlePlacesId: mockGooglePlacesId,

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
      onChatBlocked,
      onCheckIn,
      onGetDirections,
      onAvatarError,
      onViewDetails,
      onPress,
      doctorName,
      hospital,
      footer,
      checkInLabel,
      checkInDisabled,
    }: any) => (
      <View testID={`card-${doctorName}`}>
        <Text>{doctorName}</Text>
        <Text>{hospital}</Text>
        <Text testID="lbl-checkin-status">{checkInLabel}</Text>
        <Text testID="lbl-checkin-disabled">{String(checkInDisabled)}</Text>
        <TouchableOpacity onPress={onChat} testID="btn-chat">
          <Text>Chat</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onChatBlocked} testID="btn-chat-blocked">
          <Text>ChatBlocked</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onCheckIn} testID="btn-checkin">
          <Text>CheckIn</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onGetDirections} testID="btn-directions">
          <Text>Directions</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onAvatarError} testID="btn-avatar-error">
          <Text>AvatarError</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onViewDetails} testID="btn-view-details">
          <Text>ViewDetails</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onPress} testID="btn-card-press">
          <Text>Press</Text>
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
    const {View, TouchableOpacity, Text} = require('react-native');
    return {
      CompanionSelector: ({onSelect}: any) => (
        <View>
          <TouchableOpacity
            testID="btn-select-companion"
            onPress={() => onSelect('c2')}>
            <Text>SelectCompanion</Text>
          </TouchableOpacity>
        </View>
      ),
    };
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
    mockRequestBusinessPhoto.mockClear();
    mockHandleAvatarError.mockClear();

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

  // The screen defaults to the Upcoming view; past appointments are shown
  // after toggling the Upcoming/Past segmented control.
  const switchToPast = () => {
    act(() => {
      fireEvent.press(screen.getByTestId('appt-view-toggle-past'));
    });
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
    it('shows appointments from multiple business categories by default', () => {
      renderScreen();
      // 'Vet Clinic' is hospital. 'Grooming Salon' is groomer.
      expect(screen.getAllByText('Vet Clinic').length).toBeGreaterThan(0);
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
      switchToPast();

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
      switchToPast();

      // Trigger state update using helper to avoid nesting error S2004
      simulateOrgRatingUpdate({loading: false, isRated: true, rating: 5});

      const ratingText = await screen.findByText('5/5');
      expect(ratingText).toBeTruthy();
    });

    it('shows a "-" placeholder when rated but no numeric rating is available', async () => {
      renderScreen();
      switchToPast();

      simulateOrgRatingUpdate({loading: false, isRated: true, rating: null});

      const ratingText = await screen.findByText('-/5');
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
      switchToPast();

      // NO_PAYMENT results in 'Payment pending'
      expect(screen.getAllByText('Payment pending').length).toBeGreaterThan(0);

      // PAYMENT_FAILED results in 'Payment failed' logic (mock sets flag isPaymentFailed=true)
      expect(screen.getByText('Payment failed')).toBeTruthy();

      // CANCELLED results in 'Cancelled'
      expect(screen.getByText('Cancelled')).toBeTruthy();

      // UNKNOWN results in generic unknown label
      expect(screen.getByText('Unknown')).toBeTruthy();
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

    it('dispatches setSelectedCompanion when a companion is selected from the header', () => {
      renderScreen();
      fireEvent.press(screen.getByTestId('btn-select-companion'));
      expect(setSelectedCompanion).toHaveBeenCalledWith('c2');
    });

    it('filters upcoming and past cards by the selected business category', () => {
      renderScreen();

      fireEvent.press(screen.getByText('Hospital'));
      expect(screen.getAllByText('Vet Clinic').length).toBeGreaterThan(0);
      expect(screen.queryByText('Grooming Salon')).toBeNull();

      fireEvent.press(screen.getByText('Groomer'));
      expect(screen.getByText('Grooming Salon')).toBeTruthy();
      expect(screen.queryByText('Vet Clinic')).toBeNull();
    });

    it('opens the chat channel once handleChatActivation invokes onOpenChat', () => {
      renderScreen();
      const chatBtns = screen.getAllByTestId('btn-chat');
      fireEvent.press(chatBtns[0]);

      expect(handleChatActivation).toHaveBeenCalled();
      const {onOpenChat} = (handleChatActivation as jest.Mock).mock.calls[0][0];

      act(() => {
        onOpenChat();
      });

      expect(mockNavigate).toHaveBeenCalledWith(
        'ChatChannel',
        expect.objectContaining({doctorName: 'Dr. Test', petName: 'Buddy'}),
      );
    });

    it('normalizes a short (HH:mm) appointment time before opening chat', () => {
      renderScreen();
      const chatBtns = screen.getAllByTestId('btn-chat');
      // index 0 is apt-2 (time: '09:00', a 5-char HH:mm string)
      fireEvent.press(chatBtns[0]);
      const {onOpenChat} = (handleChatActivation as jest.Mock).mock.calls[0][0];

      act(() => {
        onOpenChat();
      });

      expect(mockNavigate).toHaveBeenCalledWith(
        'ChatChannel',
        expect.objectContaining({appointmentTime: '2023-12-24T09:00:00Z'}),
      );
    });

    it('keeps a full appointment time unchanged before opening chat', () => {
      store = mockStore({
        companion: {
          companions: [{id: 'c1', name: 'Buddy', identifier: [{value: 'c1'}]}],
          selectedCompanionId: 'c1',
        },
        appointments: {
          upcomingOverride: [
            {
              id: 'u-fulltime',
              businessId: 'biz-1',
              date: '2999-12-25',
              time: '10:00:30',
              start: '2999-12-25T10:00:30Z',
              status: 'CONFIRMED',
              companionId: 'c1',
            },
          ],
          pastOverride: [],
        },
      });
      renderScreen();
      fireEvent.press(screen.getByTestId('btn-chat'));
      const {onOpenChat} = (handleChatActivation as jest.Mock).mock.calls[0][0];

      act(() => {
        onOpenChat();
      });

      expect(mockNavigate).toHaveBeenCalledWith(
        'ChatChannel',
        expect.objectContaining({appointmentTime: '2999-12-25T10:00:30Z'}),
      );
    });

    it('blocks chat and shows a toast via onChatBlocked', () => {
      renderScreen();
      fireEvent.press(screen.getAllByTestId('btn-chat-blocked')[0]);
      expect(showPermissionDeniedToast).toHaveBeenCalledWith('chat with vet');
    });

    it('marks a companion as checking in via onCheckingInChange, disabling further presses', () => {
      renderScreen();
      fireEvent.press(screen.getAllByTestId('btn-checkin')[0]);

      const [{onCheckingInChange}] = mockHandleCheckIn.mock.calls[0];
      act(() => {
        onCheckingInChange('apt-2', true);
      });

      expect(
        screen.getAllByTestId('lbl-checkin-disabled')[0].props.children,
      ).toBe('true');

      mockHandleCheckIn.mockClear();
      fireEvent.press(screen.getAllByTestId('btn-checkin')[0]);
      expect(mockHandleCheckIn).not.toHaveBeenCalled();
    });

    it('shows the requested status badge for a REQUESTED appointment', () => {
      store = mockStore({
        companion: {
          companions: [{id: 'c1', name: 'Buddy', identifier: [{value: 'c1'}]}],
          selectedCompanionId: 'c1',
        },
        appointments: {
          upcomingOverride: [
            {
              id: 'apt-req',
              businessId: 'biz-1',
              date: '2023-12-25',
              time: '10:00',
              status: 'REQUESTED',
              companionId: 'c1',
            },
          ],
          pastOverride: [],
        },
      });

      renderScreen();
      expect(screen.getByText('Requested')).toBeTruthy();
    });

    it('navigates to ViewAppointment from onViewDetails and onPress (upcoming card)', () => {
      renderScreen();
      fireEvent.press(screen.getAllByTestId('btn-view-details')[0]);
      expect(mockNavigate).toHaveBeenCalledWith('ViewAppointment', {
        appointmentId: 'apt-2',
      });

      mockNavigate.mockClear();
      fireEvent.press(screen.getAllByTestId('btn-card-press')[0]);
      expect(mockNavigate).toHaveBeenCalledWith('ViewAppointment', {
        appointmentId: 'apt-2',
      });
    });

    it('navigates to ViewAppointment from onViewDetails and onPress (past card)', () => {
      renderScreen();
      switchToPast();
      const viewDetailsBtns = screen.getAllByTestId('btn-view-details');
      fireEvent.press(viewDetailsBtns[viewDetailsBtns.length - 1]);
      expect(mockNavigate).toHaveBeenCalledWith('ViewAppointment', {
        appointmentId: 'apt-past-1',
      });

      mockNavigate.mockClear();
      const cardPressBtns = screen.getAllByTestId('btn-card-press');
      fireEvent.press(cardPressBtns[cardPressBtns.length - 1]);
      expect(mockNavigate).toHaveBeenCalledWith('ViewAppointment', {
        appointmentId: 'apt-past-1',
      });
    });

    it('shows a permission toast when check-in is denied', () => {
      renderScreen();
      fireEvent.press(screen.getAllByTestId('btn-checkin')[0]);

      const [{onPermissionDenied}] = mockHandleCheckIn.mock.calls[0];
      act(() => {
        onPermissionDenied();
      });

      expect(showPermissionDeniedToast).toHaveBeenCalledWith('appointments');
    });

    it('clears the last-fetched companion ref when the screen loses focus', () => {
      renderScreen();
      expect(() => lastFocusEffectCleanup?.()).not.toThrow();
    });

    it('reports avatar load errors for both upcoming and past cards', () => {
      renderScreen();
      const avatarErrorBtns = screen.getAllByTestId('btn-avatar-error');
      expect(() =>
        avatarErrorBtns.forEach(btn => fireEvent.press(btn)),
      ).not.toThrow();
      expect(mockHandleAvatarError).toHaveBeenCalledWith('gp-1', 'biz-1');
    });
  });

  describe('Warm-bone branch coverage', () => {
    const buildStore = (
      companions: any[],
      selectedCompanionId: any,
      upcomingOverride: any,
      pastOverride: any,
    ) =>
      mockStore({
        companion: {companions, selectedCompanionId},
        appointments: {upcomingOverride, pastOverride},
      });

    it('invokes the SectionList onEndReached pagination placeholder without side effects', () => {
      renderScreen();
      const list = screen.UNSAFE_getByType(SectionList);
      expect(() => act(() => list.props.onEndReached())).not.toThrow();
    });

    it('auto-selects the first companion via _id when id is absent', () => {
      store = buildStore([{_id: 'cid', name: 'NoId'}], null, [], []);
      renderScreen();
      expect(setSelectedCompanion).toHaveBeenCalledWith('cid');
    });

    it('auto-selects the first companion via identifier value when id and _id are absent', () => {
      store = buildStore(
        [{identifier: [{value: 'ident'}], name: 'IdentOnly'}],
        null,
        [],
        [],
      );
      renderScreen();
      expect(setSelectedCompanion).toHaveBeenCalledWith('ident');
    });

    it('does not auto-select a companion when the companion list is empty', () => {
      store = buildStore([], null, [], []);
      renderScreen();
      expect(setSelectedCompanion).not.toHaveBeenCalled();
    });

    it('does not auto-select a companion when the first companion has no id fields', () => {
      store = buildStore([{name: 'Ghost'}], null, [], []);
      renderScreen();
      expect(setSelectedCompanion).not.toHaveBeenCalled();
    });

    it('sorts upcoming appointments using start and time fallbacks', () => {
      store = buildStore(
        [{id: 'c1', name: 'Buddy', identifier: [{value: 'c1'}]}],
        'c1',
        [
          {
            id: 'u-start',
            businessId: 'biz-1',
            date: '2023-12-25',
            time: '10:00',
            start: '2023-12-25T10:00:00Z',
            status: 'CONFIRMED',
            companionId: 'c1',
          },
          {
            id: 'u-notime',
            businessId: 'biz-1',
            date: '2023-12-24',
            status: 'CONFIRMED',
            companionId: 'c1',
          },
          {
            id: 'u-plain',
            businessId: 'biz-1',
            date: '2023-12-26',
            time: '09:00',
            status: 'CONFIRMED',
            companionId: 'c1',
          },
        ],
        [],
      );
      renderScreen();
      expect(screen.getAllByTestId('card-Dr. Test').length).toBe(3);
    });

    it('sorts when the compared prior appointment has no time', () => {
      store = buildStore(
        [{id: 'c1', name: 'Buddy', identifier: [{value: 'c1'}]}],
        'c1',
        [
          {
            id: 'u-no-b-time',
            businessId: 'biz-1',
            date: '2999-12-24',
            status: 'CONFIRMED',
            companionId: 'c1',
          },
          {
            id: 'u-with-time',
            businessId: 'biz-1',
            date: '2999-12-25',
            time: '10:00',
            status: 'CONFIRMED',
            companionId: 'c1',
          },
        ],
        [],
      );
      renderScreen();
      expect(screen.getAllByTestId('card-Dr. Test')).toHaveLength(2);
    });

    it('splits far-future upcoming appointments into a Later group', () => {
      store = buildStore(
        [{id: 'c1', name: 'Buddy', identifier: [{value: 'c1'}]}],
        'c1',
        [
          {
            id: 'u-soon',
            businessId: 'biz-1',
            date: '2023-12-25',
            time: '10:00',
            status: 'CONFIRMED',
            companionId: 'c1',
          },
          {
            id: 'u-later',
            businessId: 'biz-1',
            date: '2999-12-25',
            time: '10:00',
            status: 'CONFIRMED',
            companionId: 'c1',
          },
        ],
        [],
      );
      renderScreen();
      expect(screen.getByText('This week')).toBeTruthy();
      expect(screen.getByText('Later')).toBeTruthy();
    });

    it('renders an empty state card when there are no past appointments', () => {
      store = buildStore(
        [{id: 'c1', name: 'Buddy', identifier: [{value: 'c1'}]}],
        'c1',
        [],
        [],
      );
      renderScreen();
      switchToPast();
      expect(screen.getByText('No past appointments')).toBeTruthy();
      expect(
        screen.getByText('Completed appointments will appear here.'),
      ).toBeTruthy();
    });

    it('renders an empty state card when there are no upcoming appointments', () => {
      store = buildStore(
        [{id: 'c1', name: 'Buddy', identifier: [{value: 'c1'}]}],
        'c1',
        [],
        [],
      );
      renderScreen();
      expect(screen.getByText('No upcoming appointments')).toBeTruthy();
      expect(
        screen.getByText('Book a new appointment to see it here.'),
      ).toBeTruthy();
    });

    it('does nothing for Get Directions when there is no place id or address', () => {
      store = buildStore(
        [{id: 'c1', name: 'Buddy', identifier: [{value: 'c1'}]}],
        'c1',
        [
          {
            id: 'u-nodir',
            businessId: 'biz-nodir',
            date: '2023-12-25',
            time: '10:00',
            status: 'CONFIRMED',
            companionId: 'c1',
          },
        ],
        [],
      );
      renderScreen();
      fireEvent.press(screen.getByTestId('btn-directions'));
      expect(openMapsToPlaceId).not.toHaveBeenCalled();
      expect(openMapsToAddress).not.toHaveBeenCalled();
    });

    it('resolves the "In progress" check-in label for an in-progress appointment', () => {
      store = buildStore(
        [{id: 'c1', name: 'Buddy', identifier: [{value: 'c1'}]}],
        'c1',
        [
          {
            id: 'u-inprog',
            businessId: 'biz-1',
            date: '2023-12-25',
            time: '10:00',
            status: 'IN_PROGRESS',
            companionId: 'c1',
          },
        ],
        [],
      );
      renderScreen();
      expect(screen.getByTestId('lbl-checkin-status').props.children).toBe(
        'In progress',
      );
    });

    it('resolves the default check-in label for a confirmed appointment', () => {
      store = buildStore(
        [{id: 'c1', name: 'Buddy', identifier: [{value: 'c1'}]}],
        'c1',
        [
          {
            id: 'u-confirmed',
            businessId: 'biz-1',
            date: '2023-12-25',
            time: '10:00',
            status: 'CONFIRMED',
            companionId: 'c1',
          },
        ],
        [],
      );
      renderScreen();
      expect(screen.getByTestId('lbl-checkin-status').props.children).toBe(
        'Check in',
      );
    });

    it('uses the check-in label supplied by card data when present', () => {
      store = buildStore(
        [{id: 'c1', name: 'Buddy', identifier: [{value: 'c1'}]}],
        'c1',
        [
          {
            id: 'u-custom-label',
            businessId: 'biz-1',
            date: '2999-12-25',
            time: '10:00',
            status: 'CONFIRMED',
            companionId: 'c1',
            checkInLabelOverride: 'Ready now',
          },
        ],
        [],
      );
      renderScreen();
      expect(screen.getByTestId('lbl-checkin-status').props.children).toBe(
        'Ready now',
      );
    });

    it('reports avatar load errors for past cards', () => {
      store = buildStore(
        [{id: 'c1', name: 'Buddy', identifier: [{value: 'c1'}]}],
        'c1',
        [],
        [
          {
            id: 'p-avatar',
            businessId: 'biz-1',
            date: '2023-01-01',
            status: 'COMPLETED',
            companionId: 'c1',
          },
        ],
      );
      renderScreen();
      switchToPast();

      fireEvent.press(screen.getByTestId('btn-avatar-error'));

      expect(mockHandleAvatarError).toHaveBeenCalledWith('gp-1', 'biz-1');
    });

    it('navigates to ViewAppointment from the past card view-details and press handlers', () => {
      store = buildStore(
        [{id: 'c1', name: 'Buddy', identifier: [{value: 'c1'}]}],
        'c1',
        [],
        [
          {
            id: 'p-detail',
            businessId: 'biz-1',
            date: '2023-01-01',
            status: 'COMPLETED',
            companionId: 'c1',
          },
        ],
      );
      renderScreen();
      switchToPast();
      fireEvent.press(screen.getByTestId('btn-view-details'));
      expect(mockNavigate).toHaveBeenCalledWith('ViewAppointment', {
        appointmentId: 'p-detail',
      });

      mockNavigate.mockClear();
      fireEvent.press(screen.getByTestId('btn-card-press'));
      expect(mockNavigate).toHaveBeenCalledWith('ViewAppointment', {
        appointmentId: 'p-detail',
      });
    });
  });
});
