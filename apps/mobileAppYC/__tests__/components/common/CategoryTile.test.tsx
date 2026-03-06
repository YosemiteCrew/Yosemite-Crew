import React from 'react';
import { render } from '@testing-library/react-native';
import { CategoryTile } from '@/shared/components/common/CategoryTile/CategoryTile';
import { Images } from '@/assets/images';
import { mockTheme } from '../setup/mockTheme';
import { useTheme } from '@/hooks';
// Removed 'View' import as it's not used directly in the test file, only in mocks

// --- Mocks ---

// 1. Mock useTheme
jest.mock('@/hooks', () => {
  const {mockTheme: theme} = require('../setup/mockTheme');
  return {
    __esModule: true,
    useTheme: jest.fn(() => ({theme, isDark: false})),
  };
});

// 2. Spy on the props passed to the child component
const mockIconInfoTile = jest.fn();

jest.mock('@/shared/components/common/tiles/IconInfoTile', () => {
  // FIX: Dependencies must be required *inside* the mock factory
  const { View } = require('react-native');

  return {
    IconInfoTile: jest.fn((props: any) => {
      // Call the spy
      mockIconInfoTile(props);
      // Render the rightAccessory so we can test it
      return (
        <View testID="mock-icon-info-tile">{props.rightAccessory}</View>
      );
    }),
  };
});

// 2. Mock assets
jest.mock('@/assets/images', () => ({
  Images: {
    rightArrow: 12345, // Mocked image source
  },
}));

// 3. Mock react-native
jest.mock('react-native', () => {
  const ReactActual = jest.requireActual('react');
  const RN = jest.requireActual('react-native');

  const createMockComponent = (name: string, testID?: string) =>
    ReactActual.forwardRef((props: any, ref: any) =>
      ReactActual.createElement(name, {
        ...props,
        ref,
        testID: props.testID || testID,
      }),
    );

  return {
    View: createMockComponent('View'),
    Text: createMockComponent('Text', 'mock-text'),
    Image: createMockComponent('Image', 'mock-image'),
    StyleSheet: {
      create: (styles: any) => styles,
      flatten: (styles: any) => styles,
    },
    Platform: RN.Platform,
    PixelRatio: RN.PixelRatio,
    Appearance: {
      getColorScheme: jest.fn(() => 'light'),
      addChangeListener: jest.fn(() => ({ remove: jest.fn() })),
    },
  };
});

// --- Tests ---

describe('CategoryTile', () => {
  const mockOnPress = jest.fn();
  const mockIcon = { uri: 'mock-icon-uri' };

  beforeEach(() => {
    jest.clearAllMocks();
    (useTheme as jest.Mock).mockReturnValue({ theme: mockTheme, isDark: false });
  });

  it('passes all props correctly to IconInfoTile with defaults', () => {
    const { getByTestId } = render(
      <CategoryTile
        icon={mockIcon}
        title="Test Title"
        subtitle="Test Subtitle"
        onPress={mockOnPress}
      />,
    );

    // Check that the child was called with all the correct props
    expect(mockIconInfoTile).toHaveBeenCalledWith(
      expect.objectContaining({
        icon: mockIcon,
        title: 'Test Title',
        subtitle: 'Test Subtitle',
        onPress: mockOnPress,
        isSynced: false, // Verifies default prop
        syncLabel: 'Synced with\nYosemite Crew PMS',
        containerStyle: undefined,
      }),
    );

    // Check that the rightAccessory (the arrow) was rendered
    const rightArrow = getByTestId('mock-image');
    expect(rightArrow).toBeTruthy();
    expect(rightArrow.props.source).toBe(Images.rightArrow);
    expect(rightArrow.props.style).toEqual(
      expect.objectContaining({
        tintColor: '#747473',
      }),
    );
  });

  it('passes isSynced={true} when provided', () => {
    render(
      <CategoryTile
        icon={mockIcon}
        title="Test"
        subtitle="Test"
        onPress={mockOnPress}
        isSynced={true}
      />,
    );

    expect(mockIconInfoTile).toHaveBeenCalledWith(
      expect.objectContaining({
        isSynced: true,
      }),
    );
  });

  it('passes containerStyle when provided', () => {
    const customStyle = { backgroundColor: 'red' };
    render(
      <CategoryTile
        icon={mockIcon}
        title="Test"
        subtitle="Test"
        onPress={mockOnPress}
        containerStyle={customStyle}
      />,
    );

    expect(mockIconInfoTile).toHaveBeenCalledWith(
      expect.objectContaining({
        containerStyle: customStyle,
      }),
    );
  });
});
