// Basic Jest setup for React Native in pnpm monorepo
// Keep lightweight to avoid ESM issues in RN's default setup file

// Extend Jest matchers with React Native Testing Library
// require('@testing-library/jest-native/extend-expect');

// Timers + act environment
global.IS_REACT_ACT_ENVIRONMENT = true;
if (typeof global.__DEV__ === 'undefined') {
  // React Native expects __DEV__ global
  global.__DEV__ = true;
}

// Suppress warnings from Animated (path changed across RN versions; omit if unavailable)
try {
  jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');
} catch {}

// Ensure Animated.timing resolves synchronously in tests to avoid unhandled timers
try {
  const {Animated} = require('react-native');
  Animated.timing = ((originalTiming) => (value, config = {}) => {
    const animation = originalTiming
      ? originalTiming(value, {...config, useNativeDriver: config.useNativeDriver ?? false})
      : {
          value,
          config,
          start: cb => {
            value?.setValue?.(config?.toValue ?? 0);
            cb?.({finished: true});
          },
          stop: jest.fn(),
          reset: jest.fn(),
        };
    const start = animation.start?.bind(animation);
    animation.start = cb => {
      value?.setValue?.(config?.toValue ?? 0);
      cb?.({finished: true});
      return animation;
    };
    return animation;
  })(Animated.timing);

  Animated.spring = ((originalSpring) => (value, config = {}) => {
    const animation = originalSpring
      ? originalSpring(value, {...config, useNativeDriver: config.useNativeDriver ?? false})
      : {
          start: cb => {
            value?.setValue?.(config?.toValue ?? value?.__getValue?.() ?? 0);
            cb?.({finished: true});
            return animation;
          },
          stop: jest.fn(),
        };
    const start = animation.start?.bind(animation);
    animation.start = cb => {
      value?.setValue?.(config?.toValue ?? value?.__getValue?.() ?? 0);
      cb?.({finished: true});
      return animation;
    };
    return animation;
  })(Animated.spring);
} catch {}

// Ensure PlatformColor exists as a function in tests (RN sometimes lacks it in JSDOM)
// Note: If PlatformColor isn't available in tests, components should fall back gracefully.

// Mock AsyncStorage
jest.mock(
  '@react-native-async-storage/async-storage',
  () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Mock Reanimated with a lightweight stub (avoid importing official mock due to ESM deps)
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const {View} = require('react-native');
  return {
    __esModule: true,
    default: {
      addWhitelistedUIProps: () => {},
      createAnimatedComponent: c => c,
    },
    View,
    useSharedValue: v => ({value: v}),
    useAnimatedStyle: () => ({}),
    withTiming: v => v,
    withSpring: v => v,
    Easing: {
      linear: x => x,
      in: f => f,
      out: f => f,
      inOut: f => f,
      exp: x => x,
      bezier: () => () => {},
    },
    Extrapolate: {CLAMP: 'clamp'},
    interpolate: v => v,
    runOnJS: fn => fn,
    // No-op components/hooks used by some libs
    useAnimatedScrollHandler: () => ({}),
  };
});

// Mock Liquid Glass native dependency to a plain View fallback
jest.mock('@callstack/liquid-glass', () => {
  const {View} = require('react-native');
  return {
    __esModule: true,
    LiquidGlassView: View,
    isLiquidGlassSupported: false,
  };
});

// Safe area context mock to avoid native dependency requirements
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const {View} = require('react-native');
  const SafeAreaView = ({children, ...props}) =>
    React.createElement(View, props, children);
  const SafeAreaProvider = ({children, ...props}) =>
    React.createElement(View, props, children);
  return {
    __esModule: true,
    SafeAreaView,
    SafeAreaProvider,
    SafeAreaConsumer: ({children}) =>
      typeof children === 'function'
        ? children({top: 0, right: 0, bottom: 0, left: 0})
        : null,
    useSafeAreaInsets: () => ({top: 0, right: 0, bottom: 0, left: 0}),
    withSafeAreaInsets: Component => props =>
      React.createElement(Component, {
        ...props,
        insets: {top: 0, right: 0, bottom: 0, left: 0},
      }),
    initialWindowMetrics: {
      frame: {x: 0, y: 0, width: 0, height: 0},
      insets: {top: 0, right: 0, bottom: 0, left: 0},
    },
  };
});

// Gesture handler recommended setup
try {
  require('react-native-gesture-handler/jestSetup');
} catch (e) {
  // optional in case version doesn't provide jestSetup
}

// Provide requestAnimationFrame polyfill similar to RN's jest setup
if (!global.requestAnimationFrame) {
  global.requestAnimationFrame = cb => setTimeout(() => cb(Date.now()), 0);
}

// Provide minimal performance.now polyfill expected by RN
if (!global.performance) {
  global.performance = { now: jest.fn(Date.now) };
}

// Provide a minimal Platform mock for RN internals and libraries
jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  __esModule: true,
  default: {
    OS: 'ios',
    select: obj => obj?.ios ?? obj?.default,
  },
}));

// Lightweight mock for React Navigation to avoid heavy RN requirements
jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    NavigationContainer: ({children}) => React.createElement(React.Fragment, null, children),
    useNavigation: () => ({navigate: jest.fn()}),
    createNavigatorFactory: () => (Navigator) => Navigator,
    // Export anything else on demand if needed by tests
  };
});

// Mock aws-amplify to avoid pulling in ESM sub-deps
jest.mock('aws-amplify', () => ({
  Amplify: { configure: jest.fn() },
}));

// Mock Amplify Auth submodule to avoid ESM deps and network
jest.mock('aws-amplify/auth', () => ({
  confirmSignIn: jest.fn().mockResolvedValue({ isSignedIn: true, nextStep: {} }),
  fetchAuthSession: jest.fn().mockResolvedValue({ tokens: {} }),
  fetchUserAttributes: jest.fn().mockResolvedValue({}),
  getCurrentUser: jest.fn().mockResolvedValue({ userId: 'test', username: 'test@example.com' }),
  signIn: jest.fn().mockResolvedValue({ nextStep: {} }),
  signOut: jest.fn().mockResolvedValue(undefined),
  AuthError: class AuthError extends Error { constructor(message) { super(message); this.name = 'AuthError'; } },
}));

// Mock our social auth setup to a no-op
jest.mock('@/services/auth/socialAuth', () => ({
  configureSocialProviders: jest.fn(),
}));

// Mock React Native Firebase Auth to avoid pulling firebase ESM
jest.mock('@react-native-firebase/auth', () => ({
  getAuth: jest.fn(() => ({})),
}));

// Mock Keychain to avoid native module dependency
jest.mock('react-native-keychain', () => ({
  setGenericPassword: jest.fn(async () => true),
  getGenericPassword: jest.fn(async () => null),
  resetGenericPassword: jest.fn(async () => true),
  ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY' },
  SECURITY_LEVEL: { SECURE_SOFTWARE: 'SECURE_SOFTWARE' },
}));

// Mock RN Image Picker
jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
  ImagePickerResponse: {},
  Asset: {},
  ImageLibraryOptions: {},
}));

// Mock native-stack navigator to a simple host component
jest.mock('@react-navigation/native-stack', () => {
  const React = require('react');
  return {
    createNativeStackNavigator: () => ({
      Navigator: ({children}) => React.createElement(React.Fragment, null, children),
      Screen: () => null,
    }),
  };
});

// Mock bottom sheet to simple components
jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  // Simple host components to satisfy RN rendering paths
  const PassThrough = ({children, ...props}) => React.createElement('View', props, children);
  return {
    __esModule: true,
    default: ({children, ...props}) => React.createElement(PassThrough, props, children),
    BottomSheetView: ({children, ...props}) => React.createElement(PassThrough, props, children),
    BottomSheetScrollView: ({children, ...props}) => React.createElement(PassThrough, props, children),
    BottomSheetFlatList: ({..._props}) => null,
    BottomSheetBackdrop: ({children, ...props}) => React.createElement(PassThrough, props, children),
    BottomSheetHandle: ({...props}) => React.createElement('View', props),
  };
});

// Mock RN Bootsplash and LinearGradient
jest.mock('react-native-bootsplash', () => ({
  __esModule: true,
  default: { show: jest.fn(), hide: jest.fn() },
}));
jest.mock('react-native-linear-gradient', () => {
  const React = require('react');
  const Mock = ({children}) => React.createElement(React.Fragment, null, children);
  return { __esModule: true, default: Mock };
});

jest.mock('react-native-localize', () => ({
  getLocales: () => [
    {languageTag: 'en-US', languageCode: 'en', countryCode: 'US', isRTL: false},
  ],
}));

// Mock the custom splash to avoid animated internals
jest.mock('@/components/common/customSplashScreen/customSplash', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: ({onAnimationEnd}) => {
      React.useEffect(() => {
        if (onAnimationEnd) onAnimationEnd();
      }, [onAnimationEnd]);
      return React.createElement(React.Fragment, null);
    },
  };
});

// Mock amplify_outputs.json (gitignored file, safe mock for CI/CD)
jest.mock('./amplify_outputs.json', () => ({
  __esModule: true,
  default: {
    auth: {
      user_pool_id: 'mock-user-pool-id',
      aws_region: 'us-east-1',
      user_pool_client_id: 'mock-client-id',
      identity_pool_id: 'mock-identity-pool-id',
    },
    geo: {
      amazon_location_service: {
        region: 'us-east-1',
      },
    },
  },
}));
