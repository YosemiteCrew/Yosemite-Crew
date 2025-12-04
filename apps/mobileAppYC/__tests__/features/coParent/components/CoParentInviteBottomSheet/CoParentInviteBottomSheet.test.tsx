import React from 'react';
import {render, fireEvent, act} from '@testing-library/react-native';
import {
  CoParentInviteBottomSheet,
  CoParentInviteBottomSheetRef,
} from '../../../../../src/features/coParent/components/CoParentInviteBottomSheet/CoParentInviteBottomSheet';

// --- Mocks ---

// Hooks
jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        secondary: 'black',
        textSecondary: 'grey',
      },
      typography: {
        h4: {fontSize: 20},
        body: {fontSize: 14},
      },
      spacing: {
        1: 4,
        2: 8,
        4: 16,
      },
    },
  }),
}));

// Components
jest.mock('@/shared/components/common/AvatarGroup/AvatarGroup', () => {
  const {View, Text} = require('react-native');
  return {
    AvatarGroup: ({avatars}: any) => (
      <View testID="avatar-group">
        {avatars.map((a: any, i: number) => (
          <Text key={i} testID={`avatar-${i}`}>
            {a.uri || a.placeholder}
          </Text>
        ))}
      </View>
    ),
  };
});

jest.mock('@/shared/components/common/Checkbox/Checkbox', () => {
  const {TouchableOpacity, Text} = require('react-native');
  return {
    Checkbox: ({value, onValueChange, label}: any) => (
      <TouchableOpacity onPress={() => onValueChange(!value)} testID="checkbox">
        <Text>{label}</Text>
        <Text testID="checkbox-value">{value ? 'checked' : 'unchecked'}</Text>
      </TouchableOpacity>
    ),
  };
});

// Mock ConfirmActionBottomSheet to capture ref and expose buttons
const mockInternalSheetOpen = jest.fn();
const mockInternalSheetClose = jest.fn();

jest.mock(
  '@/shared/components/common/ConfirmActionBottomSheet/ConfirmActionBottomSheet',
  () => {
    const React = require('react');
    const {View, Text, TouchableOpacity} = require('react-native');

    return {
      ConfirmActionBottomSheet: React.forwardRef(
        ({title, primaryButton, secondaryButton, children}: any, ref: any) => {
          // Assign mocks to the ref passed from the parent (CoParentInviteBottomSheet)
          React.useImperativeHandle(ref, () => ({
            open: mockInternalSheetOpen,
            close: mockInternalSheetClose,
          }));

          return (
            <View testID="confirm-sheet">
              <Text testID="sheet-title">{title}</Text>
              {children}

              {/* Use a custom View acting as button to ensure props like 'disabled' are strictly passed through to testID */}
              <TouchableOpacity
                testID="primary-btn"
                onPress={primaryButton.onPress}
                disabled={primaryButton.disabled}
                accessibilityState={{disabled: primaryButton.disabled}}>
                <Text>{primaryButton.label}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                testID="secondary-btn"
                onPress={secondaryButton.onPress}>
                <Text>{secondaryButton.label}</Text>
              </TouchableOpacity>
            </View>
          );
        },
      ),
    };
  },
);

describe('CoParentInviteBottomSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly with all props provided', () => {
    const {getByText, getByTestId} = render(
      <CoParentInviteBottomSheet
        coParentName="John"
        inviterName="Inviter"
        companionName="Buddy"
        inviteeName="Me"
        coParentProfileImage="http://cp.img"
        companionProfileImage="http://dog.img"
        inviterProfileImage="http://inviter.img"
      />,
    );

    expect(getByText('Inviter invited you to join Buddy')).toBeTruthy();
    expect(getByText('Hey, Me!')).toBeTruthy();
    expect(
      getByText('Inviter has sent a co-parent invite for Buddy.'),
    ).toBeTruthy();

    expect(getByTestId('avatar-0').children[0]).toBe('http://inviter.img');
    expect(getByTestId('avatar-1').children[0]).toBe('http://dog.img');
  });

  it('renders correctly with missing props (Fallbacks)', () => {
    const {getByText, getByTestId} = render(<CoParentInviteBottomSheet />);

    expect(
      getByText('Someone invited you to join your companion'),
    ).toBeTruthy();
    expect(getByText('Hey, you!')).toBeTruthy();

    expect(getByTestId('avatar-0').children[0]).toBe('P');
    expect(getByTestId('avatar-1').children[0]).toBe('C');
  });

  it('uses coParent name/image if inviter info missing', () => {
    const {getByTestId, getByText} = render(
      <CoParentInviteBottomSheet
        coParentName="CoParent"
        coParentProfileImage="http://cp.img"
      />,
    );

    expect(
      getByText('CoParent invited you to join your companion'),
    ).toBeTruthy();
    expect(getByTestId('avatar-0').children[0]).toBe('http://cp.img');
  });

  it('handles interaction: Checkbox toggles Accept button state', () => {
    const onAccept = jest.fn();
    const {getByTestId} = render(
      <CoParentInviteBottomSheet onAccept={onAccept} />,
    );

    const primaryBtn = getByTestId('primary-btn');
    const checkbox = getByTestId('checkbox');

    // Initial state: Disabled
    expect(primaryBtn.props.accessibilityState.disabled).toBe(true);

    // Toggle On
    fireEvent.press(checkbox);
    expect(getByTestId('checkbox-value').children[0]).toBe('checked');
    // After toggle, disabled should be false
    expect(primaryBtn.props.accessibilityState.disabled).toBe(false);

    // Press Accept
    fireEvent.press(primaryBtn);
    expect(mockInternalSheetClose).toHaveBeenCalled();
    expect(onAccept).toHaveBeenCalled();

    // Toggle Off
    fireEvent.press(checkbox);
    expect(primaryBtn.props.accessibilityState.disabled).toBe(true);
  });

  it('handles interaction: Decline button', () => {
    const onDecline = jest.fn();
    const {getByTestId} = render(
      <CoParentInviteBottomSheet onDecline={onDecline} />,
    );

    const secondaryBtn = getByTestId('secondary-btn');
    fireEvent.press(secondaryBtn);

    expect(mockInternalSheetClose).toHaveBeenCalled();
    expect(onDecline).toHaveBeenCalled();
  });

  it('exposes open/close methods via ref', () => {
    const ref = React.createRef<CoParentInviteBottomSheetRef>();
    render(<CoParentInviteBottomSheet ref={ref} />);

    act(() => {
      ref.current?.open();
    });
    expect(mockInternalSheetOpen).toHaveBeenCalled();

    act(() => {
      ref.current?.close();
    });
    expect(mockInternalSheetClose).toHaveBeenCalled();
  });

  it('resets checkbox state when props change', () => {
    const {getByTestId, rerender} = render(
      <CoParentInviteBottomSheet coParentName="A" />,
    );

    fireEvent.press(getByTestId('checkbox'));
    expect(getByTestId('checkbox-value').children[0]).toBe('checked');

    rerender(<CoParentInviteBottomSheet coParentName="B" />);

    expect(getByTestId('checkbox-value').children[0]).toBe('unchecked');
  });

  it('uses initials from names if images are missing', () => {
    const {getByTestId} = render(
      <CoParentInviteBottomSheet inviterName="Mom" companionName="Rex" />,
    );
    expect(getByTestId('avatar-0').children[0]).toBe('M');
    expect(getByTestId('avatar-1').children[0]).toBe('R');
  });
});
