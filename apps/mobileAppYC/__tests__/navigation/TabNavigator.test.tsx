import React from 'react';
import TestRenderer from 'react-test-renderer';
import {NavigationContainer} from '@react-navigation/native';
import {Provider} from 'react-redux';
import {store} from '@/app/store';

// Mock Firebase notifications service
jest.mock('@/shared/services/firebaseNotifications', () => ({
  getCurrentFcmToken: jest.fn(),
  requestUserPermission: jest.fn(),
  setupNotificationListeners: jest.fn(),
}));

// Mock device token registry service
jest.mock('@/shared/services/deviceTokenRegistry', () => ({
  registerDeviceToken: jest.fn(),
  unregisterDeviceToken: jest.fn(),
  isRunningOnIosSimulator: jest.fn(),
}));

// Mock Stripe before importing anything that uses it
jest.mock('@stripe/stripe-react-native', () => ({
  useStripe: () => ({
    initPaymentSheet: jest.fn(),
    presentPaymentSheet: jest.fn(),
  }),
  useConfirmPayment: () => ({
    confirmPayment: jest.fn(),
  }),
}));

// Mock bottom tabs
jest.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: () => ({
    Navigator: ({children}: any) => children,
    Screen: () => null,
  }),
}));

// Mock the navigators
jest.mock('@/navigation/HomeStackNavigator', () => ({
  HomeStackNavigator: () => null,
}));

jest.mock('@/features/appointments/screens/AppointmentsScreen', () => ({
  AppointmentsScreen: () => null,
}));

jest.mock('@/navigation/DocumentStackNavigator', () => ({
  DocumentStackNavigator: () => null,
}));

jest.mock('@/navigation/TaskStackNavigator', () => ({
  TaskStackNavigator: () => null,
}));

jest.mock('@/navigation/FloatingTabBar', () => ({
  FloatingTabBar: () => null,
}));

// Import after mocks
const {TabNavigator} = require('@/navigation/TabNavigator');

describe('TabNavigator', () => {
  it('should render without crashing', () => {
    let tree: any;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        <Provider store={store}>
          <NavigationContainer>
            <TabNavigator />
          </NavigationContainer>
        </Provider>,
      );
    });
    expect(tree).toBeTruthy();
  });

  it('should create tab navigator instance', () => {
    let tree: any;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        <Provider store={store}>
          <NavigationContainer>
            <TabNavigator />
          </NavigationContainer>
        </Provider>,
      );
    });
    const instance = tree.root;
    expect(instance).toBeDefined();
  });
});
