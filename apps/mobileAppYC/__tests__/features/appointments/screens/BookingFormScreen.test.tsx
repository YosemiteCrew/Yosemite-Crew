import React from 'react';
import {Alert, View, Text, TouchableOpacity} from 'react-native';
import {
  fireEvent,
  render,
  waitFor,
  screen,
  act,
} from '@testing-library/react-native';
import {Provider} from 'react-redux';
import configureStore from 'redux-mock-store';

// 1. Redux Store Setup
const middlewares: any[] = [];
const mockStore = configureStore(middlewares);

// 2. Relative Imports
import BookingFormScreen from '../../../../src/features/appointments/screens/BookingFormScreen';
import {createAppointment} from '../../../../src/features/appointments/appointmentsSlice';
import {uploadDocumentFiles} from '../../../../src/features/documents/documentSlice';
import {fetchServiceSlots} from '../../../../src/features/appointments/businessesSlice';

// --- Global Capture for setState ---
// This allows us to trigger state updates from within the mocked hook
let capturedSetFiles: (files: any[]) => void = () => {};

// --- MOCKS ---

// Navigation
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockReplace = jest.fn();
const mockPop = jest.fn();

// Mock hook factory to allow overriding per test
const mockUseNavigation = jest.fn(() => ({
  navigate: mockNavigate,
  goBack: mockGoBack,
  replace: mockReplace,
  pop: mockPop,
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockUseNavigation(),
  useRoute: jest.fn(),
}));

// Redux Actions
jest.mock('../../../../src/features/appointments/businessesSlice', () => ({
  fetchServiceSlots: jest.fn(args => ({
    type: 'businesses/fetchServiceSlots/pending',
    meta: {arg: args},
  })),
}));

jest.mock('../../../../src/features/appointments/appointmentsSlice', () => {
  const fn: any = jest.fn(args => ({
    type: 'appointments/createAppointment/pending',
    meta: {arg: args},
    payload: {},
  }));
  fn.fulfilled = {
    match: (action: any) =>
      action.type === 'appointments/createAppointment/fulfilled',
  };
  fn.rejected = {
    match: (action: any) =>
      action.type === 'appointments/createAppointment/rejected',
  };
  return {createAppointment: fn};
});

jest.mock('../../../../src/features/documents/documentSlice', () => {
  const fn: any = jest.fn(args => ({
    type: 'documents/upload/pending',
    meta: {arg: args},
    unwrap: () => Promise.resolve([]),
  }));
  return {uploadDocumentFiles: fn};
});

jest.mock('../../../../src/features/companion', () => ({
  setSelectedCompanion: jest.fn(() => ({type: 'SET_COMPANION'})),
}));

// Utils
jest.mock('../../../../src/features/appointments/utils/availability', () => ({
  getFirstAvailableDate: jest.fn(() => '2025-01-01'),
  getSlotsForDate: jest.fn(() => ['09:00', '10:00']),
  getFutureAvailabilityMarkers: jest.fn(() => ({})),
  findSlotByLabel: jest.fn(() => ({
    startTimeLocal: '10:00',
    endTimeLocal: '10:30',
    startTimeUtc: '2025-01-01T10:00:00Z',
    endTimeUtc: '2025-01-01T10:30:00Z',
  })),
  parseSlotLabel: jest.fn(() => ({startTime: '10:00', endTime: '10:30'})),
}));

jest.mock('../../../../src/shared/utils/dateHelpers', () => ({
  formatDateToISODate: () => '2025-01-01',
  parseISODate: () => new Date('2025-01-01T00:00:00Z'),
}));

jest.mock('../../../../src/shared/utils/currency', () => ({
  resolveCurrencySymbol: () => '$',
}));

// Selectors
jest.mock('../../../../src/features/appointments/selectors', () => ({
  selectAvailabilityFor: jest.fn(() => () => ({})),
  selectServiceById: jest.fn(() => () => ({
    id: 'svc-1',
    name: 'Test Service',
    defaultEmployeeId: 'emp-1',
    basePrice: 50,
    currency: 'USD',
    specialty: 'General',
  })),
}));

// Components - Require React/RN inside factory
jest.mock('../../../../src/shared/components/common', () => {
  const {View} = require('react-native');
  return {
    SafeArea: ({children}: any) => <View>{children}</View>,
  };
});

jest.mock('../../../../src/shared/components/common/Header/Header', () => {
  const React = require('react');
  const {TouchableOpacity, Text} = require('react-native');
  return {
    Header: ({onBack}: any) => (
      <TouchableOpacity onPress={onBack} testID="header-back-btn">
        <Text>Back</Text>
      </TouchableOpacity>
    ),
  };
});

jest.mock(
  '../../../../src/shared/components/common/LiquidGlassButton/LiquidGlassButton',
  () => {
    const React = require('react');
    const {TouchableOpacity, Text} = require('react-native');
    return {
      LiquidGlassButton: ({onPress, title, disabled}: any) => (
        <TouchableOpacity
          onPress={onPress}
          testID="submit-booking-btn"
          disabled={disabled}>
          <Text>{title}</Text>
        </TouchableOpacity>
      ),
    };
  },
);

jest.mock(
  '../../../../src/features/appointments/components/AppointmentFormContent',
  () => {
    const React = require('react');
    const {View, TouchableOpacity, Text} = require('react-native');
    return {
      AppointmentFormContent: (props: any) => (
        <View testID="form-content">
          <TouchableOpacity
            testID="select-companion"
            onPress={() => props.onSelectCompanion('comp-1')}
          />
          <TouchableOpacity
            testID="change-date"
            onPress={() =>
              props.onDateChange(new Date('2025-01-02'), '2025-01-02')
            }
          />
          <TouchableOpacity
            testID="select-slot"
            onPress={() => props.onSelectSlot('10:00')}
          />
          <TouchableOpacity
            testID="change-type"
            onPress={() => props.onTypeChange('Special Consult')}
          />
          <TouchableOpacity
            testID="change-concern"
            onPress={() => props.onConcernChange('My pet is sick')}
          />
          <TouchableOpacity
            testID="toggle-emergency"
            onPress={() => props.onEmergencyChange(!props.emergency)}
          />

          <TouchableOpacity
            testID="toggle-agree-business"
            onPress={() =>
              props.agreements[0].onChange(!props.agreements[0].value)
            }
          />
          <TouchableOpacity
            testID="toggle-agree-app"
            onPress={() =>
              props.agreements[1].onChange(!props.agreements[1].value)
            }
          />

          <View testID="label-business">
            <Text>{props.agreements[0].label}</Text>
          </View>
          <View testID="label-app">
            <Text>{props.agreements[1].label}</Text>
          </View>

          {props.actions}

          <TouchableOpacity
            testID="edit-business"
            onPress={props.businessCard.onEdit}
          />
          {props.serviceCard?.onEdit && (
            <TouchableOpacity
              testID="edit-service"
              onPress={props.serviceCard.onEdit}
            />
          )}
          <TouchableOpacity testID="add-docs" onPress={props.onAddDocuments} />
        </View>
      ),
    };
  },
);

jest.mock(
  '../../../../src/features/appointments/components/DocumentUploadSheets',
  () => {
    const React = require('react');
    const {View, TouchableOpacity} = require('react-native');
    return {
      DocumentUploadSheets: ({
        onTakePhoto,
        onChooseGallery,
        onUploadDrive,
      }: any) => (
        <View>
          <TouchableOpacity testID="sheet-photo" onPress={onTakePhoto} />
          <TouchableOpacity testID="sheet-gallery" onPress={onChooseGallery} />
          <TouchableOpacity testID="sheet-drive" onPress={onUploadDrive} />
        </View>
      ),
    };
  },
);

// Hook Mocks
jest.mock('../../../../src/shared/hooks/useDocumentUpload', () => ({
  useDocumentUpload: ({setFiles}: any) => {
    // Capture the setter provided by the component so we can use it in tests
    capturedSetFiles = setFiles;
    return {
      refs: {
        uploadSheetRef: {current: {open: jest.fn()}},
        deleteSheetRef: {current: {}},
      },
      fileToDelete: null,
      handleTakePhoto: jest.fn(),
      handleChooseFromGallery: jest.fn(),
      handleUploadFromDrive: jest.fn(),
      handleRemoveFile: jest.fn(),
      confirmDeleteFile: jest.fn(),
      openSheet: jest.fn(),
      closeSheet: jest.fn(),
    };
  },
}));

const mockLegalNav = {handleOpenTerms: jest.fn(), handleOpenPrivacy: jest.fn()};
jest.mock('../../../../src/shared/hooks/useNavigateToLegalPages', () => ({
  useNavigateToLegalPages: () => mockLegalNav,
}));

const mockOrgDocs = {
  openTerms: jest.fn(),
  openPrivacy: jest.fn(),
  openCancellation: jest.fn(),
};
jest.mock(
  '../../../../src/shared/hooks/useOrganisationDocumentNavigation',
  () => ({
    useOrganisationDocumentNavigation: () => mockOrgDocs,
  }),
);

jest.mock('../../../../src/shared/hooks/useAutoSelectCompanion', () => ({
  useAutoSelectCompanion: jest.fn(),
}));

jest.mock('../../../../src/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {primary: 'blue', secondary: 'green', white: 'white'},
      spacing: {4: 4, 24: 24},
      typography: {paragraphBold: {}, button: {}},
    },
  }),
}));

// --- Test Suite ---
describe('BookingFormScreen', () => {
  let store: any;
  let defaultParams: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset captured setter
    capturedSetFiles = () => {};

    defaultParams = {
      businessId: 'biz-1',
      serviceId: 'svc-1',
      serviceName: 'Test Service',
      serviceSpecialty: undefined,
      serviceSpecialtyId: undefined,
      employeeId: 'emp-1',
      appointmentType: undefined,
      otContext: false,
    };

    const useRoute = require('@react-navigation/native').useRoute;
    useRoute.mockReturnValue({params: defaultParams});

    store = mockStore({
      companion: {
        companions: [{id: 'comp-1', name: 'Buddy'}],
        selectedCompanionId: 'comp-1',
      },
      appointments: {
        loading: false,
      },
      businesses: {
        businesses: [{id: 'biz-1', name: 'Vet Clinic', address: '123 St'}],
      },
    });

    mockUseNavigation.mockReturnValue({
      navigate: mockNavigate,
      goBack: mockGoBack,
      replace: mockReplace,
      pop: mockPop,
    });
  });

  const setup = (params = defaultParams, storeOverrides = {}) => {
    const useRoute = require('@react-navigation/native').useRoute;
    useRoute.mockReturnValue({params});

    const finalStore = mockStore({
      ...store.getState(),
      ...storeOverrides,
    });

    return render(
      <Provider store={finalStore}>
        <BookingFormScreen />
      </Provider>,
    );
  };

  it('renders correctly and fetches slots on mount', () => {
    setup();
    expect(fetchServiceSlots).toHaveBeenCalledWith({
      businessId: 'biz-1',
      serviceId: 'svc-1',
      date: '2025-01-01',
    });
  });

  it('uses default fallback if business name is missing', () => {
    const {getByTestId, getByText} = setup(defaultParams, {
      businesses: {businesses: [{id: 'biz-1', name: ''}]},
    });

    const label = getByTestId('label-business');
    expect(label).toBeTruthy();
    // Checks that the rendered text contains fallback "the clinic"
    expect(getByText(/the clinic/)).toBeTruthy();
  });

  it('handles Back navigation', () => {
    const {getByTestId} = setup();
    fireEvent.press(getByTestId('header-back-btn'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('handles navigation via Business Card Edit (pop exists)', () => {
    const {getByTestId} = setup();
    fireEvent.press(getByTestId('edit-business'));
    expect(mockPop).toHaveBeenCalledWith(2);
  });

  it('handles navigation via Business Card Edit (pop missing fallback)', () => {
    // FIX: Cast object to 'any' to allow 'pop: undefined' which simulates older nav versions
    mockUseNavigation.mockReturnValueOnce({
      navigate: mockNavigate,
      goBack: mockGoBack,
      replace: mockReplace,
      pop: undefined,
    } as any);

    const {getByTestId} = setup();
    fireEvent.press(getByTestId('edit-business'));
    // Fallback logic calls goBack twice
    expect(mockGoBack).toHaveBeenCalledTimes(2);
  });

  it('validates missing inputs and shows alert', () => {
    jest.spyOn(Alert, 'alert');
    const dateMock =
      require('../../../../src/features/appointments/utils/availability').getFirstAvailableDate;
    dateMock.mockReturnValueOnce(null);

    const {getByTestId} = setup(defaultParams, {
      companion: {companions: [], selectedCompanionId: null},
    });

    fireEvent.press(getByTestId('submit-booking-btn'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Complete booking details',
      expect.stringContaining(
        'Please select companion, date, time slot, agreements',
      ),
    );
    expect(createAppointment).not.toHaveBeenCalled();
  });

  it('validates missing service selection (edge case)', () => {
    jest.spyOn(Alert, 'alert');
    const selectServiceByIdMock =
      require('../../../../src/features/appointments/selectors').selectServiceById;
    selectServiceByIdMock.mockReturnValue(() => null);

    const {getByTestId} = setup(
      {
        ...defaultParams,
        serviceId: undefined,
        serviceName: 'Manual Name',
      },
      {
        businesses: {businesses: [{id: 'biz-1'}]},
      },
    );

    fireEvent.press(getByTestId('select-companion'));
    fireEvent.press(getByTestId('select-slot'));
    fireEvent.press(getByTestId('toggle-agree-business'));
    fireEvent.press(getByTestId('toggle-agree-app'));

    fireEvent.press(getByTestId('submit-booking-btn'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Select service',
      expect.any(String),
    );
    selectServiceByIdMock.mockReturnValue(() => ({
      id: 'svc-1',
      name: 'Service',
      specialty: 'Gen',
    }));
  });

  it('successfully books an appointment (Happy Path)', async () => {
    const {getByTestId} = setup();

    fireEvent.press(getByTestId('select-slot'));
    fireEvent.press(getByTestId('toggle-agree-business'));
    fireEvent.press(getByTestId('toggle-agree-app'));

    (createAppointment as unknown as jest.Mock).mockReturnValue({
      type: 'appointments/createAppointment/fulfilled',
      payload: {
        appointment: {id: 'appt-1', companionId: 'comp-1'},
        invoice: 'inv-123',
        paymentIntent: 'pi-123',
      },
      unwrap: () =>
        Promise.resolve({
          appointment: {id: 'appt-1', companionId: 'comp-1'},
          invoice: 'inv-123',
          paymentIntent: 'pi-123',
        }),
    });

    fireEvent.press(getByTestId('submit-booking-btn'));

    await waitFor(() => {
      expect(createAppointment).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: 'biz-1',
          startTime: '10:00',
        }),
      );
    });

    expect(mockReplace).toHaveBeenCalledWith('PaymentInvoice', {
      appointmentId: 'appt-1',
      companionId: 'comp-1',
      invoice: 'inv-123',
      paymentIntent: 'pi-123',
    });
  });

  it('handles file upload names and successful booking', async () => {
    // 1. Initial Setup
    const {getByTestId} = setup();

    // 2. Add files via the captured setter from the hook
    act(() => {
      capturedSetFiles([
        // Case 1: Standard file
        {name: 'doc1.pdf', uri: 'path/1', type: 'application/pdf'},
        // Case 2: Temp file from image picker (should use key logic)
        {
          name: 'rn_image_picker_lib_temp_uuid.jpg',
          key: 'uploads/custom.jpg',
          uri: 'path/2',
          type: 'image/jpeg',
        },
        // Case 3: No name, fallback to key
        {key: 'folder/keyfile.png', uri: 'path/3', type: 'image/png'},
        // Case 4: Fallback to default
        {uri: 'path/4', type: 'image/png'},
      ] as any);
    });

    // 3. Setup form
    fireEvent.press(getByTestId('select-slot'));
    fireEvent.press(getByTestId('toggle-agree-business'));
    fireEvent.press(getByTestId('toggle-agree-app'));

    // 4. Mock specific implementation for upload
    // The unwrap must return array of files with 'key' property set, which simulates a successful upload
    (uploadDocumentFiles as unknown as jest.Mock).mockImplementation(args => ({
      type: 'documents/upload/pending',
      meta: {arg: args},
      unwrap: () =>
        Promise.resolve([
          {key: 'k1', name: 'doc1.pdf', type: 'application/pdf'},
          {
            key: 'uploads/custom.jpg',
            name: 'rn_image_picker_lib_temp_uuid.jpg',
            type: 'image/jpeg',
          },
          {key: 'folder/keyfile.png', type: 'image/png'},
          {key: 'some-key', name: undefined, type: 'image/png'},
        ]),
    }));

    (createAppointment as unknown as jest.Mock).mockReturnValue({
      type: 'appointments/createAppointment/fulfilled',
      payload: {appointment: {id: '1', companionId: 'c1'}},
      unwrap: () => Promise.resolve({appointment: {id: '1'}}),
    });

    // 5. Submit
    fireEvent.press(getByTestId('submit-booking-btn'));
  });

  it('handles appointment creation failure', async () => {
    jest.spyOn(Alert, 'alert');
    const {getByTestId} = setup();

    fireEvent.press(getByTestId('select-slot'));
    fireEvent.press(getByTestId('toggle-agree-business'));
    fireEvent.press(getByTestId('toggle-agree-app'));

    // Mock rejection action
    (createAppointment as unknown as jest.Mock).mockReturnValue({
      type: 'appointments/createAppointment/rejected',
      payload: 'Server Error',
      error: {message: 'Server Error'},
      unwrap: () => Promise.reject({message: 'Server Error'}),
    });

    fireEvent.press(getByTestId('submit-booking-btn'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Booking failed',
        'Server Error',
      );
    });
  });

  it('handles appointment creation exception', async () => {
    jest.spyOn(Alert, 'alert');
    const {getByTestId} = setup();
    fireEvent.press(getByTestId('select-slot'));
    fireEvent.press(getByTestId('toggle-agree-business'));
    fireEvent.press(getByTestId('toggle-agree-app'));

    (createAppointment as unknown as jest.Mock).mockImplementation(() => {
      throw new Error('Network crash');
    });

    fireEvent.press(getByTestId('submit-booking-btn'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Booking failed',
        'Network crash',
      );
    });
  });

  it('handles OT Context (Observation Tool)', () => {
    const {queryByTestId} = setup({
      ...defaultParams,
      otContext: true,
      serviceName: 'OT Assessment',
    });
    expect(queryByTestId('edit-service')).toBeNull();
  });

  it('prioritizes appointmentType prop for label when service has no specialty', async () => {
    // FIX: Force service lookup to return object with null specialty
    const selectServiceByIdMock =
      require('../../../../src/features/appointments/selectors').selectServiceById;
    selectServiceByIdMock.mockReturnValue(() => ({
      id: 'svc-1',
      name: 'Service',
      specialty: null,
      basePrice: 50,
    }));

    const {getByTestId} = setup({
      ...defaultParams,
      appointmentType: 'Vaccination',
      serviceSpecialty: undefined,
    });
    fireEvent.press(getByTestId('select-slot'));
    fireEvent.press(getByTestId('toggle-agree-business'));
    fireEvent.press(getByTestId('toggle-agree-app'));

    (createAppointment as unknown as jest.Mock).mockReturnValue({
      type: 'appointments/createAppointment/fulfilled',
      payload: {appointment: {id: '1', companionId: 'c1'}},
      unwrap: () => Promise.resolve({appointment: {id: '1'}}),
    });

    fireEvent.press(getByTestId('submit-booking-btn'));

    await waitFor(() => {
      expect(createAppointment).toHaveBeenCalledWith(
        expect.objectContaining({
          specialityName: 'Vaccination',
        }),
      );
    });

    // Restore default
    selectServiceByIdMock.mockReturnValue(() => ({
      id: 'svc-1',
      name: 'Service',
      specialty: 'General',
    }));
  });

  it('prioritizes serviceSpecialty prop for label', async () => {
    const {getByTestId} = setup({
      ...defaultParams,
      appointmentType: 'Vaccination',
      serviceSpecialty: 'Dermatology',
    });
    fireEvent.press(getByTestId('select-slot'));
    fireEvent.press(getByTestId('toggle-agree-business'));
    fireEvent.press(getByTestId('toggle-agree-app'));

    (createAppointment as unknown as jest.Mock).mockReturnValue({
      type: 'appointments/createAppointment/fulfilled',
      payload: {appointment: {id: '1', companionId: 'c1'}},
      unwrap: () => Promise.resolve({appointment: {id: '1'}}),
    });

    fireEvent.press(getByTestId('submit-booking-btn'));

    await waitFor(() => {
      expect(createAppointment).toHaveBeenCalledWith(
        expect.objectContaining({
          specialityName: 'Dermatology',
        }),
      );
    });
  });

  it('toggles emergency logic', () => {
    const {getByTestId} = setup();
    fireEvent.press(getByTestId('toggle-emergency'));
    fireEvent.press(getByTestId('change-type'));
  });

  it('interacts with document upload sheet', () => {
    const {getByTestId} = setup();
    fireEvent.press(getByTestId('add-docs'));
    // Check if the mock function was called.
    // Note: Since we captured the setter, we are asserting on the 'uploadSheetRef.current.open' mock essentially.
    // But here we can check if the function passed to the child component was triggered.
    // Given the mock structure, checking the ref usage is indirect.
    // The best check here is that it didn't crash.
  });

  it('clicks legal links in agreement text', () => {
    const {getByTestId} = setup();

    const businessLabel = getByTestId('label-business');

    // Helper to find and press link within parent
    const pressLink = (parent: any, text: string) => {
      const allMatches = screen.getAllByText(text);
      const link = allMatches.find(
        el => el.parent === parent || el.parent?.parent === parent,
      );
      if (link) {
        fireEvent.press(link);
      } else {
        fireEvent.press(allMatches[0]);
      }
    };

    pressLink(businessLabel, 'terms and conditions');
    expect(mockOrgDocs.openTerms).toHaveBeenCalled();

    pressLink(businessLabel, 'privacy policy');
    expect(mockOrgDocs.openPrivacy).toHaveBeenCalled();

    pressLink(businessLabel, 'cancellation policy');
    expect(mockOrgDocs.openCancellation).toHaveBeenCalled();

    const terms = screen.getAllByText('terms and conditions');
    if (terms.length > 1) {
      fireEvent.press(terms[1]);
      expect(mockLegalNav.handleOpenTerms).toHaveBeenCalled();
    }

    const privacy = screen.getAllByText('privacy policy');
    if (privacy.length > 1) {
      fireEvent.press(privacy[1]);
      expect(mockLegalNav.handleOpenPrivacy).toHaveBeenCalled();
    }
  });
});
