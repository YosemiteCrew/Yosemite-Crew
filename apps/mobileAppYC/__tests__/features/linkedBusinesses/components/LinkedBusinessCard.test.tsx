import React from 'react';
import {
  render,
  fireEvent,
  screen,
  waitFor,
} from '@testing-library/react-native';
import {LinkedBusinessCard} from '../../../../src/features/linkedBusinesses/components/LinkedBusinessCard';
// Explicitly import the mocked components to use in UNSAFE_getAllByType
import {Linking, Alert, Image} from 'react-native';
import {fetchGooglePlacesImage} from '../../../../src/features/linkedBusinesses/thunks';

// --- Mocks ---

// 1. Mock Redux and Dispatch
const mockDispatch = jest.fn();
jest.mock('react-redux', () => ({
  useDispatch: () => mockDispatch,
}));

// 2. Mock the Thunk
jest.mock('../../../../src/features/linkedBusinesses/thunks', () => ({
  fetchGooglePlacesImage: jest.fn(),
}));

jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        cardBackground: 'white',
        text: 'black',
        textSecondary: 'gray',
        borderMuted: '#ccc',
        primary: 'blue',
      },
      spacing: [0, 4, 8, 12, 16, 20],
      borderRadius: {md: 8},
      shadows: {sm: {elevation: 2}},
      typography: {
        titleMedium: {fontSize: 16, fontWeight: 'bold'},
        bodyExtraSmall: {fontSize: 12},
      },
    },
  }),
}));

jest.mock('@/assets/images', () => ({
  Images: {
    sampleHospital1: {uri: 'default-hospital'},
    distanceIcon: {uri: 'distance-icon'},
    starIcon: {uri: 'star-icon'},
    getDirection: {uri: 'direction-icon'},
    deleteIconRed: {uri: 'delete-icon'},
  },
}));

// 3. Safe "Manual Mock" for react-native
jest.mock('react-native', () => {
  const React = require('react');

  class MockView extends React.Component {
    render() {
      return React.createElement('View', this.props, this.props.children);
    }
  }
  class MockText extends React.Component {
    render() {
      return React.createElement('Text', this.props, this.props.children);
    }
  }
  class MockImage extends React.Component {
    render() {
      return React.createElement('Image', this.props, this.props.children);
    }
  }
  class MockTouchableOpacity extends React.Component {
    render() {
      return React.createElement(
        'TouchableOpacity',
        this.props,
        this.props.children,
      );
    }
  }

  return {
    Platform: {OS: 'ios', select: (obj: any) => obj.ios},
    StyleSheet: {create: (obj: any) => obj, flatten: (obj: any) => obj},
    View: MockView,
    Text: MockText,
    Image: MockImage,
    TouchableOpacity: MockTouchableOpacity,
    Alert: {alert: jest.fn()},
    Linking: {
      openURL: jest.fn(() => Promise.resolve()),
      canOpenURL: jest.fn(() => Promise.resolve(true)),
    },
  };
});

// Helper to safely find buttons by icon URI
const getDirectionsButton = () => {
  try {
    const allImages = screen.UNSAFE_getAllByType(Image);
    return allImages.find(
      (img: any) =>
        img.props.source && img.props.source.uri === 'direction-icon',
    );
  } catch (_error) {
    // Return undefined to indicate element was not found (simulates queryBy)
    return undefined;
  }
};

const getDeleteButton = () => {
  try {
    const allImages = screen.UNSAFE_getAllByType(Image);
    return allImages.find(
      (img: any) => img.props.source && img.props.source.uri === 'delete-icon',
    );
  } catch (_error) {
    // Return undefined to indicate element was not found (simulates queryBy)
    return undefined;
  }
};

describe('LinkedBusinessCard', () => {
  const mockOnPress = jest.fn();
  const mockOnDeletePress = jest.fn();

  const mockBusiness: any = {
    id: 'b1',
    businessName: 'City General Hospital',
    address: '123 Health St, Mediville',
    distance: 5.2,
    rating: 4.8,
    photo: {uri: 'custom-photo'},
    placeId: 'place_123',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (Linking.canOpenURL as jest.Mock).mockResolvedValue(true);
    (Linking.openURL as jest.Mock).mockResolvedValue(undefined);

    // FIX: Ensure dispatch returns the action object so .unwrap() works in component
    mockDispatch.mockImplementation(action => action);

    // FIX: Double cast (as unknown as jest.Mock) fixes the TypeScript conversion error
    (fetchGooglePlacesImage as unknown as jest.Mock).mockReturnValue({
      unwrap: jest
        .fn()
        .mockResolvedValue({photoUrl: 'http://google-places.com/photo.jpg'}),
    });
  });

  it('renders business details correctly', () => {
    render(
      <LinkedBusinessCard business={mockBusiness} onPress={mockOnPress} />,
    );

    expect(screen.getByText('City General Hospital')).toBeTruthy();
    expect(screen.getByText('123 Health St, Mediville')).toBeTruthy();
    expect(screen.getByText('5.2mi')).toBeTruthy();
    expect(screen.getByText('4.8')).toBeTruthy();
  });

  it('renders fallback address and image when data is missing', () => {
    const incompleteBusiness = {
      ...mockBusiness,
      address: undefined,
      photo: undefined,
      distance: undefined,
      rating: undefined,
      placeId: undefined,
    };

    render(
      <LinkedBusinessCard
        // @ts-ignore
        business={incompleteBusiness}
        onPress={mockOnPress}
      />,
    );

    expect(screen.getByText('Address not available')).toBeTruthy();
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('fetches Google Places image on mount if placeId exists', async () => {
    render(<LinkedBusinessCard business={mockBusiness} />);

    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalled();
      expect(fetchGooglePlacesImage).toHaveBeenCalledWith('place_123');
    });
  });

  it('handles main card press', () => {
    render(
      <LinkedBusinessCard business={mockBusiness} onPress={mockOnPress} />,
    );

    fireEvent.press(screen.getByText('City General Hospital'));
    expect(mockOnPress).toHaveBeenCalled();
  });

  it('handles Delete button press', () => {
    render(
      <LinkedBusinessCard
        business={mockBusiness}
        onDeletePress={mockOnDeletePress}
      />,
    );

    const deleteBtnImage = getDeleteButton();
    expect(deleteBtnImage).toBeDefined();
    if (deleteBtnImage) {
      fireEvent.press(deleteBtnImage);
    }

    expect(mockOnDeletePress).toHaveBeenCalledWith(mockBusiness);
  });

  it('hides action buttons when showActionButtons is false', () => {
    render(
      <LinkedBusinessCard business={mockBusiness} showActionButtons={false} />,
    );

    expect(getDirectionsButton()).toBeUndefined();
    expect(getDeleteButton()).toBeUndefined();
  });

  it('applies border style when showBorder is true', () => {
    const {toJSON} = render(
      <LinkedBusinessCard business={mockBusiness} showBorder={true} />,
    );
    expect(toJSON()).toBeDefined();
  });

  describe('Directions Logic', () => {
    it('shows Alert if address is missing', () => {
      const noAddressBusiness = {...mockBusiness, address: ''};

      render(
        <LinkedBusinessCard
          business={noAddressBusiness}
          onPress={mockOnPress}
        />,
      );

      const dirBtn = getDirectionsButton();
      expect(dirBtn).toBeDefined();
      if (dirBtn) {
        fireEvent.press(dirBtn);
      }

      expect(Alert.alert).toHaveBeenCalledWith(
        'No Address',
        'Address not available for this business.',
      );
      expect(Linking.openURL).not.toHaveBeenCalled();
    });

    it('opens Google Maps scheme if supported', async () => {
      (Linking.canOpenURL as jest.Mock).mockResolvedValueOnce(true);

      render(<LinkedBusinessCard business={mockBusiness} />);

      const dirBtn = getDirectionsButton();
      expect(dirBtn).toBeDefined();
      if (dirBtn) {
        fireEvent.press(dirBtn);
      }

      await waitFor(() => {
        expect(Linking.canOpenURL).toHaveBeenCalledWith(
          expect.stringContaining(
            'maps://maps.google.com/?q=123%20Health%20St%2C%20Mediville',
          ),
        );
        expect(Linking.openURL).toHaveBeenCalledWith(
          expect.stringContaining(
            'maps://maps.google.com/?q=123%20Health%20St%2C%20Mediville',
          ),
        );
      });
    });

    it('opens Apple Maps scheme if Google Maps not supported', async () => {
      (Linking.canOpenURL as jest.Mock).mockResolvedValueOnce(false);

      render(<LinkedBusinessCard business={mockBusiness} />);

      const dirBtn = getDirectionsButton();
      expect(dirBtn).toBeDefined();
      if (dirBtn) {
        fireEvent.press(dirBtn);
      }

      await waitFor(() => {
        expect(Linking.openURL).toHaveBeenCalledWith(
          expect.stringContaining('maps://?address='),
        );
      });
    });

    it('falls back to Web URL if opening scheme fails', async () => {
      (Linking.canOpenURL as jest.Mock).mockRejectedValueOnce(
        new Error('Failed'),
      );

      render(<LinkedBusinessCard business={mockBusiness} />);

      const dirBtn = getDirectionsButton();
      expect(dirBtn).toBeDefined();
      if (dirBtn) {
        fireEvent.press(dirBtn);
      }

      await waitFor(() => {
        expect(Linking.openURL).toHaveBeenCalledWith(
          expect.stringContaining(
            'https://maps.google.com/?q=123%20Health%20St%2C%20Mediville',
          ),
        );
      });
    });
  });
});
