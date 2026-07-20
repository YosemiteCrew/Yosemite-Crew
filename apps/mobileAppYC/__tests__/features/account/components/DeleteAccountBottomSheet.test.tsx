import React from 'react';
import {render, act} from '@testing-library/react-native';
import DeleteAccountBottomSheet, {
  DeleteAccountBottomSheetRef,
} from '../../../../src/features/account/components/DeleteAccountBottomSheet';
import {mockTheme} from '../../../setup/mockTheme';

// --- Mutable mock state (prefixed `mock` so jest.mock factories may use them) ---

// Toggles whether the inner ConfirmActionBottomSheet registers an imperative
// handle. When false, `sheetRef.current` stays null so we exercise the
// `sheetRef.current?.(open|close)` null optional-chain branches.
let mockRegisterSheetHandle = true;

// Swappable theme so we can render with a theme missing `colors.error` and hit
// the `theme.colors.error ?? theme.colors.secondary` fallback branch.
let mockThemeValue: any = mockTheme;

// Captures the latest props handed to ConfirmActionBottomSheet so tests can call
// the primary/secondary handlers directly, bypassing TouchableOpacity's disabled
// gate (RNTL suppresses presses on disabled Touchables).
const mockSheetProps: {current: any} = {current: null};

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
      ReactLib.useImperativeHandle(ref, () =>
        mockRegisterSheetHandle ? {open: jest.fn(), close: jest.fn()} : null,
      );

      mockSheetProps.current = props;

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
  useTheme: () => ({theme: mockThemeValue, isDark: false}),
}));

describe('DeleteAccountBottomSheet', () => {
  const mockOnDelete = jest.fn();
  const mockOnCancel = jest.fn();
  const ref = React.createRef<DeleteAccountBottomSheetRef>();

  beforeEach(() => {
    jest.clearAllMocks();
    mockRegisterSheetHandle = true;
    mockThemeValue = mockTheme;
    mockSheetProps.current = null;
    mockOnDelete.mockReset();
    mockOnDelete.mockResolvedValue(undefined);
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

  // Invoke the captured primary/secondary handlers directly. This bypasses the
  // TouchableOpacity disabled gate so we can drive the in-handler validation
  // branches that a real disabled press would swallow.
  const pressPrimary = async () => {
    await act(async () => {
      await mockSheetProps.current.primaryButton.onPress();
    });
  };

  const pressSecondary = () => {
    act(() => {
      mockSheetProps.current.secondaryButton.onPress();
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
    expect(
      getByText('To delete account re-write your email address.'),
    ).toBeTruthy();
    expect(getByText(/If you're not the primary parent/)).toBeTruthy();
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
    const rendered = render(
      <DeleteAccountBottomSheet
        email="user@test.com"
        onDelete={mockOnDelete}
      />,
    );
    const {getByTestId, UNSAFE_getByType} = rendered;

    // Trigger a validation error (empty input) via the handler directly.
    await pressPrimary();
    expect(getByTestId('input-error').props.children).toBe('Email is required');

    // Typing clears the error.
    typeEmail({UNSAFE_getByType}, 'u');
    expect(getByTestId('input-error').props.children).toBeFalsy();
  });

  // ===========================================================================
  // 3. Logic: Actions & Async Handling
  // ===========================================================================

  it('calls onDelete when valid and pressed', async () => {
    const {UNSAFE_getByType} = render(
      <DeleteAccountBottomSheet
        email="user@test.com"
        onDelete={mockOnDelete}
      />,
    );

    typeEmail({UNSAFE_getByType}, 'user@test.com');
    await pressPrimary();

    expect(mockOnDelete).toHaveBeenCalled();
  });

  it('calls onDelete when account email is null and any text is typed', async () => {
    const {UNSAFE_getByType} = render(
      <DeleteAccountBottomSheet email={null} onDelete={mockOnDelete} />,
    );

    typeEmail({UNSAFE_getByType}, 'anything at all');
    await pressPrimary();

    expect(mockOnDelete).toHaveBeenCalled();
  });

  it('shows error if valid email matches but onDelete fails (Error object)', async () => {
    mockOnDelete.mockRejectedValue(new Error('Network fail'));
    const {getByTestId, UNSAFE_getByType} = render(
      <DeleteAccountBottomSheet
        email="user@test.com"
        onDelete={mockOnDelete}
      />,
    );

    typeEmail({UNSAFE_getByType}, 'user@test.com');
    await pressPrimary();

    expect(getByTestId('input-error').props.children).toBe('Network fail');
  });

  it('shows generic error if onDelete fails with a non-Error value', async () => {
    mockOnDelete.mockRejectedValue('String error');
    const {getByTestId, UNSAFE_getByType} = render(
      <DeleteAccountBottomSheet
        email="user@test.com"
        onDelete={mockOnDelete}
      />,
    );

    typeEmail({UNSAFE_getByType}, 'user@test.com');
    await pressPrimary();

    expect(getByTestId('input-error').props.children).toBe(
      'Failed to delete your account. Please try again.',
    );
  });

  it('does nothing (and shows loading label) if isProcessing is true', async () => {
    const {getByText, getByTestId, UNSAFE_getByType} = render(
      <DeleteAccountBottomSheet
        email="user@test.com"
        onDelete={mockOnDelete}
        isProcessing={true}
      />,
    );

    // Loading label is rendered
    expect(getByText('Deleting...')).toBeTruthy();
    // Button is disabled while processing
    expect(
      getByTestId('sheet-primary-button').props.accessibilityState?.disabled,
    ).toBe(true);

    typeEmail({UNSAFE_getByType}, 'user@test.com');
    await pressPrimary();

    expect(mockOnDelete).not.toHaveBeenCalled();
  });

  it('sets "Email is required" error when submitting an empty input', async () => {
    const {getByTestId} = render(
      <DeleteAccountBottomSheet
        email="user@test.com"
        onDelete={mockOnDelete}
      />,
    );

    await pressPrimary();

    expect(getByTestId('input-error').props.children).toBe('Email is required');
    expect(mockOnDelete).not.toHaveBeenCalled();
  });

  it('sets "must match" error when the typed email does not match', async () => {
    const {getByTestId, UNSAFE_getByType} = render(
      <DeleteAccountBottomSheet
        email="user@test.com"
        onDelete={mockOnDelete}
      />,
    );

    typeEmail({UNSAFE_getByType}, 'mismatch@test.com');
    await pressPrimary();

    expect(getByTestId('input-error').props.children).toBe(
      'Email must match your account email',
    );
    expect(mockOnDelete).not.toHaveBeenCalled();
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

    // Create "dirty" state (text typed)
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
    pressSecondary();

    expect(mockOnCancel).toHaveBeenCalled();
    // State was reset -> delete disabled again
    expect(
      getByTestId('sheet-primary-button').props.accessibilityState?.disabled,
    ).toBe(true);
  });

  it('handles cancel button when onCancel prop is undefined', () => {
    render(
      <DeleteAccountBottomSheet
        email="user@test.com"
        onDelete={mockOnDelete}
      />,
    );
    expect(() => pressSecondary()).not.toThrow();
  });

  it('handles a null inner sheet ref gracefully (open/close/cancel)', () => {
    // Inner ConfirmActionBottomSheet does not register a handle, so
    // sheetRef.current stays null across open/close/handleClose.
    mockRegisterSheetHandle = false;

    render(
      <DeleteAccountBottomSheet
        ref={ref}
        email="user@test.com"
        onDelete={mockOnDelete}
        onCancel={mockOnCancel}
      />,
    );

    expect(() => {
      act(() => {
        ref.current?.open();
      });
      act(() => {
        ref.current?.close();
      });
      pressSecondary();
    }).not.toThrow();

    expect(mockOnCancel).toHaveBeenCalled();
  });

  // ===========================================================================
  // 5. Theme fallback
  // ===========================================================================

  it('falls back to secondary color when the theme has no error color', () => {
    mockThemeValue = {
      ...mockTheme,
      colors: {...mockTheme.colors, error: undefined},
    };

    const {getByText} = render(
      <DeleteAccountBottomSheet email="a" onDelete={mockOnDelete} />,
    );

    expect(getByText('Delete account')).toBeTruthy();
  });
});
