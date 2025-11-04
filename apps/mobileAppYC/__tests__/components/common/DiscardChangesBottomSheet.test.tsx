import React from 'react';
import {render, act} from '@testing-library/react-native';
import DiscardChangesBottomSheet, {
  type DiscardChangesBottomSheetRef,
} from '@/shared/components/common/DiscardChangesBottomSheet/DiscardChangesBottomSheet';

// --- Mocks ---

// 1. Mock useTheme
const mockTheme = {
  colors: {
    textSecondary: 'mockTextColor',
  },
  spacing: {
    '2': 2,
    '4': 4,
  },
  typography: {
    bodyMedium: {fontSize: 16},
  },
};
jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme}),
}));

// 2. Mock child ConfirmActionBottomSheet
const mockSheetOpen = jest.fn();
const mockSheetClose = jest.fn();
const mockChildSheet = jest.fn();
let mockPrimaryOnPress: () => void;
let mockSecondaryOnPress: () => void;

jest.mock(
  '@/shared/components/common/ConfirmActionBottomSheet/ConfirmActionBottomSheet',
  () => {
    const React = require('react');
    const {View} = require('react-native');
    return {
      __esModule: true,
      ConfirmActionBottomSheet: React.forwardRef((props: any, ref: any) => {
        React.useImperativeHandle(ref, () => ({
          open: mockSheetOpen,
          close: mockSheetClose,
        }));
        // Store the callbacks to be triggered by tests
        mockPrimaryOnPress = props.primaryButton.onPress;
        mockSecondaryOnPress = props.secondaryButton.onPress;
        // Spy on all props
        mockChildSheet(props);
        // Render children so we can test the message
        return <View testID="mock-confirm-sheet">{props.children}</View>;
      }),
    };
  },
);

// 3. NO LONGER NEEDED! The react-native mock is now global.
// jest.mock('react-native', ...)

// --- Tests ---

describe('DiscardChangesBottomSheet', () => {
  const mockOnDiscard = jest.fn();
  const mockOnKeepEditing = jest.fn();
  const mockOnSheetChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with correct static props and custom message', () => {
    const {getByText} = render(
      <DiscardChangesBottomSheet onDiscard={mockOnDiscard} />,
    );

    // Check that the correct props were passed to the child
    expect(mockChildSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Discard changes?',
        snapPoints: ['250%'],
      }),
    );

    // This should now pass because StyleSheet.flatten is mocked
    expect(
      getByText(
        'You have unsaved changes. Are you sure you want to discard them?',
      ),
    ).toBeTruthy();
  });

  it('forwards open and close refs', () => {
    const ref = React.createRef<DiscardChangesBottomSheetRef>();
    render(<DiscardChangesBottomSheet onDiscard={mockOnDiscard} ref={ref} />);

    act(() => {
      ref.current?.open();
    });
    expect(mockSheetOpen).toHaveBeenCalledTimes(1);

    act(() => {
      ref.current?.close();
    });
    expect(mockSheetClose).toHaveBeenCalledTimes(1);
  });

  it('handles discard press', () => {
    render(<DiscardChangesBottomSheet onDiscard={mockOnDiscard} />);

    act(() => {
      mockPrimaryOnPress();
    });

    expect(mockSheetClose).toHaveBeenCalledTimes(1);
    expect(mockOnDiscard).toHaveBeenCalledTimes(1);
  });

  it('handles keep editing press and calls onKeepEditing', () => {
    render(
      <DiscardChangesBottomSheet
        onDiscard={mockOnDiscard}
        onKeepEditing={mockOnKeepEditing}
      />,
    );

    act(() => {
      mockSecondaryOnPress();
    });

    expect(mockSheetClose).toHaveBeenCalledTimes(1);
    expect(mockOnKeepEditing).toHaveBeenCalledTimes(1);
  });

  it('handles keep editing press without onKeepEditing prop', () => {
    render(<DiscardChangesBottomSheet onDiscard={mockOnDiscard} />);

    act(() => {
      mockSecondaryOnPress();
    });

    // Should not call onKeepEditing, but should still close
    expect(mockOnKeepEditing).not.toHaveBeenCalled();
    expect(mockSheetClose).toHaveBeenCalledTimes(1);
  });

  it('passes onSheetChange prop to child', () => {
    render(
      <DiscardChangesBottomSheet
        onDiscard={mockOnDiscard}
        onSheetChange={mockOnSheetChange}
      />,
    );

    expect(mockChildSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        onSheetChange: mockOnSheetChange,
      }),
    );
  });
});
