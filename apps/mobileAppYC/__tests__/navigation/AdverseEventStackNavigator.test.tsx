import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {render} from '@testing-library/react-native';
import {AdverseEventStackNavigator} from '@/navigation/AdverseEventStackNavigator';

// --- Mocks ---

// Using require('react-native') inside the mock factory prevents
// "ReferenceError: variable is not defined" caused by Jest hoisting.

jest.mock('@/features/adverseEventReporting/screens/LandingScreen', () => ({
  LandingScreen: () => {
    const {View, Text} = require('react-native');
    return (
      <View testID="LandingScreen">
        <Text>Landing Screen</Text>
      </View>
    );
  },
}));

jest.mock('@/features/adverseEventReporting/screens/Step1Screen', () => ({
  Step1Screen: () => {
    const {View, Text} = require('react-native');
    return (
      <View testID="Step1Screen">
        <Text>Step 1 Screen</Text>
      </View>
    );
  },
}));

jest.mock('@/features/adverseEventReporting/screens/Step2Screen', () => ({
  Step2Screen: () => {
    const {View, Text} = require('react-native');
    return (
      <View testID="Step2Screen">
        <Text>Step 2 Screen</Text>
      </View>
    );
  },
}));

jest.mock('@/features/adverseEventReporting/screens/Step3Screen', () => ({
  Step3Screen: () => {
    const {View, Text} = require('react-native');
    return (
      <View testID="Step3Screen">
        <Text>Step 3 Screen</Text>
      </View>
    );
  },
}));

jest.mock('@/features/adverseEventReporting/screens/Step4Screen', () => ({
  Step4Screen: () => {
    const {View, Text} = require('react-native');
    return (
      <View testID="Step4Screen">
        <Text>Step 4 Screen</Text>
      </View>
    );
  },
}));

jest.mock('@/features/adverseEventReporting/screens/Step5Screen', () => ({
  Step5Screen: () => {
    const {View, Text} = require('react-native');
    return (
      <View testID="Step5Screen">
        <Text>Step 5 Screen</Text>
      </View>
    );
  },
}));

jest.mock('@/features/adverseEventReporting/screens/ThankYouScreen', () => ({
  ThankYouScreen: () => {
    const {View, Text} = require('react-native');
    return (
      <View testID="ThankYouScreen">
        <Text>Thank You Screen</Text>
      </View>
    );
  },
}));

// --- Helper ---
const TestWrapper = () => (
  <NavigationContainer>
    <AdverseEventStackNavigator />
  </NavigationContainer>
);

describe('AdverseEventStackNavigator', () => {
  it('defines all screens in the stack correctly', async () => {
    const {toJSON} = render(<TestWrapper />);
    expect(toJSON()).toMatchSnapshot();
  });
});
