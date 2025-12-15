import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {
  SearchBar,
  SearchBarProps,
} from '../../../src/shared/components/common/SearchBar/SearchBar';
import {StyleSheet, View, Image} from 'react-native';

// --- Mocks ---

// Mock LiquidGlassCard since it's a wrapper
jest.mock(
  '../../../src/shared/components/common/LiquidGlassCard/LiquidGlassCard',
  () => {
    const {View: RNView} = require('react-native');
    return {
      LiquidGlassCard: (props: any) => (
        <RNView testID="liquid-glass-card" {...props} />
      ),
    };
  },
);

// Mock Images asset
jest.mock('@/assets/images', () => ({
  Images: {
    searchIcon: {uri: 'search-icon-png'},
  },
}));

// Mock theme hook
jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        border: '#e0e0e0',
        cardBackground: '#ffffff',
        neutralShadow: '#000000',
        text: '#000000',
        textSecondary: '#888888',
      },
      borderRadius: {
        lg: 12,
      },
      spacing: {
        3: 12,
        4: 16,
      },
      shadows: {
        base: {shadowOpacity: 0.1},
      },
      typography: {
        paragraph: {
          fontFamily: 'System',
          fontWeight: '400',
        },
      },
    },
  }),
}));

describe('SearchBar Component', () => {
  const defaultProps: SearchBarProps = {
    placeholder: 'Find something...',
    onPress: jest.fn(),
    onIconPress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  // 1. Readonly Mode (Default)
  // ===========================================================================

  describe('Readonly Mode', () => {
    it('renders correctly in readonly mode (default)', () => {
      const {getByText, getByTestId} = render(
        <SearchBar {...defaultProps} mode="readonly" />,
      );

      // Verify wrapper
      expect(getByTestId('liquid-glass-card')).toBeTruthy();
      // Verify placeholder text is rendered as Text, not Input placeholder
      expect(getByText('Find something...')).toBeTruthy();
    });

    it('calls onPress when the main container is pressed', () => {
      const {getByText} = render(
        <SearchBar {...defaultProps} mode="readonly" />,
      );

      // The touchable wraps the content
      fireEvent.press(getByText('Find something...'));
      expect(defaultProps.onPress).toHaveBeenCalledTimes(1);
    });

    it('calls onIconPress when the search icon is pressed', () => {
      const {UNSAFE_getByType} = render(
        <SearchBar {...defaultProps} mode="readonly" />,
      );

      // Find the Image component
      const image = UNSAFE_getByType(Image);

      // Fire press on the parent TouchableOpacity
      fireEvent.press(image.parent as any);

      expect(defaultProps.onIconPress).toHaveBeenCalledTimes(1);
    });

    it('falls back to calling onPress if onIconPress is not provided', () => {
      const {UNSAFE_getByType} = render(
        <SearchBar
          {...defaultProps}
          onIconPress={undefined} // Undefined icon handler
          mode="readonly"
        />,
      );

      const image = UNSAFE_getByType(Image);
      fireEvent.press(image.parent as any);

      // Should fall back to the main onPress handler
      expect(defaultProps.onPress).toHaveBeenCalledTimes(1);
    });

    it('renders rightElement if provided', () => {
      // Use View instead of Fragment to ensure testID is preserved
      const {getByTestId} = render(
        <SearchBar
          {...defaultProps}
          mode="readonly"
          rightElement={<View testID="right-elem" />}
        />,
      );
      expect(getByTestId('right-elem')).toBeTruthy();
    });
  });

  // ===========================================================================
  // 2. Input Mode
  // ===========================================================================

  describe('Input Mode', () => {
    it('renders a TextInput in input mode', () => {
      const {getByPlaceholderText} = render(
        <SearchBar {...defaultProps} mode="input" />,
      );
      expect(getByPlaceholderText('Find something...')).toBeTruthy();
    });

    it('passes value and handles text changes', () => {
      const mockOnChange = jest.fn();
      const {getByPlaceholderText} = render(
        <SearchBar
          {...defaultProps}
          mode="input"
          value="Initial"
          onChangeText={mockOnChange}
        />,
      );

      const input = getByPlaceholderText('Find something...');
      expect(input.props.value).toBe('Initial');

      fireEvent.changeText(input, 'New Text');
      expect(mockOnChange).toHaveBeenCalledWith('New Text');
    });

    it('handles onSubmitEditing on the input itself', () => {
      const mockOnSubmit = jest.fn();
      const {getByPlaceholderText} = render(
        <SearchBar
          {...defaultProps}
          mode="input"
          onSubmitEditing={mockOnSubmit}
        />,
      );

      const input = getByPlaceholderText('Find something...');
      fireEvent(input, 'submitEditing');
      expect(mockOnSubmit).toHaveBeenCalled();
    });

    it('calls onIconPress when icon is pressed in input mode', () => {
      const {UNSAFE_getByType} = render(
        <SearchBar {...defaultProps} mode="input" />,
      );

      const image = UNSAFE_getByType(Image);
      fireEvent.press(image.parent as any);

      expect(defaultProps.onIconPress).toHaveBeenCalledTimes(1);
    });

    it('calls onSubmitEditing with current value when icon is pressed AND onIconPress is missing', () => {
      const mockOnSubmit = jest.fn();
      const testValue = 'Test Query';

      const {UNSAFE_getByType} = render(
        <SearchBar
          {...defaultProps}
          mode="input"
          onIconPress={undefined}
          onSubmitEditing={mockOnSubmit}
          value={testValue}
        />,
      );

      const image = UNSAFE_getByType(Image);
      fireEvent.press(image.parent as any);

      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
      // It simulates the native event structure
      expect(mockOnSubmit).toHaveBeenCalledWith({
        nativeEvent: {text: testValue},
      });
    });

    it('safely handles empty value when simulating onSubmitEditing via icon press', () => {
      const mockOnSubmit = jest.fn();
      const {UNSAFE_getByType} = render(
        <SearchBar
          {...defaultProps}
          mode="input"
          onIconPress={undefined}
          onSubmitEditing={mockOnSubmit}
          value={undefined} // Value missing
        />,
      );

      const image = UNSAFE_getByType(Image);
      fireEvent.press(image.parent as any);

      expect(mockOnSubmit).toHaveBeenCalledWith({
        nativeEvent: {text: ''},
      });
    });

    it('does nothing when icon is pressed if neither handler exists', () => {
      const {UNSAFE_getByType} = render(
        <SearchBar
          {...defaultProps}
          mode="input"
          onIconPress={undefined}
          onSubmitEditing={undefined}
        />,
      );

      const image = UNSAFE_getByType(Image);
      expect(() => fireEvent.press(image.parent as any)).not.toThrow();
    });

    it('supports autoFocus', () => {
      const {getByPlaceholderText} = render(
        <SearchBar {...defaultProps} mode="input" autoFocus={true} />,
      );
      const input = getByPlaceholderText('Find something...');
      expect(input.props.autoFocus).toBe(true);
    });
  });

  // ===========================================================================
  // 3. Styling & Props
  // ===========================================================================

  it('merges container styles correctly', () => {
    const customStyle = {backgroundColor: 'red'};
    const {getByTestId} = render(
      <SearchBar {...defaultProps} containerStyle={customStyle} />,
    );

    const card = getByTestId('liquid-glass-card');
    const flatStyle = StyleSheet.flatten(card.props.style);

    expect(flatStyle).toMatchObject(expect.objectContaining(customStyle));
  });

  it('provides correct default props', () => {
    // Render without optional props
    const {getByText} = render(<SearchBar />);
    expect(getByText('Search')).toBeTruthy(); // Default placeholder
  });
});
