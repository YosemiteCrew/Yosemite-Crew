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

// Reduce noisy warnings in test output (keeps other warnings visible)
const originalConsoleWarn = console.warn.bind(console);
console.warn = (...args) => {
  const first = args[0];
  if (
    typeof first === 'string' &&
    (first.includes('Unable to resolve ../../../lib/commonjs/spec/NativeDocumentPicker') ||
      first.includes('ToastAndroid is not supported on this platform.'))
  ) {
    return;
  }
  return originalConsoleWarn(...args);
};

// ToastAndroid fallback logs warnings in Jest; stub it to a no-op.
try {
  const rn = require('react-native');
  if (rn?.ToastAndroid) {
    rn.ToastAndroid.show = jest.fn();
  }
} catch {}

try {
  const {Platform} = require('react-native');
  Platform.constants = Platform.constants || {};
  Platform.constants.reactNativeVersion = Platform.constants.reactNativeVersion ?? {
    major: 0,
    minor: 81,
    patch: 4,
  };
} catch {}

// Suppress warnings from Animated (path changed across RN versions; omit if unavailable)
try {
  jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');
} catch {}

// Ensure Animated.timing resolves synchronously in tests to avoid unhandled timers
try {
  const {Animated} = require('react-native');
  Animated.timing = (
    originalTiming =>
    (value, config = {}) => {
      const animation = originalTiming
        ? originalTiming(value, {
            ...config,
            useNativeDriver: config.useNativeDriver ?? false,
          })
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
    }
  )(Animated.timing);

  Animated.spring = (
    originalSpring =>
    (value, config = {}) => {
      const animation = originalSpring
        ? originalSpring(value, {
            ...config,
            useNativeDriver: config.useNativeDriver ?? false,
          })
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
    }
  )(Animated.spring);
} catch {}

// Ensure PlatformColor exists as a function in tests (RN sometimes lacks it in JSDOM)
// Note: If PlatformColor isn't available in tests, components should fall back gracefully.

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
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

// Mock Gorhom Bottom Sheet to avoid requiring native implementation in tests
jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  const {View, ScrollView} = require('react-native');

  const createViewStub = displayName => {
    const Component = React.forwardRef(({children, ...props}, ref) =>
      React.createElement(View, {...props, ref}, children),
    );
    Component.displayName = displayName;
    return Component;
  };

  const MockBottomSheet = React.forwardRef(({children, ...props}, ref) => {
    React.useImperativeHandle(ref, () => ({
      snapToIndex: jest.fn(),
      snapToPosition: jest.fn(),
      expand: jest.fn(),
      collapse: jest.fn(),
      close: jest.fn(),
      forceClose: jest.fn(),
    }));
    return React.createElement(View, props, children);
  });
  MockBottomSheet.displayName = 'MockBottomSheet';

  const MockBottomSheetView = createViewStub('MockBottomSheetView');
  const MockBottomSheetHandle = createViewStub('MockBottomSheetHandle');

  const MockBottomSheetScrollView = React.forwardRef(
    ({children, ...props}, ref) =>
      React.createElement(ScrollView, {...props, ref}, children),
  );
  MockBottomSheetScrollView.displayName = 'MockBottomSheetScrollView';

  const MockBottomSheetFlatList = React.forwardRef(
    ({data = [], renderItem, keyExtractor, ...props}, ref) => {
      const {View: RNView} = require('react-native');
      return React.createElement(
        RNView,
        {...props, ref},
        data.map((item, index) =>
          renderItem
            ? renderItem({item, index})
            : React.createElement(RNView, {
                key: keyExtractor ? keyExtractor(item, index) : String(index),
              }),
        ),
      );
    },
  );
  MockBottomSheetFlatList.displayName = 'MockBottomSheetFlatList';

  const MockBottomSheetBackdrop = ({children, ...props}) =>
    React.createElement(View, props, children);

  return {
    __esModule: true,
    default: MockBottomSheet,
    BottomSheetView: MockBottomSheetView,
    BottomSheetScrollView: MockBottomSheetScrollView,
    BottomSheetFlatList: MockBottomSheetFlatList,
    BottomSheetBackdrop: MockBottomSheetBackdrop,
    BottomSheetHandle: MockBottomSheetHandle,
  };
});

// Provide a shared jest.fn-based mock for the theme hook so tests can override
try {
  jest.mock('@/hooks', () => {
    /**
     * Avoid spreading `jest.requireActual('@/hooks')` here.
     *
     * The `src/hooks/index.ts` module uses re-export getters (e.g. `export {useAppDispatch} ...`).
     * Spreading/enumerating the actual export object eagerly evaluates those getters during setup,
     * which can throw in Jest if some dependencies haven't been initialized yet.
     *
     * Instead, load the actual module and override `useTheme` in-place without enumerating.
     */
    const actual = jest.requireActual('@/hooks');
    const {createMockUseTheme} = require('./__tests__/setup/mockTheme');
    const mockUseTheme = jest.fn(() => createMockUseTheme());

    try {
      Object.defineProperty(actual, 'useTheme', {
        value: mockUseTheme,
        enumerable: true,
        configurable: true,
        writable: true,
      });
    } catch {
      // Fallback if defineProperty fails for any reason
      actual.useTheme = mockUseTheme;
    }

    return actual;
  });
} catch {
  // Ignore if helper is unavailable; individual tests can still mock useTheme
}

// Mock react-native-blob-util to avoid requiring native modules in tests
jest.mock('react-native-blob-util', () => {
  const mockFetch = jest.fn(() =>
    Promise.resolve({
      info: () => ({status: 200}),
    }),
  );
  const mockWrap = jest.fn(value => value);

  const mockBlob = {
    fetch: mockFetch,
    wrap: mockWrap,
    fs: {},
    android: {},
    ios: {},
  };
  mockBlob.config = jest.fn(() => mockBlob);

  return {
    __esModule: true,
    default: mockBlob,
    fetch: mockFetch,
    wrap: mockWrap,
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

// Mock NetInfo native module so libraries relying on connectivity checks can run in Jest
jest.mock('@react-native-community/netinfo', () => {
  const listeners = new Set();
  const defaultState = {isConnected: true, isInternetReachable: true};
  return {
    __esModule: true,
    addEventListener: jest.fn((handler) => {
      listeners.add(handler);
      handler(defaultState);
      return () => listeners.delete(handler);
    }),
    fetch: jest.fn(() => Promise.resolve(defaultState)),
    configure: jest.fn(),
    useNetInfo: () => defaultState,
  };
});

// Mock haptic feedback native module
jest.mock('react-native-haptic-feedback', () => {
  const trigger = jest.fn();
  return {
    __esModule: true,
    default: {trigger},
    trigger,
  };
});

// Mock Nitro sound recorder used for voice messages
jest.mock('react-native-nitro-sound', () => {
  const playListeners = new Set();
  const recordListeners = new Set();
  const mockSoundInstance = {
    setSubscriptionDuration: jest.fn(),
    addPlayBackListener: jest.fn((listener) => {
      playListeners.add(listener);
      return listener;
    }),
    addRecordBackListener: jest.fn((listener) => {
      recordListeners.add(listener);
      return listener;
    }),
    removeRecordBackListener: jest.fn((listener) => recordListeners.delete(listener)),
    startRecorder: jest.fn(async () => '/tmp/mock-recording.m4a'),
    stopRecorder: jest.fn(async () => '/tmp/mock-recording.m4a'),
    startPlayer: jest.fn(async () => undefined),
    pausePlayer: jest.fn(async () => undefined),
    resumePlayer: jest.fn(async () => undefined),
    stopPlayer: jest.fn(async () => undefined),
  };

  const createSound = jest.fn(() => mockSoundInstance);

  return {
    __esModule: true,
    createSound,
    default: {
      ...mockSoundInstance,
      addRecordBackListener: mockSoundInstance.addRecordBackListener,
      removeRecordBackListener: mockSoundInstance.removeRecordBackListener,
      startRecorder: mockSoundInstance.startRecorder,
      stopRecorder: mockSoundInstance.stopRecorder,
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
  global.performance = {now: jest.fn(Date.now)};
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
    NavigationContainer: ({children}) =>
      React.createElement(React.Fragment, null, children),
    useNavigation: () => ({navigate: jest.fn()}),
    createNavigatorFactory: () => Navigator => Navigator,
    // Export anything else on demand if needed by tests
  };
});

// Mock aws-amplify to avoid pulling in ESM sub-deps
jest.mock('aws-amplify', () => ({
  Amplify: {configure: jest.fn()},
}));

// Mock Amplify Auth submodule to avoid ESM deps and network
jest.mock('aws-amplify/auth', () => ({
  confirmSignIn: jest.fn().mockResolvedValue({isSignedIn: true, nextStep: {}}),
  fetchAuthSession: jest.fn().mockResolvedValue({tokens: {}}),
  fetchUserAttributes: jest.fn().mockResolvedValue({}),
  getCurrentUser: jest
    .fn()
    .mockResolvedValue({userId: 'test', username: 'test@example.com'}),
  signIn: jest.fn().mockResolvedValue({nextStep: {}}),
  signOut: jest.fn().mockResolvedValue(undefined),
  AuthError: class AuthError extends Error {
    constructor(message) {
      super(message);
      this.name = 'AuthError';
    }
  },
}));

// Mock our social auth setup to a no-op
jest.mock('@/features/auth/services/socialAuth', () => ({
  configureSocialProviders: jest.fn(),
}));

// Mock React Native Firebase Auth to avoid pulling firebase ESM
jest.mock('@react-native-firebase/auth', () => {
  const reload = jest.fn(async () => undefined);
  const getIdToken = jest.fn(async user => user?.getIdToken?.());
  const getIdTokenResult = jest.fn(async user => user?.getIdTokenResult?.());
  const getAuth = jest.fn(() => ({}));
  const signOut = jest.fn(async auth => {
    // Delegate to instance signOut when provided to match real API shape
    return auth?.signOut ? auth.signOut() : undefined;
  });

  return {
    __esModule: true,
    getAuth,
    signOut,
    getIdToken,
    getIdTokenResult,
    reload,
  };
});

// Mock Keychain to avoid native module dependency
jest.mock('react-native-keychain', () => ({
  setGenericPassword: jest.fn(async () => true),
  getGenericPassword: jest.fn(async () => null),
  resetGenericPassword: jest.fn(async () => true),
  ACCESSIBLE: {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  },
  SECURITY_LEVEL: {SECURE_SOFTWARE: 'SECURE_SOFTWARE'},
}));

// Mock RN Image Picker
jest.mock('react-native-image-picker', () => {
  const mockResponse = {assets: []};
  return {
    launchCamera: jest.fn(() => Promise.resolve(mockResponse)),
    launchImageLibrary: jest.fn(() => Promise.resolve(mockResponse)),
  };
});

jest.mock('react-native-fs', () => ({
  stat: jest.fn(() => Promise.resolve({size: 1024})),
}));

// Mock native-stack navigator to a simple host component
jest.mock('@react-navigation/native-stack', () => {
  const React = require('react');
  return {
    createNativeStackNavigator: () => ({
      Navigator: ({children}) =>
        React.createElement(React.Fragment, null, children),
      Screen: () => null,
    }),
  };
});

// Mock bottom sheet to simple components
jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  // Simple host components to satisfy RN rendering paths
  const PassThrough = ({children, ...props}) =>
    React.createElement('View', props, children);
  return {
    __esModule: true,
    default: ({children, ...props}) =>
      React.createElement(PassThrough, props, children),
    BottomSheetView: ({children, ...props}) =>
      React.createElement(PassThrough, props, children),
    BottomSheetScrollView: ({children, ...props}) =>
      React.createElement(PassThrough, props, children),
    BottomSheetFlatList: ({..._props}) => null,
    BottomSheetBackdrop: ({children, ...props}) =>
      React.createElement(PassThrough, props, children),
    BottomSheetHandle: ({...props}) => React.createElement('View', props),
  };
});

// Mock RN Bootsplash and LinearGradient
jest.mock('react-native-bootsplash', () => ({
  __esModule: true,
  default: {show: jest.fn(), hide: jest.fn()},
}));
jest.mock('react-native-linear-gradient', () => {
  const React = require('react');
  const Mock = ({children}) =>
    React.createElement(React.Fragment, null, children);
  return {__esModule: true, default: Mock};
});

jest.mock('react-native-localize', () => ({
  getLocales: () => [
    {languageTag: 'en-US', languageCode: 'en', countryCode: 'US', isRTL: false},
  ],
}));

// Mock the custom splash to avoid animated internals
jest.mock('@/shared/components/common/customSplashScreen/customSplash', () => {
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
jest.mock('react-native/Libraries/Components/Keyboard/Keyboard', () => {
  const mockKeyboard = {
    addListener: jest.fn(() => ({
      remove: jest.fn(),
    })),
    removeListener: jest.fn(),
    dismiss: jest.fn(),
    isVisible: jest.fn(() => false),
  };
  return {
    __esModule: true,
    default: mockKeyboard,
    Keyboard: mockKeyboard,
  };
});

// Mock @d11/react-native-fast-image to avoid native dependencies
jest.mock('@d11/react-native-fast-image', () => {
  const React = require('react');
  const {Image} = require('react-native');

  const FastImage = React.forwardRef((props, ref) =>
    React.createElement(Image, {...props, ref})
  );
  FastImage.displayName = 'FastImage';

  FastImage.resizeMode = {
    contain: 'contain',
    cover: 'cover',
    stretch: 'stretch',
    center: 'center',
  };

  FastImage.priority = {
    low: 'low',
    normal: 'normal',
    high: 'high',
  };

  FastImage.cacheControl = {
    immutable: 'immutable',
    web: 'web',
    cacheOnly: 'cacheOnly',
  };

  FastImage.preload = jest.fn();
  FastImage.clearMemoryCache = jest.fn();
  FastImage.clearDiskCache = jest.fn();

  return {
    __esModule: true,
    default: FastImage,
  };
});

// Mock Image.resolveAssetSource for react-native
try {
  const {Image} = require('react-native');
  if (!Image.resolveAssetSource) {
    Image.resolveAssetSource = jest.fn((source) => {
      if (typeof source === 'number') {
        return {uri: `asset://image_${source}`, width: 100, height: 100};
      }
      if (typeof source === 'object' && source.uri) {
        return {uri: source.uri, width: 100, height: 100};
      }
      return {uri: 'asset://default', width: 100, height: 100};
    });
  }
} catch {}
