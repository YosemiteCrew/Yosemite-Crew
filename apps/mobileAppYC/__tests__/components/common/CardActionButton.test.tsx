import React from 'react';
import {mockTheme} from '../setup/mockTheme';
import {render, fireEvent} from '@testing-library/react-native';
import {CardActionButton} from '@/shared/components/common/CardActionButton/CardActionButton';
import {useTheme} from '@/hooks';

// --- Mocks ---

// 1. Mock useTheme

jest.mock('@/hooks', () => {
  const {mockTheme: theme} = require('../setup/mockTheme');
  return {
    __esModule: true,
    useTheme: jest.fn(() => ({theme, isDark: false})),
  };
});

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

  return {
    TouchableOpacity: createMockComponent(
      'TouchableOpacity',
      'mock-touchable-opacity',
    ),
    Text: createMockComponent('Text', 'mock-text'),
    View: createMockComponent('View'),
    Image: createMockComponent('Image', 'mock-image'),
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

describe('CardActionButton', () => {
  const mockOnPress = jest.fn();
  const mockIconSource = 12345; // Mock RN image require()

  beforeEach(() => {
    jest.clearAllMocks();
    (useTheme as jest.Mock).mockReturnValue({theme: mockTheme});
  });

  it('renders the label and handles press', () => {
    const {getByText, getByTestId} = render(
      <CardActionButton label="Press Me" onPress={mockOnPress} />,
    );

    // Check for label
    expect(getByText('Press Me')).toBeTruthy();

    // Check for press
    fireEvent.press(getByTestId('mock-touchable-opacity'));
    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });

  it('renders the icon when provided', () => {
    const {getByTestId} = render(
      <CardActionButton
        label="With Icon"
        onPress={mockOnPress}
        icon={mockIconSource}
      />,
    );

    const icon = getByTestId('mock-image');
    expect(icon).toBeTruthy();
    expect(icon.props.source).toBe(mockIconSource);
  });

  it('does not render the icon when not provided', () => {
    const {queryByTestId} = render(
      <CardActionButton label="No Icon" onPress={mockOnPress} />,
    );

    expect(queryByTestId('mock-image')).toBeNull();
  });

  it('applies correct styles for "primary" variant (default)', () => {
    const {getByTestId, getByText} = render(
      <CardActionButton
        label="Primary"
        onPress={mockOnPress}
        icon={mockIconSource}
        variant="primary"
      />,
    );

    const icon = getByTestId('mock-image');
    const label = getByText('Primary');

    // tintColor should be secondary
    expect(icon.props.style[0].tintColor).toBe(mockTheme.colors.secondary);
    // label color should be secondary
    expect(label.props.style[0].color).toBe(mockTheme.colors.secondary);
  });

  it('applies correct styles for "success" variant', () => {
    const {getByTestId, getByText} = render(
      <CardActionButton
        label="Success"
        onPress={mockOnPress}
        icon={mockIconSource}
        variant="success"
      />,
    );

    const icon = getByTestId('mock-image');
    const label = getByText('Success');

    // tintColor should be white
    expect(icon.props.style[0].tintColor).toBe(mockTheme.colors.white);
    // label color should be white
    expect(label.props.style[0].color).toBe(mockTheme.colors.white);
  });

  it('applies correct styles for "secondary" variant', () => {
    const {getByTestId, getByText} = render(
      <CardActionButton
        label="Secondary"
        onPress={mockOnPress}
        icon={mockIconSource}
        variant="secondary"
      />,
    );

    const icon = getByTestId('mock-image');
    const label = getByText('Secondary');

    // tintColor should be secondary
    expect(icon.props.style[0].tintColor).toBe(mockTheme.colors.secondary);
    // label color should be secondary
    expect(label.props.style[0].color).toBe(mockTheme.colors.secondary);
  });

  it('applies custom styles to all elements', () => {
    const customButtonStyle = {margin: 10};
    const customLabelStyle = {fontSize: 99};
    const customIconStyle = {width: 123};

    const {getByTestId, getByText} = render(
      <CardActionButton
        label="Custom"
        onPress={mockOnPress}
        icon={mockIconSource}
        buttonStyle={customButtonStyle}
        labelStyle={customLabelStyle}
        iconStyle={customIconStyle}
      />,
    );

    const button = getByTestId('mock-touchable-opacity');
    const icon = getByTestId('mock-image');
    const label = getByText('Custom');

    expect(button.props.style).toEqual(
      expect.arrayContaining([customButtonStyle]),
    );
    expect(label.props.style).toEqual(
      expect.arrayContaining([customLabelStyle]),
    );
    expect(icon.props.style).toEqual(expect.arrayContaining([customIconStyle]));
  });
});
