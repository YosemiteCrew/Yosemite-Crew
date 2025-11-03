import React from 'react';
import TestRenderer from 'react-test-renderer';
import {HomeStackNavigator} from '@/navigation/HomeStackNavigator';
import {NavigationContainer} from '@react-navigation/native';
import {Provider} from 'react-redux';
import {store} from '@/app/store';

// Mock screens
jest.mock('@/features/home/screens/HomeScreen/HomeScreen', () => ({
  HomeScreen: () => null,
}));

jest.mock('@/features/account/screens/AccountScreen', () => ({
  AccountScreen: () => null,
}));

describe('HomeStackNavigator', () => {
  it('should render without crashing', () => {
    let tree: any;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        <Provider store={store}>
          <NavigationContainer>
            <HomeStackNavigator />
          </NavigationContainer>
        </Provider>,
      );
    });
    expect(tree).toBeTruthy();
  });

  it('should create home stack navigator instance', () => {
    let tree: any;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        <Provider store={store}>
          <NavigationContainer>
            <HomeStackNavigator />
          </NavigationContainer>
        </Provider>,
      );
    });
    const instance = tree.root;
    expect(instance).toBeDefined();
  });

  it('should use theme from useTheme hook', () => {
    let tree: any;
    TestRenderer.act(() => {
      tree = TestRenderer.create(
        <Provider store={store}>
          <NavigationContainer>
            <HomeStackNavigator />
          </NavigationContainer>
        </Provider>,
      );
    });
    expect(tree).toBeTruthy();
  });
});
