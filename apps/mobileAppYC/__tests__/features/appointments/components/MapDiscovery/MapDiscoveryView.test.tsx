import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {Switch} from 'react-native';
import {mockTheme} from '../../../../setup/mockTheme';
import MapDiscoveryView, {
  type MapDiscoveryViewProps,
} from '../../../../../src/features/appointments/components/MapDiscovery/MapDiscoveryView';

// --- Mocks ---

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({t: (k: string) => k}),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0}),
}));

jest.mock('react-native-reanimated', () => {
  return {
    createAnimatedComponent: (C: any) => C,
    useSharedValue: (v: any) => ({value: v}),
    useAnimatedStyle: (fn: any) => fn(),
    interpolate: () => 1,
    Extrapolation: {CLAMP: 'CLAMP'},
  };
});

jest.mock('@/shared/components/common/Header/Header', () => ({
  Header: ({title, onBack}: any) => {
    const {View, Text, TouchableOpacity} = require('react-native');
    return (
      <View testID="header">
        <Text>{title}</Text>
        <TouchableOpacity testID="back-btn" onPress={onBack}>
          <Text>Back</Text>
        </TouchableOpacity>
      </View>
    );
  },
}));

jest.mock('@/shared/components/common/SearchBar/SearchBar', () => ({
  SearchBar: ({value, onChangeText, onSubmitEditing, onIconPress}: any) => {
    const {TextInput, TouchableOpacity, Text, View} = require('react-native');
    return (
      <View>
        <TextInput
          testID="search-input"
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmitEditing}
        />
        <TouchableOpacity testID="search-icon" onPress={onIconPress}>
          <Text>Search</Text>
        </TouchableOpacity>
      </View>
    );
  },
}));

jest.mock('@/shared/components/common/FilterPills', () => ({
  FilterPills: ({options, selected: _selected, onSelect}: any) => {
    const {View, TouchableOpacity, Text} = require('react-native');
    return (
      <View testID="filter-pills">
        {options.map((o: any) => (
          <TouchableOpacity
            key={String(o.id)}
            testID={`pill-${o.id ?? 'all'}`}
            onPress={() => onSelect(o.id)}>
            <Text>{o.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  },
}));

jest.mock('@/shared/components/common/LiquidGlassCard/LiquidGlassCard', () => ({
  LiquidGlassCard: ({children}: any) => {
    const {View} = require('react-native');
    return <View testID="liquid-glass-card">{children}</View>;
  },
}));

jest.mock(
  '../../../../../src/features/appointments/components/MapDiscovery/ClinicMapPin',
  () =>
    ({isSelected}: any) => {
      const {View, Text} = require('react-native');
      return (
        <View testID={isSelected ? 'pin-selected' : 'pin'}>
          <Text>pin</Text>
        </View>
      );
    },
);

jest.mock(
  '../../../../../src/features/appointments/components/MapDiscovery/ClusterMapPin',
  () =>
    ({count}: any) => {
      const {View, Text} = require('react-native');
      return (
        <View testID="cluster-pin">
          <Text>{count}</Text>
        </View>
      );
    },
);

jest.mock(
  '../../../../../src/features/appointments/components/MapDiscovery/ClinicBottomSheet',
  () => {
    const {forwardRef, useImperativeHandle} = require('react');
    return {
      __esModule: true,
      default: forwardRef(({filterHeader}: any, ref: any) => {
        const {View} = require('react-native');
        useImperativeHandle(ref, () => ({
          show: jest.fn(),
          hide: jest.fn(),
        }));
        return <View testID="clinic-bottom-sheet">{filterHeader}</View>;
      }),
    };
  },
);

jest.mock(
  '../../../../../src/features/appointments/components/BusinessCard/BusinessCard',
  () => ({
    __esModule: true,
    default: ({name, onBook, distanceText}: any) => {
      const {View, Text, TouchableOpacity} = require('react-native');
      return (
        <View testID="business-card">
          <Text>{name}</Text>
          {distanceText ? (
            <Text testID="distance-text">{distanceText}</Text>
          ) : null}
          <TouchableOpacity testID="book-btn" onPress={onBook}>
            <Text>Book</Text>
          </TouchableOpacity>
        </View>
      );
    },
  }),
);

const mockClusterClinics = jest.fn((clinics: any[]) =>
  clinics.map(c => ({type: 'pin', clinic: c})),
);
jest.mock(
  '../../../../../src/features/appointments/utils/clusterClinics',
  () => ({
    clusterClinics: (...args: any[]) => mockClusterClinics(...args),
  }),
);

// --- Helpers ---

const mockNavigation: any = {navigate: jest.fn()};

const baseClinics = [
  {
    id: 'c1',
    name: 'City Vet',
    lat: 37.77,
    lng: -122.41,
    openHours: 'Open',
    address: '1 Main St',
    rating: 4.5,
    photo: null,
    distanceMi: 1.2,
    distanceMeters: null,
  },
  {
    id: 'c2',
    name: 'Bay Clinic',
    lat: 37.78,
    lng: -122.42,
    openHours: 'Closed',
    address: '2 Bay Ave',
    rating: null,
    photo: null,
    distanceMi: null,
    distanceMeters: 3218,
  },
  {
    id: 'c3',
    name: 'No Coords Vet',
    lat: null,
    lng: null,
    openHours: null,
    address: null,
    rating: null,
    photo: null,
    distanceMi: null,
    distanceMeters: null,
  },
];

const defaultProps: MapDiscoveryViewProps = {
  clinics: baseClinics,
  selectedClinicId: null,
  userLocation: null,
  hasLocationPermission: false,
  searchQuery: '',
  category: undefined,
  openNow: false,
  mapRegion: null,
  fallbacks: {},
  distanceUnit: 'mi',
  navigation: mockNavigation,
  onRegionChange: jest.fn(),
  onSelectClinic: jest.fn(),
  onSearchChange: jest.fn(),
  onSearchSubmit: jest.fn(),
  onCategoryChange: jest.fn(),
  onOpenNowChange: jest.fn(),
  onBack: jest.fn(),
  onMapUserLocationChange: jest.fn(),
};

const renderView = (props: Partial<MapDiscoveryViewProps> = {}) =>
  render(<MapDiscoveryView {...defaultProps} {...props} />);

// --- Tests ---

describe('MapDiscoveryView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClusterClinics.mockImplementation((clinics: any[]) =>
      clinics.map(c => ({type: 'pin', clinic: c})),
    );
  });

  it('renders header with title', () => {
    const {getByTestId} = renderView();
    expect(getByTestId('header')).toBeTruthy();
  });

  it('renders search input', () => {
    const {getByTestId} = renderView();
    expect(getByTestId('search-input')).toBeTruthy();
  });

  it('renders filter pills', () => {
    const {getByTestId} = renderView();
    expect(getByTestId('filter-pills')).toBeTruthy();
  });

  it('calls onBack when back button pressed', () => {
    const onBack = jest.fn();
    const {getByTestId} = renderView({onBack});
    fireEvent.press(getByTestId('back-btn'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('calls onSearchChange when text changes', () => {
    const onSearchChange = jest.fn();
    const {getByTestId} = renderView({onSearchChange});
    fireEvent.changeText(getByTestId('search-input'), 'vet');
    expect(onSearchChange).toHaveBeenCalledWith('vet');
  });

  it('calls onSearchSubmit when icon pressed', () => {
    const onSearchSubmit = jest.fn();
    const {getByTestId} = renderView({onSearchSubmit});
    fireEvent.press(getByTestId('search-icon'));
    expect(onSearchSubmit).toHaveBeenCalledTimes(1);
  });

  it('shows Open toggle when no clinic is selected', () => {
    const {UNSAFE_getByType} = renderView({selectedClinicId: null});
    expect(UNSAFE_getByType(Switch)).toBeTruthy();
  });

  it('calls onOpenNowChange when toggle switched', () => {
    const onOpenNowChange = jest.fn();
    const {UNSAFE_getByType} = renderView({onOpenNowChange});
    fireEvent(UNSAFE_getByType(Switch), 'valueChange', true);
    expect(onOpenNowChange).toHaveBeenCalledWith(true);
  });

  it('hides Open toggle when a clinic is selected', () => {
    const {UNSAFE_queryAllByType} = renderView({selectedClinicId: 'c1'});
    expect(UNSAFE_queryAllByType(Switch).length).toBe(0);
  });

  it('shows selected clinic BusinessCard overlay', () => {
    const {getByTestId} = renderView({selectedClinicId: 'c1'});
    expect(getByTestId('business-card')).toBeTruthy();
  });

  it('navigates to BusinessDetails when Book pressed', () => {
    const navigate = jest.fn();
    const navigation: any = {navigate};
    const {getByTestId} = renderView({selectedClinicId: 'c1', navigation});
    fireEvent.press(getByTestId('book-btn'));
    expect(navigate).toHaveBeenCalledWith('BusinessDetails', {
      businessId: 'c1',
      distanceMi: 1.2,
    });
  });

  it('shows ClinicBottomSheet when no clinic is selected', () => {
    const {getByTestId} = renderView({selectedClinicId: null});
    expect(getByTestId('clinic-bottom-sheet')).toBeTruthy();
  });

  it('hides ClinicBottomSheet when a clinic is selected', () => {
    const {queryByTestId} = renderView({selectedClinicId: 'c1'});
    expect(queryByTestId('clinic-bottom-sheet')).toBeNull();
  });

  it('selects clinic and hides overlay via dismiss button', () => {
    const onSelectClinic = jest.fn();
    const {getByText} = renderView({
      selectedClinicId: 'c1',
      onSelectClinic,
    });
    fireEvent.press(getByText('✕'));
    expect(onSelectClinic).toHaveBeenCalledWith(null);
  });

  it('calls onCategoryChange when filter pill pressed', () => {
    const onCategoryChange = jest.fn();
    const {getByTestId} = renderView({onCategoryChange});
    fireEvent.press(getByTestId('pill-hospital'));
    expect(onCategoryChange).toHaveBeenCalledWith('hospital');
  });

  it('renders searchResultsOverlay when provided', () => {
    const {getByTestId} = renderView({
      searchResultsOverlay: (
        <React.Fragment>
          <Overlay />
        </React.Fragment>
      ),
    });
    expect(getByTestId('overlay-content')).toBeTruthy();
  });

  it('resolves distanceText from distanceMi (mi units)', () => {
    const {getByTestId} = renderView({selectedClinicId: 'c1'});
    expect(getByTestId('distance-text').props.children).toBe('1.2 mi');
  });

  it('resolves distanceText from distanceMi (km units)', () => {
    const {getByTestId} = renderView({
      selectedClinicId: 'c1',
      distanceUnit: 'km',
    });
    expect(getByTestId('distance-text').props.children).toBe('1.9 km');
  });

  it('resolves distanceText from distanceMeters when distanceMi is null', () => {
    const {getByTestId} = renderView({
      selectedClinicId: 'c2',
      distanceUnit: 'mi',
    });
    expect(getByTestId('distance-text').props.children).toBe('2.0 mi');
  });

  it('shows no distance text when both distanceMi and distanceMeters are null', () => {
    const clinicNoDistance = [
      {
        ...baseClinics[0],
        id: 'c-no-dist',
        distanceMi: null,
        distanceMeters: null,
      },
    ];
    const {queryByTestId} = renderView({
      clinics: clinicNoDistance,
      selectedClinicId: 'c-no-dist',
    });
    expect(queryByTestId('distance-text')).toBeNull();
  });

  it('uses userLocation for initial region when provided', () => {
    expect(() =>
      renderView({
        userLocation: {latitude: 48.85, longitude: 2.35},
      }),
    ).not.toThrow();
  });

  it('passes native map user location changes to the parent', () => {
    const onMapUserLocationChange = jest.fn();
    const {getByTestId} = renderView({
      onMapUserLocationChange,
      hasLocationPermission: true,
    });

    getByTestId('map-view').props.onUserLocationChange({
      nativeEvent: {
        coordinate: {
          latitude: 39.7392,
          longitude: -104.9903,
          altitude: 0,
          timestamp: Date.now(),
          accuracy: 10,
          speed: 0,
          heading: 0,
        },
      },
    });

    expect(onMapUserLocationChange).toHaveBeenCalledWith({
      latitude: 39.7392,
      longitude: -104.9903,
    });
  });

  it('renders without error when onSearchBarLayout prop is provided', () => {
    const onSearchBarLayout = jest.fn();
    expect(() => renderView({onSearchBarLayout})).not.toThrow();
  });

  it('renders fallback photo from fallbacks map on selected clinic', () => {
    const {getByTestId} = renderView({
      selectedClinicId: 'c1',
      fallbacks: {c1: {photo: 'https://fallback.com/img.jpg'}},
    });
    expect(getByTestId('business-card')).toBeTruthy();
  });

  it('pressing a pin marker calls onSelectClinic', () => {
    const onSelectClinic = jest.fn();
    const {getAllByTestId} = renderView({onSelectClinic});
    const markers = getAllByTestId('marker-pin');
    // Press the first marker that has an onPress (clinic with lat/lng)
    const pressableMarker = markers.find((m: any) => m.props.onPress);
    if (pressableMarker) {
      fireEvent.press(pressableMarker);
    }
    expect(onSelectClinic).toHaveBeenCalled();
  });

  it('renders without error when all clinics have null lat/lng (no markers)', () => {
    const nullCoordsClinics = [baseClinics[2]];
    expect(() => renderView({clinics: nullCoordsClinics})).not.toThrow();
  });

  it('renders ClusterMapPin when clusterClinics returns a cluster', () => {
    mockClusterClinics.mockReturnValue([
      {type: 'cluster', id: 'cluster-1', lat: 37.77, lng: -122.41, count: 3},
      {type: 'pin', clinic: baseClinics[0]},
    ]);
    const {getByTestId} = renderView();
    expect(getByTestId('cluster-pin')).toBeTruthy();
  });
});

// Small helper component for overlay test
function Overlay() {
  const {View} = require('react-native');
  return <View testID="overlay-content" />;
}
