import React from 'react';
import TestRenderer from 'react-test-renderer';
import {NavigationContainer} from '@react-navigation/native';
import {Provider} from 'react-redux';
import {store} from '@/app/store';

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

jest.mock('@/screens/appointments/AppointmentsScreen', () => ({
  AppointmentsScreen: () => null,
}));

jest.mock('@/screens/documents/DocumentsScreen', () => ({
  DocumentsScreen: () => null,
}));

jest.mock('@/screens/tasks/TasksScreen', () => ({
  TasksScreen: () => null,
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
