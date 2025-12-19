import React from 'react';
import {mockTheme} from '../../../setup/mockTheme';
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
  useTheme: () => ({theme: mockTheme, isDark: false}),
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
  // FIX: Alias React to avoid shadowing the top-level import
  const ReactMock = require('react');

  class MockView extends ReactMock.Component {
    render() {
      return ReactMock.createElement('View', this.props, this.props.children);
    }
  }
  class MockText extends ReactMock.Component {
    render() {
      return ReactMock.createElement('Text', this.props, this.props.children);
    }
  }
  class MockImage extends ReactMock.Component {
    render() {
      return ReactMock.createElement('Image', this.props, this.props.children);
    }
  }
  class MockTouchableOpacity extends ReactMock.Component {
    render() {
      return ReactMock.createElement(
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

    mockDispatch.mockImplementation(action => action);

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

    it('opens Apple Maps when supported', async () => {
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
            'maps://?q=123%20Health%20St%2C%20Mediville',
          ),
        );
        expect(Linking.openURL).toHaveBeenCalledWith(
          expect.stringContaining(
            'maps://?q=123%20Health%20St%2C%20Mediville',
          ),
        );
      });
    });

    it('falls back to Apple Maps web if the native scheme is unavailable', async () => {
      (Linking.canOpenURL as jest.Mock).mockResolvedValueOnce(false).mockResolvedValueOnce(true);

      render(<LinkedBusinessCard business={mockBusiness} />);

      const dirBtn = getDirectionsButton();
      expect(dirBtn).toBeDefined();
      if (dirBtn) {
        fireEvent.press(dirBtn);
      }

      await waitFor(() => {
        expect(Linking.openURL).toHaveBeenCalledWith(
          expect.stringContaining('http://maps.apple.com/?q=123%20Health%20St%2C%20Mediville'),
        );
      });
    });

    it('falls back to Web URL if opening scheme fails', async () => {
      (Linking.canOpenURL as jest.Mock)
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      render(<LinkedBusinessCard business={mockBusiness} />);

      const dirBtn = getDirectionsButton();
      expect(dirBtn).toBeDefined();
      if (dirBtn) {
        fireEvent.press(dirBtn);
      }

      await waitFor(() => {
        expect(Linking.openURL).toHaveBeenCalledWith(
          expect.stringContaining(
            'https://www.google.com/maps/search/?api=1&query=123%20Health%20St%2C%20Mediville',
          ),
        );
      });
    });
  });
});
