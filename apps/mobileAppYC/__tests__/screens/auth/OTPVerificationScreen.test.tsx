import React from 'react';
import {render, fireEvent, waitFor, act} from '@testing-library/react-native';
import {DeviceEventEmitter, View as MockView} from 'react-native';
import {OTPVerificationScreen} from '@/features/auth/screens/OTPVerificationScreen';
import * as passwordlessAuth from '@/features/auth/services/passwordlessAuth';
import {useAuth} from '@/features/auth/context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  PENDING_PROFILE_STORAGE_KEY,
  PENDING_PROFILE_UPDATED_EVENT,
} from '@/config/variables';

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
}));

jest.mock('@/shared/hooks/useTheme', () => ({
  useTheme: jest.fn(() => ({
    theme: {
      colors: {
        background: '#FFF',
        secondary: '#000',
        textSecondary: '#555',
        primary: '#123',
        white: '#FFF',
        error: 'red',
      },
      typography: {
        h3: {},
        paragraph: {},
        paragraphBold: {},
        cta: {},
      },
    },
  })),
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
        maxLength={4}
        accessibilityLabel={props.error ? `Error: ${props.error}` : undefined}
      />
    ),
  };
});

jest.mock('@/shared/components/common/LiquidGlassButton/LiquidGlassButton', () => {
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
});

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));
jest.spyOn(DeviceEventEmitter, 'emit');

const mockedCompleteSignIn =
  passwordlessAuth.completePasswordlessSignIn as jest.Mock;
const mockedRequestCode =
  passwordlessAuth.requestPasswordlessEmailCode as jest.Mock;
const mockedFormatError = passwordlessAuth.formatAuthError as jest.Mock;
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
    expect(getByText('Check your email')).toBeTruthy();
    expect(getByText('test@example.com')).toBeTruthy();
    expect(
      getByText(/Enter the code to create your Yosemite Crew account./),
    ).toBeTruthy();
    expect(getByTestId('mock-otp-input')).toBeTruthy();
    expect(getByTestId('mock-liquid-button')).toBeDisabled();
    expect(getByText('00:60 sec')).toBeTruthy();
    expect(getByTestId('mock-image')).toBeTruthy();
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
      fireEvent.changeText(otpInput, '1234');
    });

    await findByText('Loading...');
    expect(mockedCompleteSignIn).toHaveBeenCalledWith('1234');
    expect(verifyButton).toBeDisabled();

    await act(async () => {
      resolveSignIn!({
        user: {userId: 'user-123', username: 'test@example.com'},
        attributes: {email: 'test@example.com'},
        profile: {exists: true, profileToken: 'token-abc'},
        tokens: {accessToken: 'abc', idToken: 'def'},
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
      user: {userId: 'user-123', username: 'test@example.com'},
      attributes: {email: 'test@example.com'},
      profile: {exists: true, profileToken: 'token-abc'},
      tokens: mockTokens,
    });

    const {getByTestId} = renderComponent(false);
    const otpInput = getByTestId('mock-otp-input');

    await act(async () => {
      fireEvent.changeText(otpInput, '1234');
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockedCompleteSignIn).toHaveBeenCalledWith('1234');
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
      user: {userId: 'user-123', username: 'test@example.com'},
      attributes: {email: 'test@example.com', given_name: 'Test'},
      profile: {exists: false, profileToken: 'token-abc'},
      tokens: mockTokens,
    });

    const {getByTestId} = renderComponent(true);
    const otpInput = getByTestId('mock-otp-input');

    await act(async () => {
      fireEvent.changeText(otpInput, '1234');
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockedCompleteSignIn).toHaveBeenCalledWith('1234');
      expect(mockedSetItem).toHaveBeenCalledWith(
        PENDING_PROFILE_STORAGE_KEY,
        expect.any(String),
      );
      const storedData = JSON.parse(mockedSetItem.mock.calls[0][1]);
      expect(storedData).toMatchObject({
        userId: 'user-123',
        email: 'test@example.com',
        profileToken: 'token-abc',
        initialAttributes: {firstName: 'Test'},
        tokens: mockTokens,
        showOtpSuccess: true,
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
              initialAttributes: {firstName: 'Test'},
              tokens: mockTokens,
              showOtpSuccess: true,
            }),
          },
        ],
      });
      expect(mockedLogin).not.toHaveBeenCalled();
    });
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
      fireEvent.changeText(otpInput, '1234');
      try {
        await Promise.resolve();
      } catch (e) {}
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
      fireEvent.changeText(otpInput, '1234');
      try {
        await Promise.resolve();
      } catch (e) {}
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
      } catch (e) {}
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
      expect(mockedLogout).toHaveBeenCalled();
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
      expect(mockedLogout).toHaveBeenCalled();
    });
  });

  it('cleans up back handler subscription on unmount', () => {
    const {unmount} = renderComponent();
    unmount();
    expect(mockRemoveEventListener).toHaveBeenCalledTimes(1);
  });
});
