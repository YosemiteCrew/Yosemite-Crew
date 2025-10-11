import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {AccountScreen} from '@/screens/account/AccountScreen';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {HomeStackParamList} from '@/navigation/types';
import {Provider} from 'react-redux';
import {store} from '@/app/store';
import {SafeAreaProvider} from 'react-native-safe-area-context';

const mockLogout = jest.fn();

// Mock heavy child components to simple views to avoid native/library coupling in this unit test
jest.mock('@/screens/account/components/DeleteAccountBottomSheet', () => {
  const React = require('react');
  const {View} = require('react-native');
  return { __esModule: true, default: React.forwardRef(() => React.createElement(View)) };
});

jest.mock('@/components/common/LiquidGlassCard/LiquidGlassCard', () => {
  const React = require('react');
  const {View} = require('react-native');
  return {
    __esModule: true,
    LiquidGlassCard: ({children, ...props}: any) => React.createElement(View, props, children),
  };
});

jest.mock('@/components/common/LiquidGlassButton/LiquidGlassButton', () => {
  const React = require('react');
  const {Text, TouchableOpacity} = require('react-native');
  const Btn = ({title, onPress}: any) => React.createElement(TouchableOpacity, {onPress}, React.createElement(Text, null, title ?? 'Btn'));
  return { __esModule: true, default: Btn };
});

// Mock images to plain numeric IDs to satisfy RN Image
jest.mock('@/assets/images', () => ({
  Images: {
    backIcon: 1,
    notificationIcon: 1,
    blackEdit: 1,
    rightArrow: 1,
    faqIcon: 1,
    aboutusIcon: 1,
    tncIcon: 1,
    privacyIcon: 1,
    contactIcon: 1,
    deleteIconRed: 1,
  },
}));

// Mock AuthContext
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-123',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      phone: '+1234567890',
    },
    isAuthenticated: true,
    logout: mockLogout,
  }),
}));

describe.skip('AccountScreen', () => {
  beforeEach(() => {
    mockLogout.mockClear();
  });

  const buildProps = (): NativeStackScreenProps<HomeStackParamList, 'Account'> => ({
    navigation: {
      navigate: jest.fn(),
      goBack: jest.fn(),
      setOptions: jest.fn(),
      getParent: jest.fn(),
      dispatch: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      setParams: jest.fn(),
      isFocused: jest.fn(),
      canGoBack: jest.fn(),
      replace: jest.fn(),
      reset: jest.fn(),
      pop: jest.fn(),
      popToTop: jest.fn(),
      push: jest.fn(),
    } as any,
    route: {key: 'account', name: 'Account', params: undefined},
  });

  const renderScreen = () =>
    render(
      <Provider store={store}>
        <SafeAreaProvider>
          <AccountScreen {...(buildProps() as any)} />
        </SafeAreaProvider>
      </Provider>,
    );

  it('renders header and menu items', () => {
    const utils = renderScreen();
    expect(utils.getByText('Account')).toBeTruthy();
    expect(utils.getByText('FAQs')).toBeTruthy();
    expect(utils.getByText('Delete Account')).toBeTruthy();
  });

  it('shows user name and triggers logout', () => {
    const utils = renderScreen();
    expect(utils.getByText('John Doe')).toBeTruthy();
    const logoutBtn = utils.getByText('Logout');
    fireEvent.press(logoutBtn);
    expect(mockLogout).toHaveBeenCalled();
  });
});
