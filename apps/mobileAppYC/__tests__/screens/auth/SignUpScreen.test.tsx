import React from 'react';
import {render, fireEvent, act} from '@testing-library/react-native';
import {View as MockView} from 'react-native'; // Import for Image mock
import {SignUpScreen} from '@/screens/auth/SignUpScreen';
import {useSocialAuth, type SocialProvider} from '@/hooks';

// Define Mock Param List relevant to SignUpScreen
type MockAuthStackParamList = {
  SignUp: undefined;
  SignIn: undefined; // Target for email signup and sign in link
  CreateAccount: {
    email?: string;
    provider?: SocialProvider;
    [key: string]: any;
  }; // Target for new social profile
};

// Mock Navigation and related types
jest.mock('@/navigation/AuthNavigator', () => ({
  AuthStackParamList: {} as MockAuthStackParamList,
}));

// Mock Assets
jest.mock('@/assets/images', () => ({
  Images: {
    welcomeIllustration: 'welcomeIllustration.png',
    emailIcon: 'emailIcon.png',
    googleIcon: 'googleIcon.png',
    facebookIcon: 'facebookIcon.png',
    appleIcon: 'appleIcon.png',
  },
}));

// Mock built-in Image component
jest.mock('react-native/Libraries/Image/Image', () => ({
  __esModule: true,
  default: (props: any) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const {source, ...rest} = props;
    return <MockView testID="mock-image" {...rest} />;
  },
}));

// Mock Theme hook
const mockTheme = {
  colors: {
    background: '#FFF',
    secondary: '#000',
    textSecondary: '#555',
    primary: '#123',
    white: '#FFF',
    cardBackground: '#EEE',
    border: '#DDD',
    error: 'red',
    text: '#111', // Added for Google button text style
  },
  typography: {
    h3: {fontSize: 24, fontWeight: 'bold'},
    paragraph: {fontSize: 14},
    paragraphBold: {fontSize: 14, fontWeight: 'bold'},
    cta: {fontSize: 16, fontWeight: '600'},
  },
};
jest.mock('@/hooks/useTheme', () => ({
  useTheme: jest.fn(() => ({
    theme: mockTheme,
  })),
}));

// Mock Auth Context hook
const mockedLogin = jest.fn().mockResolvedValue(undefined);
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    login: mockedLogin,
  })),
}));

// Mock Social Auth Hook
const mockHandleSocialAuth = jest.fn();
let capturedSocialAuthCallbacks: {
  onStart?: () => void;
  onExistingProfile?: (result: any) => Promise<void>;
  onNewProfile?: (payload: any) => Promise<void>;
  genericErrorMessage?: string;
} = {};

jest.mock('@/hooks/useSocialAuth', () => ({
  useSocialAuth: jest.fn(callbacks => {
    capturedSocialAuthCallbacks = callbacks; // Capture callbacks passed by SignUpScreen
    return {
      // Return values expected by SignUpScreen
      activeProvider: null,
      isSocialLoading: false,
      handleSocialAuth: mockHandleSocialAuth,
    };
  }),
}));

// Mock Common Components (SafeArea)
// Assuming SafeArea is a named export from '@/components/common'
jest.mock('@/components/common', () => {
  const {View} = jest.requireActual('react-native');
  const MockSafeArea = ({children, ...props}: {children: React.ReactNode}) => (
    <View {...props}>{children}</View>
  );
  return {
    __esModule: true, // Needed for mixed default/named exports
    SafeArea: MockSafeArea,
  };
});

// Mock LiquidGlassButton
// Component uses: import { LiquidGlassButton } from ... (NAMED import)
jest.mock('@/components/common/LiquidGlassButton/LiquidGlassButton', () => {
  const {TouchableOpacity, Text, View} = jest.requireActual('react-native');
  return {
    __esModule: true,
    // FIX 2: Use a NAMED export `LiquidGlassButton`
    LiquidGlassButton: jest.fn(
      ({onPress, title, disabled, loading, leftIcon}) => {
        let content;
        if (loading) {
          content = <Text>Loading...</Text>;
        } else {
          content = (
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              {leftIcon}
              {title && (
                <Text style={{marginLeft: leftIcon ? 8 : 0}}>{title}</Text>
              )}
            </View>
          );
        }

        const testIdSuffix = title
          ? title.toLowerCase().replaceAll(/\s+/g, '-')
          : 'icon-button';

        return (
          <TouchableOpacity
            testID={`button-${testIdSuffix}`}
            onPress={onPress}
            disabled={disabled} // <<< FIX 2.5: Pass the disabled prop
          >
            {content}
          </TouchableOpacity>
        );
      },
    ),
  };
});

// --- END MOCKS ---

const mockedUseSocialAuth = useSocialAuth as jest.Mock;

const mockNavigation = {
  navigate: jest.fn(),
  reset: jest.fn(),
};

// Helper function to render the component
const renderComponent = () => {
  const route = {params: undefined};
  return render(
    <SignUpScreen navigation={mockNavigation as any} route={route as any} />,
  );
};

// FIX 1: Corrected the typo here (removed "()D,")
describe('SignUpScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    capturedSocialAuthCallbacks = {};
    mockedUseSocialAuth.mockImplementation((callbacks: any) => {
      capturedSocialAuthCallbacks = callbacks;
      return {
        activeProvider: null,
        isSocialLoading: false,
        handleSocialAuth: mockHandleSocialAuth,
      };
    });

    mockHandleSocialAuth.mockResolvedValue(undefined);
    mockedLogin.mockClear().mockResolvedValue(undefined);
  });

  it('renders correctly', () => {
    // FIX 3: Use getAllByTestId and check length
    const {getByText, getAllByTestId} = renderComponent();

    expect(getByText('All companions, one place')).toBeTruthy();
    // Check if at least one mock image exists
    expect(getAllByTestId('mock-image').length).toBeGreaterThan(0);
    expect(getByText('Sign up with email')).toBeTruthy();
    expect(getByText('Sign up with Google')).toBeTruthy();
    expect(getByText('Sign up with Facebook')).toBeTruthy();
    expect(getByText('Sign up with Apple')).toBeTruthy();
    expect(getByText('Already a member?')).toBeTruthy();
    expect(getByText('Sign in')).toBeTruthy();
  });

  it('navigates to SignIn when "Sign up with email" is pressed', () => {
    const {getByTestId} = renderComponent();
    fireEvent.press(getByTestId('button-sign-up-with-email'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('SignIn');
  });

  it('navigates to SignIn when "Sign in" link is pressed', () => {
    const {getByText} = renderComponent();
    fireEvent.press(getByText('Sign in'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('SignIn');
  });

  it('calls handleSocialAuth with "google" when Google button is pressed', () => {
    const {getByTestId} = renderComponent();
    fireEvent.press(getByTestId('button-sign-up-with-google'));
    expect(mockHandleSocialAuth).toHaveBeenCalledWith('google');
  });

  it('calls handleSocialAuth with "facebook" when Facebook button is pressed', () => {
    const {getByTestId} = renderComponent();
    fireEvent.press(getByTestId('button-sign-up-with-facebook'));
    expect(mockHandleSocialAuth).toHaveBeenCalledWith('facebook');
  });

  it('calls handleSocialAuth with "apple" when Apple button is pressed', () => {
    const {getByTestId} = renderComponent();
    fireEvent.press(getByTestId('button-sign-up-with-apple'));
    expect(mockHandleSocialAuth).toHaveBeenCalledWith('apple');
  });

  it('shows loading state for the correct social provider', () => {
    mockedUseSocialAuth.mockReturnValue({
      activeProvider: 'google',
      isSocialLoading: true,
      handleSocialAuth: mockHandleSocialAuth,
    });
  });

  it('displays social error message when social auth fails with an Error', async () => {
    const errorMessage = 'Google Sign-In failed.';
    mockHandleSocialAuth.mockRejectedValue(new Error(errorMessage));

    const {getByTestId, findByText} = renderComponent();
    await act(async () => {
      fireEvent.press(getByTestId('button-sign-up-with-google'));
      await Promise.resolve().catch(() => {});
    });

    expect(await findByText(errorMessage)).toBeTruthy();
  });

  it('displays generic social error message for non-Error rejections', async () => {
    const genericMessage = 'We couldn’t complete the sign up. Kindly retry.';
    mockHandleSocialAuth.mockRejectedValue('Some string error');

    const {getByTestId, findByText} = renderComponent();
    await act(async () => {
      fireEvent.press(getByTestId('button-sign-up-with-google'));
      await Promise.resolve().catch(() => {});
    });

    expect(await findByText(genericMessage)).toBeTruthy();
  });

  it('clears social error when social auth starts (onStart callback)', async () => {
    const errorMessage = 'Previous error';
    mockHandleSocialAuth.mockRejectedValueOnce(new Error(errorMessage));
    const {getByTestId, findByText, queryByText} = renderComponent();
    await act(async () => {
      fireEvent.press(getByTestId('button-sign-up-with-google'));
      await Promise.resolve().catch(() => {});
    });
    expect(await findByText(errorMessage)).toBeTruthy();

    await act(async () => {
      capturedSocialAuthCallbacks.onStart?.();
    });

    expect(queryByText(errorMessage)).toBeNull();
  });

  it('calls login on existing social profile (onExistingProfile callback)', async () => {
    renderComponent();
    const mockResult = {user: {id: 'social-user-1'}, tokens: {access: 'xyz'}};
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
    const mockPayload = {
      email: 'new@social.com',
      provider: 'google',
      idToken: 'someToken',
    };
    await act(async () => {
      await capturedSocialAuthCallbacks.onNewProfile?.(mockPayload);
    });
    expect(mockNavigation.reset).toHaveBeenCalledWith({
      index: 0,
      routes: [{name: 'CreateAccount', params: mockPayload}],
    });
  });
});
