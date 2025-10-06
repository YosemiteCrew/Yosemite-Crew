import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SignInScreen } from '../screens/auth/SignInScreen';
import { SignUpScreen } from '../screens/auth/SignUpScreen';
import { OTPVerificationScreen } from '../screens/auth/OTPVerificationScreen';
import { CreateAccountScreen } from '../screens/auth/CreateAccountScreen';

// Type definitions for the Auth Stack
export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  OTPVerification: {
    email: string;
  };
  CreateAccount: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export const AuthNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
      initialRouteName="SignUp"
    >
      <Stack.Screen name="SignIn" component={SignInScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen 
        name="OTPVerification" 
        component={OTPVerificationScreen}
        options={{
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen name="CreateAccount" component={CreateAccountScreen} />
    </Stack.Navigator>
  );
};