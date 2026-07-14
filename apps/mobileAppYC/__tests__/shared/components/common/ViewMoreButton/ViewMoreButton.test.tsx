import React from 'react';
import {mockTheme} from '../../../../setup/mockTheme';
import {render, fireEvent} from '@testing-library/react-native';
import {ViewMoreButton} from '@/shared/components/common/ViewMoreButton/ViewMoreButton';

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

const mockLiquidGlassButton = jest.fn();
jest.mock(
  '@/shared/components/common/LiquidGlassButton/LiquidGlassButton',
  () => {
    const {TouchableOpacity, Text} = require('react-native');
    return {
      LiquidGlassButton: (props: any) => {
        mockLiquidGlassButton(props);
        return (
          <TouchableOpacity
            testID="liquid-glass-button"
            onPress={props.onPress}>
            <Text>{props.title}</Text>
          </TouchableOpacity>
        );
      },
    };
  },
);

describe('ViewMoreButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with the default "View more" title', () => {
    const {getByText} = render(<ViewMoreButton onPress={jest.fn()} />);
    expect(getByText('View more')).toBeTruthy();
  });

  it('renders a custom title when provided', () => {
    const {getByText} = render(
      <ViewMoreButton onPress={jest.fn()} title="Show all" />,
    );
    expect(getByText('Show all')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    const {getByTestId} = render(<ViewMoreButton onPress={onPress} />);
    fireEvent.press(getByTestId('liquid-glass-button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('passes the expected compact/small/glass config to LiquidGlassButton', () => {
    render(<ViewMoreButton onPress={jest.fn()} />);

    expect(mockLiquidGlassButton).toHaveBeenCalledWith(
      expect.objectContaining({
        size: 'small',
        compact: true,
        glassEffect: 'clear',
        borderRadius: 'full',
        shadowIntensity: 'none',
      }),
    );
  });
});
