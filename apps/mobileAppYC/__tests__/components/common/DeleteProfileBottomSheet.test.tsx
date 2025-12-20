import React from 'react';
import {mockTheme} from '../setup/mockTheme';
import {render, act} from '@testing-library/react-native';
import DeleteProfileBottomSheet, {
  type DeleteProfileBottomSheetRef,
} from '@/shared/components/common/DeleteProfileBottomSheet/DeleteProfileBottomSheet';

// --- Mocks ---

// 1. Mock useTheme

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
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
    const ReactActual = jest.requireActual('react');
    const {View: RNView} = jest.requireActual('react-native');
    return {
      __esModule: true,
      default: ReactActual.forwardRef((props: any, ref: any) => {
        ReactActual.useImperativeHandle(ref, () => ({
          open: mockSheetOpen,
          close: mockSheetClose,
        }));
        // Store the callbacks to be triggered by tests
        mockPrimaryOnPress = props.primaryButton.onPress;
        mockSecondaryOnPress = props.secondaryButton.onPress;
        // Spy on all props
        mockChildSheet(props);
        return <RNView testID="mock-confirm-sheet" />;
      }),
    };
  },
);

// 3. Mock react-native
jest.mock('react-native', () => ({
  StyleSheet: {
    create: (styles: any) => styles,
  },
  View: 'View', // Needed for the mock child
}));

// --- Tests ---

describe('DeleteProfileBottomSheet', () => {
  const mockOnDelete = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with correct message and props', () => {
    render(
      <DeleteProfileBottomSheet
        onDelete={mockOnDelete}
        companionName="Buddy"
      />,
    );

    // Check that the correct props were passed to the child
    expect(mockChildSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Delete profile',
        message: "Are you sure you want to delete Buddy's profile?",
        snapPoints: ['35%', '45%'],
      }),
    );

    // Check primary button props
    const primaryButtonProps = mockChildSheet.mock.calls[0][0].primaryButton;
    expect(primaryButtonProps.label).toBe('Delete');
    expect(primaryButtonProps.tintColor).toBe(mockTheme.colors.secondary);

    // Check secondary button props
    const secondaryButtonProps =
      mockChildSheet.mock.calls[0][0].secondaryButton;
    expect(secondaryButtonProps.label).toBe('Cancel');
    expect(secondaryButtonProps.tintColor).toBe(mockTheme.colors.surface);
    expect(secondaryButtonProps.borderColor).toBe(mockTheme.colors.border);
  });

  it('forwards open and close refs', () => {
    const ref = React.createRef<DeleteProfileBottomSheetRef>();
    render(
      <DeleteProfileBottomSheet
        onDelete={mockOnDelete}
        companionName="Buddy"
        ref={ref}
      />,
    );

    act(() => {
      ref.current?.open();
    });
    expect(mockSheetOpen).toHaveBeenCalledTimes(1);

    act(() => {
      ref.current?.close();
    });
    expect(mockSheetClose).toHaveBeenCalledTimes(1);
  });

  it('handles delete press', () => {
    render(
      <DeleteProfileBottomSheet
        onDelete={mockOnDelete}
        companionName="Buddy"
      />,
    );

    act(() => {
      mockPrimaryOnPress();
    });

    expect(mockOnDelete).toHaveBeenCalledTimes(1);
    expect(mockSheetClose).toHaveBeenCalledTimes(1);
  });

  it('handles cancel press with onCancel prop', () => {
    render(
      <DeleteProfileBottomSheet
        onDelete={mockOnDelete}
        onCancel={mockOnCancel}
        companionName="Buddy"
      />,
    );

    act(() => {
      mockSecondaryOnPress();
    });

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
    expect(mockSheetClose).toHaveBeenCalledTimes(1);
  });

  it('handles cancel press without onCancel prop', () => {
    render(
      <DeleteProfileBottomSheet
        onDelete={mockOnDelete}
        companionName="Buddy"
      />,
    );

    act(() => {
      mockSecondaryOnPress();
    });

    // Should not call onCancel, but should still close
    expect(mockOnCancel).not.toHaveBeenCalled();
    expect(mockSheetClose).toHaveBeenCalledTimes(1);
  });
});
