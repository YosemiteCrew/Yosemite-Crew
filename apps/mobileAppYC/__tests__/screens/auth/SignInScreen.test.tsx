import React from 'react';
import {render, fireEvent, waitFor, act} from '@testing-library/react-native';
import {Platform, View as MockView, DeviceEventEmitter} from 'react-native';
import {SignInScreen} from '@/features/auth/screens/SignInScreen';
import * as passwordlessAuth from '@/features/auth/services/passwordlessAuth';
import {useSocialAuth, useTheme} from '@/hooks';
import * as ConstantsUtil from '@/shared/constants/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

type MockAuthStackParamList = {
  SignIn: {email?: string; statusMessage?: string} | undefined;
  OTPVerification: {email: string; isNewUser: boolean};
  CreateAccount: any;
  SignUp: undefined;
};
jest.mock('@/navigation/AuthNavigator', () => ({
  AuthStackParamList: {} as MockAuthStackParamList,
}));

jest.mock('react-native/Libraries/EventEmitter/NativeEventEmitter');

jest.mock('@/assets/images', () => ({
  Images: {
    authIllustration: 'authIllustration.png',
    googleIcon: 'googleIcon.png',
    facebookIcon: 'facebookIcon.png',
    appleIcon: 'appleIcon.png',
  },
}));

jest.mock('react-native/Libraries/Image/Image', () => ({
  __esModule: true,
  default: (props: any) => {
    const { ...rest} = props;
    return <MockView testID="mock-image" {...rest} />;
  },
}));

let currentPlatformSelectImplementation = (spec: any) =>
  spec.ios ? spec.ios : spec.default;
const mockPlatformSelect = jest.fn((spec: any) =>
  currentPlatformSelectImplementation(spec),
);

jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  OS: 'ios',
  select: mockPlatformSelect,
}));

jest.mock('@/features/auth/services/passwordlessAuth', () => ({
  requestPasswordlessEmailCode: jest.fn(),
  formatAuthError: jest.fn(error => error.message || String(error)),
}));

const mockTheme = {
  colors: {
    background: '#FFF',
    secondary: '#000',
    textSecondary: '#555',
    primary: '#123',
    white: '#FFF',
    cardBackground: '#EEE',
    border: '#DDD',
    success: 'green',
    error: 'red',
  },
  typography: {
    h3: {},
    paragraph: {},
    paragraphBold: {},
    cta: {},
    screenTitle: {},
  },
};
jest.mock('@/shared/hooks/useTheme', () => ({
  useTheme: jest.fn(() => ({
    theme: mockTheme,
  })),
}));

const mockedLogin = jest.fn().mockResolvedValue(undefined);
jest.mock('@/features/auth/context/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    login: mockedLogin,
  })),
}));

const mockHandleSocialAuth = jest.fn();
let capturedSocialAuthCallbacks: {
  onStart?: () => void;
  onExistingProfile?: (result: any) => Promise<void>;
  onNewProfile?: (payload: any) => Promise<void>;
} = {};

jest.mock('@/features/auth/hooks/useSocialAuth', () => ({
  useSocialAuth: jest.fn(callbacks => {
    capturedSocialAuthCallbacks = callbacks;
    return {
      activeProvider: null,
      isSocialLoading: false,
      handleSocialAuth: mockHandleSocialAuth,
    };
  }),
}));

jest.mock('@/shared/components/common', () => {
  const {View, TextInput} = jest.requireActual('react-native');

  const MockSafeArea = ({children, ...props}: {children: React.ReactNode}) => (
    <View {...props}>{children}</View>
  );
  return {
    SafeArea: MockSafeArea,
    Input: (props: any) => (
      <TextInput
        testID="mock-input"
        value={props.value}
        onChangeText={props.onChangeText}
        accessibilityLabel={props.label}
        accessibilityHint={props.error ? `Error: ${props.error}` : undefined}
      />
    ),
  };
});

jest.mock('@/shared/components/common/LiquidGlassButton/LiquidGlassButton', () => {
  const {TouchableOpacity, Text} = jest.requireActual('react-native');

  return {
    __esModule: true,
    default: jest.fn(({onPress, title, disabled, loading, customContent}) => {
      let content;
      if (loading) {
        content = <Text>Loading...</Text>;
      } else if (customContent) {
        content = customContent;
      } else {
        content = <Text>{title}</Text>;
      }

      return (
        <TouchableOpacity
          testID={title ? `button-${title}` : 'mock-liquid-button-icon'}
          onPress={onPress}
          disabled={disabled}
        >
          {content}{' '}
        </TouchableOpacity>
      );
    }),
  };
});

jest.mock('@/shared/constants/constants', () => ({
  isValidEmail: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn().mockResolvedValue(null),
  removeItem: jest.fn().mockResolvedValue(null),
}));

const mockedSetItem = AsyncStorage.setItem as jest.Mock;
const mockedRemoveItem = AsyncStorage.removeItem as jest.Mock;
const mockedEmit = jest.spyOn(DeviceEventEmitter, 'emit');

const mockedRequestCode =
  passwordlessAuth.requestPasswordlessEmailCode as jest.Mock;
const mockedUseSocialAuth = useSocialAuth as jest.Mock;
const mockedUseTheme = useTheme as jest.Mock;

const mockNavigation = {
  navigate: jest.fn(),
  reset: jest.fn(),
  setParams: jest.fn(),
};

const renderComponent = (params: MockAuthStackParamList['SignIn'] = {}) => {
  const route = {params};
  return render(
    <SignInScreen navigation={mockNavigation as any} route={route as any} />,
  );
};

describe('SignInScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Platform.OS as 'ios' | 'android') = 'ios';

    currentPlatformSelectImplementation = (spec: any) =>
      spec.ios ? spec.ios : spec.default;
    mockPlatformSelect.mockClear();

    mockedUseTheme.mockReturnValue({theme: mockTheme});

    (ConstantsUtil.isValidEmail as jest.Mock).mockReturnValue(true);

    mockedRequestCode.mockResolvedValue({
      destination: 'test@example.com',
      isNewUser: false,
    });
    mockHandleSocialAuth.mockResolvedValue(undefined);

    capturedSocialAuthCallbacks = {};
    mockedUseSocialAuth.mockImplementation((callbacks: any) => {
      capturedSocialAuthCallbacks = callbacks;
      return {
        activeProvider: null,
        isSocialLoading: false,
        handleSocialAuth: mockHandleSocialAuth,
      };
    });

    mockedLogin.mockClear().mockResolvedValue(undefined);
    mockedEmit.mockClear();
    mockedSetItem.mockClear().mockResolvedValue(null);
    mockedRemoveItem.mockClear().mockResolvedValue(null);
  });

  it('renders correctly', () => {
    const {getByText, getByLabelText, getAllByTestId} = renderComponent();

    expect(getByText('Tail-wagging welcome!')).toBeTruthy();
    expect(getByLabelText('Email address')).toBeTruthy();
    expect(getByText('Send OTP')).toBeTruthy();
    expect(getByText('Login via')).toBeTruthy();
    expect(getAllByTestId('mock-image').length).toBe(4);
    expect(getByText('Not a member?')).toBeTruthy();
    expect(getByText('Sign up')).toBeTruthy();
  });

  it('handles email input and clears errors', () => {
    const {getByLabelText, queryByText} = renderComponent({
      statusMessage: 'Old status',
    });

    const emailInput = getByLabelText('Email address');
    expect(queryByText('Old status')).toBeTruthy();

    fireEvent.changeText(emailInput, 'new@example.com');

    expect(queryByText('Old status')).toBeFalsy();
    expect(emailInput.props.value).toBe('new@example.com');
  });

  it('clears email error on email input change', async () => {
    (ConstantsUtil.isValidEmail as jest.Mock).mockReturnValue(false);
    const {getByLabelText, getByText} = renderComponent();

    const emailInput = getByLabelText('Email address');
    fireEvent.changeText(emailInput, 'invalid');
    fireEvent.press(getByText('Send OTP'));

    await waitFor(() => {
      expect(emailInput.props.accessibilityHint).toContain(
        'Error: Please enter a valid email address',
      );
    });

    fireEvent.changeText(emailInput, 'invalid-new');
    expect(emailInput.props.accessibilityHint).toBeUndefined();
  });

  it('clears social error on email input change', async () => {
    mockHandleSocialAuth.mockRejectedValue(new Error('Social error'));
    const {getByLabelText, getAllByTestId, findByText, queryByText} =
      renderComponent();

    const googleButton = getAllByTestId('mock-liquid-button-icon')[0];
    await act(async () => {
      fireEvent.press(googleButton);
      await Promise.resolve().catch(() => {});
    });

    expect(await findByText('Social error')).toBeTruthy();

    const emailInput = getByLabelText('Email address');
    fireEvent.changeText(emailInput, 'a');

    expect(queryByText('Social error')).toBeFalsy();
  });

  describe('useEffect state restoration', () => {
    it('restores email and status from route params on mount', () => {
      const {getByLabelText, getByText} = renderComponent({
        email: 'param@test.com',
        statusMessage: 'Code sent!',
      });

      expect(getByLabelText('Email address').props.value).toBe(
        'param@test.com',
      );
      expect(getByText('Code sent!')).toBeTruthy();
      expect(mockNavigation.setParams).toHaveBeenCalledWith({
        email: undefined,
        statusMessage: undefined,
      });
    });

    it('does not restore or clear params if no params are passed', () => {
      const {getByLabelText} = renderComponent({});

      expect(getByLabelText('Email address').props.value).toBe('');
      expect(mockNavigation.setParams).not.toHaveBeenCalled();
    });

    it('restores only email if only email param is passed', () => {
      const {getByLabelText} = renderComponent({
        email: 'only-email@test.com',
      });

      expect(getByLabelText('Email address').props.value).toBe(
        'only-email@test.com',
      );
      expect(mockNavigation.setParams).toHaveBeenCalledWith({
        email: undefined,
        statusMessage: undefined,
      });
    });

    it('restores empty status message if statusMessage param is undefined', () => {
      const {getByLabelText, queryByTestId} = renderComponent({
        statusMessage: undefined,
      });

      expect(getByLabelText('Email address').props.value).toBe('');
      expect(queryByTestId('status-message')).toBeFalsy();
      expect(mockNavigation.setParams).toHaveBeenCalledWith({
        email: undefined,
        statusMessage: undefined,
      });
    });
  });

  it('shows error for empty email on OTP send', async () => {
    const {getByText, getByLabelText} = renderComponent();

    fireEvent.press(getByText('Send OTP'));

    await waitFor(() => {
      expect(getByLabelText('Email address').props.accessibilityHint).toContain(
        'Please enter your email address',
      );
    });
    expect(mockedRequestCode).not.toHaveBeenCalled();
  });

  it('shows error for invalid email on OTP send', async () => {
    (ConstantsUtil.isValidEmail as jest.Mock).mockReturnValue(false);
    const {getByText, getByLabelText} = renderComponent();

    const emailInput = getByLabelText('Email address');
    fireEvent.changeText(emailInput, 'invalid-email');
    fireEvent.press(getByText('Send OTP'));

    await waitFor(() => {
      expect(getByLabelText('Email address').props.accessibilityHint).toContain(
        'Please enter a valid email address',
      );
    });
    expect(mockedRequestCode).not.toHaveBeenCalled();
  });

  it('handles successful OTP send and navigates', async () => {
    const {getByText, getByLabelText} = renderComponent();

    const emailInput = getByLabelText('Email address');
    fireEvent.changeText(emailInput, 'test@example.com');

    await act(async () => {
      fireEvent.press(getByText('Send OTP'));
    });

    await waitFor(() => {
      expect(mockedRequestCode).toHaveBeenCalledWith('test@example.com');
      expect(mockNavigation.navigate).toHaveBeenCalledWith('OTPVerification', {
        email: 'test@example.com',
        isNewUser: false,
      });
      expect(
        getByText('We sent a login code to test@example.com'),
      ).toBeTruthy();
    });

    expect(getByText('Send OTP')).toBeTruthy();
  });

  it('handles failed OTP send and shows error', async () => {
    mockedRequestCode.mockRejectedValue(new Error('API Error'));
    const {getByText, getByLabelText} = renderComponent();

    const emailInput = getByLabelText('Email address');
    fireEvent.changeText(emailInput, 'test@example.com');

    await act(async () => {
      fireEvent.press(getByText('Send OTP'));
      await Promise.resolve().catch(() => {});
    });

    await waitFor(() => {
      expect(getByLabelText('Email address').props.accessibilityHint).toContain(
        'API Error',
      );
    });
  });

  it('navigates to Sign Up screen', () => {
    const {getByText} = renderComponent();
    fireEvent.press(getByText('Sign up'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('SignUp');
  });

  it('calls handleSocialAuth with "google"', () => {
    const {getAllByTestId} = renderComponent();
    const socialButtons = getAllByTestId('mock-liquid-button-icon');
    const googleButton = socialButtons[0];

    fireEvent.press(googleButton);
    expect(mockHandleSocialAuth).toHaveBeenCalledWith('google');
  });

  it('calls handleSocialAuth with "facebook"', () => {
    const {getAllByTestId} = renderComponent();
    const socialButtons = getAllByTestId('mock-liquid-button-icon');
    const facebookButton = socialButtons[1];

    fireEvent.press(facebookButton);
    expect(mockHandleSocialAuth).toHaveBeenCalledWith('facebook');
  });

  it('calls handleSocialAuth with "apple"', () => {
    const {getAllByTestId} = renderComponent();
    const socialButtons = getAllByTestId('mock-liquid-button-icon');
    const appleButton = socialButtons[2];

    fireEvent.press(appleButton);
    expect(mockHandleSocialAuth).toHaveBeenCalledWith('apple');
  });

  it('shows social auth loading state', () => {
    mockedUseSocialAuth.mockReturnValue({
      activeProvider: 'google',
      isSocialLoading: true,
      handleSocialAuth: mockHandleSocialAuth,
    });
    const {getByText} = renderComponent();
    expect(getByText('Loading...')).toBeTruthy();
  });

  it('shows social auth error message', async () => {
    mockHandleSocialAuth.mockRejectedValue(new Error('Social login failed'));

    const {getAllByTestId, findByText} = renderComponent();
    const googleButton = getAllByTestId('mock-liquid-button-icon')[0];

    await act(async () => {
      fireEvent.press(googleButton);
      await Promise.resolve().catch(() => {});
    });

    expect(await findByText('Social login failed')).toBeTruthy();
  });

  it('shows generic social auth error for non-Error rejections', async () => {
    mockHandleSocialAuth.mockRejectedValue('Some string error');

    const {getAllByTestId, findByText} = renderComponent();
    const googleButton = getAllByTestId('mock-liquid-button-icon')[0];

    await act(async () => {
      fireEvent.press(googleButton);
      await Promise.resolve().catch(() => {});
    });

    expect(
      await findByText('We couldn’t sign you in. Kindly retry.'),
    ).toBeTruthy();
  });

  it('shows social auth error with fallback color if theme.colors.error is missing', async () => {
    const themeWithoutError = {
      ...mockTheme,
      colors: {
        ...mockTheme.colors,
        error: undefined,
      },
    };
    mockedUseTheme.mockReturnValue({theme: themeWithoutError});
    mockHandleSocialAuth.mockRejectedValue(new Error('Social login failed'));

    const {getAllByTestId, findByText} = renderComponent();
    const googleButton = getAllByTestId('mock-liquid-button-icon')[0];

    await act(async () => {
      fireEvent.press(googleButton);
      await Promise.resolve().catch(() => {});
    });

    const errorText = await findByText('Social login failed');
    expect(errorText).toBeTruthy();
  });



  it('clears errors when social auth starts (onStart callback)', async () => {
    const {getByLabelText, getByText, queryByText} = renderComponent({
      statusMessage: 'Old Status',
    });

    expect(getByText('Old Status')).toBeTruthy();
    const emailInput = getByLabelText('Email address');
    await act(async () => {
      fireEvent.press(getByText('Send OTP'));
    });
    expect(emailInput.props.accessibilityHint).toContain(
      'Error: Please enter your email address',
    );

    await act(async () => {
      capturedSocialAuthCallbacks.onStart?.();
    });

    expect(queryByText('Old Status')).toBeFalsy();
    expect(emailInput.props.accessibilityHint).toBeUndefined();
  });

  it('calls login on existing social profile (onExistingProfile callback)', async () => {
    renderComponent();
    const mockResult = {user: {id: '1'}, tokens: {access: 'abc'}};

    await act(async () => {
      await capturedSocialAuthCallbacks.onExistingProfile?.(mockResult);
    });

    expect(mockedLogin).toHaveBeenCalledWith(
      mockResult.user,
      mockResult.tokens,
    );
  });

  it('navigates to CreateAccount on new social profile (onNewProfile callback)', async () => {
    renderComponent();
    const mockPayload = {email: 'new@social.com', provider: 'google'};

    await act(async () => {
      await capturedSocialAuthCallbacks.onNewProfile?.(mockPayload);
    });

    expect(mockNavigation.reset).toHaveBeenCalledWith({
      index: 0,
      routes: [{name: 'CreateAccount', params: mockPayload}],
    });
  });



  describe('when on Android', () => {


    beforeEach(() => {
      (Platform.OS as 'ios' | 'android') = 'android';



      currentPlatformSelectImplementation = (spec: any) =>
        spec.android ? spec.android : spec.default;
    });

    it('renders social buttons with Android-specific styles', () => {
      const {getAllByTestId} = renderComponent();
      expect(getAllByTestId('mock-liquid-button-icon').length).toBe(3);
    });
  });
});
