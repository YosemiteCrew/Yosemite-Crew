import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import OnBoarding from '../screens/Auth/onBoarding';

const OnBoardingStack = ({ route }) => {
  const OnBoardings = createStackNavigator();
  return (
    <OnBoardings.Navigator>
      <OnBoardings.Screen
        name="Onboarding"
        component={OnBoarding}
        // initialParams={route?.params}
        options={{
          gestureEnabled: false,
          headerShown: false,
        }}
      />
    </OnBoardings.Navigator>
  );
};
export default OnBoardingStack;
