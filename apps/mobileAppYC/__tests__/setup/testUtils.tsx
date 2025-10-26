/**
 * Comprehensive Test Utilities for mobileAppYC
 * This file provides reusable mocks and helpers for all tests
 */

import React, {ReactElement} from 'react';
import {render, RenderOptions} from '@testing-library/react-native';
import {Provider} from 'react-redux';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {NavigationContainer} from '@react-navigation/native';
import {store} from '@/app/store';

// ============================================================================
// THEME MOCK
// ============================================================================
export const mockTheme = {
  colors: {
    background: '#F5F5F5',
    backgroundSecondary: '#FFFFFF',
    cardBackground: '#FFFFFF',
    surface: '#FFFFFF',
    primary: '#007AFF',
    secondary: '#333333',
    tertiary: '#666666',
    error: '#FF3B30',
    errorSurface: '#FFE5E5',
    success: '#34C759',
    successLight: '#E6F4EF',
    warning: '#FF9500',
    border: '#E0E0E0',
    borderMuted: '#F0F0F0',
    borderSeperator: '#E5E5E5',
    neutralShadow: '#000000',
    text: '#000000',
    textPrimary: '#000000',
    textSecondary: '#666666',
    textTertiary: '#999999',
    white: '#FFFFFF',
    black: '#000000',
    lightBlueBackground: '#E3F2FD',
  },
  spacing: {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    7: 28,
    8: 32,
    10: 40,
    12: 48,
  },
  borderRadius: {
    base: 8,
    sm: 4,
    md: 12,
    lg: 16,
    xl: 20,
    full: 9999,
  },
  typography: {
    h1: {fontSize: 36, fontWeight: '700', lineHeight: 45, fontFamily: 'ClashDisplay-Bold'},
    h2: {fontSize: 30, fontWeight: '700', lineHeight: 37.5, fontFamily: 'ClashDisplay-Bold'},
    h3: {fontSize: 26, fontWeight: '500', lineHeight: 31.2, fontFamily: 'ClashGrotesk-Medium', letterSpacing: -0.26},
    h4: {fontSize: 20, fontWeight: '600', lineHeight: 27.5, fontFamily: 'ClashDisplay-Semibold'},
    h5: {fontSize: 18, fontWeight: '500', lineHeight: 27, fontFamily: 'ClashDisplay-Medium'},
    h6: {fontSize: 16, fontWeight: '500', lineHeight: 24, fontFamily: 'ClashDisplay-Medium'},
    headlineLarge: {fontSize: 32, fontWeight: '700'},
    headlineMedium: {fontSize: 28, fontWeight: '600'},
    headlineSmall: {fontSize: 24, fontWeight: '600'},
    titleLarge: {fontSize: 20, fontWeight: '500', lineHeight: 24, fontFamily: 'ClashGrotesk-Medium', letterSpacing: -0.2},
    titleMedium: {fontSize: 18, fontWeight: '500', lineHeight: 21.6, fontFamily: 'ClashGrotesk-Medium', letterSpacing: -0.18},
    titleSmall: {fontSize: 16, fontWeight: '500', lineHeight: 19.2, fontFamily: 'ClashGrotesk-Medium', letterSpacing: -0.16},
    bodyLarge: {fontSize: 18, fontWeight: '400', lineHeight: 29.25, fontFamily: 'Satoshi-Regular'},
    bodyMedium: {fontSize: 14, fontWeight: '400', fontFamily: 'Satoshi-Regular'},
    bodySmall: {fontSize: 14, fontWeight: '400', lineHeight: 21, fontFamily: 'Satoshi-Regular'},
    bodySmallTight: {fontSize: 14, fontWeight: '400', lineHeight: 19.6, fontFamily: 'Satoshi-Regular'},
    bodyExtraSmall: {fontSize: 13, fontWeight: '400', lineHeight: 16, fontFamily: 'Satoshi-Regular'},
    labelLarge: {fontSize: 14, fontWeight: '500'},
    labelMedium: {fontSize: 12, fontWeight: '500'},
    labelSmall: {fontSize: 14, fontWeight: '500', lineHeight: 21, fontFamily: 'Satoshi-Medium'},
    labelXsBold: {fontSize: 13, fontWeight: '700', lineHeight: 15.6, fontFamily: 'Satoshi-Bold', letterSpacing: 0},
    labelXxsBold: {fontSize: 12, fontWeight: '700', lineHeight: 14.4, fontFamily: 'Satoshi-Bold', letterSpacing: 0},
    button: {fontSize: 16, fontWeight: '500', lineHeight: 20, fontFamily: 'Satoshi-Medium'},
    buttonSmall: {fontSize: 14, fontWeight: '500', lineHeight: 14, fontFamily: 'Satoshi-Medium'},
    caption: {fontSize: 12, fontWeight: '400', lineHeight: 18, fontFamily: 'SFProText-regular'},
    captionBold: {fontSize: 12, fontWeight: '600', lineHeight: 18, fontFamily: 'SFProText-semibold'},
    paragraph: {fontSize: 16, fontWeight: '400', lineHeight: 19.2, fontFamily: 'Satoshi-Regular', letterSpacing: -0.32},
    paragraphBold: {fontSize: 16, fontWeight: '700', lineHeight: 19.2, fontFamily: 'Satoshi-Bold', letterSpacing: -0.32},
    cta: {fontSize: 18, fontWeight: '500', lineHeight: 18, fontFamily: 'ClashGrotesk-Medium', letterSpacing: -0.18},
    screenTitle: {fontSize: 16, fontWeight: '500', lineHeight: 19.2, fontFamily: 'ClashGrotesk-Medium', letterSpacing: -0.16},
    inputLabel: {fontSize: 14, fontWeight: '700', lineHeight: 16, fontFamily: 'Satoshi-Bold', letterSpacing: -0.42},
    input: {fontSize: 16, fontWeight: '400', lineHeight: 19.2, fontFamily: 'Satoshi-Regular', letterSpacing: -0.32},
    inputFilled: {fontSize: 16, fontWeight: '500', lineHeight: 16, fontFamily: 'Satoshi-Medium', letterSpacing: -0.48},
    inputError: {fontSize: 14, fontWeight: '700', lineHeight: 16, fontFamily: 'Satoshi-Bold', letterSpacing: -0.42, color: '#EA3729'},
    tabLabelFocused: {fontSize: 12, fontWeight: '900', lineHeight: 14.4, fontFamily: 'Satoshi-Black'},
    tabLabel: {fontSize: 12, fontWeight: '500', lineHeight: 14.4, fontFamily: 'Satoshi-Medium'},
    h4Alt: {fontSize: 23, fontWeight: '500', lineHeight: 27.6, fontFamily: 'ClashGrotesk-Medium', letterSpacing: -0.23},
    h5Clash23: {fontSize: 23, fontWeight: '500', lineHeight: 27.6, fontFamily: 'ClashGrotesk-Medium', letterSpacing: -0.46},
    paragraph18Bold: {fontSize: 18, fontWeight: '700', lineHeight: 21.6, fontFamily: 'Satoshi-Bold', letterSpacing: -0.36},
    subtitleBold14: {fontSize: 14, fontWeight: '700', lineHeight: 16.8, fontFamily: 'Satoshi-Bold'},
    buttonH6Clash19: {fontSize: 19, fontWeight: '500', lineHeight: 22.8, fontFamily: 'ClashGrotesk-Medium', letterSpacing: -0.38},
  },
  shadows: {
    none: {},
    xs: {
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 1},
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 1,
    },
    sm: {
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.1,
      shadowRadius: 3,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 4},
      shadowOpacity: 0.15,
      shadowRadius: 6,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 8},
      shadowOpacity: 0.2,
      shadowRadius: 12,
      elevation: 8,
    },
  },
};

// ============================================================================
// MOCK SETUP FUNCTIONS
// ============================================================================

export const setupMocks = () => {
  // Mock useTheme hook
  jest.mock('@/hooks', () => ({
    useTheme: () => ({theme: mockTheme}),
  }));

  // Mock LiquidGlass components
  jest.mock('@callstack/liquid-glass', () => ({
    LiquidGlassView: ({children, ...props}: any) => {
      const ReactModule = require('react');
      const {View} = require('react-native');
      return ReactModule.createElement(View, props, children);
    },
    isLiquidGlassSupported: false,
  }));

  // Mock react-native-safe-area-context
  jest.mock('react-native-safe-area-context', () => ({
    SafeAreaProvider: ({children}: any) => children,
    SafeAreaView: ({children}: any) => {
      const ReactModule = require('react');
      const {View} = require('react-native');
      return ReactModule.createElement(View, {testID: 'safe-area-view'}, children);
    },
    useSafeAreaInsets: () => ({top: 0, right: 0, bottom: 0, left: 0}),
  }));

  // Mock Images
  jest.mock('@/assets/images', () => ({
    Images: new Proxy(
      {},
      {
        get: () => 1, // Return mock image source
      }
    ),
  }));
};

// ============================================================================
// CUSTOM RENDER WITH PROVIDERS
// ============================================================================

interface ExtendedRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  store?: typeof store;
  withNavigation?: boolean;
}

export function renderWithProviders(
  ui: ReactElement,
  {
    store: customStore,
    withNavigation = false,
    ...renderOptions
  }: ExtendedRenderOptions = {}
) {
  const testStore = customStore || store;

  const Wrapper = ({children}: {children: React.ReactNode}) => {
    let content = <Provider store={testStore}>{children}</Provider>;

    if (withNavigation) {
      content = <NavigationContainer>{content}</NavigationContainer>;
    }

    return <SafeAreaProvider>{content}</SafeAreaProvider>;
  };

  return {store: testStore, ...render(ui, {wrapper: Wrapper, ...renderOptions})};
}

// ============================================================================
// MOCK NAVIGATION
// ============================================================================

export const createMockNavigation = (overrides = {}) => ({
  navigate: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
  getParent: jest.fn(),
  dispatch: jest.fn(),
  addListener: jest.fn(() => jest.fn()), // Returns unsubscribe function
  removeListener: jest.fn(),
  setParams: jest.fn(),
  isFocused: jest.fn(() => true),
  canGoBack: jest.fn(() => true),
  replace: jest.fn(),
  reset: jest.fn(),
  pop: jest.fn(),
  popToTop: jest.fn(),
  push: jest.fn(),
  ...overrides,
});

export const createMockRoute = (params = {}, name = 'TestScreen') => ({
  key: `${name}-key`,
  name,
  params,
});

// ============================================================================
// MOCK REDUX STATE
// ============================================================================

export const createMockAuthUser = (overrides = {}) => ({
  id: 'user-123',
  email: 'test@example.com',
  firstName: 'John',
  lastName: 'Doe',
  phone: '+1234567890',
  profilePicture: null,
  profileToken: null,
  ...overrides,
});

export const createMockCompanion = (overrides = {}) => ({
  id: 'companion-1',
  name: 'Buddy',
  species: 'dog',
  breed: {
    breedId: 'breed-1',
    breedName: 'Golden Retriever',
  },
  gender: 'male',
  dateOfBirth: '2020-01-01',
  currentWeight: 25,
  profileImage: null,
  ...overrides,
});

export const createMockDocument = (overrides = {}) => ({
  id: 'doc-1',
  companionId: 'companion-1',
  category: 'medical',
  subcategory: 'vaccination',
  visitType: 'hospital',
  title: 'Annual Checkup',
  businessName: 'Pet Hospital',
  issueDate: '2024-01-15',
  files: [],
  createdAt: '2024-01-15T10:00:00.000Z',
  updatedAt: '2024-01-15T10:00:00.000Z',
  isSynced: false,
  isUserAdded: true,
  ...overrides,
});

// ============================================================================
// COMMON COMPONENT MOCKS
// ============================================================================

export const mockComponents = {
  Header: ({title, showBackButton, onBack, rightIcon, onRightPress}: any) => {
    const ReactModule = require('react');
    const {View, Text, TouchableOpacity} = require('react-native');
    return ReactModule.createElement(
      View,
      {testID: 'header'},
      ReactModule.createElement(Text, {testID: 'header-title'}, title),
      showBackButton &&
        ReactModule.createElement(
          TouchableOpacity,
          {testID: 'back-button', onPress: onBack},
          ReactModule.createElement(Text, null, 'Back')
        ),
      rightIcon &&
        ReactModule.createElement(
          TouchableOpacity,
          {testID: 'right-button', onPress: onRightPress},
          ReactModule.createElement(Text, null, 'Right')
        )
    );
  },

  SafeArea: ({children}: any) => {
    const ReactModule = require('react');
    const {View} = require('react-native');
    return ReactModule.createElement(View, {testID: 'safe-area'}, children);
  },

  LiquidGlassCard: ({children, style, fallbackStyle}: any) => {
    const ReactModule = require('react');
    const {View} = require('react-native');
    return ReactModule.createElement(View, {style: [style, fallbackStyle]}, children);
  },

  LiquidGlassButton: ({title, onPress, leftIcon, rightIcon}: any) => {
    const ReactModule = require('react');
    const {TouchableOpacity, Text, View} = require('react-native');
    return ReactModule.createElement(
      TouchableOpacity,
      {onPress, testID: 'liquid-glass-button'},
      leftIcon && ReactModule.createElement(View, null, leftIcon),
      ReactModule.createElement(Text, null, title),
      rightIcon && ReactModule.createElement(View, null, rightIcon)
    );
  },

  SearchBar: ({value, onChangeText, placeholder}: any) => {
    const ReactModule = require('react');
    const {TextInput} = require('react-native');
    return ReactModule.createElement(TextInput, {
      testID: 'search-bar',
      value,
      onChangeText,
      placeholder,
    });
  },
};

// ============================================================================
// ASYNC UTILITIES
// ============================================================================

export const waitForAsync = () =>
  new Promise(resolve => {
    setTimeout(resolve, 0);
  });

export const flushPromises = () => new Promise(setImmediate);

// ============================================================================
// SNAPSHOT SERIALIZERS
// ============================================================================

export const mockImageSerializer = {
  test: (val: any) => val && typeof val === 'object' && val.$$typeof === Symbol.for('react.test.json'),
  print: (val: any) => {
    if (val.type === 'Image') {
      return `<Image source={${val.props.source}} />`;
    }
    return val;
  },
};

// Re-export everything from testing library
export * from '@testing-library/react-native';
export {renderWithProviders as render};
