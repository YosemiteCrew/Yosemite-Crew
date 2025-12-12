import React from 'react';
import {render} from '@testing-library/react-native';
import {
  PrimaryActionButton,
  PrimaryActionButtonProps,
} from '../../../src/shared/components/common/PrimaryActionButton/PrimaryActionButton';
import {StyleSheet} from 'react-native';

// --- Mocks ---

// Mock useTheme
jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        secondary: '#333333',
        borderMuted: '#cccccc',
        background: '#ffffff',
      },
      borderRadius: {
        lg: 12,
      },
      typography: {
        cta: {fontSize: 16, fontWeight: 'bold'},
      },
    },
  }),
}));

// Mock LiquidGlassButton
// Use a View and spread props to ensure 'disabled' and other props are inspectable
jest.mock(
  '@/shared/components/common/LiquidGlassButton/LiquidGlassButton',
  () => {
    const {View, Text} = require('react-native');
    return {
      __esModule: true,
      default: (props: any) => (
        <View testID="mock-liquid-button" {...props}>
          <Text style={props.textStyle}>{props.title}</Text>
        </View>
      ),
    };
  },
);

describe('PrimaryActionButton Component', () => {
  const defaultProps: PrimaryActionButtonProps = {
    title: 'Click Me',
    onPress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  // 1. Rendering Logic
  // ===========================================================================

  it('renders correctly with default props', () => {
    const {getByText, getByTestId} = render(
      <PrimaryActionButton {...defaultProps} />,
    );
    expect(getByText('Click Me')).toBeTruthy();
    expect(getByTestId('mock-liquid-button')).toBeTruthy();
  });

  // ===========================================================================
  // 2. Interaction
  // ===========================================================================

  it('calls onPress when pressed', () => {
    const {getByTestId} = render(<PrimaryActionButton {...defaultProps} />);
    // Note: Since we mocked with View, we simulate the press on the View.
    // In a real integration test, the child would handle this, but here we test prop passing.
    const button = getByTestId('mock-liquid-button');

    // Simulate the function call passed to the child's onPress prop
    button.props.onPress();

    expect(defaultProps.onPress).toHaveBeenCalledTimes(1);
  });

  it('passes disabled prop correctly', () => {
    const {getByTestId} = render(
      <PrimaryActionButton {...defaultProps} disabled={true} />,
    );
    const button = getByTestId('mock-liquid-button');
    expect(button.props.disabled).toBe(true);
  });

  // ===========================================================================
  // 3. Props Passing (Loading)
  // ===========================================================================

  it('passes loading prop to LiquidGlassButton', () => {
    const {getByTestId} = render(
      <PrimaryActionButton {...defaultProps} loading={true} />,
    );
    const button = getByTestId('mock-liquid-button');
    expect(button.props.loading).toBe(true);
  });

  // ===========================================================================
  // 4. Styling
  // ===========================================================================

  it('merges container style correctly', () => {
    const customStyle = {backgroundColor: 'red', marginTop: 10};
    const {getByTestId} = render(
      <PrimaryActionButton {...defaultProps} style={customStyle} />,
    );

    const button = getByTestId('mock-liquid-button');
    // StyleSheet.flatten is safe here because we passed the style prop through to the View
    const flatStyle = StyleSheet.flatten(button.props.style);

    expect(flatStyle).toMatchObject(expect.objectContaining(customStyle));
    // Verify default style (from createStyles) is also present
    expect(flatStyle).toHaveProperty('width', '100%');
  });

  it('merges text style correctly', () => {
    const customTextStyle = {color: 'blue', fontSize: 20};
    const {getByText} = render(
      <PrimaryActionButton {...defaultProps} textStyle={customTextStyle} />,
    );

    const text = getByText('Click Me');
    const flatStyle = StyleSheet.flatten(text.props.style);

    expect(flatStyle).toMatchObject(expect.objectContaining(customTextStyle));
    // Verify default text style
    expect(flatStyle).toHaveProperty('textAlign', 'center');
  });
});
