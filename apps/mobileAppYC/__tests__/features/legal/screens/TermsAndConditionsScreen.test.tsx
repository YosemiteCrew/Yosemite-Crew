import React from 'react';
import {render, fireEvent, act} from '@testing-library/react-native';
import {TermsAndConditionsScreen} from '@/features/legal/screens/TermsAndConditionsScreen';
import {Alert} from 'react-native';
import {withdrawalService} from '@/features/legal/services/withdrawalService';
import {getCurrentFcmToken} from '@/shared/services/firebaseNotifications';
import {unregisterDeviceToken} from '@/shared/services/deviceTokenRegistry';
import {useAuth} from '@/features/auth/context/AuthContext';

// --- Mocks ---

// 1. Mock Navigation
const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
};

// 2. Mock Auth Hook
jest.mock('@/features/auth/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

// 3. Mock Hooks & Styles
jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {secondary: 'blue'},
      spacing: {s: 4, m: 8},
    },
  }),
}));

// 4. Mock Services
jest.mock('@/features/legal/services/withdrawalService', () => ({
  withdrawalService: {
    submitWithdrawal: jest.fn(),
  },
}));

jest.mock('@/shared/services/firebaseNotifications', () => ({
  getCurrentFcmToken: jest.fn(),
}));

jest.mock('@/shared/services/deviceTokenRegistry', () => ({
  unregisterDeviceToken: jest.fn(),
}));

// 5. Mock Components
jest.mock('@/shared/components/common', () => {
  const {TextInput} = require('react-native');
  return {
    Input: (props: any) => (
      <TextInput
        testID={props.label}
        value={props.value}
        onChangeText={props.onChangeText}
        accessibilityLabel={props.error}
      />
    ),
  };
});

jest.mock('@/shared/components/common/LiquidGlassCard/LiquidGlassCard', () => ({
  LiquidGlassCard: ({children}: any) => <>{children}</>,
}));

jest.mock(
  '@/shared/components/common/LiquidGlassButton/LiquidGlassButton',
  () => {
    const {TouchableOpacity, Text} = require('react-native');
    const MockButton = (props: any) => (
      <TouchableOpacity
        testID="SubmitButton"
        onPress={props.onPress}
        disabled={props.disabled}>
        <Text>{props.title}</Text>
      </TouchableOpacity>
    );
    // Ensure default export compatibility
    return {
      __esModule: true,
      default: MockButton,
    };
  },
);

jest.mock('@/shared/components/common/Checkbox/Checkbox', () => {
  const {TouchableOpacity, Text} = require('react-native');
  return {
    Checkbox: (props: any) => (
      <TouchableOpacity
        testID="ConsentCheckbox"
        onPress={() => props.onValueChange(!props.value)}>
        <Text>{props.value ? 'Checked' : 'Unchecked'}</Text>
      </TouchableOpacity>
    ),
  };
});

// Fix LegalScreen mock to handle the relative import path resolution in Jest
// We mock the absolute path.
jest.mock('@/features/legal/components/LegalScreen', () => ({
  LegalScreen: ({extraContent}: any) => <>{extraContent}</>,
}));

jest.mock('@/features/legal/data/termsData', () => ({
  TERMS_SECTIONS: [],
}));

jest.mock('@/features/legal/styles/legalStyles', () => ({
  createLegalStyles: () => ({}),
}));

describe('TermsAndConditionsScreen', () => {
  const mockLogout = jest.fn();
  const defaultUser = {
    id: 'user-123',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert');
    mockLogout.mockResolvedValue(undefined);

    (useAuth as jest.Mock).mockReturnValue({
      user: defaultUser,
      logout: mockLogout,
    });

    (withdrawalService.submitWithdrawal as jest.Mock).mockResolvedValue(true);
    (getCurrentFcmToken as jest.Mock).mockResolvedValue('token-123');
    (unregisterDeviceToken as jest.Mock).mockResolvedValue(true);
  });

  const setup = () => {
    const props: any = {
      navigation: mockNavigation,
      route: {name: 'TermsAndConditions'},
    };
    return render(<TermsAndConditionsScreen {...props} />);
  };

  // --- Tests ---

  it('renders correctly and prefills form with user data', () => {
    const {getByTestId} = setup();

    const nameInput = getByTestId('User Full Name');
    const emailInput = getByTestId('Email Address');

    expect(nameInput.props.value).toBe('John Doe');
    expect(emailInput.props.value).toBe('john.doe@example.com');
  });

  it('handles user with missing last name', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: {...defaultUser, lastName: undefined},
      logout: mockLogout,
    });
    const {getByTestId} = setup();
    const nameInput = getByTestId('User Full Name');
    expect(nameInput.props.value).toBe('John');
  });

  it('handles missing user (not logged in)', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      logout: mockLogout,
    });

    const {getByTestId} = setup();
    const nameInput = getByTestId('User Full Name');
    expect(nameInput.props.value).toBe('');
  });

  it('shows error when required fields are empty', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      logout: mockLogout,
    });

    const {getByTestId} = setup();

    await act(async () => {
      fireEvent.press(getByTestId('SubmitButton'));
    });

    expect(withdrawalService.submitWithdrawal).not.toHaveBeenCalled();
    expect(getByTestId('User Full Name').props.accessibilityLabel).toBe(
      'Full name is required.',
    );
  });

  it('validates email format', async () => {
    const {getByTestId} = setup();

    fireEvent.changeText(getByTestId('User Address'), '123 St');
    fireEvent.changeText(getByTestId('Signature (Type Full Name)'), 'John Doe');
    fireEvent.press(getByTestId('ConsentCheckbox'));

    fireEvent.changeText(getByTestId('Email Address'), 'invalid-email');

    await act(async () => {
      fireEvent.press(getByTestId('SubmitButton'));
    });

    expect(withdrawalService.submitWithdrawal).not.toHaveBeenCalled();
    expect(getByTestId('Email Address').props.accessibilityLabel).toBe(
      'Enter a valid email address.',
    );
  });

  it('validates email length', async () => {
    const {getByTestId} = setup();
    const longEmail = 'a'.repeat(321) + '@example.com';
    fireEvent.changeText(getByTestId('Email Address'), longEmail);

    await act(async () => {
      fireEvent.press(getByTestId('SubmitButton'));
    });

    expect(withdrawalService.submitWithdrawal).not.toHaveBeenCalled();
    expect(getByTestId('Email Address').props.accessibilityLabel).toBe(
      'Email is too long.',
    );
  });

  it('validates email matches logged in user account', async () => {
    const {getByTestId} = setup();

    fireEvent.changeText(getByTestId('Email Address'), 'other@example.com');
    fireEvent.changeText(getByTestId('User Address'), '123 St');
    fireEvent.changeText(getByTestId('Signature (Type Full Name)'), 'John Doe');
    fireEvent.press(getByTestId('ConsentCheckbox'));

    await act(async () => {
      fireEvent.press(getByTestId('SubmitButton'));
    });

    expect(withdrawalService.submitWithdrawal).not.toHaveBeenCalled();
    expect(getByTestId('Email Address').props.accessibilityLabel).toContain(
      'Email must match your account',
    );
  });

  it('clears error when user types', async () => {
    (useAuth as jest.Mock).mockReturnValue({user: null, logout: mockLogout});
    const {getByTestId} = setup();

    await act(async () => {
      fireEvent.press(getByTestId('SubmitButton'));
    });
    expect(getByTestId('User Full Name').props.accessibilityLabel).toBeTruthy();

    fireEvent.changeText(getByTestId('User Full Name'), 'Jane');
    expect(getByTestId('User Full Name').props.accessibilityLabel).toBeFalsy();
  });

  it('submits successfully and logs out', async () => {
    const {getByTestId} = setup();

    fireEvent.changeText(getByTestId('User Address'), '123 Main St');
    fireEvent.changeText(getByTestId('Signature (Type Full Name)'), 'John Doe');
    fireEvent.press(getByTestId('ConsentCheckbox'));

    await act(async () => {
      fireEvent.press(getByTestId('SubmitButton'));
    });

    expect(withdrawalService.submitWithdrawal).toHaveBeenCalled();
    expect(unregisterDeviceToken).toHaveBeenCalled();

    // @ts-ignore
    const alertButtons = (Alert.alert as jest.Mock).mock.calls[0][2];
    await act(async () => {
      alertButtons[0].onPress();
    });

    expect(mockLogout).toHaveBeenCalled();
  });

  it('handles submission error', async () => {
    (withdrawalService.submitWithdrawal as jest.Mock).mockRejectedValue(
      new Error('Network fail'),
    );
    const {getByTestId} = setup();

    fireEvent.changeText(getByTestId('User Address'), '123 St');
    fireEvent.changeText(getByTestId('Signature (Type Full Name)'), 'John Doe');
    fireEvent.press(getByTestId('ConsentCheckbox'));

    await act(async () => {
      fireEvent.press(getByTestId('SubmitButton'));
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Unable to submit',
      'Network fail',
    );
  });

  it('handles unknown submission error string', async () => {
    (withdrawalService.submitWithdrawal as jest.Mock).mockRejectedValue(
      'Unknown error',
    );
    const {getByTestId} = setup();

    fireEvent.changeText(getByTestId('User Address'), '123 St');
    fireEvent.changeText(getByTestId('Signature (Type Full Name)'), 'John Doe');
    fireEvent.press(getByTestId('ConsentCheckbox'));

    await act(async () => {
      fireEvent.press(getByTestId('SubmitButton'));
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Unable to submit',
      'Unable to submit withdrawal right now.',
    );
  });

  it('handles logout failure gracefully', async () => {
    mockLogout.mockRejectedValue(new Error('Logout fail'));
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const {getByTestId} = setup();

    fireEvent.changeText(getByTestId('User Address'), '123 St');
    fireEvent.changeText(getByTestId('Signature (Type Full Name)'), 'John Doe');
    fireEvent.press(getByTestId('ConsentCheckbox'));

    await act(async () => {
      fireEvent.press(getByTestId('SubmitButton'));
    });

    // @ts-ignore
    const alertButtons = (Alert.alert as jest.Mock).mock.calls[0][2];
    await act(async () => {
      alertButtons[0].onPress();
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Logout after submission failed'),
      expect.any(Error),
    );
    consoleSpy.mockRestore();
  });

  it('prevents double submission', async () => {
    // Manually control the promise to ensure the first click is still "processing" when the second click happens
    let resolveSubmission: Function = () => {};
    const promise = new Promise(resolve => {
      resolveSubmission = resolve;
    });
    (withdrawalService.submitWithdrawal as jest.Mock).mockReturnValue(promise);

    const {getByTestId} = setup();

    fireEvent.changeText(getByTestId('User Address'), '123 St');
    fireEvent.changeText(getByTestId('Signature (Type Full Name)'), 'John Doe');
    fireEvent.press(getByTestId('ConsentCheckbox'));

    // First click: triggers state update -> isSubmitting = true
    await act(async () => {
      fireEvent.press(getByTestId('SubmitButton'));
    });

    // Second click: should see isSubmitting = true and return early
    await act(async () => {
      fireEvent.press(getByTestId('SubmitButton'));
    });

    // Resolve the service call to clean up
    await act(async () => {
      resolveSubmission(true);
    });

    expect(withdrawalService.submitWithdrawal).toHaveBeenCalledTimes(1);
  });

  it('executes without crashing', () => {
    setup();
  });
});
