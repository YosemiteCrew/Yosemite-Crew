import React from 'react';
import {Alert, Platform} from 'react-native';
import {render, fireEvent, waitFor} from '@testing-library/react-native';
import BusinessDetailsScreen from '../../../../src/features/appointments/screens/BusinessDetailsScreen';

const mockAlertFn = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

// --- 1. Core Mocks (Hooks & Navigation) ---

// Mock useTheme with the specific structure expected by the component
jest.mock('../../../../src/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockCanGoBack = jest.fn().mockReturnValue(true);
const mockTabNavigate = jest.fn();
let mockGetParent: jest.Mock = jest.fn().mockReturnValue({
  navigate: mockTabNavigate,
});
// Use a getter for params so we can change them per test if needed
let mockRouteParams: any = {businessId: 'bus-123'};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    canGoBack: mockCanGoBack,
    getParent: mockGetParent,
  }),
  useRoute: () => ({
    params: mockRouteParams,
  }),
}));

let mockDistanceUnit = 'km';
jest.mock('../../../../src/features/preferences/PreferencesContext', () => ({
  usePreferences: () => ({
    measurementSystem: 'metric',
    weightUnit: 'kg',
    get distanceUnit() {
      return mockDistanceUnit;
    },
  }),
}));

// --- 2. Redux Mocks ---

const mockDispatch = jest.fn();
jest.mock('react-redux', () => ({
  useDispatch: () => mockDispatch,
  useSelector: jest.fn(),
}));
import {useSelector} from 'react-redux';

jest.mock('../../../../src/features/appointments/businessesSlice', () => ({
  fetchBusinesses: jest.fn(() => ({
    type: 'fetchBusinesses',
    unwrap: jest.fn(),
  })),
}));
import {fetchBusinesses} from '../../../../src/features/appointments/businessesSlice';

jest.mock('../../../../src/features/linkedBusinesses', () => ({
  fetchBusinessDetails: jest.fn(),
  fetchGooglePlacesImage: jest.fn(),
}));
import {
  fetchBusinessDetails,
  fetchGooglePlacesImage,
} from '../../../../src/features/linkedBusinesses';

jest.mock('../../../../src/features/appointments/selectors', () => ({
  createSelectServicesForBusiness: () => (state: any, businessId: string) => {
    return state.businesses.services.filter(
      (s: any) => s.businessId === businessId,
    );
  },
  createSelectPackagesForBusiness: () => (state: any, businessId: string) => {
    return (state.businesses.packages ?? []).filter(
      (p: any) => p.businessId === businessId,
    );
  },
}));

// --- 3. Component Mocks (Crucial for "Element type is invalid" fix) ---

// VetBusinessCard is a DEFAULT export
jest.mock(
  '../../../../src/features/appointments/components/VetBusinessCard/VetBusinessCard',
  () => {
    const {View, Text} = require('react-native');
    return (props: any) => (
      <View testID="vet-business-card">
        <Text>{props.name}</Text>
        <Text>{props.distance}</Text>
        <Text>
          {props.fallbackPhoto
            ? `Fallback:${props.fallbackPhoto}`
            : 'NoFallback'}
        </Text>
      </View>
    );
  },
);

jest.mock(
  '../../../../src/features/appointments/components/SpecialtyAccordion',
  () => {
    const {View, Text, TouchableOpacity} = require('react-native');
    return {
      SpecialtyAccordion: ({
        specialties,
        onSelectService,
        onSelectPackage,
      }: any) => (
        <View testID="specialty-accordion">
          {specialties.map((grp: any) => (
            <View key={grp.name}>
              <Text>{grp.name}</Text>
              {grp.services.map((svc: any) => (
                <TouchableOpacity
                  key={svc.id}
                  testID={`service-${svc.id}`}
                  onPress={() => onSelectService(svc.id, grp.name)}>
                  <Text>{svc.name}</Text>
                </TouchableOpacity>
              ))}
              {(grp.packages ?? []).map((pkg: any) => (
                <TouchableOpacity
                  key={pkg.id}
                  testID={`package-${pkg.id}`}
                  onPress={() => onSelectPackage(pkg.id, pkg.name)}>
                  <Text>{pkg.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
          <TouchableOpacity
            testID="service-undefined-specialty"
            onPress={() => onSelectService('svc-1', undefined)}>
            <Text>Undefined specialty service</Text>
          </TouchableOpacity>
        </View>
      ),
    };
  },
);

// Header is a NAMED export
jest.mock('../../../../src/shared/components/common/Header/Header', () => {
  const {TouchableOpacity, Text} = require('react-native');
  return {
    Header: ({onBack}: any) => (
      <TouchableOpacity testID="header-back" onPress={onBack}>
        <Text>Back</Text>
      </TouchableOpacity>
    ),
  };
});

// LiquidGlassButton is a NAMED export
jest.mock(
  '../../../../src/shared/components/common/LiquidGlassButton/LiquidGlassButton',
  () => {
    const {TouchableOpacity, Text} = require('react-native');
    return {
      LiquidGlassButton: ({title, onPress}: any) => (
        <TouchableOpacity testID="glass-button" onPress={onPress}>
          <Text>{title}</Text>
        </TouchableOpacity>
      ),
    };
  },
);

// SafeArea is a NAMED export
jest.mock('../../../../src/shared/components/common', () => ({
  SafeArea: ({children}: any) => children,
}));

// --- 4. Utility Mocks ---

jest.mock('../../../../src/shared/utils/openMaps', () => ({
  openMapsToPlaceId: jest.fn(),
  openMapsToAddress: jest.fn(),
}));
import {
  openMapsToPlaceId,
  openMapsToAddress,
} from '../../../../src/shared/utils/openMaps';

jest.mock('../../../../src/features/appointments/utils/photoUtils', () => ({
  isDummyPhoto: jest.fn(),
}));
import {isDummyPhoto} from '../../../../src/features/appointments/utils/photoUtils';
import {mockTheme} from '../../../setup/mockTheme';

// --- Test Data ---

const mockBusiness = {
  id: 'bus-123',
  name: 'Test Clinic',
  googlePlacesId: 'gp-123',
  address: '123 Fake St',
  distanceMi: 5.5,
  rating: 4.5,
  openHours: '9-5',
  website: 'http://vet.com',
  photo: 'dummy.jpg',
};

const mockServices = [
  {
    id: 'svc-1',
    businessId: 'bus-123',
    name: 'Vaccine',
    specialty: 'General',
    specialityId: 'spec-1',
  },
  {
    id: 'svc-2',
    businessId: 'bus-123',
    name: 'Surgery',
    specialty: 'Surgical',
    specialityId: 'spec-2',
  },
  {id: 'svc-3', businessId: 'bus-123', name: 'Checkup'}, // Undefined specialty -> 'General'
];

const mockServicesWithSpecies = [
  {
    id: 'svc-feline',
    businessId: 'bus-123',
    name: 'Feline Dental',
    specialty: 'Feline',
    specialityId: 'spec-feline',
  },
  {
    id: 'svc-canine',
    businessId: 'bus-123',
    name: 'Canine Checkup',
    specialty: 'Canine',
    specialityId: 'spec-canine',
  },
];

// --- Tests ---

describe('BusinessDetailsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteParams = {businessId: 'bus-123'};
    mockDistanceUnit = 'km';
    mockGetParent = jest.fn().mockReturnValue({navigate: mockTabNavigate});

    // Default Selector Implementation
    (useSelector as unknown as jest.Mock).mockImplementation(selectorFn => {
      return selectorFn({
        businesses: {
          businesses: [mockBusiness],
          services: mockServices,
        },
        companion: {
          companions: [],
          selectedCompanionId: null,
        },
      });
    });

    // Default Dispatch Implementation
    mockDispatch.mockReturnValue({unwrap: () => Promise.resolve({})});

    // Default Utils
    (isDummyPhoto as jest.Mock).mockReturnValue(true);
  });

  it('renders business details and groups services correctly', () => {
    const {getByTestId, getByText} = render(<BusinessDetailsScreen />);

    expect(getByTestId('vet-business-card')).toBeTruthy();
    expect(getByText('Test Clinic')).toBeTruthy();

    expect(getByTestId('specialty-accordion')).toBeTruthy();
    expect(getByText('General')).toBeTruthy();
    expect(getByText('Surgical')).toBeTruthy();
    expect(getByText('Vaccine')).toBeTruthy();
  });

  it('dispatches fetchBusinesses if business is not found in state', () => {
    (useSelector as unknown as jest.Mock).mockImplementation(selectorFn => {
      return selectorFn({
        businesses: {
          businesses: [], // Empty businesses
          services: mockServices,
        },
        companion: {companions: [], selectedCompanionId: null},
      });
    });

    render(<BusinessDetailsScreen />);
    expect(fetchBusinesses).toHaveBeenCalledWith();
  });

  it('dispatches fetchBusinesses if totalServices is 0', () => {
    (useSelector as unknown as jest.Mock).mockImplementation(selectorFn => {
      return selectorFn({
        businesses: {
          businesses: [mockBusiness],
          services: [], // Empty services
        },
        companion: {companions: [], selectedCompanionId: null},
      });
    });

    render(<BusinessDetailsScreen />);
    expect(fetchBusinesses).toHaveBeenCalled();
  });

  it('renders empty state when no services match business', () => {
    (useSelector as unknown as jest.Mock).mockImplementation(selectorFn => {
      return selectorFn({
        businesses: {
          businesses: [mockBusiness],
          services: [{id: 'svc-99', businessId: 'other-bus'}], // Mismatch ID
        },
        companion: {companions: [], selectedCompanionId: null},
      });
    });

    const {getByText, queryByTestId} = render(<BusinessDetailsScreen />);

    expect(getByText('Services coming soon')).toBeTruthy();
    expect(queryByTestId('specialty-accordion')).toBeNull();
  });

  it('navigates back on header press', () => {
    const {getByTestId} = render(<BusinessDetailsScreen />);
    fireEvent.press(getByTestId('header-back'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('navigates to a parent tab when returnTo.tab is set instead of going back', () => {
    mockRouteParams = {
      businessId: 'bus-123',
      returnTo: {tab: 'Home', screen: 'Dashboard'},
    };
    const {getByTestId} = render(<BusinessDetailsScreen />);
    fireEvent.press(getByTestId('header-back'));

    expect(mockTabNavigate).toHaveBeenCalledWith('Home', {screen: 'Dashboard'});
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('navigates to a parent tab with no screen param when returnTo.screen is missing', () => {
    mockRouteParams = {
      businessId: 'bus-123',
      returnTo: {tab: 'Home'},
    };
    const {getByTestId} = render(<BusinessDetailsScreen />);
    fireEvent.press(getByTestId('header-back'));

    expect(mockTabNavigate).toHaveBeenCalledWith('Home', undefined);
  });

  it('falls back to normal goBack when returnTo.tab is set but no parent navigator exists', () => {
    mockRouteParams = {
      businessId: 'bus-123',
      returnTo: {tab: 'Home'},
    };
    mockGetParent = jest.fn().mockReturnValue(undefined);
    const {getByTestId} = render(<BusinessDetailsScreen />);
    fireEvent.press(getByTestId('header-back'));

    expect(mockTabNavigate).not.toHaveBeenCalled();
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('shows the distance in miles when the preferred unit is not km', () => {
    mockDistanceUnit = 'mi';
    const {getByText} = render(<BusinessDetailsScreen />);
    expect(getByText('5.5mi')).toBeTruthy();
  });

  it('groups packages by specialty and navigates to BookingForm when a package is selected', () => {
    (useSelector as unknown as jest.Mock).mockImplementation(selectorFn =>
      selectorFn({
        businesses: {
          businesses: [mockBusiness],
          services: mockServices,
          packages: [
            {
              id: 'pkg-1',
              businessId: 'bus-123',
              name: 'Wellness Package',
              specialty: 'Surgical',
              specialityId: 'spec-2',
            },
            {
              // Second package sharing the 'Surgical' key exercises the
              // "group already exists" branch of the grouping loop.
              id: 'pkg-1b',
              businessId: 'bus-123',
              name: 'Deluxe Surgical Package',
              specialty: 'Surgical',
              specialityId: 'spec-2b',
            },
            {
              // 'Grooming' has no matching service, so serviceGroups['Grooming']
              // is undefined -> exercises the `?? 0` / `?? []` fallbacks.
              id: 'pkg-3',
              businessId: 'bus-123',
              name: 'Grooming Package',
              specialty: 'Grooming',
            },
            {
              // No specialty/specialityId -> exercises the undefined fallbacks
              // in handleSelectPackage's navigation params.
              id: 'pkg-2',
              businessId: 'bus-123',
              name: 'Basic Package',
            },
          ],
        },
        companion: {companions: [], selectedCompanionId: null},
      }),
    );

    const {getByTestId, getByText} = render(<BusinessDetailsScreen />);
    expect(getByText('Wellness Package')).toBeTruthy();
    expect(getByText('Basic Package')).toBeTruthy();
    expect(getByText('Grooming Package')).toBeTruthy();

    fireEvent.press(getByTestId('package-pkg-1'));
    expect(mockNavigate).toHaveBeenCalledWith('BookingForm', {
      businessId: 'bus-123',
      serviceId: 'pkg-1',
      serviceName: 'Wellness Package',
      serviceSpecialty: 'Surgical',
      serviceSpecialtyId: 'spec-2',
    });

    fireEvent.press(getByTestId('package-pkg-2'));
    expect(mockNavigate).toHaveBeenCalledWith('BookingForm', {
      businessId: 'bus-123',
      serviceId: 'pkg-2',
      serviceName: 'Basic Package',
      serviceSpecialty: undefined,
      serviceSpecialtyId: undefined,
    });
  });

  it('navigates to BookingForm with correct params when service selected', () => {
    const {getByTestId} = render(<BusinessDetailsScreen />);
    fireEvent.press(getByTestId('service-svc-1'));

    expect(mockNavigate).toHaveBeenCalledWith('BookingForm', {
      businessId: 'bus-123',
      serviceId: 'svc-1',
      serviceName: 'Vaccine',
      serviceSpecialty: 'General',
      serviceSpecialtyId: 'spec-1',
    });
  });

  it('navigates with an undefined specialty when the service callback omits it', () => {
    const {getByTestId} = render(<BusinessDetailsScreen />);
    fireEvent.press(getByTestId('service-undefined-specialty'));

    expect(mockNavigate).toHaveBeenCalledWith('BookingForm', {
      businessId: 'bus-123',
      serviceId: 'svc-1',
      serviceName: 'Vaccine',
      serviceSpecialty: undefined,
      serviceSpecialtyId: 'spec-1',
    });
  });

  it('evaluates the Android empty-services fallback border', () => {
    const originalOS = Platform.OS;
    Platform.OS = 'android';
    try {
      (useSelector as unknown as jest.Mock).mockImplementation(selectorFn => {
        return selectorFn({
          businesses: {
            businesses: [mockBusiness],
            services: [{id: 'svc-99', businessId: 'other-bus'}],
          },
          companion: {companions: [], selectedCompanionId: null},
        });
      });

      const {getByText} = render(<BusinessDetailsScreen />);
      expect(getByText('Services coming soon')).toBeTruthy();
    } finally {
      Platform.OS = originalOS;
    }
  });

  describe('Photo Fetching', () => {
    it('skips fetching if googlePlacesId is missing', () => {
      const noPlaceBus = {...mockBusiness, googlePlacesId: undefined};
      (useSelector as unknown as jest.Mock).mockImplementation(selectorFn =>
        selectorFn({
          businesses: {businesses: [noPlaceBus], services: mockServices},
          companion: {companions: [], selectedCompanionId: null},
        }),
      );

      render(<BusinessDetailsScreen />);
      expect(fetchBusinessDetails).not.toHaveBeenCalled();
    });

    it('skips fetching if photo is real (not dummy)', () => {
      (isDummyPhoto as jest.Mock).mockReturnValue(false);
      render(<BusinessDetailsScreen />);
      expect(fetchBusinessDetails).not.toHaveBeenCalled();
    });

    it('Scenario 1: fetchBusinessDetails SUCCEEDS with photoUrl', async () => {
      (isDummyPhoto as jest.Mock).mockReturnValue(true);
      const unwrapDetails = jest
        .fn()
        .mockResolvedValue({photoUrl: 'http://details.jpg'});

      (fetchBusinessDetails as unknown as jest.Mock).mockReturnValue({
        unwrap: unwrapDetails,
      });
      mockDispatch.mockReturnValue({unwrap: unwrapDetails});

      const {findByText} = render(<BusinessDetailsScreen />);

      await findByText('Fallback:http://details.jpg');
    });

    it('Scenario 2: fetchBusinessDetails SUCCEEDS but NO photoUrl', async () => {
      (isDummyPhoto as jest.Mock).mockReturnValue(true);
      const unwrapDetails = jest.fn().mockResolvedValue({});
      (fetchBusinessDetails as unknown as jest.Mock).mockReturnValue({
        unwrap: unwrapDetails,
      });
      mockDispatch.mockReturnValue({unwrap: unwrapDetails});

      const {findByText} = render(<BusinessDetailsScreen />);

      await findByText('NoFallback');
      // Should NOT chain to google places if the first call didn't throw
      expect(fetchGooglePlacesImage).not.toHaveBeenCalled();
    });

    it('Scenario 3: fetchBusinessDetails FAILS -> fetchGooglePlacesImage SUCCEEDS with photoUrl', async () => {
      (isDummyPhoto as jest.Mock).mockReturnValue(true);

      const unwrapFail = jest.fn().mockRejectedValue(new Error('Fail'));
      const unwrapSuccess = jest
        .fn()
        .mockResolvedValue({photoUrl: 'http://google.jpg'});

      (fetchBusinessDetails as unknown as jest.Mock).mockReturnValue({
        unwrap: unwrapFail,
      });
      (fetchGooglePlacesImage as unknown as jest.Mock).mockReturnValue({
        unwrap: unwrapSuccess,
      });

      mockDispatch
        .mockReturnValueOnce({unwrap: unwrapFail})
        .mockReturnValueOnce({unwrap: unwrapSuccess});

      const {findByText} = render(<BusinessDetailsScreen />);

      await findByText('Fallback:http://google.jpg');
      expect(fetchGooglePlacesImage).toHaveBeenCalledWith('gp-123');
    });

    it('Scenario 4: fetchBusinessDetails FAILS -> fetchGooglePlacesImage SUCCEEDS but NO photoUrl', async () => {
      (isDummyPhoto as jest.Mock).mockReturnValue(true);

      const unwrapFail = jest.fn().mockRejectedValue(new Error('Fail'));
      const unwrapEmpty = jest.fn().mockResolvedValue({});

      (fetchBusinessDetails as unknown as jest.Mock).mockReturnValue({
        unwrap: unwrapFail,
      });
      (fetchGooglePlacesImage as unknown as jest.Mock).mockReturnValue({
        unwrap: unwrapEmpty,
      });

      mockDispatch
        .mockReturnValueOnce({unwrap: unwrapFail})
        .mockReturnValueOnce({unwrap: unwrapEmpty});

      const {findByText} = render(<BusinessDetailsScreen />);

      await waitFor(() => expect(fetchGooglePlacesImage).toHaveBeenCalled());
      await findByText('NoFallback');
    });

    it('Scenario 5: Both fetches FAIL', async () => {
      (isDummyPhoto as jest.Mock).mockReturnValue(true);
      const unwrapFail = jest.fn().mockRejectedValue(new Error('Fail'));

      (fetchBusinessDetails as unknown as jest.Mock).mockReturnValue({
        unwrap: unwrapFail,
      });
      (fetchGooglePlacesImage as unknown as jest.Mock).mockReturnValue({
        unwrap: unwrapFail,
      });

      mockDispatch.mockReturnValue({unwrap: unwrapFail});

      const {findByText} = render(<BusinessDetailsScreen />);

      await waitFor(() => expect(fetchGooglePlacesImage).toHaveBeenCalled());
      await findByText('NoFallback');
    });
  });

  describe('Get Directions', () => {
    it('opens maps with Place ID if available', () => {
      const {getByTestId} = render(<BusinessDetailsScreen />);
      fireEvent.press(getByTestId('glass-button'));
      expect(openMapsToPlaceId).toHaveBeenCalledWith('gp-123', '123 Fake St');
    });

    it('opens maps with Address if Place ID missing', () => {
      const addressOnlyBus = {...mockBusiness, googlePlacesId: undefined};
      (useSelector as unknown as jest.Mock).mockImplementation(selectorFn =>
        selectorFn({
          businesses: {businesses: [addressOnlyBus], services: mockServices},
          companion: {companions: [], selectedCompanionId: null},
        }),
      );

      const {getByTestId} = render(<BusinessDetailsScreen />);
      fireEvent.press(getByTestId('glass-button'));
      expect(openMapsToAddress).toHaveBeenCalledWith('123 Fake St');
    });

    it('does nothing if neither Place ID nor Address exists', () => {
      const emptyBus = {
        ...mockBusiness,
        googlePlacesId: undefined,
        address: undefined,
      };
      (useSelector as unknown as jest.Mock).mockImplementation(selectorFn =>
        selectorFn({
          businesses: {businesses: [emptyBus], services: mockServices},
          companion: {companions: [], selectedCompanionId: null},
        }),
      );

      const {getByTestId} = render(<BusinessDetailsScreen />);
      fireEvent.press(getByTestId('glass-button'));

      expect(openMapsToPlaceId).not.toHaveBeenCalled();
      expect(openMapsToAddress).not.toHaveBeenCalled();
    });
  });

  describe('Species Mismatch', () => {
    const companionStateWithDog = {
      companions: [{id: 'c1', category: 'dog', name: 'Rex'}],
      selectedCompanionId: 'c1',
    };

    beforeEach(() => {
      mockAlertFn.mockClear();
      (useSelector as unknown as jest.Mock).mockImplementation(selectorFn =>
        selectorFn({
          businesses: {
            businesses: [mockBusiness],
            services: mockServicesWithSpecies,
          },
          companion: companionStateWithDog,
        }),
      );
    });

    it('shows alert and does NOT navigate when companion species mismatches service species', () => {
      const {getByTestId} = render(<BusinessDetailsScreen />);
      fireEvent.press(getByTestId('service-svc-feline'));

      expect(mockAlertFn).toHaveBeenCalledWith(
        'Species Mismatch',
        expect.stringContaining('cats'),
        [{text: 'OK'}],
      );
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('navigates normally when service species matches companion species', () => {
      const {getByTestId} = render(<BusinessDetailsScreen />);
      fireEvent.press(getByTestId('service-svc-canine'));

      expect(mockAlertFn).not.toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith(
        'BookingForm',
        expect.objectContaining({
          serviceId: 'svc-canine',
        }),
      );
    });

    it('navigates normally when service has no species in its name', () => {
      (useSelector as unknown as jest.Mock).mockImplementation(selectorFn =>
        selectorFn({
          businesses: {businesses: [mockBusiness], services: mockServices},
          companion: companionStateWithDog,
        }),
      );
      const {getByTestId} = render(<BusinessDetailsScreen />);
      fireEvent.press(getByTestId('service-svc-1'));

      expect(mockAlertFn).not.toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith(
        'BookingForm',
        expect.objectContaining({
          serviceId: 'svc-1',
        }),
      );
    });

    it('navigates normally when no companion is selected', () => {
      (useSelector as unknown as jest.Mock).mockImplementation(selectorFn =>
        selectorFn({
          businesses: {
            businesses: [mockBusiness],
            services: mockServicesWithSpecies,
          },
          companion: {companions: [], selectedCompanionId: null},
        }),
      );
      const {getByTestId} = render(<BusinessDetailsScreen />);
      fireEvent.press(getByTestId('service-svc-feline'));

      expect(mockAlertFn).not.toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalled();
    });

    it('shows a species mismatch alert using the raw category for an unrecognized species', () => {
      (useSelector as unknown as jest.Mock).mockImplementation(selectorFn =>
        selectorFn({
          businesses: {
            businesses: [mockBusiness],
            services: mockServicesWithSpecies,
          },
          companion: {
            companions: [{id: 'c1', category: 'rabbit', name: 'Thumper'}],
            selectedCompanionId: 'c1',
          },
        }),
      );
      const {getByTestId} = render(<BusinessDetailsScreen />);
      fireEvent.press(getByTestId('service-svc-feline'));

      expect(mockAlertFn).toHaveBeenCalledWith(
        'Species Mismatch',
        expect.stringContaining('cats'),
        [{text: 'OK'}],
      );
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('resolves a "cat" category to feline and navigates when species match', () => {
      (useSelector as unknown as jest.Mock).mockImplementation(selectorFn =>
        selectorFn({
          businesses: {
            businesses: [mockBusiness],
            services: mockServicesWithSpecies,
          },
          companion: {
            companions: [{id: 'c1', category: 'cat', name: 'Whiskers'}],
            selectedCompanionId: 'c1',
          },
        }),
      );
      const {getByTestId} = render(<BusinessDetailsScreen />);
      fireEvent.press(getByTestId('service-svc-feline'));

      expect(mockAlertFn).not.toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith(
        'BookingForm',
        expect.objectContaining({serviceId: 'svc-feline'}),
      );
    });

    it('treats a companion with no category as an empty string and still alerts on mismatch', () => {
      (useSelector as unknown as jest.Mock).mockImplementation(selectorFn =>
        selectorFn({
          businesses: {
            businesses: [mockBusiness],
            services: mockServicesWithSpecies,
          },
          companion: {
            companions: [{id: 'c1', name: 'Mystery'}],
            selectedCompanionId: 'c1',
          },
        }),
      );
      const {getByTestId} = render(<BusinessDetailsScreen />);
      fireEvent.press(getByTestId('service-svc-feline'));

      expect(mockAlertFn).toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  it('treats a selectedCompanionId with no matching companion as no companion selected', () => {
    (useSelector as unknown as jest.Mock).mockImplementation(selectorFn =>
      selectorFn({
        businesses: {
          businesses: [mockBusiness],
          services: mockServicesWithSpecies,
        },
        companion: {
          companions: [{id: 'other-id', category: 'dog', name: 'Rex'}],
          selectedCompanionId: 'c1',
        },
      }),
    );
    const {getByTestId} = render(<BusinessDetailsScreen />);
    fireEvent.press(getByTestId('service-svc-feline'));

    expect(mockAlertFn).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalled();
  });

  it('falls back to an undefined specialityId when the selected service has none', () => {
    const {getByTestId} = render(<BusinessDetailsScreen />);
    fireEvent.press(getByTestId('service-svc-3'));

    expect(mockNavigate).toHaveBeenCalledWith('BookingForm', {
      businessId: 'bus-123',
      serviceId: 'svc-3',
      serviceName: 'Checkup',
      serviceSpecialty: 'General',
      serviceSpecialtyId: undefined,
    });
  });

  it('does not call goBack when there is nothing to go back to', () => {
    mockCanGoBack.mockReturnValueOnce(false);
    const {getByTestId} = render(<BusinessDetailsScreen />);
    fireEvent.press(getByTestId('header-back'));

    expect(mockGoBack).not.toHaveBeenCalled();
  });
});
