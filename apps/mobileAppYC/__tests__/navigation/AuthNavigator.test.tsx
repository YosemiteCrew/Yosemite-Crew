import React from 'react';
import TestRenderer from 'react-test-renderer';
import {AuthNavigator} from '@/navigation/AuthNavigator';
import {NavigationContainer} from '@react-navigation/native';

// Mock the screens
jest.mock('@/features/auth/screens/SignInScreen', () => ({
  SignInScreen: () => null,
}));

jest.mock('@/features/auth/screens/SignUpScreen', () => ({
  SignUpScreen: () => null,
}));

jest.mock('@/features/auth/screens/OTPVerificationScreen', () => ({
  OTPVerificationScreen: () => null,
}));

jest.mock('@/features/auth/screens/CreateAccountScreen', () => ({
  CreateAccountScreen: () => null,
}));

describe('AuthNavigator', () => {
  it('should render without crashing', () => {
    let tree: any;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        <NavigationContainer>
          <AuthNavigator />
        </NavigationContainer>,
      );
    });
    expect(tree).toBeTruthy();
  });

  it('should render with initial route', () => {
    let tree: any;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        <NavigationContainer>
          <AuthNavigator initialRouteName="SignIn" />
        </NavigationContainer>,
      );
    });
    expect(tree).toBeTruthy();
  });

  it('should create navigator instance', () => {
    let tree: any;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        <NavigationContainer>
          <AuthNavigator />
        </NavigationContainer>,
      );
    });
    const instance = tree.root;
    expect(instance).toBeDefined();
  });
});
