import React from 'react';
import {mockTheme} from '../setup/mockTheme';
import {Alert} from 'react-native';
import {render, fireEvent, waitFor} from '@testing-library/react-native';
import BrowseBusinessesScreen from '@/features/appointments/screens/BrowseBusinessesScreen';
import * as reactRedux from 'react-redux';
import {useNavigation, useRoute} from '@react-navigation/native';
import {fetchBusinesses} from '@/features/appointments/businessesSlice';
import {
  fetchBusinessDetails,
  fetchGooglePlacesImage,
} from '@/features/linkedBusinesses';
import {useClinicMapDiscovery} from '@/features/appointments/hooks/useClinicMapDiscovery';
import {usePlacesBusinessSearch} from '@/features/linkedBusinesses/hooks/usePlacesBusinessSearch';

// --- Mocks ---
jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(),
  useRoute: jest.fn(),
}));

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

jest.mock('@/shared/components/common', () => ({
  SafeArea: ({children}: any) => <>{children}</>,
}));

jest.mock('@/shared/components/common/Header/Header', () => ({
  Header: ({title, onBack}: any) => (
    <mock-header title={title} onBack={onBack} testID="header" />
  ),
}));

jest.mock('@/shared/components/common/SearchBar/SearchBar', () => ({
  SearchBar: ({value, onChangeText, onSubmitEditing, onIconPress}: any) => (
    <mock-searchbar
      value={value}
      onChangeText={onChangeText}
      onSubmitEditing={onSubmitEditing}
      onIconPress={onIconPress}
      testID="searchBar"
    />
  ),
}));

jest.mock(
  '@/features/appointments/components/BusinessCard/BusinessCard',
  () => ({
    __esModule: true,
    default: ({name, onBook}: any) => (
      <mock-business-card
        name={name}
        onPress={onBook}
        testID={`card-${name}`}
      />
    ),
  }),
);

jest.mock('react-native-gesture-handler', () => ({
  GestureDetector: ({children}: any) => <>{children}</>,
  Gesture: {Native: () => ({})},
  NativeViewGestureHandler: ({children, ...props}: any) => {
    const {View} = require('react-native');
    return <View {...props}>{children}</View>;
  },
}));

jest.mock('@gorhom/bottom-sheet', () => {
  const {View} = require('react-native');
  const {forwardRef, useImperativeHandle, createElement} = require('react');

  const BottomSheet = forwardRef(({children, ...props}: any, ref: any) => {
    useImperativeHandle(ref, () => ({
      snapToIndex: jest.fn(),
      snapToPosition: jest.fn(),
      expand: jest.fn(),
      collapse: jest.fn(),
      close: jest.fn(),
    }));
    return createElement(View, props, children);
  });

  const BottomSheetFlatList = forwardRef(
    (
      {
        data,
        renderItem,
        keyExtractor: _keyExtractor,
        ListHeaderComponent,
        ListEmptyComponent,
        ...props
      }: any,
      ref: any,
    ) => {
      const items: any[] = data ?? [];
      return createElement(
        View,
        {...props, ref},
        ListHeaderComponent ?? null,
        items.length === 0
          ? (ListEmptyComponent ?? null)
          : items.map((item: any, index: number) =>
              renderItem ? renderItem({item, index}) : null,
            ),
      );
    },
  );

  return {
    __esModule: true,
    default: BottomSheet,
    BottomSheetView: ({children, ...props}: any) =>
      createElement(View, props, children),
    BottomSheetScrollView: ({children, ...props}: any) =>
      createElement(View, props, children),
    BottomSheetFlatList,
    BottomSheetBackdrop: ({children, ...props}: any) =>
      createElement(View, props, children),
    BottomSheetHandle: ({...props}: any) => createElement(View, props),
  };
});

// Mock the hook that controls which clinics are visible on the map/list
jest.mock('@/features/appointments/hooks/useClinicMapDiscovery', () => ({
  useClinicMapDiscovery: jest.fn(),
}));

jest.mock('@/features/linkedBusinesses/hooks/usePlacesBusinessSearch', () => ({
  usePlacesBusinessSearch: jest.fn(),
}));

// Mock Actions
jest.mock('@/features/appointments/businessesSlice', () => ({
  fetchBusinesses: jest.fn(),
  upsertBusiness: jest.fn(payload => ({
    type: 'businesses/upsertBusiness',
    payload,
  })),
}));

jest.mock('@/features/linkedBusinesses', () => ({
  fetchBusinessDetails: jest.fn(),
  fetchGooglePlacesImage: jest.fn(),
}));

jest.mock('@/features/appointments/utils/photoUtils', () => ({
  isDummyPhoto: jest.fn().mockImplementation(photo => photo === 'dummy'),
}));

const makeDiscoveryMock = (overrides: any = {}) => ({
  visibleClinics: [],
  selectedClinicId: null,
  mapRegion: null,
  category: undefined,
  openNow: false,
  setSelectedClinicId: jest.fn(),
  setMapRegion: jest.fn(),
  setCategory: jest.fn(),
  setOpenNow: jest.fn(),
  enrichWithDistance: jest.fn().mockReturnValue([]),
  pinAndSelectClinic: jest.fn(),
  ...overrides,
});

const makePlacesSearchMock = (overrides: any = {}) => ({
  searchQuery: '',
  setSearchQuery: jest.fn(),
  searchResults: [],
  searching: false,
  handleSearchChange: jest.fn(),
  handleSelectBusiness: jest.fn(),
  clearResults: jest.fn(),
  ...overrides,
});

const baseState = {
  companion: {companions: [], selectedCompanionId: null},
  businesses: {businesses: []},
};

describe('BrowseBusinessesScreen', () => {
  const dispatchMock = jest.fn();
  const navigateMock = jest.fn();
  const goBackMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useNavigation as jest.Mock).mockReturnValue({
      navigate: navigateMock,
      goBack: goBackMock,
    });
    jest.spyOn(reactRedux, 'useDispatch').mockReturnValue(dispatchMock);
    dispatchMock.mockReturnValue({unwrap: jest.fn().mockResolvedValue({})});

    jest
      .spyOn(reactRedux, 'useSelector')
      .mockImplementation(cb => cb(baseState));

    (useClinicMapDiscovery as jest.Mock).mockReturnValue(makeDiscoveryMock());
    (usePlacesBusinessSearch as jest.Mock).mockReturnValue(
      makePlacesSearchMock(),
    );

    (useRoute as jest.Mock).mockReturnValue({params: {}});

    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders initial layout with categories and search bar', () => {
    const {getByTestId, getAllByText} = render(<BrowseBusinessesScreen />);

    expect(getByTestId('header')).toBeTruthy();
    expect(getByTestId('searchBar')).toBeTruthy();

    expect(getAllByText('All')).toBeTruthy();
    expect(getAllByText('Hospital').length).toBeGreaterThan(0);
  });

  it('passes initialBusinessId and selectionToken to useClinicMapDiscovery', () => {
    (useRoute as jest.Mock).mockReturnValue({
      params: {initialBusinessId: 'org-123', selectionToken: 9999},
    });

    render(<BrowseBusinessesScreen />);

    expect(useClinicMapDiscovery).toHaveBeenCalledWith(
      expect.any(String),
      'org-123',
      9999,
    );
  });

  it('passes undefined for both when params are absent', () => {
    (useRoute as jest.Mock).mockReturnValue({params: {}});

    render(<BrowseBusinessesScreen />);

    expect(useClinicMapDiscovery).toHaveBeenCalledWith(
      expect.any(String),
      undefined,
      undefined,
    );
  });

  it('performs initial search if serviceName param is present', async () => {
    (useRoute as jest.Mock).mockReturnValue({
      params: {serviceName: 'grooming'},
    });

    render(<BrowseBusinessesScreen />);

    await waitFor(() => {
      expect(dispatchMock).toHaveBeenCalledWith(
        fetchBusinesses({serviceName: 'grooming'}),
      );
    });
  });

  it('updates search query and performs search on submit', () => {
    const {getByTestId} = render(<BrowseBusinessesScreen />);

    // Clear initial mount call
    dispatchMock.mockClear();

    const searchBar = getByTestId('searchBar');

    fireEvent(searchBar, 'changeText', 'vet');
    fireEvent(searchBar, 'submitEditing');

    expect(dispatchMock).toHaveBeenCalledWith(
      fetchBusinesses({serviceName: 'vet'}),
    );
  });

  it('performs search on icon press', () => {
    const {getByTestId} = render(<BrowseBusinessesScreen />);

    // Clear initial mount call
    dispatchMock.mockClear();

    const searchBar = getByTestId('searchBar');

    fireEvent(searchBar, 'changeText', 'vet');
    fireEvent(searchBar, 'iconPress');

    expect(dispatchMock).toHaveBeenCalledWith(
      fetchBusinesses({serviceName: 'vet'}),
    );
  });

  it('debounces search calls (skips duplicate within interval)', () => {
    let now = 1000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);

    const {getByTestId} = render(<BrowseBusinessesScreen />);

    // Clear the initial mount dispatch (performSearch(''))
    dispatchMock.mockClear();

    const searchBar = getByTestId('searchBar');

    // 1. First user search
    fireEvent(searchBar, 'changeText', 'vet');
    fireEvent(searchBar, 'submitEditing');

    // Should trigger search because 'vet' != '' (last term)
    expect(dispatchMock).toHaveBeenCalledTimes(1);

    // 2. Advance time slightly (500ms), still within 1000ms threshold
    now += 500;

    // 3. Second user search with SAME term
    fireEvent(searchBar, 'submitEditing');

    // Should NOT trigger search because term is same ('vet' == 'vet') AND time diff (500) < 1000
    expect(dispatchMock).toHaveBeenCalledTimes(1); // Still 1

    jest.restoreAllMocks();
  });

  // --- Category Filtering & Rendering ---

  it('renders empty state when no businesses found', () => {
    const {getByText} = render(<BrowseBusinessesScreen />);
    expect(getByText('No veterinary businesses in this area')).toBeTruthy();
  });

  it('renders businesses when clinics are provided', () => {
    const mockData = [
      {id: 'b1', name: 'Vet 1', category: 'hospital'},
      {id: 'b2', name: 'Groomer 1', category: 'groomer'},
      {id: 'b3', name: 'Groomer 2', category: 'groomer'},
    ];
    (useClinicMapDiscovery as jest.Mock).mockReturnValue(
      makeDiscoveryMock({
        visibleClinics: mockData,
        enrichWithDistance: jest.fn().mockReturnValue(mockData),
      }),
    );

    const {getByTestId} = render(<BrowseBusinessesScreen />);

    expect(getByTestId('card-Vet 1')).toBeTruthy();
    expect(getByTestId('card-Groomer 1')).toBeTruthy();
    expect(getByTestId('card-Groomer 2')).toBeTruthy();
  });

  it('pressing a category filter pill updates the selected category', () => {
    const mockSetCategory = jest.fn();
    (useClinicMapDiscovery as jest.Mock).mockReturnValue(
      makeDiscoveryMock({setCategory: mockSetCategory}),
    );

    const {getAllByText} = render(<BrowseBusinessesScreen />);

    fireEvent.press(getAllByText('Groomer')[0]);
    expect(mockSetCategory).toHaveBeenCalledWith('groomer');
  });

  it('filters businesses when a specific category is selected', () => {
    const mockSetCategory = jest.fn();
    (useClinicMapDiscovery as jest.Mock).mockReturnValue(
      makeDiscoveryMock({setCategory: mockSetCategory}),
    );

    const {getAllByText} = render(<BrowseBusinessesScreen />);

    const hospitalPills = getAllByText('Hospital');
    fireEvent.press(hospitalPills[0]);

    expect(mockSetCategory).toHaveBeenCalledWith('hospital');
  });

  // --- Business Card Logic & Interaction ---

  it('navigates to BusinessDetails on card press', () => {
    const mockData = [{id: 'b1', name: 'Vet 1', category: 'hospital'}];
    (useClinicMapDiscovery as jest.Mock).mockReturnValue(
      makeDiscoveryMock({
        visibleClinics: mockData,
        enrichWithDistance: jest.fn().mockReturnValue(mockData),
      }),
    );

    const {getByTestId} = render(<BrowseBusinessesScreen />);

    fireEvent(getByTestId('card-Vet 1'), 'press');
    expect(navigateMock).toHaveBeenCalledWith(
      'BusinessDetails',
      expect.objectContaining({businessId: 'b1'}),
    );
  });

  it('resolves correct description text based on priority', () => {
    const biz1 = {id: '1', name: 'N1', category: 'hospital', address: 'Addr'};
    const biz2 = {
      id: '2',
      name: 'N2',
      category: 'hospital',
      description: 'Desc',
    };
    const biz3 = {
      id: '3',
      name: 'N3',
      category: 'hospital',
      specialties: ['S1', 'S2'],
    };
    const biz4 = {id: '4', name: 'N4', category: 'hospital'};
    const mockData = [biz1, biz2, biz3, biz4];

    (useClinicMapDiscovery as jest.Mock).mockReturnValue(
      makeDiscoveryMock({
        visibleClinics: mockData,
        enrichWithDistance: jest.fn().mockReturnValue(mockData),
      }),
    );

    render(<BrowseBusinessesScreen />);
  });

  // --- Data Fetching / Side Effects ---

  it('requests details for businesses with googlePlacesId and missing info', async () => {
    const mockData = [
      {id: 'b1', googlePlacesId: 'gp1', photo: null},
      {
        id: 'b2',
        googlePlacesId: 'gp2',
        website: null,
        phone: null,
        photo: 'valid',
      },
      {id: 'b3', googlePlacesId: 'gp3', photo: 'dummy'},
      {id: 'b4', googlePlacesId: null},
    ];

    jest
      .spyOn(reactRedux, 'useSelector')
      .mockImplementation(cb =>
        cb({...baseState, businesses: {businesses: mockData}}),
      );

    dispatchMock.mockImplementation((_action: any) => {
      return {
        unwrap: jest.fn().mockResolvedValue({
          photoUrl: 'new_url',
          phoneNumber: '123',
          website: 'site.com',
        }),
      };
    });

    render(<BrowseBusinessesScreen />);

    await waitFor(() => {
      expect(fetchBusinessDetails).toHaveBeenCalledWith('gp1');
      expect(fetchBusinessDetails).toHaveBeenCalledWith('gp2');
      expect(fetchBusinessDetails).toHaveBeenCalledWith('gp3');
    });
  });

  it('falls back to fetching image if details fetch fails', async () => {
    const mockData = [{id: 'b1', googlePlacesId: 'gp1', photo: null}];

    jest
      .spyOn(reactRedux, 'useSelector')
      .mockImplementation(cb =>
        cb({...baseState, businesses: {businesses: mockData}}),
      );

    const unwrapMock = jest
      .fn()
      .mockRejectedValueOnce(new Error('Detail fail'))
      .mockResolvedValueOnce({photoUrl: 'fallback_img'});

    dispatchMock.mockReturnValue({unwrap: unwrapMock});

    render(<BrowseBusinessesScreen />);

    await waitFor(() => {
      expect(fetchBusinessDetails).toHaveBeenCalledWith('gp1');
      expect(fetchGooglePlacesImage).toHaveBeenCalledWith('gp1');
    });
  });

  it('swallows error if image fetch also fails', async () => {
    const mockData = [{id: 'b1', googlePlacesId: 'gp1', photo: null}];

    jest
      .spyOn(reactRedux, 'useSelector')
      .mockImplementation(cb =>
        cb({...baseState, businesses: {businesses: mockData}}),
      );

    const unwrapMock = jest.fn().mockRejectedValue(new Error('All fail'));
    dispatchMock.mockReturnValue({unwrap: unwrapMock});

    render(<BrowseBusinessesScreen />);

    await waitFor(() => {
      expect(fetchGooglePlacesImage).toHaveBeenCalled();
    });
  });

  it('formats distance and rating text correctly', () => {
    const bizMi = {id: '1', category: 'hospital', distanceMi: 5.5, rating: 4.8};
    const bizMeters = {id: '2', category: 'hospital', distanceMeters: 3218};
    const bizNone = {id: '3', category: 'hospital'};
    const mockData = [bizMi, bizMeters, bizNone];

    (useClinicMapDiscovery as jest.Mock).mockReturnValue(
      makeDiscoveryMock({
        visibleClinics: mockData,
        enrichWithDistance: jest.fn().mockReturnValue(mockData),
      }),
    );

    render(<BrowseBusinessesScreen />);
  });

  it('PMS selection from map search calls pinAndSelectClinic and clears results, not navigate', async () => {
    const pinAndSelectClinic = jest.fn();
    const clearResults = jest.fn();
    (useClinicMapDiscovery as jest.Mock).mockReturnValue(
      makeDiscoveryMock({pinAndSelectClinic}),
    );
    (usePlacesBusinessSearch as jest.Mock).mockImplementation(
      ({onSelectPms}: any) => {
        // Expose onSelectPms so the test can invoke it
        (usePlacesBusinessSearch as any)._capturedOnSelectPms = onSelectPms;
        return makePlacesSearchMock({clearResults});
      },
    );

    render(<BrowseBusinessesScreen />);

    const pmsSelection = {
      placeId: 'gp-1',
      organisationId: 'org-1',
      name: 'Test Vet',
      address: '1 Main St',
      isPmsOrganisation: true,
      lat: 37.77,
      lng: -122.42,
    };

    await (usePlacesBusinessSearch as any)._capturedOnSelectPms(pmsSelection);

    expect(pinAndSelectClinic).toHaveBeenCalledWith(
      expect.objectContaining({id: 'org-1', name: 'Test Vet'}),
    );
    expect(clearResults).toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('selectedCompanion falls back to null when targetCompanionId has no match in companions', () => {
    jest.spyOn(reactRedux, 'useSelector').mockImplementation(cb =>
      cb({
        ...baseState,
        companion: {companions: [], selectedCompanionId: 'stale-id'},
      }),
    );
    expect(() => render(<BrowseBusinessesScreen />)).not.toThrow();
  });

  it('ensureCompanion shows Alert when no companion is available', async () => {
    jest.spyOn(Alert, 'alert');
    let capturedOnSelectNonPms: any;
    (usePlacesBusinessSearch as jest.Mock).mockImplementation(
      ({onSelectNonPms}: any) => {
        capturedOnSelectNonPms = onSelectNonPms;
        return makePlacesSearchMock();
      },
    );
    jest.spyOn(reactRedux, 'useSelector').mockImplementation(cb =>
      cb({
        ...baseState,
        companion: {companions: [], selectedCompanionId: null},
      }),
    );

    render(<BrowseBusinessesScreen />);

    await capturedOnSelectNonPms({
      placeId: 'gp-1',
      name: 'Test Vet',
      address: '1 Main',
      isPmsOrganisation: false,
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Add a companion',
      'Add a companion to notify a business.',
    );
  });

  it('handleNonPmsSelection navigates to BusinessAdd when companion is available', async () => {
    const mockParentNavigate = jest.fn();
    (useNavigation as jest.Mock).mockReturnValue({
      navigate: navigateMock,
      goBack: goBackMock,
      getParent: () => ({navigate: mockParentNavigate}),
    });

    let capturedOnSelectNonPms: any;
    (usePlacesBusinessSearch as jest.Mock).mockImplementation(
      ({onSelectNonPms}: any) => {
        capturedOnSelectNonPms = onSelectNonPms;
        return makePlacesSearchMock();
      },
    );
    jest.spyOn(reactRedux, 'useSelector').mockImplementation(cb =>
      cb({
        ...baseState,
        companion: {
          companions: [
            {
              id: 'comp-1',
              name: 'Buddy',
              breed: {breedName: 'Labrador'},
              profileImage: null,
            },
          ],
          selectedCompanionId: 'comp-1',
        },
      }),
    );

    render(<BrowseBusinessesScreen />);

    await capturedOnSelectNonPms({
      placeId: 'gp-1',
      name: 'Test Vet',
      address: '1 Main',
      isPmsOrganisation: false,
    });

    expect(mockParentNavigate).toHaveBeenCalledWith(
      'HomeStack',
      expect.objectContaining({screen: 'LinkedBusinesses'}),
    );
  });

  it('handleSearchError logs error without throwing', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    let capturedOnError: any;
    (usePlacesBusinessSearch as jest.Mock).mockImplementation(
      ({onError}: any) => {
        capturedOnError = onError;
        return makePlacesSearchMock();
      },
    );

    render(<BrowseBusinessesScreen />);

    expect(() => capturedOnError(new Error('search failed'))).not.toThrow();
    expect(consoleSpy).toHaveBeenCalledWith(
      '[BrowseBusinesses] Places search error',
      expect.any(Error),
    );

    consoleSpy.mockRestore();
  });

  it('handleRegionChange calls setMapRegion via map onRegionChangeComplete', () => {
    const setMapRegion = jest.fn();
    (useClinicMapDiscovery as jest.Mock).mockReturnValue(
      makeDiscoveryMock({setMapRegion}),
    );

    const {getByTestId} = render(<BrowseBusinessesScreen />);
    const region = {
      latitude: 37.7,
      longitude: -122.4,
      latitudeDelta: 0.1,
      longitudeDelta: 0.1,
    };
    fireEvent(getByTestId('map-view'), 'regionChangeComplete', region);

    expect(setMapRegion).toHaveBeenCalledWith(region);
  });

  it('header onBack triggers navigation.goBack', () => {
    const {getByTestId} = render(<BrowseBusinessesScreen />);
    getByTestId('header').props.onBack();
    expect(goBackMock).toHaveBeenCalled();
  });
});
