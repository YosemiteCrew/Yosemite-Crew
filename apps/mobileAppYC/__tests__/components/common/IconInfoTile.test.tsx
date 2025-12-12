import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import IconInfoTile from '../../../src/shared/components/common/tiles/IconInfoTile';
import {Image, Text} from 'react-native';

// --- Mocks ---

// Mock Images
jest.mock('@/assets/images', () => ({
  Images: {
    // Just a placeholder, though not strictly used inside the component directly,
    // the component receives 'icon' as a prop.
    someIcon: {uri: 'icon-png'},
  },
}));

// Mock Hooks
jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        secondary: 'black',
        textSecondary: 'gray',
        success: 'green',
        successLight: '#lightgreen',
      },
      spacing: {
        2: 8,
        3: 12,
        4: 16,
      },
      borderRadius: {
        md: 8,
      },
      typography: {
        titleMedium: {fontSize: 16, fontWeight: 'bold'},
        labelXsBold: {fontSize: 12, fontWeight: 'bold'},
      },
      shadows: {},
    },
  }),
}));

// Mock Styles Utils
jest.mock('@/shared/utils/cardStyles', () => ({
  createGlassCardStyles: () => ({card: {}, fallback: {}}),
  createCardContentStyles: () => ({content: {}}),
  createIconContainerStyles: () => ({iconContainer: {}}),
  createTextContainerStyles: () => ({textContainer: {}}),
}));

// Mock LiquidGlassCard
jest.mock('@/shared/components/common/LiquidGlassCard/LiquidGlassCard', () => {
  const {View: RNView} = require('react-native');
  return {
    LiquidGlassCard: (props: any) => (
      <RNView testID="liquid-glass-card">{props.children}</RNView>
    ),
  };
});

describe('IconInfoTile Component', () => {
  const mockOnPress = jest.fn();
  const mockIcon = {uri: 'test-icon'};
  const defaultProps = {
    icon: mockIcon,
    title: 'Test Title',
    subtitle: 'Test Subtitle',
    onPress: mockOnPress,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  // 1. Rendering Logic
  // ===========================================================================

  it('renders title, subtitle and icon correctly', () => {
    const {getByText, UNSAFE_getByType} = render(
      <IconInfoTile {...defaultProps} />,
    );

    expect(getByText('Test Title')).toBeTruthy();
    expect(getByText('Test Subtitle')).toBeTruthy();

    const image = UNSAFE_getByType(Image);
    expect(image.props.source).toEqual(mockIcon);
  });

  // ===========================================================================
  // 2. Conditional Rendering (Sync Badge & Accessories)
  // ===========================================================================

  it('renders sync badge with default text when isSynced is true', () => {
    const {getByText} = render(
      <IconInfoTile {...defaultProps} isSynced={true} />,
    );
    expect(getByText('Synced')).toBeTruthy();
  });

  it('renders sync badge with custom text when isSynced is true and syncLabel is provided', () => {
    const {getByText} = render(
      <IconInfoTile {...defaultProps} isSynced={true} syncLabel="Connected" />,
    );
    expect(getByText('Connected')).toBeTruthy();
  });

  it('does NOT render sync badge when isSynced is false', () => {
    const {queryByText} = render(
      <IconInfoTile {...defaultProps} isSynced={false} />,
    );
    expect(queryByText('Synced')).toBeNull();
  });

  it('renders rightAccessory when provided', () => {
    const {getByText} = render(
      <IconInfoTile {...defaultProps} rightAccessory={<Text>Arrow</Text>} />,
    );
    expect(getByText('Arrow')).toBeTruthy();
  });

  // ===========================================================================
  // 3. Interaction Logic
  // ===========================================================================

  it('calls onPress when the tile is pressed', () => {
    const {getByTestId} = render(<IconInfoTile {...defaultProps} />);

    // The container is a TouchableOpacity. Since RNTL renders it,
    // we can find the LiquidGlassCard (which is mocked as a View)
    // and go up to its parent, or find the TouchableOpacity directly if unambiguous.
    // However, finding by text and pressing the parent is usually safe in simple tiles.
    const title = getByTestId('liquid-glass-card');
    // The touchable wraps the card.
    fireEvent.press(title.parent as any);

    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });

  // ===========================================================================
  // 4. Styling Logic
  // ===========================================================================

  it('applies custom container styles', () => {
    const customStyle = {backgroundColor: 'red'};
    const {UNSAFE_getByType} = render(
      <IconInfoTile {...defaultProps} containerStyle={customStyle} />,
    );

    const {TouchableOpacity} = require('react-native');
    const touchable = UNSAFE_getByType(TouchableOpacity);

    // Flatten styles to verify containment
    const flattened = [touchable.props.style].flat();
    expect(flattened).toEqual(
      expect.arrayContaining([expect.objectContaining(customStyle)]),
    );
  });
});
