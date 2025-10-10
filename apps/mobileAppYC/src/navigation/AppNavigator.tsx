import React, {useCallback, useEffect, useState} from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {RootStackParamList} from './types';
import {AuthNavigator} from './AuthNavigator';
import type {AuthStackParamList} from './AuthNavigator';
import {TabNavigator} from './TabNavigator';
import {OnboardingScreen} from '../screens/onboarding/OnboardingScreen';
import {useAuth} from '../contexts/AuthContext'; // Update import path
import {Loading} from '../components';

import {DeviceEventEmitter} from 'react-native';
import { PENDING_PROFILE_STORAGE_KEY, PENDING_PROFILE_UPDATED_EVENT } from '@/config/variables';

const Stack = createNativeStackNavigator<RootStackParamList>();
const ONBOARDING_COMPLETED_KEY = '@onboarding_completed';

export const AppNavigator: React.FC = () => {
  const {isLoggedIn, isLoading: authLoading, user} = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [pendingProfile, setPendingProfile] = useState<
    AuthStackParamList['CreateAccount'] | null
  >(null);
  // Derive profile completeness directly from auth user to avoid stale storage
  const isProfileComplete = !!(user?.firstName && user?.dateOfBirth);

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const loadPendingProfile = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(PENDING_PROFILE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AuthStackParamList['CreateAccount'];
        setPendingProfile(parsed);
      } else {
        setPendingProfile(null);
      }
    } catch (error) {
      console.warn('Failed to load pending profile payload', error);
      setPendingProfile(null);
    }
  }, []);

  useEffect(() => {
    loadPendingProfile();
    const subscription = DeviceEventEmitter.addListener(
      PENDING_PROFILE_UPDATED_EVENT,
      loadPendingProfile,
    );
    return () => subscription.remove();
  }, [loadPendingProfile]);

const checkOnboardingStatus = async () => {
    try {
      const onboardingCompleted = await AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY);
      setShowOnboarding(onboardingCompleted === null);
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      setShowOnboarding(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOnboardingComplete = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
      setShowOnboarding(false);
    } catch (error) {
      console.error('Error saving onboarding status:', error);
      setShowOnboarding(false);
    }
  };

  if (isLoading || authLoading) {
    return <Loading text="Loading..." />;
  }

  console.log(
    'AppNavigator render - isLoggedIn:',
    isLoggedIn,
    'showOnboarding:',
    showOnboarding,
  );

  const renderAuth = () => {
    const authKey = pendingProfile
      ? `pending-${pendingProfile.userId}`
      : isLoggedIn && !isProfileComplete
      ? `incomplete-${user?.id ?? 'unknown'}`
      : 'auth-default';

    const initialRoute = pendingProfile ? 'CreateAccount' : 'SignUp';

    return (
      <Stack.Screen key={authKey} name="Auth">
        {() => (
          <AuthNavigator
            initialRouteName={initialRoute as any}
            createAccountInitialParams={pendingProfile ?? undefined}
          />
        )}
      </Stack.Screen>
    );
  };

  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      {showOnboarding ? (
        <Stack.Screen name="Onboarding">
          {() => <OnboardingScreen onComplete={handleOnboardingComplete} />}
        </Stack.Screen>
      ) : isLoggedIn && isProfileComplete ? (
        <Stack.Screen name="Main" component={TabNavigator} />
      ) : (
        renderAuth()
      )}
    </Stack.Navigator>
  );
}
