import React from 'react';
import {render, fireEvent, waitFor} from '@testing-library/react-native';
import BusinessDetailsScreen from '../../../../src/features/appointments/screens/BusinessDetailsScreen';

// --- 1. Core Mocks (Hooks & Navigation) ---

// Mock useTheme with the specific structure expected by the component
jest.mock('../../../../src/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: '#ffffff',
        cardBackground: '#f0f0f0',
        border: '#cccccc',
        textSecondary: '#666666',
        secondary: '#0000ff',
        white: '#ffffff',
      },
      spacing: {2: 8, 4: 16, 5: 20, 24: 96},
      typography: {
        cta: {fontSize: 16, fontWeight: 'bold'},
        titleSmall: {fontSize: 14, fontWeight: '600'},
        body12: {fontSize: 12},
      },
    },
  }),
}));

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
// Use a getter for params so we can change them per test if needed
let mockRouteParams = {businessId: 'bus-123'};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
  }),
  useRoute: () => ({
    params: mockRouteParams,
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
      SpecialtyAccordion: ({specialties, onSelectService}: any) => (
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
            </View>
          ))}
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

// --- Tests ---

describe('BusinessDetailsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteParams = {businessId: 'bus-123'};

    // Default Selector Implementation
    (useSelector as unknown as jest.Mock).mockImplementation(selectorFn => {
      return selectorFn({
        businesses: {
          businesses: [mockBusiness],
          services: mockServices,
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
      });
    });

    render(<BusinessDetailsScreen />);
    expect(fetchBusinesses).toHaveBeenCalledWith({serviceName: undefined});
  });

  it('dispatches fetchBusinesses if totalServices is 0', () => {
    (useSelector as unknown as jest.Mock).mockImplementation(selectorFn => {
      return selectorFn({
        businesses: {
          businesses: [mockBusiness],
          services: [], // Empty services
        },
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

  describe('Photo Fetching', () => {
    it('skips fetching if googlePlacesId is missing', () => {
      const noPlaceBus = {...mockBusiness, googlePlacesId: undefined};
      (useSelector as unknown as jest.Mock).mockImplementation(selectorFn =>
        selectorFn({
          businesses: {businesses: [noPlaceBus], services: mockServices},
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
        }),
      );

      const {getByTestId} = render(<BusinessDetailsScreen />);
      fireEvent.press(getByTestId('glass-button'));

      expect(openMapsToPlaceId).not.toHaveBeenCalled();
      expect(openMapsToAddress).not.toHaveBeenCalled();
    });
  });
});
