import React from 'react';
import TestRenderer from 'react-test-renderer';
import {AuthNavigator} from '@/navigation/AuthNavigator';
import {NavigationContainer} from '@react-navigation/native';

// Mock the screens
jest.mock('@/screens/auth/SignInScreen', () => ({
  SignInScreen: () => null,
}));

jest.mock('@/screens/auth/SignUpScreen', () => ({
  SignUpScreen: () => null,
}));

jest.mock('@/screens/auth/OTPVerificationScreen', () => ({
  OTPVerificationScreen: () => null,
}));

jest.mock('@/screens/auth/CreateAccountScreen', () => ({
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
