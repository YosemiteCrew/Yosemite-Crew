import React from 'react';
import {render} from '@testing-library/react-native';
import {LinkedBusinessesStackNavigator} from '../../src/navigation/LinkedBusinessesStackNavigator';
import {View} from 'react-native';

// --- Mocks ---

// 1. Hooks
jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: '#ffffff',
        secondary: '#000000',
      },
      typography: {
        screenTitle: {
          fontFamily: 'System',
          fontSize: 20,
          fontWeight: 'bold',
        },
      },
    },
  }),
}));

// 2. Mock Screens
// We require React and View inside the mock to avoid ReferenceError due to hoisting
jest.mock('@/features/linkedBusinesses/screens/BusinessSearchScreen', () => {
  const {View} = require('react-native');
  return {BusinessSearchScreen: () => <View testID="screen-BusinessSearch" />};
});

jest.mock('@/features/linkedBusinesses/screens/BusinessAddScreen', () => {
  const {View} = require('react-native');
  return {BusinessAddScreen: () => <View testID="screen-BusinessAdd" />};
});

jest.mock('@/features/linkedBusinesses/screens/QRScannerScreen', () => {
  const {View} = require('react-native');
  return {QRScannerScreen: () => <View testID="screen-QRScanner" />};
});

// 3. Mock Navigation
jest.mock('@react-navigation/native-stack', () => {
  const {View} = require('react-native');
  return {
    createNativeStackNavigator: () => ({
      Navigator: ({children, screenOptions}: any) => (
        <View
          testID="stack-navigator"
          accessibilityLabel={JSON.stringify(screenOptions)}>
          {children}
        </View>
      ),
      Screen: ({name}: any) => <View testID={`screen-placeholder-${name}`} />,
    }),
  };
});

describe('LinkedBusinessesStackNavigator', () => {
  it('renders the stack navigator with correct theme options and screens', () => {
    const {getByTestId} = render(<LinkedBusinessesStackNavigator />);

    // Verify Navigator exists
    const navigator = getByTestId('stack-navigator');
    expect(navigator).toBeTruthy();

    // Verify theme options are passed (by checking the accessibilityLabel hack in our mock)
    // This ensures lines 15-24 are covered
    const options = JSON.parse(navigator.props.accessibilityLabel);
    expect(options.headerStyle.backgroundColor).toBe('#ffffff');
    expect(options.headerTintColor).toBe('#000000');
    expect(options.headerTitleStyle.fontSize).toBe(20);

    // Verify all screens are registered in the stack
    expect(getByTestId('screen-placeholder-BusinessSearch')).toBeTruthy();
    expect(getByTestId('screen-placeholder-BusinessAdd')).toBeTruthy();
    expect(getByTestId('screen-placeholder-QRScanner')).toBeTruthy();
  });
});
