import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {RootStackParamList} from './types';
import {AuthNavigator} from './AuthNavigator';
import type {AuthStackParamList} from './AuthNavigator';
import {TabNavigator} from './TabNavigator';
import {OnboardingScreen} from '@/features/onboarding/screens/OnboardingScreen';
import {useAuth} from '@/features/auth/context/AuthContext';
import {Loading} from '@/shared/components/common';
import {EmergencyProvider, useEmergency} from '@/features/home/context/EmergencyContext';
import {EmergencyBottomSheet} from '@/features/home/components/EmergencyBottomSheet';

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
  // Add defensive checks to prevent state corruption from causing logout
  const isProfileComplete = useMemo(() => {
    try {
      if (!user) {
        console.log('[AppNavigator] No user found, profile incomplete');
        return false;
      }

      const hasRequiredFields = !!(user.id && user.firstName && user.dateOfBirth);
      console.log('[AppNavigator] Profile completeness check:', {
        userId: user.id,
        hasFirstName: !!user.firstName,
        hasDateOfBirth: !!user.dateOfBirth,
        isComplete: hasRequiredFields,
      });

      return hasRequiredFields;
    } catch (error) {
      console.error('[AppNavigator] Error checking profile completeness:', error);
      // If there's an error checking, assume incomplete to be safe
      return false;
    }
  }, [user]);

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
    let authKey = 'auth-default';
    if (pendingProfile) {
      authKey = `pending-${pendingProfile.userId}`;
    } else if (isLoggedIn && !isProfileComplete) {
      const userId = user?.id ?? 'unknown';
      authKey = `incomplete-${userId}`;
    }

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

  let screenToRender: React.ReactNode;

  if (showOnboarding) {
    screenToRender = (
      <Stack.Screen name="Onboarding">
        {() => <OnboardingScreen onComplete={handleOnboardingComplete} />}
      </Stack.Screen>
    );
  } else if (isLoggedIn && isProfileComplete) {
    screenToRender = <Stack.Screen name="Main" component={TabNavigator} />;
  } else {
    screenToRender = renderAuth();
  }

  return (
    <EmergencyProvider>
      <Stack.Navigator screenOptions={{headerShown: false}}>
        {screenToRender}
      </Stack.Navigator>
      <AppNavigatorEmergencySheet />
    </EmergencyProvider>
  );
}

const AppNavigatorEmergencySheet: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const emergencySheetRef = React.useRef<any>(null);
  const {setEmergencySheetRef} = useEmergency();

  React.useEffect(() => {
    if (emergencySheetRef.current) {
      setEmergencySheetRef(emergencySheetRef);
    }
  }, [setEmergencySheetRef]);

  const handleCallVet = React.useCallback(() => {
    console.log('[AppNavigator] Call vet clicked');
    // TODO: Implement actual call vet functionality
  }, []);

  const handleAdverseEvent = React.useCallback(() => {
    console.log('[AppNavigator] Adverse event clicked - navigating to AdverseEvent');
    try {
      // Navigate to Main tab, then to HomeStack, then to AdverseEvent
      (navigation as any).navigate('Main', {
        screen: 'HomeStack',
        params: {
          screen: 'AdverseEvent',
          params: {
            screen: 'Landing',
          },
        },
      });
    } catch (error) {
      console.error('[AppNavigator] Navigation error:', error);
    }
  }, [navigation]);

  return (
    <EmergencyBottomSheet
      ref={emergencySheetRef}
      onCallVet={handleCallVet}
      onAdverseEvent={handleAdverseEvent}
    />
  );
}
