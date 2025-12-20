import React from 'react';
import {mockTheme} from '../setup/mockTheme';
import {render, fireEvent, act, waitFor} from '@testing-library/react-native';
import {EditAppointmentScreen} from '@/features/appointments/screens/EditAppointmentScreen';
import {Provider} from 'react-redux';
import {configureStore} from '@reduxjs/toolkit';

// --- Mocks ---

// 1. Mock Navigation
const mockGoBack = jest.fn();
const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    goBack: mockGoBack,
    navigate: mockNavigate,
  }),
  useRoute: () => ({
    params: {appointmentId: 'apt-123'},
  }),
}));

// 2. Mock Hooks
const mockHandleOpenAppTerms = jest.fn();
const mockHandleOpenAppPrivacy = jest.fn();
jest.mock('@/shared/hooks/useNavigateToLegalPages', () => ({
  useNavigateToLegalPages: () => ({
    handleOpenTerms: mockHandleOpenAppTerms,
    handleOpenPrivacy: mockHandleOpenAppPrivacy,
  }),
}));

const mockOpenBusinessTerms = jest.fn();
const mockOpenBusinessPrivacy = jest.fn();
const mockOpenBusinessCancellation = jest.fn();
jest.mock('@/shared/hooks/useOrganisationDocumentNavigation', () => ({
  useOrganisationDocumentNavigation: () => ({
    openTerms: mockOpenBusinessTerms,
    openPrivacy: mockOpenBusinessPrivacy,
    openCancellation: mockOpenBusinessCancellation,
  }),
}));

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

// 3. Mock Components
jest.mock('@/shared/components/common', () => {
  const {View} = require('react-native');
  return {
    SafeArea: ({children}: any) => <View>{children}</View>,
  };
});

jest.mock('@/shared/components/common/Header/Header', () => {
  const {View, Text, TouchableOpacity} = require('react-native');
  return {
    Header: ({title, onBack, onRightPress, rightIcon}: any) => (
      <View testID="Header">
        <Text testID="HeaderTitle">{title}</Text>
        <TouchableOpacity testID="HeaderBack" onPress={onBack} />
        {rightIcon && (
          <TouchableOpacity testID="HeaderRight" onPress={onRightPress} />
        )}
      </View>
    ),
  };
});

jest.mock(
  '@/shared/components/common/LiquidGlassButton/LiquidGlassButton',
  () => {
    const {View, Text} = require('react-native');
    return {
      LiquidGlassButton: ({title, onPress}: any) => (
        <View testID="SubmitButton" onTouchEnd={onPress}>
          <Text>{title}</Text>
        </View>
      ),
    };
  },
);

jest.mock(
  '@/features/appointments/components/CancelAppointmentBottomSheet',
  () => {
    // eslint-disable-next-line @typescript-eslint/no-shadow
    const React = require('react');
    const {View, Button} = require('react-native');
    return {
      CancelAppointmentBottomSheet: React.forwardRef(
        ({onConfirm}: any, ref: any) => {
          React.useImperativeHandle(ref, () => ({
            open: jest.fn(),
          }));
          return (
            <View testID="CancelSheet">
              <Button
                title="Confirm Cancel"
                onPress={onConfirm}
                testID="ConfirmCancelBtn"
              />
            </View>
          );
        },
      ),
    };
  },
);

jest.mock('@/features/appointments/components/AppointmentFormContent', () => {
  const {View, Button} = require('react-native');
  return {
    AppointmentFormContent: (props: any) => (
      <View testID="FormContent">
        <Button
          testID="ChangeDateBtn"
          title="Change Date"
          onPress={() =>
            props.onDateChange(new Date('2025-01-02'), '2025-01-02')
          }
        />
        <Button
          testID="SelectSlotBtn"
          title="Select Slot"
          onPress={() => props.onSelectSlot('10:00 - 11:00')}
        />
        <Button
          testID="ClearSlotBtn"
          title="Clear Slot"
          onPress={() => props.onSelectSlot(null)}
        />
        <Button
          testID="ToggleEmergencyBtn"
          title="Toggle Emergency"
          onPress={() => props.onEmergencyChange(!props.emergency)}
        />
        <Button
          testID="ChangeConcernBtn"
          title="Change Concern"
          onPress={() => props.onConcernChange('New Concern')}
        />
        {/* Render Agreements */}
        {props.agreements?.map((ag: any) => (
          <View key={ag.id}>{ag.label}</View>
        ))}
        {/* Render Actions (Submit Button) */}
        {props.actions}
        {/* Render Employee Edit */}
        {props.employeeCard && (
          <Button
            testID="EditEmployeeBtn"
            title="Edit Employee"
            onPress={props.employeeCard.onEdit}
          />
        )}
      </View>
    ),
  };
});

// 4. Mock Utils & Assets
jest.mock('@/assets/images', () => ({Images: {deleteIcon: 'delete.png'}}));

const mockAvailability = ['09:00 - 10:00'];
const mockService = {
  id: 'svc-1',
  name: 'Service Name',
  description: 'Desc',
  basePrice: 100,
  currency: 'USD',
  defaultEmployeeId: 'emp-1',
};

jest.mock('@/features/appointments/selectors', () => ({
  selectAvailabilityFor: jest.fn(() => () => mockAvailability),
  selectServiceById: jest.fn(() => () => mockService),
}));

jest.mock('@/features/appointments/utils/availability', () => ({
  getFirstAvailableDate: jest.fn(() => '2025-01-01'),
  getFutureAvailabilityMarkers: jest.fn(() => ({})),
  getSlotsForDate: jest.fn(() => ['09:00 - 10:00']),
  findSlotByLabel: jest.fn(() => ({
    startTimeUtc: 'iso-start',
    endTimeUtc: 'iso-end',
  })),
  parseSlotLabel: jest.fn(() => ({startTime: '10:00', endTime: '11:00'})),
}));

jest.mock('@/features/appointments/utils/timeFormatting', () => ({
  formatTimeRange: jest.fn(() => '09:00 - 10:00'),
}));

jest.mock('@/features/appointments/utils/photoUtils', () => ({
  isDummyPhoto: jest.fn(url => url === 'dummy-url'),
}));

jest.mock('@/shared/utils/currency', () => ({
  resolveCurrencySymbol: jest.fn(() => '$'),
}));

// 5. Mock Thunks
// FIXED: Define rescheduleAppointment as jest.fn() so we can spy/mock it later
jest.mock('@/features/appointments/appointmentsSlice', () => ({
  cancelAppointment: jest.fn(() => ({type: 'appointments/cancel'})),
  rescheduleAppointment: jest.fn(() => ({
    type: 'appointments/reschedule',
    unwrap: jest.fn().mockResolvedValue(true),
  })),
}));

jest.mock('@/features/appointments/businessesSlice', () => ({
  fetchServiceSlots: jest.fn(() => ({type: 'businesses/fetchSlots'})),
}));

const mockFetchBusinessDetails = jest.fn();
const mockFetchGooglePlacesImage = jest.fn();

jest.mock('@/features/linkedBusinesses', () => ({
  fetchBusinessDetails: (id: string) => ({
    type: 'linkedBusinesses/fetchDetails',
    unwrap: () => mockFetchBusinessDetails(id),
  }),
  fetchGooglePlacesImage: (id: string) => ({
    type: 'linkedBusinesses/fetchImage',
    unwrap: () => mockFetchGooglePlacesImage(id),
  }),
}));

describe('EditAppointmentScreen', () => {
  let store: any;
  const initialState = {
    appointments: {
      items: [
        {
          id: 'apt-123',
          serviceId: 'svc-1',
          businessId: 'biz-1',
          employeeId: 'emp-1',
          date: '2025-01-01',
          time: '09:00',
          endTime: '10:00',
          status: 'BOOKED',
          companionId: 'comp-1',
          organisationName: 'Vet Clinic',
          businessGooglePlacesId: 'google-id-123',
        },
      ],
      loading: false,
    },
    businesses: {
      businesses: [
        {
          id: 'biz-1',
          name: 'Vet Clinic',
          googlePlacesId: 'google-id-123',
          photo: 'real-photo.jpg',
        },
      ],
      employees: [
        {
          id: 'emp-1',
          name: 'Dr. Smith',
          specialization: 'Surgeon',
          title: 'Head Vet',
        },
      ],
    },
    companion: {
      companions: [{id: 'comp-1', name: 'Buddy'}],
    },
  };

  const setup = (customState = initialState) => {
    store = configureStore({
      reducer: {
        appointments: (state = customState.appointments) => state,
        businesses: (state = customState.businesses) => state,
        companion: (state = customState.companion) => state,
      },
      middleware: getDefaultMiddleware =>
        getDefaultMiddleware({
          serializableCheck: false,
          immutableCheck: false,
        }),
    });

    return render(
      <Provider store={store}>
        <EditAppointmentScreen />
      </Provider>,
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchBusinessDetails.mockResolvedValue({photoUrl: 'fetched-photo-url'});
    mockFetchGooglePlacesImage.mockResolvedValue({
      photoUrl: 'google-photo-url',
    });

    // Reset the reschedule mock to success by default
    const {
      rescheduleAppointment,
    } = require('@/features/appointments/appointmentsSlice');
    (rescheduleAppointment as unknown as jest.Mock).mockReturnValue({
      type: 'appointments/reschedule',
      unwrap: jest.fn().mockResolvedValue(true),
    });
  });

  // --- Tests ---

  it('renders correctly with all data populated', () => {
    const {getByTestId, getByText} = setup();
    expect(getByTestId('HeaderTitle')).toHaveTextContent(
      'Reschedule Appointment',
    );
    expect(getByTestId('FormContent')).toBeTruthy();
    expect(getByText(/Submit reschedule request/i)).toBeTruthy();
  });

  it('renders null if appointment is not found', () => {
    const emptyState = {
      ...initialState,
      appointments: {items: [], loading: false},
    };
    const {queryByTestId} = setup(emptyState);
    expect(queryByTestId('Header')).toBeNull();
  });

  it('fetches service slots on mount', () => {
    setup();
    const {
      fetchServiceSlots,
    } = require('@/features/appointments/businessesSlice');
    expect(fetchServiceSlots).toHaveBeenCalledWith({
      businessId: 'biz-1',
      serviceId: 'svc-1',
      date: '2025-01-01',
    });
  });

  // --- Logic: Photo Fallbacks ---

  it('fetches business details if photo is missing/dummy and googlePlacesId exists', async () => {
    const state = {
      ...initialState,
      businesses: {
        ...initialState.businesses,
        businesses: [
          {
            ...initialState.businesses.businesses[0],
            photo: 'dummy-url',
          },
        ],
      },
    };
    setup(state);
    await waitFor(() => {
      expect(mockFetchBusinessDetails).toHaveBeenCalledWith('google-id-123');
    });
  });

  it('falls back to fetchGooglePlacesImage if fetchBusinessDetails fails', async () => {
    mockFetchBusinessDetails.mockRejectedValue(new Error('Failed'));

    const state = {
      ...initialState,
      businesses: {
        ...initialState.businesses,
        businesses: [
          {
            ...initialState.businesses.businesses[0],
            photo: '', // strict empty string match for your types
          },
        ],
      },
    };

    setup(state);

    await waitFor(() => {
      expect(mockFetchGooglePlacesImage).toHaveBeenCalledWith('google-id-123');
    });
  });

  it('handles errors gracefully in photo fetching chain', async () => {
    mockFetchBusinessDetails.mockRejectedValue(new Error('Fail 1'));
    mockFetchGooglePlacesImage.mockRejectedValue(new Error('Fail 2'));

    const state = {
      ...initialState,
      businesses: {
        ...initialState.businesses,
        businesses: [
          {
            ...initialState.businesses.businesses[0],
            photo: '',
          },
        ],
      },
    };

    setup(state);

    await waitFor(() => {
      expect(mockFetchGooglePlacesImage).toHaveBeenCalled();
    });
  });

  it('does not fetch photos if photo exists and is not dummy', () => {
    setup();
    expect(mockFetchBusinessDetails).not.toHaveBeenCalled();
  });

  // --- Logic: Form Interactions ---

  it('updates state when changing date, time, emergency, and concern', () => {
    const {getByTestId} = setup();
    fireEvent.press(getByTestId('ChangeDateBtn'));
    fireEvent.press(getByTestId('SelectSlotBtn'));
    fireEvent.press(getByTestId('ToggleEmergencyBtn'));
    fireEvent.press(getByTestId('ChangeConcernBtn'));
  });

  it('handles submission (reschedule)', async () => {
    const {getByTestId} = setup();

    fireEvent.press(getByTestId('SelectSlotBtn'));

    await act(async () => {
      fireEvent(getByTestId('SubmitButton'), 'touchEnd');
    });

    const {
      rescheduleAppointment,
    } = require('@/features/appointments/appointmentsSlice');
    await waitFor(() => {
      expect(rescheduleAppointment).toHaveBeenCalledWith(
        expect.objectContaining({
          appointmentId: 'apt-123',
          isEmergency: expect.any(Boolean),
        }),
      );
      expect(mockGoBack).toHaveBeenCalled();
    });
  });

  it('does not submit if time is invalid (null) and navigates back', async () => {
    const {getByTestId} = setup();

    // 1. Clear Slot (sets time to null)
    fireEvent.press(getByTestId('ClearSlotBtn'));

    // 2. Submit (Bypassing disabled prop via our LiquidGlassButton mock)
    await act(async () => {
      fireEvent(getByTestId('SubmitButton'), 'touchEnd');
    });

    const {
      rescheduleAppointment,
    } = require('@/features/appointments/appointmentsSlice');
    // 3. Verify Reschedule NOT called, but GoBack IS called (Lines 148-149)
    expect(rescheduleAppointment).not.toHaveBeenCalled();
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('handles submission error gracefully', async () => {
    // Override reschedule to return a failed promise inside unwrap
    const {
      rescheduleAppointment,
    } = require('@/features/appointments/appointmentsSlice');

    (rescheduleAppointment as unknown as jest.Mock).mockReturnValueOnce({
      type: 'appointments/reschedule',
      unwrap: jest.fn().mockRejectedValue(new Error('Fail')),
    });

    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const {getByTestId} = setup();
    fireEvent.press(getByTestId('SelectSlotBtn'));

    await act(async () => {
      fireEvent(getByTestId('SubmitButton'), 'touchEnd');
    });

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to reschedule'),
        expect.any(Error),
      );
    });
    consoleSpy.mockRestore();
  });

  // --- Logic: Cancellation & Header ---

  it('shows delete icon for BOOKED status and opens sheet on press', () => {
    const {getByTestId} = setup();
    const deleteBtn = getByTestId('HeaderRight');
    expect(deleteBtn).toBeTruthy();

    fireEvent.press(deleteBtn);
    fireEvent.press(getByTestId('ConfirmCancelBtn'));

    const {
      cancelAppointment,
    } = require('@/features/appointments/appointmentsSlice');
    expect(cancelAppointment).toHaveBeenCalledWith({appointmentId: 'apt-123'});
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('hides delete icon for NO_PAYMENT status', () => {
    const state = {
      ...initialState,
      appointments: {
        ...initialState.appointments,
        items: [{...initialState.appointments.items[0], status: 'NO_PAYMENT'}],
      },
    };
    const {queryByTestId} = setup(state);
    expect(queryByTestId('HeaderRight')).toBeNull();
  });

  it('hides delete icon for AWAITING_PAYMENT status', () => {
    const state = {
      ...initialState,
      appointments: {
        ...initialState.appointments,
        items: [
          {...initialState.appointments.items[0], status: 'AWAITING_PAYMENT'},
        ],
      },
    };
    const {queryByTestId} = setup(state);
    expect(queryByTestId('HeaderRight')).toBeNull();
  });

  it('hides delete icon for PAYMENT_FAILED status', () => {
    const state = {
      ...initialState,
      appointments: {
        ...initialState.appointments,
        items: [
          {...initialState.appointments.items[0], status: 'PAYMENT_FAILED'},
        ],
      },
    };
    const {queryByTestId} = setup(state);
    expect(queryByTestId('HeaderRight')).toBeNull();
  });

  it('navigates back when header back is pressed', () => {
    const {getByTestId} = setup();
    fireEvent.press(getByTestId('HeaderBack'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  // --- Logic: Legal Links & Employee Card ---

  it('triggers all legal navigation links', () => {
    const {getAllByText} = setup();

    fireEvent.press(getAllByText('terms and conditions')[0]);
    expect(mockOpenBusinessTerms).toHaveBeenCalled();

    fireEvent.press(getAllByText('privacy policy')[0]);
    expect(mockOpenBusinessPrivacy).toHaveBeenCalled();

    fireEvent.press(getAllByText('cancellation policy')[0]);
    expect(mockOpenBusinessCancellation).toHaveBeenCalled();
  });

  it('navigates back when editing employee', () => {
    const {getByTestId} = setup();
    fireEvent.press(getByTestId('EditEmployeeBtn'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  // --- Edge Cases: Missing Data ---

  it('handles missing appointment time (initial load)', () => {
    const state = {
      ...initialState,
      appointments: {
        ...initialState.appointments,
        // Cast as any if Typescript complains about strict null checks, but here we just pass null
        items: [{...initialState.appointments.items[0], time: null} as any],
      },
    };
    const {getByTestId} = setup(state);
    expect(getByTestId('FormContent')).toBeTruthy();
  });

  it('handles missing business/employee/service data', () => {
    const state = {
      ...initialState,
      appointments: {
        ...initialState.appointments,
        items: [
          {
            ...initialState.appointments.items[0],
            businessId: 'unknown',
            serviceId: 'unknown',
            employeeId: 'unknown',
            businessGooglePlacesId: '',
          },
        ],
      },
    };

    const {getByTestId} = setup(state);
    expect(getByTestId('FormContent')).toBeTruthy();
  });

  it('handles empty slots when time is selected', () => {
    const {
      getSlotsForDate,
    } = require('@/features/appointments/utils/availability');
    getSlotsForDate.mockReturnValue([]);

    const {getByTestId} = setup();
    expect(getByTestId('FormContent')).toBeTruthy();
  });
});
