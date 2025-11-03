import React from 'react';
import {render, fireEvent, act} from '@testing-library/react-native';
import {
  ConfirmActionBottomSheet,
  type ConfirmActionBottomSheetRef,
} from '@/shared/components/common/ConfirmActionBottomSheet/ConfirmActionBottomSheet';
import {useTheme} from '@/hooks';
import {Text} from 'react-native';

// --- Mocks ---

// 1. Mock useTheme
const mockTheme = {
  colors: {
    surface: 'mock-surface',
    secondary: 'mock-secondary',
    white: 'mock-white',
    borderMuted: 'mock-borderMuted',
    primary: 'mock-primary',
  },
  borderRadius: {
    '3xl': 24,
    lg: 12,
  },
  spacing: {
    '3': 8,
    '4': 12,
    '5': 16,
    '6': 20,
  },
  typography: {
    h5Clash23: {fontSize: 23},
    paragraph18Bold: {fontSize: 18, fontWeight: 'bold'},
    buttonH6Clash19: {fontSize: 19},
  },
};

jest.mock('@/hooks', () => ({
  useTheme: jest.fn(() => ({
    theme: mockTheme,
  })),
}));

// 2. Mock Child Components
const mockBottomSheet = jest.fn();
const mockSnapToIndex = jest.fn();
const mockClose = jest.fn();
let mockSheetOnChange: (index: number) => void = () => {};

jest.mock('@/shared/components/common/BottomSheet/BottomSheet', () => {
  const React = require('react');
  const {View} = require('react-native');
  return {
    __esModule: true,
    default: React.forwardRef((props: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({
        snapToIndex: mockSnapToIndex,
        close: mockClose,
      }));
      mockSheetOnChange = props.onChange;
      mockBottomSheet(props);
      return <View testID="mock-bottom-sheet">{props.children}</View>;
    }),
  };
});

const mockLiquidGlassButton = jest.fn();

jest.mock(
  '@/shared/components/common/LiquidGlassButton/LiquidGlassButton',
  () => {
    const {TouchableOpacity, Text} = require('react-native');
    return {
      __esModule: true,
      default: (props: any) => {
        mockLiquidGlassButton(props);
        return (
          <TouchableOpacity
            testID={`mock-liquid-button-${props.title}`}
            onPress={props.onPress}
            disabled={props.disabled || props.loading}>
            <Text>{props.title}</Text>
          </TouchableOpacity>
        );
      },
    };
  },
);

// --- Tests ---

describe('ConfirmActionBottomSheet', () => {
  const mockPrimaryPress = jest.fn();
  const mockSecondaryPress = jest.fn();

  const primaryButtonConfig = {
    label: 'Confirm',
    onPress: mockPrimaryPress,
  };

  const secondaryButtonConfig = {
    label: 'Cancel',
    onPress: mockSecondaryPress,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useTheme as jest.Mock).mockReturnValue({theme: mockTheme});
  });

  it('renders title, message, and primary button', () => {
    const {getByText} = render(
      <ConfirmActionBottomSheet
        title="Test Title"
        message="Test Message"
        primaryButton={primaryButtonConfig}
      />,
    );

    expect(getByText('Test Title')).toBeTruthy();
    expect(getByText('Test Message')).toBeTruthy();
    expect(getByText('Confirm')).toBeTruthy();
  });

  it('renders children when provided', () => {
    const {getByText} = render(
      <ConfirmActionBottomSheet
        title="Test Title"
        primaryButton={primaryButtonConfig}>
        <Text>My Child Component</Text>
      </ConfirmActionBottomSheet>,
    );

    expect(getByText('My Child Component')).toBeTruthy();
  });

  it('does not render message if not provided', () => {
    const {queryByText} = render(
      <ConfirmActionBottomSheet
        title="Test Title"
        primaryButton={primaryButtonConfig}
      />,
    );

    expect(queryByText('Test Message')).toBeNull();
  });

  it('applies correct message alignment', () => {
    const {getByText} = render(
      <ConfirmActionBottomSheet
        title="Test Title"
        message="Left aligned"
        messageAlign="left"
        primaryButton={primaryButtonConfig}
      />,
    );
    const message = getByText('Left aligned');
    expect(message.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({textAlign: 'left'})]),
    );
  });

  it('renders secondary button when provided', () => {
    const {getByText} = render(
      <ConfirmActionBottomSheet
        title="Test Title"
        primaryButton={primaryButtonConfig}
        secondaryButton={secondaryButtonConfig}
      />,
    );

    expect(getByText('Confirm')).toBeTruthy();
    expect(getByText('Cancel')).toBeTruthy();
    expect(mockLiquidGlassButton).toHaveBeenCalledTimes(2);
  });

  it('does not render secondary button if not provided', () => {
    const {queryByText} = render(
      <ConfirmActionBottomSheet
        title="Test Title"
        primaryButton={primaryButtonConfig}
      />,
    );

    expect(queryByText('Cancel')).toBeNull();
    expect(mockLiquidGlassButton).toHaveBeenCalledTimes(1);
  });

  it('calls primary button onPress', () => {
    const {getByTestId} = render(
      <ConfirmActionBottomSheet
        title="Test"
        primaryButton={primaryButtonConfig}
      />,
    );
    fireEvent.press(getByTestId('mock-liquid-button-Confirm'));
    expect(mockPrimaryPress).toHaveBeenCalledTimes(1);
  });

  it('calls secondary button onPress', () => {
    const {getByTestId} = render(
      <ConfirmActionBottomSheet
        title="Test"
        primaryButton={primaryButtonConfig}
        secondaryButton={secondaryButtonConfig}
      />,
    );
    fireEvent.press(getByTestId('mock-liquid-button-Cancel'));
    expect(mockSecondaryPress).toHaveBeenCalledTimes(1);
  });

  it('passes correct default styles to primary button', () => {
    render(
      <ConfirmActionBottomSheet
        title="Test"
        primaryButton={primaryButtonConfig}
      />,
    );
    expect(mockLiquidGlassButton).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Confirm',
        tintColor: mockTheme.colors.secondary,
        // FIX: Check for object containing color, not array
        textStyle: expect.objectContaining({
          color: mockTheme.colors.white,
        }),
      }),
    );
  });

  it('passes correct default styles to secondary button', () => {
    render(
      <ConfirmActionBottomSheet
        title="Test"
        primaryButton={primaryButtonConfig}
        secondaryButton={secondaryButtonConfig}
      />,
    );
    expect(mockLiquidGlassButton).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Cancel',
        tintColor: mockTheme.colors.surface,
        // FIX: Check for object containing color, not array
        textStyle: expect.objectContaining({
          color: mockTheme.colors.secondary,
        }),
      }),
    );
  });

  it('allows overriding button props', () => {
    const customPrimary = {
      ...primaryButtonConfig,
      label: 'Go',
      tintColor: 'custom-tint',
      borderColor: 'custom-border',
      loading: true,
      disabled: true,
      forceBorder: true,
      textStyle: {fontSize: 99},
    };
    render(
      <ConfirmActionBottomSheet title="Test" primaryButton={customPrimary} />,
    );

    expect(mockLiquidGlassButton).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Go',
        tintColor: 'custom-tint',
        borderColor: 'custom-border',
        loading: true,
        disabled: true,
        forceBorder: true,
        // FIX: Check for object containing fontSize, not array
        textStyle: expect.objectContaining({
          fontSize: 99,
        }),
      }),
    );
  });

  it('sets initial visibility based on initialIndex', () => {
    render(
      <ConfirmActionBottomSheet
        title="Test"
        primaryButton={primaryButtonConfig}
        initialIndex={0}
      />,
    );
    expect(mockBottomSheet).toHaveBeenCalledWith(
      expect.objectContaining({enableBackdrop: true}),
    );
  });

  it('is hidden by default (initialIndex={-1})', () => {
    render(
      <ConfirmActionBottomSheet
        title="Test"
        primaryButton={primaryButtonConfig}
      />,
    );
    expect(mockBottomSheet).toHaveBeenCalledWith(
      expect.objectContaining({enableBackdrop: false}),
    );
  });

  it('calls ref.open(), snaps to index, and shows backdrop', () => {
    const ref = React.createRef<ConfirmActionBottomSheetRef>();
    render(
      <ConfirmActionBottomSheet
        title="Test"
        primaryButton={primaryButtonConfig}
        ref={ref}
      />,
    );

    expect(mockBottomSheet).toHaveBeenLastCalledWith(
      expect.objectContaining({enableBackdrop: false}),
    );

    act(() => {
      ref.current?.open();
    });

    expect(mockSnapToIndex).toHaveBeenCalledWith(0);
    expect(mockBottomSheet).toHaveBeenLastCalledWith(
      expect.objectContaining({enableBackdrop: true}),
    );
  });

  it('calls ref.close(), calls sheet close, and hides backdrop', () => {
    const ref = React.createRef<ConfirmActionBottomSheetRef>();
    render(
      <ConfirmActionBottomSheet
        title="Test"
        primaryButton={primaryButtonConfig}
        initialIndex={0}
        ref={ref}
      />,
    );

    expect(mockBottomSheet).toHaveBeenLastCalledWith(
      expect.objectContaining({enableBackdrop: true}),
    );

    act(() => {
      ref.current?.close();
    });

    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(mockBottomSheet).toHaveBeenLastCalledWith(
      expect.objectContaining({enableBackdrop: false}),
    );
  });

  it('updates state and calls onSheetChange when sheet callback fires', () => {
    const mockOnSheetChange = jest.fn();
    render(
      <ConfirmActionBottomSheet
        title="Test"
        primaryButton={primaryButtonConfig}
        initialIndex={0}
        onSheetChange={mockOnSheetChange}
      />,
    );

    expect(mockBottomSheet).toHaveBeenLastCalledWith(
      expect.objectContaining({enableBackdrop: true}),
    );

    act(() => {
      mockSheetOnChange(-1);
    });

    expect(mockOnSheetChange).toHaveBeenCalledWith(-1);
    expect(mockBottomSheet).toHaveBeenLastCalledWith(
      expect.objectContaining({enableBackdrop: false}),
    );
  });

  it('handles async button press rejection and warns', async () => {
    const consoleWarnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => {});
    const mockAsyncPress = jest.fn().mockRejectedValue(new Error('Test Error'));

    const asyncButton = {
      label: 'Async Fail',
      onPress: mockAsyncPress,
    };

    const {getByTestId} = render(
      <ConfirmActionBottomSheet title="Test" primaryButton={asyncButton} />,
    );

    const button = getByTestId('mock-liquid-button-Async Fail');
    await act(async () => {
      fireEvent.press(button);
      await new Promise(setImmediate);
    });

    expect(mockAsyncPress).toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[ConfirmActionBottomSheet] Button action rejected',
      expect.any(Error),
    );
    consoleWarnSpy.mockRestore();
  });

  it('handles sync button press correctly', () => {
    const {getByTestId} = render(
      <ConfirmActionBottomSheet
        title="Test"
        primaryButton={primaryButtonConfig}
      />,
    );
    act(() => {
      fireEvent.press(getByTestId('mock-liquid-button-Confirm'));
    });
    expect(mockPrimaryPress).toHaveBeenCalledTimes(1);
  });
});
