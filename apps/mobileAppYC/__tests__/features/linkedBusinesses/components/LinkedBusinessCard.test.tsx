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

// --- Mocks ---

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

// FIX 1: Safe "Manual Mock" for react-native to avoid "DevMenu" crash.
// We define components here so they have stable identities for UNSAFE_getAllByType.
jest.mock('react-native', () => {
  const React = require('react');

  // Simple mock components that pass props through
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
    // FIX 2: Pass the imported Image component (which resolves to our MockImage)
    const allImages = screen.UNSAFE_getAllByType(Image);
    return allImages.find(
      (img: any) =>
        img.props.source && img.props.source.uri === 'direction-icon',
    );
  } finally {
    console.log('empty');
  }
};

const getDeleteButton = () => {
  try {
    const allImages = screen.UNSAFE_getAllByType(Image);
    return allImages.find(
      (img: any) => img.props.source && img.props.source.uri === 'delete-icon',
    );
  } finally {
    console.log('empty');
  }
};

describe('LinkedBusinessCard', () => {
  const mockOnPress = jest.fn();
  const mockOnDeletePress = jest.fn();

  // FIX 3: Cast mock data to 'any' to satisfy LinkedBusiness interface without mocking every field
  const mockBusiness: any = {
    id: 'b1',
    businessName: 'City General Hospital',
    address: '123 Health St, Mediville',
    distance: 5.2,
    rating: 4.8,
    photo: {uri: 'custom-photo'},
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (Linking.canOpenURL as jest.Mock).mockResolvedValue(true);
    (Linking.openURL as jest.Mock).mockResolvedValue(undefined);
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
    };

    render(
      <LinkedBusinessCard
        // @ts-ignore - Intentionally testing missing props
        business={incompleteBusiness}
        onPress={mockOnPress}
      />,
    );

    expect(screen.getByText('Address not available')).toBeTruthy();
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
    // FIX 4: Explicitly assert existence before interaction to satisfy TypeScript
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
          expect.stringContaining('maps://maps.google.com/?q='),
        );
        expect(Linking.openURL).toHaveBeenCalledWith(
          expect.stringContaining('maps://maps.google.com/?q='),
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
          expect.stringContaining('https://maps.google.com/?q='),
        );
      });
    });
  });
});
