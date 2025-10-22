import React from 'react';
import {render} from '@testing-library/react-native';
import {Platform, View as MockView, TouchableOpacity, Text} from 'react-native';

const MockSafeArea = ({children, style}: any) => (
  <MockView style={style} testID="mock-safe-area">
    {children}{' '}
  </MockView>
);

const MockLiquidGlassButton = ({
  onPress,
  title,
  disabled,
  loading,
  leftIcon,
  testID,
}: any) => {
  const buttonTestID = testID || `button-${title?.replaceAll(/\s+/g, '-')}`;
  return (
    <TouchableOpacity
      testID={buttonTestID}
      onPress={onPress}
      disabled={disabled}>
      {' '}
      {loading && <Text testID={`${buttonTestID}-loading`}>Loading...</Text>}
      {leftIcon}
      {title && <Text testID={`${buttonTestID}-text`}>{title}</Text>}{' '}
    </TouchableOpacity>
  );
};

jest.mock('@/components/common', () => ({
  __esModule: true,
  SafeArea: MockSafeArea,
  LiquidGlassButton: MockLiquidGlassButton,
}));

type MockAuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  CreateAccount: any;
};

jest.mock('@/navigation/AuthNavigator', () => ({
  __esModule: true,
  AuthStackParamList: {} as MockAuthStackParamList,
}));

jest.mock('react-native/Libraries/EventEmitter/NativeEventEmitter');

jest.mock('@/assets/images', () => ({
  __esModule: true,
  Images: {
    welcomeIllustration: 'welcomeIllustration.png',
    emailIcon: 'emailIcon.png',
    googleIcon: 'googleIcon.png',
    facebookIcon: 'facebookIcon.png',
    appleIcon: 'appleIcon.png',
  },
}));

jest.mock('react-native/Libraries/Image/Image', () => {
  const ReactNative = jest.requireActual('react-native');
  const MockImage = (props: any) => {
    const {source, style, ...rest} = props;
    let sourceString = 'unknown';
    if (typeof source === 'string') {
      sourceString = source;
    } else if (typeof source === 'number') {
      sourceString = props.testID || 'mock-image-required';
    } else if (source && typeof source.uri === 'string') {
      sourceString = source.uri;
    }

    const testID =
      props.testID ||
      `mock-image-${sourceString.split('.')[0].split('/').pop()}`;
    return <ReactNative.View testID={testID} style={style} {...rest} />;
  };
  MockImage.getSize = jest.fn();
  MockImage.prefetch = jest.fn();
  return MockImage;
});

let currentPlatformSelectImplementation = (spec: any) =>
  spec.ios ? spec.ios : spec.default;
const mockPlatformSelect = jest.fn((spec: any) =>
  currentPlatformSelectImplementation(spec),
);

jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  OS: 'ios',
  select: mockPlatformSelect,
}));

const mockedLogin = jest.fn().mockResolvedValue(undefined);
jest.mock('@/contexts/AuthContext', () => ({
  __esModule: true,
  useAuth: jest.fn(() => ({
    login: mockedLogin,
  })),
}));

type MockThemeType = {
  colors: {
    background: string;
    secondary: string;
    textSecondary: string;
    primary: string;
    white: string;
    cardBackground: string;
    border: string;
    error?: string;
    text: string;
  };
  typography: {
    h3: object;
    cta: object;
    paragraph: object;
    paragraphBold: object;
  };
};

const mockTheme: MockThemeType = {
  colors: {
    background: '#FFF',
    secondary: '#000',
    textSecondary: '#555',
    primary: '#123',
    white: '#FFF',
    cardBackground: '#EEE',
    border: '#DDD',
    error: 'red',
    text: '#333',
  },
  typography: {
    h3: {fontSize: 24, fontWeight: 'bold'},
    cta: {fontSize: 16, fontWeight: 'bold'},
    paragraph: {fontSize: 14},
    paragraphBold: {fontSize: 14, fontWeight: 'bold'},
  },
};

type UseSocialAuthMockReturn = {
  activeProvider: string | null;
  isSocialLoading: boolean;
  handleSocialAuth: jest.Mock;
};

const mockHandleSocialAuth = jest.fn();
let capturedSocialAuthCallbacks: {
  onStart?: () => void;
  onExistingProfile?: (result: any) => Promise<void>;
  onNewProfile?: (payload: any) => Promise<void>;
} = {};

const mockUseThemeImplementation = jest.fn(() => ({theme: mockTheme}));
const mockUseSocialAuthImplementation = jest.fn(
  (callbacks): UseSocialAuthMockReturn => {
    capturedSocialAuthCallbacks = callbacks;
    return {
      activeProvider: null,
      isSocialLoading: false,
      handleSocialAuth: mockHandleSocialAuth,
    };
  },
);

jest.mock('@/hooks', () => ({
  __esModule: true,
  useTheme: mockUseThemeImplementation,
  useSocialAuth: mockUseSocialAuthImplementation,
}));

import {SignUpScreen} from '@/screens/auth/SignUpScreen';

const mockNavigation = {
  navigate: jest.fn(),
  reset: jest.fn(),
};

const renderComponent = (
  overrideTheme?: Partial<MockThemeType>,
  overrideSocialAuth?: Partial<UseSocialAuthMockReturn>,
) => {
  mockUseThemeImplementation.mockReturnValue({
    theme: {...mockTheme, ...overrideTheme},
  });

  mockUseSocialAuthImplementation.mockImplementation(callbacks => {
    capturedSocialAuthCallbacks = callbacks;
    let baseReturn: UseSocialAuthMockReturn = {
      activeProvider: null,
      isSocialLoading: false,
      handleSocialAuth: mockHandleSocialAuth,
    };
    if (overrideSocialAuth) {
      baseReturn = {...baseReturn, ...overrideSocialAuth};
    }
    return baseReturn;
  });

  const mockRoute = {key: 'SignUpScreen', name: 'SignUp'} as any;

  return render(
    <SignUpScreen navigation={mockNavigation as any} route={mockRoute} />,
  );
};

describe('SignUpScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseThemeImplementation.mockImplementation(() => ({theme: mockTheme}));
    mockUseSocialAuthImplementation.mockImplementation(
      (callbacks): UseSocialAuthMockReturn => {
        capturedSocialAuthCallbacks = callbacks;
        return {
          activeProvider: null,
          isSocialLoading: false,
          handleSocialAuth: mockHandleSocialAuth,
        };
      },
    );
    mockHandleSocialAuth.mockResolvedValue(undefined);
    mockedLogin.mockResolvedValue(undefined);

    (Platform.OS as 'ios' | 'android') = 'ios';
    currentPlatformSelectImplementation = (spec: any) =>
      spec.ios ? spec.ios : spec.default;

    capturedSocialAuthCallbacks = {};
  });

  it('should have at least one test', () => {
    expect(true).toBe(true);
  });
});
