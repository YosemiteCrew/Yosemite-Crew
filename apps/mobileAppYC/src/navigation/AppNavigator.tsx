import React, {useCallback, useEffect, useState} from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {RootStackParamList} from './types';
import {AuthNavigator} from './AuthNavigator';
import type { AuthStackParamList } from './AuthNavigator';
import {TabNavigator} from './TabNavigator';
import {OnboardingScreen} from '../screens/onboarding/OnboardingScreen';
import {useAuth} from '../contexts/AuthContext'; // Update import path
import {Loading} from '../components';
import { PENDING_PROFILE_STORAGE_KEY, PENDING_PROFILE_UPDATED_EVENT } from '@/constants/auth';
import { DeviceEventEmitter } from 'react-native';

const Stack = createNativeStackNavigator<RootStackParamList>();
const ONBOARDING_COMPLETED_KEY = '@onboarding_completed';

export const AppNavigator: React.FC = () => {
  const {isLoggedIn, isLoading: authLoading} = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [pendingProfile, setPendingProfile] = useState<
    AuthStackParamList['CreateAccount'] | null
  >(null);

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

  console.log('AppNavigator render - isLoggedIn:', isLoggedIn, 'showOnboarding:', showOnboarding);

  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      {showOnboarding ? (
        <Stack.Screen name="Onboarding">
          {() => <OnboardingScreen onComplete={handleOnboardingComplete} />}
        </Stack.Screen>
      ) : pendingProfile ? (
        <Stack.Screen name="Auth">
          {() => (
            <AuthNavigator
              key={`pending-${pendingProfile.userId}`}
              initialRouteName="CreateAccount"
              createAccountInitialParams={pendingProfile}
            />
          )}
        </Stack.Screen>
      ) : isLoggedIn ? (
        <Stack.Screen name="Main" component={TabNavigator} />
      ) : (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      )}
    </Stack.Navigator>
  );
};
