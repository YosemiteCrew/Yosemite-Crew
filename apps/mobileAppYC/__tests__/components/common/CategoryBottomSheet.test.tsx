import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {Button} from '@/shared/components/common/Button/Button';
import {useTheme} from '@/hooks';

// --- Mocks ---

// 1. Mock useTheme
const mockTheme = {
  borderRadius: {
    base: 8,
  },
  spacing: {
    '2': 4,
    '3': 8,
    '4': 12,
    '6': 16,
  },
  colors: {
    primary: 'mock-primary',
    secondary: 'mock-secondary',
    surface: 'mock-surface',
    textSecondary: 'mock-text-secondary',
    transparent: 'transparent',
  },
  typography: {
    button: {fontSize: 16, fontWeight: '600'},
    buttonSmall: {fontSize: 14, fontWeight: '500'},
  },
};

jest.mock('@/hooks', () => ({
  useTheme: jest.fn(() => ({
    theme: mockTheme,
  })),
}));

// 2. Mock react-native
jest.mock('react-native', () => {
  const React = require('react');
  const RN = jest.requireActual('react-native');

  const createMockComponent = (name: string, testID?: string) =>
    React.forwardRef((props: any, ref: any) =>
      React.createElement(name, {
        ...props,
        ref,
        testID: props.testID || testID,
      }),
    );

  const MockTouchableOpacity = React.forwardRef((props: any, ref: any) => {
    const {onPress, disabled, ...rest} = props;
    const handlePress = () => {
      if (!disabled) {
        onPress?.();
      }
    };
    return React.createElement('TouchableOpacity', {
      ...rest,
      ref,
      onPress: handlePress,
      disabled: disabled,
      testID: props.testID || 'mock-touchable-opacity',
    });
  });

  return {
    TouchableOpacity: MockTouchableOpacity,
    Text: createMockComponent('Text', 'mock-text'),
    View: createMockComponent('View'),
    ActivityIndicator: createMockComponent(
      'ActivityIndicator',
      'mock-activity-indicator',
    ),
    StyleSheet: {
      create: (styles: any) => styles,
      flatten: (styles: any) => styles,
      absoluteFillObject: RN.StyleSheet.absoluteFillObject,
      hairlineWidth: RN.StyleSheet.hairlineWidth,
    },
    Platform: RN.Platform,
    PixelRatio: RN.PixelRatio,
  };
});

// --- Tests ---

describe('Button', () => {
  const mockOnPress = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useTheme as jest.Mock).mockReturnValue({theme: mockTheme});
  });

  it('renders the title', () => {
    const {getByText} = render(
      <Button title="Click Me" onPress={mockOnPress} />,
    );
    expect(getByText('Click Me')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const {getByTestId} = render(
      <Button title="Click Me" onPress={mockOnPress} />,
    );
    fireEvent.press(getByTestId('mock-touchable-opacity'));
    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });

  it('disables the button and does not call onPress when disabled={true}', () => {
    const {getByTestId} = render(
      <Button title="Disabled" onPress={mockOnPress} disabled={true} />,
    );
    const button = getByTestId('mock-touchable-opacity');
    fireEvent.press(button);
    expect(mockOnPress).not.toHaveBeenCalled();
    expect(button.props.disabled).toBe(true);
  });

  it('disables the button and does not call onPress when loading={true}', () => {
    const {getByTestId, getByText} = render(
      <Button title="Loading" onPress={mockOnPress} loading={true} />,
    );
    const button = getByTestId('mock-touchable-opacity');
    const indicator = getByTestId('mock-activity-indicator');
    fireEvent.press(button);
    expect(mockOnPress).not.toHaveBeenCalled();
    expect(button.props.disabled).toBe(true);
    expect(indicator).toBeTruthy();
    expect(getByText('Loading')).toBeTruthy();
  });

  it('does not show ActivityIndicator when not loading', () => {
    const {queryByTestId} = render(
      <Button title="Click Me" onPress={mockOnPress} loading={false} />,
    );
    expect(queryByTestId('mock-activity-indicator')).toBeNull();
  });

  it('passes correct indicator color for "primary" variant', () => {
    const {getByTestId} = render(
      <Button
        title="Loading"
        onPress={mockOnPress}
        loading={true}
        variant="primary"
      />,
    );
    expect(getByTestId('mock-activity-indicator').props.color).toBe(
      mockTheme.colors.surface,
    );
  });

  it('passes correct indicator color for "secondary" variant', () => {
    const {getByTestId} = render(
      <Button
        title="Loading"
        onPress={mockOnPress}
        loading={true}
        variant="secondary"
      />,
    );
    expect(getByTestId('mock-activity-indicator').props.color).toBe(
      mockTheme.colors.surface,
    );
  });

  it('passes correct indicator color for "outline" variant', () => {
    const {getByTestId} = render(
      <Button
        title="Loading"
        onPress={mockOnPress}
        loading={true}
        variant="outline"
      />,
    );
    expect(getByTestId('mock-activity-indicator').props.color).toBe(
      mockTheme.colors.primary,
    );
  });

  it('passes correct indicator color for "ghost" variant', () => {
    const {getByTestId} = render(
      <Button
        title="Loading"
        onPress={mockOnPress}
        loading={true}
        variant="ghost"
      />,
    );
    expect(getByTestId('mock-activity-indicator').props.color).toBe(
      mockTheme.colors.primary,
    );
  });

  // NEW TEST FOR 100% BRANCH COVERAGE
  it('applies correct disabled text color for "outline" variant', () => {
    const {getByText} = render(
      <Button
        title="Disabled Outline"
        onPress={mockOnPress}
        variant="outline"
        disabled={true}
      />,
    );
    const text = getByText('Disabled Outline');
    expect(text.props.style[0].color).toBe(mockTheme.colors.textSecondary);
  });

  it('applies custom style to TouchableOpacity', () => {
    const customStyle = {margin: 100};
    const {getByTestId} = render(
      <Button title="Custom" onPress={mockOnPress} style={customStyle} />,
    );
    const button = getByTestId('mock-touchable-opacity');
    expect(button.props.style).toEqual(expect.arrayContaining([customStyle]));
  });

  it('applies custom textStyle to Text', () => {
    const customTextStyle = {fontSize: 99};
    const {getByText} = render(
      <Button
        title="Custom"
        onPress={mockOnPress}
        textStyle={customTextStyle}
      />,
    );
    const text = getByText('Custom');
    expect(text.props.style).toEqual(expect.arrayContaining([customTextStyle]));
  });
});
