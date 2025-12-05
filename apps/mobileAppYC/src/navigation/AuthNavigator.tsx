import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SignInScreen } from '@/features/auth/screens/SignInScreen';
import { SignUpScreen } from '@/features/auth/screens/SignUpScreen';
import { OTPVerificationScreen } from '@/features/auth/screens/OTPVerificationScreen';
import { CreateAccountScreen } from '@/features/auth/screens/CreateAccountScreen';
import type {AuthTokens} from '@/features/auth/context/AuthContext';
import type {ParentProfileSummary} from '@/features/account/services/profileService';

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
    challengeType?: 'otp' | 'demoPassword';
    challengeLength?: number;
  };
  CreateAccount: {
    email: string;
    userId: string;
    profileToken?: string;
    tokens: AuthTokens;
    initialAttributes?: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      dateOfBirth?: string;
      profilePicture?: string;
      address?: {
        addressLine?: string;
        city?: string;
        stateProvince?: string;
        postalCode?: string;
        country?: string;
      };
    };
    hasRemoteProfile?: boolean;
    existingParentProfile?: ParentProfileSummary | null;
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
