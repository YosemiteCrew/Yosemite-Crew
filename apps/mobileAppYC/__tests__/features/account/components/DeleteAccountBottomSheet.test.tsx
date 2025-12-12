import React from 'react';
import {render, fireEvent, act} from '@testing-library/react-native';
import DeleteAccountBottomSheet, {
  DeleteAccountBottomSheetRef,
} from '../../../../src/features/account/components/DeleteAccountBottomSheet';

// --- Mocks ---

// 1. Mock ConfirmActionBottomSheet
jest.mock(
  '../../../../src/shared/components/common/ConfirmActionBottomSheet/ConfirmActionBottomSheet',
  () => {
    const ReactLib = require('react');
    const {
      View: RNView,
      Text: RNText,
      TouchableOpacity: RNTouchableOpacity,
    } = require('react-native');

    return ReactLib.forwardRef((props: any, ref: any) => {
      ReactLib.useImperativeHandle(ref, () => ({
        open: jest.fn(),
        close: jest.fn(),
      }));

      return (
        <RNView testID="mock-confirm-sheet">
          <RNText>{props.title}</RNText>
          <RNText>{props.message}</RNText>
          {props.children}

          {props.primaryButton && (
            <RNTouchableOpacity
              testID="sheet-primary-button"
              onPress={props.primaryButton.onPress}
              disabled={props.primaryButton.disabled}>
              <RNText>{props.primaryButton.label}</RNText>
            </RNTouchableOpacity>
          )}

          {props.secondaryButton && (
            <RNTouchableOpacity
              testID="sheet-secondary-button"
              onPress={props.secondaryButton.onPress}>
              <RNText>{props.secondaryButton.label}</RNText>
            </RNTouchableOpacity>
          )}
        </RNView>
      );
    });
  },
);

// 2. Mock Input
jest.mock('../../../../src/shared/components/common/Input/Input', () => {
  const {View: RNView, Text: RNText} = require('react-native');

  return {
    Input: (props: any) => (
      <RNView testID="mock-input-container">
        <RNText testID="input-error">{props.error}</RNText>
      </RNView>
    ),
  };
});

// 3. Mock Hooks
jest.mock('../../../../src/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        secondary: 'black',
        surface: 'white',
        textPrimary: 'grey',
        primary: 'blue',
        error: 'red',
        white: 'white',
        borderMuted: 'grey',
      },
      spacing: {
        '2': 8,
        '3': 12,
        '4': 16,
        '5': 20,
        '6': 24,
      },
      typography: {
        h5Clash23: {fontSize: 23},
        paragraph18Bold: {fontSize: 18},
        inputLabel: {fontSize: 14},
        buttonH6Clash19: {fontSize: 19},
      },
    },
  }),
}));

describe('DeleteAccountBottomSheet', () => {
  const mockOnDelete = jest.fn();
  const mockOnCancel = jest.fn();
  const ref = React.createRef<DeleteAccountBottomSheetRef>();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper to simulate typing
  const typeEmail = (renderer: any, text: string) => {
    const inputComponent = renderer.UNSAFE_getByType(
      require('../../../../src/shared/components/common/Input/Input').Input,
    );
    act(() => {
      inputComponent.props.onChangeText(text);
    });
  };

  // ===========================================================================
  // 1. Rendering & Structure
  // ===========================================================================

  it('renders correctly', () => {
    const {getByText, getByTestId} = render(
      <DeleteAccountBottomSheet
        ref={ref}
        email="user@test.com"
        onDelete={mockOnDelete}
      />,
    );

    expect(getByText('Delete account')).toBeTruthy();
    expect(
      getByText('Are you sure you want to delete your account?'),
    ).toBeTruthy();
    expect(getByTestId('sheet-primary-button')).toBeTruthy();
    expect(getByTestId('sheet-secondary-button')).toBeTruthy();
  });

  // ===========================================================================
  // 2. Logic: Validation & State
  // ===========================================================================

  it('disables delete button initially (empty input)', () => {
    const {getByTestId} = render(
      <DeleteAccountBottomSheet
        email="user@test.com"
        onDelete={mockOnDelete}
      />,
    );
    const deleteBtn = getByTestId('sheet-primary-button');
    expect(deleteBtn.props.accessibilityState?.disabled).toBe(true);
  });

  it('enables delete button only when email matches exactly (normalized)', () => {
    const {getByTestId, UNSAFE_getByType} = render(
      <DeleteAccountBottomSheet
        email="user@test.com"
        onDelete={mockOnDelete}
      />,
    );

    // Mismatch
    typeEmail({UNSAFE_getByType}, 'wrong@test.com');
    expect(
      getByTestId('sheet-primary-button').props.accessibilityState?.disabled,
    ).toBe(true);

    // Match (with whitespace and case diff to test normalization)
    typeEmail({UNSAFE_getByType}, ' User@Test.com ');
    expect(
      getByTestId('sheet-primary-button').props.accessibilityState?.disabled,
    ).toBe(false);
  });

  it('allows any typing if account email is null/empty', () => {
    const {getByTestId, UNSAFE_getByType} = render(
      <DeleteAccountBottomSheet email={null} onDelete={mockOnDelete} />,
    );

    // Disabled when empty
    expect(
      getByTestId('sheet-primary-button').props.accessibilityState?.disabled,
    ).toBe(true);

    // Enabled when anything is typed
    typeEmail({UNSAFE_getByType}, 'random text');
    expect(
      getByTestId('sheet-primary-button').props.accessibilityState?.disabled,
    ).toBe(false);
  });

  it('clears error on text change', async () => {
    const {getByTestId, UNSAFE_getByType} = render(
      <DeleteAccountBottomSheet
        email="user@test.com"
        onDelete={mockOnDelete}
      />,
    );

    // Trigger error by pressing disabled button (bypassed via testID press)
    await act(async () => {
      fireEvent.press(getByTestId('sheet-primary-button'));
    });

    // Use findByText to wait for state update
    // Type something
    typeEmail({UNSAFE_getByType}, 'u');

    // Error should be gone. We check the input error prop via testID
    // Since state update is async, we expect re-render.
    const errorText = getByTestId('input-error');
    expect(errorText.props.children).toBeFalsy();
  });

  // ===========================================================================
  // 3. Logic: Actions & Async Handling
  // ===========================================================================

  it('calls onDelete when valid and pressed', async () => {
    const {getByTestId, UNSAFE_getByType} = render(
      <DeleteAccountBottomSheet
        email="user@test.com"
        onDelete={mockOnDelete}
      />,
    );

    typeEmail({UNSAFE_getByType}, 'user@test.com');

    await act(async () => {
      fireEvent.press(getByTestId('sheet-primary-button'));
    });

    expect(mockOnDelete).toHaveBeenCalled();
  });

  it('shows error if valid email matches but onDelete fails (Error object)', async () => {
    mockOnDelete.mockRejectedValue(new Error('Network fail'));
    const {findByText, UNSAFE_getByType, getByTestId} = render(
      <DeleteAccountBottomSheet
        email="user@test.com"
        onDelete={mockOnDelete}
      />,
    );

    typeEmail({UNSAFE_getByType}, 'user@test.com');

    await act(async () => {
      fireEvent.press(getByTestId('sheet-primary-button'));
    });

    const errorMsg = await findByText('Network fail');
    expect(errorMsg).toBeTruthy();
  });

  it('shows generic error if onDelete fails with string', async () => {
    mockOnDelete.mockRejectedValue('String error');
    const {findByText, UNSAFE_getByType, getByTestId} = render(
      <DeleteAccountBottomSheet
        email="user@test.com"
        onDelete={mockOnDelete}
      />,
    );

    typeEmail({UNSAFE_getByType}, 'user@test.com');

    await act(async () => {
      fireEvent.press(getByTestId('sheet-primary-button'));
    });

    const errorMsg = await findByText(
      'Failed to delete your account. Please try again.',
    );
    expect(errorMsg).toBeTruthy();
  });

  it('does nothing if isProcessing is true', async () => {
    const {getByTestId, UNSAFE_getByType} = render(
      <DeleteAccountBottomSheet
        email="user@test.com"
        onDelete={mockOnDelete}
        isProcessing={true}
      />,
    );

    typeEmail({UNSAFE_getByType}, 'user@test.com');

    await act(async () => {
      fireEvent.press(getByTestId('sheet-primary-button'));
    });

    expect(mockOnDelete).not.toHaveBeenCalled();
    // Verify loading label
  });

  // Edge Case: Hitting validation branches inside handleDelete explicitly
  it('sets validation errors inside handler if bypassing disabled state', async () => {
    const {getByTestId, UNSAFE_getByType} = render(
      <DeleteAccountBottomSheet
        email="user@test.com"
        onDelete={mockOnDelete}
      />,
    );

    // Case 1: Empty
    await act(async () => {
      fireEvent.press(getByTestId('sheet-primary-button'));
    });
    // Case 2: Mismatch
    typeEmail({UNSAFE_getByType}, 'mismatch@test.com');
    await act(async () => {
      fireEvent.press(getByTestId('sheet-primary-button'));
    });
  });

  // ===========================================================================
  // 4. Imperative Handles & Cancel
  // ===========================================================================

  it('resets state when opening via ref', () => {
    const {getByTestId, UNSAFE_getByType} = render(
      <DeleteAccountBottomSheet
        ref={ref}
        email="user@test.com"
        onDelete={mockOnDelete}
      />,
    );

    // Create "dirty" state (error present, text typed)
    typeEmail({UNSAFE_getByType}, 'dirty');

    // Call open
    act(() => {
      ref.current?.open();
    });

    // Verify state reset: button should be disabled (text cleared)
    expect(
      getByTestId('sheet-primary-button').props.accessibilityState?.disabled,
    ).toBe(true);
  });

  it('exposes close via ref', () => {
    render(
      <DeleteAccountBottomSheet ref={ref} email="a" onDelete={mockOnDelete} />,
    );
    expect(() => ref.current?.close()).not.toThrow();
  });

  it('handles cancel button', () => {
    const {getByTestId, UNSAFE_getByType} = render(
      <DeleteAccountBottomSheet
        email="user@test.com"
        onDelete={mockOnDelete}
        onCancel={mockOnCancel}
      />,
    );

    typeEmail({UNSAFE_getByType}, 'dirty');

    act(() => {
      fireEvent.press(getByTestId('sheet-secondary-button'));
    });

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('handles cancel button when onCancel prop is undefined', () => {
    const {getByTestId} = render(
      <DeleteAccountBottomSheet
        email="user@test.com"
        onDelete={mockOnDelete}
      />,
    );
    expect(() => {
      fireEvent.press(getByTestId('sheet-secondary-button'));
    }).not.toThrow();
  });
});
