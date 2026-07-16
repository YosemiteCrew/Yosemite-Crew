import React from 'react';
import {render, fireEvent, waitFor, act} from '@testing-library/react-native';
import {
  DeviceEventEmitter,
  View as MockView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import {OTPVerificationScreen} from '@/features/auth/screens/OTPVerificationScreen';
import * as passwordlessAuth from '@/features/auth/services/passwordlessAuth';
import {useAuth} from '@/features/auth/context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  PENDING_PROFILE_STORAGE_KEY,
  PENDING_PROFILE_UPDATED_EVENT,
  DEV_API_MODE_CHANGED_EVENT,
  AUTH_FEATURE_FLAGS,
  API_CONFIG,
  DEVELOPMENT_API_BASE_URL,
  MOBILE_CONFIG_BEHAVIOR,
  PRODUCTION_API_BASE_URL,
} from '@/config/variables';
import {DEMO_API_MODE_KEY} from '@/features/auth/sessionManager';
import {mockTheme} from '../../setup/mockTheme';

jest.mock('react-native/Libraries/EventEmitter/NativeEventEmitter');

const mockAddEventListener = jest.fn();
const mockRemoveEventListener = jest.fn();
jest.mock('react-native/Libraries/Utilities/BackHandler', () => ({
  __esModule: true,
  default: {
    addEventListener: mockAddEventListener,
    removeEventListener: mockRemoveEventListener,
    exitApp: jest.fn(),
  },
}));

jest.mock('@/assets/images', () => ({
  Images: {
    catLaptop: 'catLaptop.png',
  },
}));

jest.mock('react-native/Libraries/Image/Image', () => ({
  __esModule: true,
  default: (_props: any) => {
    return <MockView testID="mock-image" />;
  },
}));

jest.mock('@/features/auth/services/passwordlessAuth', () => ({
  completePasswordlessSignIn: jest.fn(),
  formatAuthError: jest.fn(error => error.message || String(error)),
  requestPasswordlessEmailCode: jest.fn(),
  signOutEverywhere: jest.fn().mockResolvedValue(undefined),
  DEMO_LOGIN_EMAIL: 'demo@yosemitecrew.com',
  DEMO_LOGIN_PASSWORD: 'demoPass123',
}));

jest.mock('@/shared/hooks/useTheme', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

jest.mock('@/features/auth/context/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    login: jest.fn(),
    logout: jest.fn(),
  })),
}));

jest.mock('@/shared/components/common', () => {
  const {TouchableOpacity, Text, TextInput, View} =
    jest.requireActual('react-native');
  const MockSafeArea = ({children, ...props}: {children: React.ReactNode}) => (
    <View {...props}>{children}</View>
  );
  return {
    SafeArea: MockSafeArea,
    Header: (props: any) => (
      <TouchableOpacity testID="mock-header" onPress={props.onBack}>
        <Text>{props.title}</Text>
      </TouchableOpacity>
    ),
    OTPInput: (props: any) => (
      <TextInput
        testID="mock-otp-input"
        onChangeText={props.onComplete}
        value={props.value}
        maxLength={6}
        accessibilityLabel={props.error ? `Error: ${props.error}` : undefined}
      />
    ),
    Input: (props: any) => (
      <TextInput
        testID="mock-demo-input"
        onChangeText={props.onChangeText}
        onSubmitEditing={props.onSubmitEditing}
        value={props.value}
        accessibilityLabel={props.error ? `Error: ${props.error}` : undefined}
      />
    ),
  };
});

jest.mock(
  '@/shared/components/common/LiquidGlassButton/LiquidGlassButton',
  () => {
    const ReactModule = require('react');
    const {TouchableOpacity, Text} = jest.requireActual('react-native');

    const MockButton = ReactModule.forwardRef(
      ({onPress, title, disabled, loading}: any, ref: any) => (
        <TouchableOpacity
          ref={ref}
          testID="mock-liquid-button"
          onPress={onPress}
          disabled={disabled}>
          {/* Ensure Text is correctly nested */}
          <Text>{loading ? 'Loading...' : title}</Text>
        </TouchableOpacity>
      ),
    );
    MockButton.displayName = 'MockLiquidGlassButton';
    return MockButton;
  },
);

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));
jest.spyOn(DeviceEventEmitter, 'emit');

const mockedCompleteSignIn =
  passwordlessAuth.completePasswordlessSignIn as jest.Mock;
const mockedRequestCode =
  passwordlessAuth.requestPasswordlessEmailCode as jest.Mock;
const mockedFormatError = passwordlessAuth.formatAuthError as jest.Mock;
const mockedSignOutEverywhere = passwordlessAuth.signOutEverywhere as jest.Mock;
const mockedUseAuth = useAuth as jest.Mock;
const mockedLogin = jest.fn();
const mockedLogout = jest.fn();
const mockedSetItem = AsyncStorage.setItem as jest.Mock;
const mockedRemoveItem = AsyncStorage.removeItem as jest.Mock;
const mockedEmit = DeviceEventEmitter.emit as jest.Mock;

const mockNavigation = {
  navigate: jest.fn(),
  reset: jest.fn(),
};

const getMockRoute = (isNewUser: boolean) => ({
  params: {
    email: 'test@example.com',
    isNewUser,
  },
});

const renderComponent = (isNewUser = false) => {
  const route = getMockRoute(isNewUser);
  return render(
    <OTPVerificationScreen
      navigation={mockNavigation as any}
      route={route as any}
    />,
  );
};

const renderDemoComponent = () => {
  const route = {
    params: {
      email: 'demo@yosemitecrew.com',
      isNewUser: false,
      challengeType: 'demoPassword' as const,
    },
  };
  return render(
    <OTPVerificationScreen
      navigation={mockNavigation as any}
      route={route as any}
    />,
  );
};

describe('OTPVerificationScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockedUseAuth.mockReturnValue({
      login: mockedLogin,
      logout: mockedLogout,
    });
    mockAddEventListener.mockReturnValue({remove: mockRemoveEventListener});
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders correctly for a new user', () => {
    const {getByText, getByTestId} = renderComponent(true);
    expect(getByText('Check your inbox')).toBeTruthy();
    expect(getByText('test@example.com')).toBeTruthy();
    expect(
      getByText(/Enter the code to create your Yosemite Crew account./),
    ).toBeTruthy();
    expect(getByTestId('mock-otp-input')).toBeTruthy();
    expect(getByTestId('mock-liquid-button')).toBeDisabled();
    expect(getByText('00:60 sec')).toBeTruthy();
  });

  it('renders correctly for an existing user', () => {
    const {getByText} = renderComponent(false);
    expect(getByText(/Enter the code to continue./)).toBeTruthy();
  });

  it('automatically starts verification when OTP is filled', async () => {
    let resolveSignIn: (value: any) => void;
    const signInPromise = new Promise(resolve => {
      resolveSignIn = resolve;
    });
    mockedCompleteSignIn.mockReturnValue(signInPromise);

    const {getByTestId, findByText} = renderComponent();
    const otpInput = getByTestId('mock-otp-input');
    const verifyButton = getByTestId('mock-liquid-button');

    expect(verifyButton).toBeDisabled();

    act(() => {
      fireEvent.changeText(otpInput, '123456');
    });

    await findByText('Loading...');
    expect(mockedCompleteSignIn).toHaveBeenCalledWith('123456');
    expect(verifyButton).toBeDisabled();

    await act(async () => {
      resolveSignIn!({
        userId: 'user-123',
        email: 'test@example.com',
        isNewUser: false,
        profile: {
          exists: true,
          isComplete: true,
          profileToken: 'token-abc',
          parent: {id: 'parent-abc'} as any,
        },
        tokens: {accessToken: 'abc', idToken: 'def'},
        parentLinked: true,
      });
      await Promise.resolve();
    });
  });

  it('shows an error if verify is pressed with incomplete OTP', async () => {
    const {getByTestId} = renderComponent();
    const otpInput = getByTestId('mock-otp-input');
    const verifyButton = getByTestId('mock-liquid-button');

    fireEvent.changeText(otpInput, '123');
    expect(verifyButton).toBeDisabled();

    fireEvent.press(verifyButton);
    expect(mockedCompleteSignIn).not.toHaveBeenCalled();
  });

  it('handles successful verification for an existing user and logs them in', async () => {
    const mockTokens = {accessToken: 'abc', idToken: 'def'};
    mockedCompleteSignIn.mockResolvedValue({
      userId: 'user-123',
      email: 'test@example.com',
      isNewUser: false,
      profile: {
        exists: true,
        isComplete: true,
        profileToken: 'token-abc',
        parent: {id: 'parent-123'} as any,
      },
      tokens: mockTokens,
      parentLinked: true,
    });

    const {getByTestId} = renderComponent(false);
    const otpInput = getByTestId('mock-otp-input');

    await act(async () => {
      fireEvent.changeText(otpInput, '123456');
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockedCompleteSignIn).toHaveBeenCalledWith('123456');
      expect(mockedRemoveItem).toHaveBeenCalledWith(
        PENDING_PROFILE_STORAGE_KEY,
      );
      expect(mockedEmit).toHaveBeenCalledWith(PENDING_PROFILE_UPDATED_EVENT);
      expect(mockedLogin).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'user-123',
          email: 'test@example.com',
        }),
        mockTokens,
      );
    });
  });

  it('handles successful verification for a new user and navigates to CreateAccount', async () => {
    const mockTokens = {accessToken: 'abc', idToken: 'def'};
    mockedCompleteSignIn.mockResolvedValue({
      userId: 'user-123',
      email: 'test@example.com',
      isNewUser: true,
      profile: {
        exists: false,
        isComplete: false,
        profileToken: 'token-abc',
        parent: null,
      },
      tokens: mockTokens,
      parentLinked: false,
    });

    const {getByTestId} = renderComponent(true);
    const otpInput = getByTestId('mock-otp-input');

    await act(async () => {
      fireEvent.changeText(otpInput, '123456');
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockedCompleteSignIn).toHaveBeenCalledWith('123456');
      expect(mockedSetItem).toHaveBeenCalledWith(
        PENDING_PROFILE_STORAGE_KEY,
        expect.any(String),
      );
      const storedData = JSON.parse(mockedSetItem.mock.calls[0][1]);
      expect(storedData).toMatchObject({
        userId: 'user-123',
        email: 'test@example.com',
        profileToken: 'token-abc',
        tokens: mockTokens,
        showOtpSuccess: false,
      });

      expect(mockedEmit).toHaveBeenCalledWith(PENDING_PROFILE_UPDATED_EVENT);
      expect(mockNavigation.reset).toHaveBeenCalledWith({
        index: 0,
        routes: [
          {
            name: 'CreateAccount',
            params: expect.objectContaining({
              userId: 'user-123',
              email: 'test@example.com',
              profileToken: 'token-abc',
              tokens: mockTokens,
              showOtpSuccess: true,
            }),
          },
        ],
      });
      expect(mockedLogin).not.toHaveBeenCalled();
    });
  });

  it('ignores verification completion after the user backs out', async () => {
    let resolveSignIn: (value: any) => void;
    const signInPromise = new Promise(resolve => {
      resolveSignIn = resolve;
    });
    mockedCompleteSignIn.mockReturnValue(signInPromise);

    const {getByTestId} = renderComponent(false);

    act(() => {
      fireEvent.changeText(getByTestId('mock-otp-input'), '123456');
    });

    expect(mockedCompleteSignIn).toHaveBeenCalledWith('123456');

    await act(async () => {
      fireEvent.press(getByTestId('mock-header'));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockNavigation.reset).toHaveBeenCalledWith({
        index: 0,
        routes: [{name: 'SignIn'}],
      });
    });
    mockNavigation.reset.mockClear();

    await act(async () => {
      resolveSignIn!({
        userId: 'user-123',
        email: 'test@example.com',
        isNewUser: false,
        profile: {
          exists: true,
          isComplete: true,
          profileToken: 'token-abc',
          parent: {id: 'parent-123'} as any,
        },
        tokens: {accessToken: 'abc', idToken: 'def'},
        parentLinked: true,
      });
      await Promise.resolve();
    });

    expect(mockedLogin).not.toHaveBeenCalled();
    expect(mockNavigation.reset).not.toHaveBeenCalled();
  });

  it('shows "incorrect code" error on specific auth failure', async () => {
    mockedCompleteSignIn.mockRejectedValue(new Error('Some error'));
    mockedFormatError.mockImplementation((error: any) => {
      if (error instanceof Error && error.message === 'Some error') {
        return 'Unexpected authentication error. Please retry.';
      }
      return String(error);
    });

    const {getByTestId} = renderComponent();
    const otpInput = getByTestId('mock-otp-input');

    await act(async () => {
      fireEvent.changeText(otpInput, '123456');
      try {
        await Promise.resolve();
      } catch (_error) {}
    });

    const expectedErrorLabel =
      'Error: The code you entered is incorrect. Please try again.';
    await waitFor(() => {
      expect(getByTestId('mock-otp-input').props.accessibilityLabel).toBe(
        expectedErrorLabel,
      );
    });
  });

  it('shows a generic error on other auth failures', async () => {
    mockedCompleteSignIn.mockRejectedValue(new Error('Network failed'));
    mockedFormatError.mockReturnValue('Network failed');

    const {getByTestId} = renderComponent();
    const otpInput = getByTestId('mock-otp-input');

    await act(async () => {
      fireEvent.changeText(otpInput, '123456');
      try {
        await Promise.resolve();
      } catch (_error) {}
    });

    const expectedErrorLabel = 'Error: Network failed';
    await waitFor(() => {
      expect(getByTestId('mock-otp-input').props.accessibilityLabel).toBe(
        expectedErrorLabel,
      );
    });
  });

  it('handles countdown timer and enables resend button', () => {
    const {getByText, queryByText} = renderComponent();

    expect(getByText('00:60 sec')).toBeTruthy();
    expect(queryByText('Resend')).toBeFalsy();

    act(() => {
      jest.advanceTimersByTime(59000);
    });
    expect(getByText('00:01 sec')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(queryByText(/sec/)).toBeFalsy();
    expect(getByText('Resend')).toBeTruthy();
  });

  it('handles successful OTP resend', async () => {
    mockedRequestCode.mockResolvedValue(undefined);
    const {getByText, queryByText} = renderComponent();

    act(() => {
      jest.advanceTimersByTime(60000);
    });

    const resendButton = getByText('Resend');
    await act(async () => {
      fireEvent.press(resendButton);
      await Promise.resolve();
    });

    expect(mockedRequestCode).toHaveBeenCalledWith('test@example.com');
    expect(getByText('00:60 sec')).toBeTruthy();
    expect(queryByText('Resend')).toBeFalsy();
  });

  it('exposes a button role and label on the resend button', () => {
    const {getByLabelText} = renderComponent();

    act(() => {
      jest.advanceTimersByTime(60000);
    });

    const resendButton = getByLabelText('Resend code');
    expect(resendButton.props.accessibilityRole).toBe('button');
    expect(resendButton.props.accessibilityState).toEqual({disabled: false});
  });

  it('handles failed OTP resend and shows error', async () => {
    mockedRequestCode.mockRejectedValue(new Error('Resend limit exceeded'));
    mockedFormatError.mockReturnValue('Resend limit exceeded');
    const {getByText, getByTestId} = renderComponent();

    act(() => {
      jest.advanceTimersByTime(60000);
    });

    const resendButton = getByText('Resend');
    await act(async () => {
      fireEvent.press(resendButton);
      try {
        await Promise.resolve();
      } catch (_error) {}
    });

    const expectedErrorLabel = 'Error: Resend limit exceeded';
    await waitFor(() => {
      expect(getByTestId('mock-otp-input').props.accessibilityLabel).toBe(
        expectedErrorLabel,
      );
    });

    expect(getByText('Resend')).toBeTruthy();
  });

  it('handles hardware back press by logging out and clearing state', async () => {
    let backPressCallback: () => boolean = () => false;
    mockAddEventListener.mockImplementation((event, callback) => {
      if (event === 'hardwareBackPress') {
        backPressCallback = callback;
      }
      return {remove: mockRemoveEventListener};
    });

    renderComponent();

    await act(async () => {
      const handled = backPressCallback();
      expect(handled).toBe(true);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockedRemoveItem).toHaveBeenCalledWith(
        PENDING_PROFILE_STORAGE_KEY,
      );
      expect(mockedEmit).toHaveBeenCalledWith(PENDING_PROFILE_UPDATED_EVENT);
      expect(mockedSignOutEverywhere).toHaveBeenCalled();
    });
  });

  it('calls onBack prop from header and triggers logout', async () => {
    const {getByTestId} = renderComponent();
    const headerBackButton = getByTestId('mock-header');

    await act(async () => {
      fireEvent.press(headerBackButton);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockedRemoveItem).toHaveBeenCalledWith(
        PENDING_PROFILE_STORAGE_KEY,
      );
      expect(mockedEmit).toHaveBeenCalledWith(PENDING_PROFILE_UPDATED_EVENT);
      expect(mockedSignOutEverywhere).toHaveBeenCalled();
    });
  });

  it('cleans up back handler subscription on unmount', () => {
    const {unmount} = renderComponent();
    unmount();
    expect(mockRemoveEventListener).toHaveBeenCalledTimes(1);
  });

  it('clears a previous OTP error when the user retypes a full code', async () => {
    mockedCompleteSignIn.mockRejectedValueOnce(new Error('first try fails'));
    mockedFormatError.mockReturnValue('first try fails');

    const {getByTestId} = renderComponent();
    const otpInput = getByTestId('mock-otp-input');

    await act(async () => {
      fireEvent.changeText(otpInput, '123456');
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(getByTestId('mock-otp-input').props.accessibilityLabel).toBe(
        'Error: first try fails',
      );
    });

    mockedCompleteSignIn.mockResolvedValueOnce({
      userId: 'user-retry',
      email: 'test@example.com',
      profile: {
        exists: true,
        isComplete: true,
        profileToken: 'token-retry',
        parent: {id: 'parent-retry'} as any,
      },
      tokens: {accessToken: 'abc', idToken: 'def'},
      parentLinked: true,
    });

    await act(async () => {
      fireEvent.changeText(otpInput, '123456');
      await Promise.resolve();
    });

    // The pre-existing error is cleared as soon as the full code is retyped.
    expect(
      getByTestId('mock-otp-input').props.accessibilityLabel,
    ).toBeUndefined();
    await waitFor(() => {
      expect(mockedLogin).toHaveBeenCalled();
    });
  });

  it('falls back to the account username when the completion has no email', async () => {
    const mockTokens = {accessToken: 'abc', idToken: 'def'};
    mockedCompleteSignIn.mockResolvedValue({
      user: {userId: 'user-xyz', username: 'username-fallback@example.com'},
      attributes: {},
      profile: {
        exists: true,
        isComplete: true,
        profileToken: 'token-abc',
        parent: {id: 'parent-xyz'} as any,
      },
      tokens: mockTokens,
      parentLinked: true,
    });

    const {getByTestId} = renderComponent(false);
    const otpInput = getByTestId('mock-otp-input');

    await act(async () => {
      fireEvent.changeText(otpInput, '1234');
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockedLogin).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'user-xyz',
          email: 'username-fallback@example.com',
        }),
        mockTokens,
      );
    });
  });

  it('shows the digit-count error when the entered code trims below the expected length', () => {
    const {getByTestId} = renderComponent();
    const otpInput = getByTestId('mock-otp-input');

    // A four-character value that trims to two triggers auto-verify but fails
    // the length check inside validateCode.
    act(() => {
      fireEvent.changeText(otpInput, '  12');
    });

    expect(getByTestId('mock-otp-input').props.accessibilityLabel).toBe(
      'Error: Please enter the 4-digit code.',
    );
    expect(mockedCompleteSignIn).not.toHaveBeenCalled();
  });

  it('ignores a resend request once cancellation has started', async () => {
    const {getByText, getByTestId} = renderComponent();

    act(() => {
      jest.advanceTimersByTime(60000);
    });

    await act(async () => {
      fireEvent.press(getByTestId('mock-header'));
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(mockedSignOutEverywhere).toHaveBeenCalled();
    });

    fireEvent.press(getByText('Resend'));
    expect(mockedRequestCode).not.toHaveBeenCalled();
  });

  it('does not clear the resending flag when cancelled during a resend', async () => {
    let resolveResend: () => void = () => {};
    mockedRequestCode.mockReturnValue(
      new Promise<void>(resolve => {
        resolveResend = resolve;
      }),
    );

    const {getByText, getByTestId} = renderComponent();
    act(() => {
      jest.advanceTimersByTime(60000);
    });

    await act(async () => {
      fireEvent.press(getByText('Resend'));
      await Promise.resolve();
    });

    // Cancel while the resend request is still in flight.
    await act(async () => {
      fireEvent.press(getByTestId('mock-header'));
      await Promise.resolve();
    });

    await act(async () => {
      resolveResend();
      await Promise.resolve();
    });

    expect(mockedRequestCode).toHaveBeenCalledWith('test@example.com');
  });

  it('shows a loading spinner while a resend request is pending', async () => {
    mockedRequestCode.mockReturnValue(new Promise<void>(() => {}));
    const {getByText, queryByText, UNSAFE_getByType} = renderComponent();

    act(() => {
      jest.advanceTimersByTime(60000);
    });

    await act(async () => {
      fireEvent.press(getByText('Resend'));
      await Promise.resolve();
    });

    expect(queryByText('Resend')).toBeNull();
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  it('renders with the android keyboard-avoiding behavior', () => {
    const originalOS = Platform.OS;
    Platform.OS = 'android';

    try {
      const {getByText} = renderComponent();
      expect(getByText('Check your inbox')).toBeTruthy();
    } finally {
      Platform.OS = originalOS;
    }
  });

  describe('Demo/Review login mode', () => {
    const originalEnableReviewLogin = AUTH_FEATURE_FLAGS.enableReviewLogin;
    const originalApiBaseUrl = API_CONFIG.baseUrl;
    const originalApiPmsBaseUrl = API_CONFIG.pmsBaseUrl;

    beforeEach(() => {
      AUTH_FEATURE_FLAGS.enableReviewLogin = true;
    });

    afterEach(() => {
      AUTH_FEATURE_FLAGS.enableReviewLogin = originalEnableReviewLogin;
      API_CONFIG.baseUrl = originalApiBaseUrl;
      API_CONFIG.pmsBaseUrl = originalApiPmsBaseUrl;
    });

    it('renders the review-login UI instead of the OTP input and countdown', () => {
      const {getByText, getByTestId, queryByTestId, queryByText} =
        renderDemoComponent();

      expect(getByText(/This is the App Review login/)).toBeTruthy();
      expect(getByTestId('mock-demo-input')).toBeTruthy();
      expect(getByText('Use provided password')).toBeTruthy();
      expect(getByText('Sign in with password')).toBeTruthy();
      expect(queryByTestId('mock-otp-input')).toBeNull();
      expect(queryByText(/sec/)).toBeNull();
    });

    it('prefills the review password when the helper button is pressed', () => {
      const {getByText, getByTestId} = renderDemoComponent();

      fireEvent.press(getByText('Use provided password'));

      expect(getByTestId('mock-demo-input').props.value).toBe('demoPass123');
    });

    it('exposes a button role and label on the prefill-password helper button', () => {
      const {getByLabelText} = renderDemoComponent();
      const prefillButton = getByLabelText('Use provided password');
      expect(prefillButton.props.accessibilityRole).toBe('button');
    });

    it('updates the password field and clears a previous error as the user types', async () => {
      const {getByTestId} = renderDemoComponent();
      const input = getByTestId('mock-demo-input');

      // Trigger a validation error via keyboard submit on an empty field
      // (the button itself stays disabled while empty).
      fireEvent(input, 'submitEditing');
      await waitFor(() => {
        expect(getByTestId('mock-demo-input').props.accessibilityLabel).toBe(
          'Error: Please enter the review password to continue.',
        );
      });

      fireEvent.changeText(input, 'a');
      expect(
        getByTestId('mock-demo-input').props.accessibilityLabel,
      ).toBeUndefined();
    });

    it('switches the API base URL, signs in, and marks demo API mode on success', async () => {
      mockedCompleteSignIn.mockResolvedValue({
        user: {userId: 'demo-user', username: 'demo@yosemitecrew.com'},
        attributes: {email: 'demo@yosemitecrew.com'},
        profile: {
          exists: true,
          isComplete: true,
          profileToken: 'token-demo',
          parent: {id: 'parent-demo'} as any,
        },
        tokens: {accessToken: 'abc', idToken: 'def'},
        parentLinked: true,
      });

      const {getByTestId, getByText} = renderDemoComponent();
      fireEvent.changeText(getByTestId('mock-demo-input'), 'demoPass123');

      await act(async () => {
        fireEvent.press(getByText('Sign in with password'));
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(mockedCompleteSignIn).toHaveBeenCalledWith('demoPass123');
      });

      expect(mockedSetItem).toHaveBeenCalledWith(DEMO_API_MODE_KEY, 'true');
      expect(mockedEmit).toHaveBeenCalledWith(DEV_API_MODE_CHANGED_EVENT, {
        isDevApi: true,
      });
      await waitFor(() => {
        expect(mockedLogin).toHaveBeenCalled();
      });
    });

    it('restores the configured API base URL when demo sign-in fails', async () => {
      mockedCompleteSignIn.mockRejectedValue(new Error('bad demo password'));
      mockedFormatError.mockReturnValue('bad demo password');

      const expectedBaseUrl =
        MOBILE_CONFIG_BEHAVIOR.overrides?.apiBaseUrl ??
        (MOBILE_CONFIG_BEHAVIOR.useDevApi
          ? DEVELOPMENT_API_BASE_URL
          : PRODUCTION_API_BASE_URL);

      const {getByTestId, getByText} = renderDemoComponent();
      fireEvent.changeText(getByTestId('mock-demo-input'), 'demoPass123');

      await act(async () => {
        fireEvent.press(getByText('Sign in with password'));
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(getByTestId('mock-demo-input').props.accessibilityLabel).toBe(
          'Error: bad demo password',
        );
      });

      expect(API_CONFIG.baseUrl).toBe(expectedBaseUrl);
    });

    it('treats the demo login email as review login without a demo challenge type', () => {
      const route = {
        params: {
          email: 'demo@yosemitecrew.com',
          isNewUser: false,
        },
      };
      const {getByText, queryByTestId} = render(
        <OTPVerificationScreen
          navigation={mockNavigation as any}
          route={route as any}
        />,
      );

      expect(getByText(/This is the App Review login/)).toBeTruthy();
      expect(queryByTestId('mock-otp-input')).toBeNull();
    });

    it('restores the production API base URL when dev API is disabled on demo failure', async () => {
      const originalUseDevApi = MOBILE_CONFIG_BEHAVIOR.useDevApi;
      const originalOverride = MOBILE_CONFIG_BEHAVIOR.overrides?.apiBaseUrl;
      MOBILE_CONFIG_BEHAVIOR.useDevApi = false;
      if (MOBILE_CONFIG_BEHAVIOR.overrides) {
        MOBILE_CONFIG_BEHAVIOR.overrides.apiBaseUrl = undefined;
      }
      mockedCompleteSignIn.mockRejectedValue(new Error('bad demo password'));
      mockedFormatError.mockReturnValue('bad demo password');

      try {
        const {getByTestId, getByText} = renderDemoComponent();
        fireEvent.changeText(getByTestId('mock-demo-input'), 'demoPass123');

        await act(async () => {
          fireEvent.press(getByText('Sign in with password'));
          await Promise.resolve();
        });

        await waitFor(() => {
          expect(getByTestId('mock-demo-input').props.accessibilityLabel).toBe(
            'Error: bad demo password',
          );
        });

        expect(API_CONFIG.baseUrl).toBe(PRODUCTION_API_BASE_URL);
        expect(API_CONFIG.pmsBaseUrl).toBe(PRODUCTION_API_BASE_URL);
      } finally {
        MOBILE_CONFIG_BEHAVIOR.useDevApi = originalUseDevApi;
        if (MOBILE_CONFIG_BEHAVIOR.overrides) {
          MOBILE_CONFIG_BEHAVIOR.overrides.apiBaseUrl = originalOverride;
        }
      }
    });

    it('does not re-verify when submit fires after cancellation', async () => {
      const {getByTestId} = renderDemoComponent();
      fireEvent.changeText(getByTestId('mock-demo-input'), 'demoPass123');

      // Cancel the flow via the header back button.
      await act(async () => {
        fireEvent.press(getByTestId('mock-header'));
        await Promise.resolve();
      });
      await waitFor(() => {
        expect(mockedSignOutEverywhere).toHaveBeenCalled();
      });

      // Submitting now is a no-op because cancellation already started.
      await act(async () => {
        fireEvent(getByTestId('mock-demo-input'), 'submitEditing');
        await Promise.resolve();
      });

      expect(mockedCompleteSignIn).not.toHaveBeenCalled();
    });
  });

  describe('handleGoBack edge cases', () => {
    it('ignores a second back trigger once cancellation has already started', async () => {
      const {getByTestId} = renderComponent();
      const headerBackButton = getByTestId('mock-header');

      await act(async () => {
        fireEvent.press(headerBackButton);
        await Promise.resolve();
      });
      await waitFor(() => {
        expect(mockedSignOutEverywhere).toHaveBeenCalledTimes(1);
      });

      await act(async () => {
        fireEvent.press(headerBackButton);
        await Promise.resolve();
      });

      // The second press is a no-op: no additional sign-out attempt.
      expect(mockedSignOutEverywhere).toHaveBeenCalledTimes(1);
    });

    it('warns but still signs out when clearing the pending profile fails', async () => {
      mockedRemoveItem.mockRejectedValueOnce(new Error('storage error'));
      const consoleWarnSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => {});

      const {getByTestId} = renderComponent();
      await act(async () => {
        fireEvent.press(getByTestId('mock-header'));
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          'Failed to clear pending profile state',
          expect.any(Error),
        );
        expect(mockedSignOutEverywhere).toHaveBeenCalled();
      });

      consoleWarnSpy.mockRestore();
    });

    it('warns but still resets navigation when signOutEverywhere fails', async () => {
      mockedSignOutEverywhere.mockRejectedValueOnce(new Error('amplify error'));
      const consoleWarnSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => {});

      const {getByTestId} = renderComponent();
      await act(async () => {
        fireEvent.press(getByTestId('mock-header'));
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          '[OTP] Failed to cancel SuperTokens session',
          expect.any(Error),
        );
        expect(mockNavigation.reset).toHaveBeenCalledWith({
          index: 0,
          routes: [{name: 'SignIn'}],
        });
      });

      consoleWarnSpy.mockRestore();
    });
  });
});
