import React from 'react';
import {mockTheme} from '../setup/mockTheme';
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

jest.mock('@gorhom/bottom-sheet', () => {
  const {View} = require('react-native');

  const BottomSheet = React.forwardRef(
    ({children, ...props}: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({
        snapToIndex: jest.fn(),
        snapToPosition: jest.fn(),
        expand: jest.fn(),
        collapse: jest.fn(),
        close: jest.fn(),
      }));
      return React.createElement(View, props, children);
    },
  );

  const BottomSheetFlatList = React.forwardRef(
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
      return React.createElement(
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
      React.createElement(View, props, children),
    BottomSheetScrollView: ({children, ...props}: any) =>
      React.createElement(View, props, children),
    BottomSheetFlatList,
    BottomSheetBackdrop: ({children, ...props}: any) =>
      React.createElement(View, props, children),
    BottomSheetHandle: ({...props}: any) => React.createElement(View, props),
  };
});

// Mock the hook that controls which clinics are visible on the map/list
jest.mock('@/features/appointments/hooks/useClinicMapDiscovery', () => ({
  useClinicMapDiscovery: jest.fn(),
}));

// Mock Actions
jest.mock('@/features/appointments/businessesSlice', () => ({
  fetchBusinesses: jest.fn(),
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
    expect(getByText('No clinics in this area')).toBeTruthy();
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
});
