import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SignInScreen } from '../screens/auth/SignInScreen';
import { SignUpScreen } from '../screens/auth/SignUpScreen';
import { OTPVerificationScreen } from '../screens/auth/OTPVerificationScreen';
import { CreateAccountScreen } from '../screens/auth/CreateAccountScreen';

// Type definitions for the Auth Stack
export type AuthStackParamList = {
  SignIn: {
    email?: string;
    statusMessage?: string;
  } | undefined;
  SignUp: undefined;
  OTPVerification: {
    email: string;
    isNewUser: boolean;
  };
  CreateAccount: {
    email: string;
    userId: string;
    profileToken: string;
    tokens: {
      idToken: string;
      accessToken: string;
      refreshToken?: string;
      expiresAt?: number;
      userId?: string;
    };
    initialAttributes?: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      dateOfBirth?: string;
      profilePicture?: string;
    };
    showOtpSuccess?: boolean;
  };
};

interface AuthNavigatorProps {
  initialRouteName?: keyof AuthStackParamList;
  createAccountInitialParams?: AuthStackParamList['CreateAccount'];
}

const Stack = createNativeStackNavigator<AuthStackParamList>();

export const AuthNavigator: React.FC<AuthNavigatorProps> = ({
  initialRouteName = 'SignUp',
  createAccountInitialParams,
}) => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
      initialRouteName={initialRouteName}
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
      <Stack.Screen
        name="CreateAccount"
        component={CreateAccountScreen}
        initialParams={createAccountInitialParams}
      />
    </Stack.Navigator>
  );
};
