import React from 'react';
import * as Redux from 'react-redux';
import {render, fireEvent, screen} from '@testing-library/react-native';
import {mockTheme} from '../../../setup/mockTheme';
import {BusinessesListScreen} from '@/features/appointments/screens/BusinessesListScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
let mockRouteParams: any = {category: 'hospital'};

jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({params: mockRouteParams}),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
  }),
}));

const mockDispatch = jest.fn();
let mockState: any = {};

jest.spyOn(Redux, 'useDispatch').mockReturnValue(mockDispatch as any);
jest
  .spyOn(Redux, 'useSelector')
  .mockImplementation((callback: any) => callback(mockState));

const mockFetchBusinesses = jest.fn();

jest.mock('@/features/appointments/businessesSlice', () => ({
  fetchBusinesses: (...args: any[]) => mockFetchBusinesses(...args),
}));

jest.mock('@/features/appointments/selectors', () => ({
  createSelectBusinessesByCategory: () => (state: any, category: string) =>
    state.businesses.businesses.filter((b: any) => b.category === category),
}));

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

jest.mock(
  '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen',
  () => {
    const {View} = require('react-native');
    return {
      LiquidGlassHeaderScreen: ({header, children}: any) => (
        <View testID="liquid-glass-header-screen">
          {header}
          {typeof children === 'function' ? children({}) : children}
        </View>
      ),
    };
  },
);

jest.mock('@/shared/components/common/Header/Header', () => {
  const {View, Text, TouchableOpacity} = require('react-native');
  return {
    Header: ({title, onBack}: any) => (
      <View testID="header">
        <Text>{title}</Text>
        <TouchableOpacity testID="header-back-btn" onPress={onBack}>
          <Text>Back</Text>
        </TouchableOpacity>
      </View>
    ),
  };
});

jest.mock(
  '@/features/appointments/components/BusinessCard/BusinessCard',
  () => {
    const {View, Text, TouchableOpacity} = require('react-native');
    return {
      __esModule: true,
      default: ({
        name,
        openText,
        description,
        distanceText,
        ratingText,
        onBook,
      }: any) => (
        <View testID={`business-card-${name}`}>
          <Text testID={`name-${name}`}>{name}</Text>
          <Text testID={`open-${name}`}>{openText}</Text>
          <Text testID={`description-${name}`}>{description}</Text>
          <Text testID={`distance-${name}`}>
            {distanceText ?? 'no-distance'}
          </Text>
          <Text testID={`rating-${name}`}>{ratingText ?? 'no-rating'}</Text>
          <TouchableOpacity testID={`book-${name}`} onPress={onBook}>
            <Text>Book</Text>
          </TouchableOpacity>
        </View>
      ),
    };
  },
);

describe('BusinessesListScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteParams = {category: 'hospital'};
    mockState = {
      businesses: {
        businesses: [],
      },
    };
  });

  it('renders the header title', () => {
    render(<BusinessesListScreen />);
    expect(screen.getByText('Book an appointment')).toBeTruthy();
  });

  it('navigates back when the header back button is pressed', () => {
    render(<BusinessesListScreen />);
    fireEvent.press(screen.getByTestId('header-back-btn'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('fetches businesses when none are loaded for the category', () => {
    render(<BusinessesListScreen />);
    expect(mockFetchBusinesses).toHaveBeenCalledWith({
      serviceName: undefined,
    });
  });

  it('does not fetch businesses when some are already loaded', () => {
    mockState.businesses.businesses = [
      {id: 'b1', name: 'Vet A', category: 'hospital', address: '1 Main St'},
    ];
    render(<BusinessesListScreen />);
    expect(mockFetchBusinesses).not.toHaveBeenCalled();
  });

  it('uses the trimmed description when provided', () => {
    mockState.businesses.businesses = [
      {
        id: 'b1',
        name: 'Vet A',
        category: 'hospital',
        address: '1 Main St',
        description: '  A great clinic.  ',
      },
    ];
    render(<BusinessesListScreen />);
    expect(screen.getByTestId('description-Vet A').props.children).toBe(
      'A great clinic.',
    );
  });

  it('falls back to specialties (max 3) when description is missing', () => {
    mockState.businesses.businesses = [
      {
        id: 'b1',
        name: 'Vet A',
        category: 'hospital',
        address: '1 Main St',
        specialties: ['Cardiology', 'Surgery', 'Dentistry', 'Oncology'],
      },
    ];
    render(<BusinessesListScreen />);
    expect(screen.getByTestId('description-Vet A').props.children).toBe(
      'Cardiology, Surgery, Dentistry',
    );
  });

  it('falls back to name/address when neither description nor specialties are present', () => {
    mockState.businesses.businesses = [
      {id: 'b1', name: 'Vet A', category: 'hospital', address: '1 Main St'},
    ];
    render(<BusinessesListScreen />);
    expect(screen.getByTestId('description-Vet A').props.children).toBe(
      'Vet A located at 1 Main St',
    );
  });

  it('formats distance from distanceMi when present', () => {
    mockState.businesses.businesses = [
      {
        id: 'b1',
        name: 'Vet A',
        category: 'hospital',
        address: '1 Main St',
        distanceMi: 2.34,
      },
    ];
    render(<BusinessesListScreen />);
    expect(screen.getByTestId('distance-Vet A').props.children).toBe('2.3mi');
  });

  it('formats distance from distanceMeters when distanceMi is absent', () => {
    mockState.businesses.businesses = [
      {
        id: 'b1',
        name: 'Vet A',
        category: 'hospital',
        address: '1 Main St',
        distanceMeters: 1609.344,
      },
    ];
    render(<BusinessesListScreen />);
    expect(screen.getByTestId('distance-Vet A').props.children).toBe('1.0mi');
  });

  it('shows no distance when neither distanceMi nor distanceMeters are present', () => {
    mockState.businesses.businesses = [
      {id: 'b1', name: 'Vet A', category: 'hospital', address: '1 Main St'},
    ];
    render(<BusinessesListScreen />);
    expect(screen.getByTestId('distance-Vet A').props.children).toBe(
      'no-distance',
    );
  });

  it('shows the rating as a string when present', () => {
    mockState.businesses.businesses = [
      {
        id: 'b1',
        name: 'Vet A',
        category: 'hospital',
        address: '1 Main St',
        rating: 4.5,
      },
    ];
    render(<BusinessesListScreen />);
    expect(screen.getByTestId('rating-Vet A').props.children).toBe('4.5');
  });

  it('shows no rating when absent', () => {
    mockState.businesses.businesses = [
      {id: 'b1', name: 'Vet A', category: 'hospital', address: '1 Main St'},
    ];
    render(<BusinessesListScreen />);
    expect(screen.getByTestId('rating-Vet A').props.children).toBe('no-rating');
  });

  it('navigates to BusinessDetails with the business id when booking', () => {
    mockState.businesses.businesses = [
      {id: 'b1', name: 'Vet A', category: 'hospital', address: '1 Main St'},
    ];
    render(<BusinessesListScreen />);
    fireEvent.press(screen.getByTestId('book-Vet A'));
    expect(mockNavigate).toHaveBeenCalledWith('BusinessDetails', {
      businessId: 'b1',
    });
  });

  it('only renders businesses matching the route category', () => {
    mockState.businesses.businesses = [
      {id: 'b1', name: 'Vet A', category: 'hospital', address: '1 Main St'},
      {id: 'b2', name: 'Groomer B', category: 'groomer', address: '2 Elm St'},
    ];
    render(<BusinessesListScreen />);
    expect(screen.queryByTestId('business-card-Vet A')).toBeTruthy();
    expect(screen.queryByTestId('business-card-Groomer B')).toBeNull();
  });
});
