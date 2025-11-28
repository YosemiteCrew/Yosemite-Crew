import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Checkbox } from '@/shared/components/common/Checkbox/Checkbox';
import { useTheme } from '@/hooks';

// --- Mocks ---

// 1. Mock useTheme
const mockTheme = {
  colors: {
    border: 'mock-border',
    primary: 'mock-primary',
    error: 'mock-error',
    white: 'mock-white',
    text: 'mock-text',
  },
  typography: {
    subtitleRegular14: {
      fontFamily: 'Satoshi-Regular',
      fontSize: 14,
      lineHeight: 16.8,
      fontWeight: '400',
    },
    SATOSHI_REGULAR: 'Satoshi-Regular-Fallback', // Fallback font
  },
};

jest.mock('@/hooks', () => ({
  useTheme: jest.fn(() => ({
    theme: mockTheme,
  })),
}));

// 2. Mock react-native
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

  const MockTouchableOpacity = ReactActual.forwardRef((props: any, ref: any) => {
    const { onPress, disabled, ...rest } = props;
    const handlePress = () => {
      if (!disabled) {
        onPress?.();
      }
    };
    return ReactActual.createElement('TouchableOpacity', {
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
    View: createMockComponent('View', 'mock-view'),
    StyleSheet: {
      create: (styles: any) => styles,
      flatten: (styles: any) => styles,
    },
    Platform: RN.Platform,
    PixelRatio: RN.PixelRatio,
  };
});

// --- Tests ---

describe('Checkbox', () => {
  const mockOnValueChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useTheme as jest.Mock).mockReturnValue({ theme: mockTheme });
  });

  it('renders unchecked by default and shows no checkmark', () => {
    const { queryByText } = render(
      <Checkbox value={false} onValueChange={mockOnValueChange} />,
    );
    expect(queryByText('✓')).toBeNull();
  });

  it('renders checked when value is true and shows checkmark', () => {
    const { getByText } = render(
      <Checkbox value={true} onValueChange={mockOnValueChange} />,
    );
    expect(getByText('✓')).toBeTruthy();
  });

  it('calls onValueChange with true when pressed while unchecked', () => {
    const { getByTestId } = render(
      <Checkbox value={false} onValueChange={mockOnValueChange} />,
    );
    fireEvent.press(getByTestId('mock-touchable-opacity'));
    expect(mockOnValueChange).toHaveBeenCalledWith(true);
  });

  it('calls onValueChange with false when pressed while checked', () => {
    const { getByTestId } = render(
      <Checkbox value={true} onValueChange={mockOnValueChange} />,
    );
    fireEvent.press(getByTestId('mock-touchable-opacity'));
    expect(mockOnValueChange).toHaveBeenCalledWith(false);
  });

  it('renders the label when provided', () => {
    const { getByText } = render(
      <Checkbox
        value={false}
        onValueChange={mockOnValueChange}
        label="Test Label"
      />,
    );
    expect(getByText('Test Label')).toBeTruthy();
  });

  it('renders the error message when provided', () => {
    const { getByText } = render(
      <Checkbox
        value={false}
        onValueChange={mockOnValueChange}
        error="Test Error"
      />,
    );
    expect(getByText('Test Error')).toBeTruthy();
  });

  it('does not render the error message when not provided', () => {
    const { queryByText } = render(
      <Checkbox value={false} onValueChange={mockOnValueChange} />,
    );
    expect(queryByText('Test Error')).toBeNull();
  });

  it('applies custom labelStyle', () => {
    const customStyle = { color: 'red', fontSize: 20 };
    const { getByText } = render(
      <Checkbox
        value={false}
        onValueChange={mockOnValueChange}
        label="Styled Label"
        labelStyle={customStyle}
      />,
    );
    const label = getByText('Styled Label');
    expect(label.props.style).toEqual(expect.arrayContaining([customStyle]));
  });

  it('applies checkboxChecked style when value is true', () => {
    const { getByTestId } = render(
      <Checkbox value={true} onValueChange={mockOnValueChange} />,
    );
    const touchable = getByTestId('mock-touchable-opacity');
    const checkboxView = touchable.props.children[0]; // The inner View

    expect(checkboxView.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ backgroundColor: 'mock-primary' }),
      ]),
    );
  });

  it('applies checkboxError style when error is provided', () => {
    const { getByTestId } = render(
      <Checkbox
        value={false}
        onValueChange={mockOnValueChange}
        error="Test Error"
      />,
    );
    const touchable = getByTestId('mock-touchable-opacity');
    const checkboxView = touchable.props.children[0]; // The inner View

    expect(checkboxView.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ borderColor: 'mock-error' }),
      ]),
    );
  });

  it('applies both checked and error styles when appropriate', () => {
    const { getByTestId } = render(
      <Checkbox
        value={true}
        onValueChange={mockOnValueChange}
        error="Test Error"
      />,
    );
    const touchable = getByTestId('mock-touchable-opacity');
    const checkboxView = touchable.props.children[0]; // The inner View

    expect(checkboxView.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ backgroundColor: 'mock-primary' }),
        expect.objectContaining({ borderColor: 'mock-error' }),
      ]),
    );
  });

  it('uses fallback typography if subtitleRegular14 is missing', () => {
    const themeWithoutTypography = {
      ...mockTheme,
      typography: {
        SATOSHI_REGULAR: 'Satoshi-Regular-Fallback',
        // subtitleRegular14 is deliberately missing
      },
    };
    (useTheme as jest.Mock).mockReturnValue({ theme: themeWithoutTypography });

    const { getByText } = render(
      <Checkbox
        value={false}
        onValueChange={mockOnValueChange}
        label="My Label"
      />,
    );
    const label = getByText('My Label');
    const style = label.props.style[0];

    expect(style.fontFamily).toBe(
      themeWithoutTypography.typography.SATOSHI_REGULAR,
    );
    expect(style.fontSize).toBe(14);
    expect(style.lineHeight).toBe(14 * 1.2);
    expect(style.fontWeight).toBe('400');
  });
});
