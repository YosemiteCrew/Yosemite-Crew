import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {createNativeStackNavigator, NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useNavigation} from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {DeviceEventEmitter, Alert} from 'react-native';
import {useDispatch, useSelector} from 'react-redux';
import {RootStackParamList} from './types';
import {AuthNavigator} from './AuthNavigator';
import type {AuthStackParamList} from './AuthNavigator';
import {TabNavigator} from './TabNavigator';
import {OnboardingScreen} from '@/features/onboarding/screens/OnboardingScreen';
import {useAuth, type AuthTokens} from '@/features/auth/context/AuthContext';
import {Loading} from '@/shared/components/common';
import {EmergencyProvider, useEmergency} from '@/features/home/context/EmergencyContext';
import {NetworkProvider} from '@/features/network/context/NetworkContext';
import {EmergencyBottomSheet} from '@/features/home/components/EmergencyBottomSheet';
import CoParentInviteBottomSheet, {
  type CoParentInviteBottomSheetRef,
} from '@/features/coParent/components/CoParentInviteBottomSheet/CoParentInviteBottomSheet';
import NetworkStatusBottomSheet, {
  type NetworkStatusBottomSheetRef,
} from '@/features/network/components/NetworkStatusBottomSheet';
import {useNetworkStatus} from '@/features/network/context/NetworkContext';
import type {AppDispatch, RootState} from '@/app/store';
import {
  acceptCoParentInvite,
  declineCoParentInvite,
  fetchParentAccess,
  fetchPendingInvites,
} from '@/features/coParent';
import {fetchCompanions, selectSelectedCompanionId} from '@/features/companion';
import {PENDING_PROFILE_STORAGE_KEY, PENDING_PROFILE_UPDATED_EVENT} from '@/config/variables';
import {getFreshStoredTokens, isTokenExpired} from '@/features/auth/sessionManager';

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
    if (!user) {
      console.log('[AppNavigator] No user found, profile incomplete');
      return false;
    }

    if (user.parentId) {
      console.log('[AppNavigator] Parent linked, profile considered complete', {
        userId: user.id,
        parentId: user.parentId,
      });
      return true;
    }

    console.log('[AppNavigator] Missing parent link, profile incomplete', {
      userId: user.id,
    });
    return false;
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

  useEffect(() => {
    if (pendingProfile || !isLoggedIn || isProfileComplete || !user) {
      return;
    }

    let cancelled = false;

    const seedPendingProfile = async () => {
      try {
        const storedTokens = await getFreshStoredTokens();
        if (!storedTokens) {
          console.warn('[AppNavigator] No stored tokens available to resume pending profile.');
          return;
        }

        if (isTokenExpired(storedTokens.expiresAt ?? undefined)) {
          console.warn('[AppNavigator] Stored tokens are expired; skipping pending profile seeding.');
          return;
        }

        const authTokens: AuthTokens = {
          idToken: storedTokens.idToken,
          accessToken: storedTokens.accessToken,
          refreshToken: storedTokens.refreshToken,
          provider: storedTokens.provider ?? 'amplify',
          userId: storedTokens.userId ?? user.id,
          expiresAt: storedTokens.expiresAt,
        };

        const payload: AuthStackParamList['CreateAccount'] = {
          email: user.email,
          userId: user.id,
          profileToken: user.profileToken,
          tokens: authTokens,
          initialAttributes: {
            firstName: user.firstName,
            lastName: user.lastName,
            phone: user.phone,
            dateOfBirth: user.dateOfBirth,
            profilePicture: user.profilePicture,
            address: user.address,
          },
          hasRemoteProfile: true,
        };

        await AsyncStorage.setItem(
          PENDING_PROFILE_STORAGE_KEY,
          JSON.stringify(payload),
        );
        if (!cancelled) {
          DeviceEventEmitter.emit(PENDING_PROFILE_UPDATED_EVENT, payload);
        }
      } catch (error) {
        console.warn('[AppNavigator] Failed to seed pending profile for incomplete account', error);
      }
    };

    seedPendingProfile();

    return () => {
      cancelled = true;
    };
  }, [pendingProfile, isLoggedIn, isProfileComplete, user]);

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
    <NetworkProvider>
      <EmergencyProvider>
        <Stack.Navigator screenOptions={{headerShown: false}}>
          {screenToRender}
        </Stack.Navigator>
        <AppNavigatorEmergencySheet />
        <AppNavigatorCoParentInviteSheet />
        <AppNavigatorNetworkStatusSheet />
      </EmergencyProvider>
    </NetworkProvider>
  );
}

const AppNavigatorEmergencySheet: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const emergencySheetRef = React.useRef<any>(null);
  const {setEmergencySheetRef} = useEmergency();

  // Get selected companion ID from Redux
  const selectedCompanionId = useSelector(selectSelectedCompanionId);

  React.useEffect(() => {
    if (emergencySheetRef.current) {
      setEmergencySheetRef(emergencySheetRef);
    }
  }, [setEmergencySheetRef]);

  const handleCallVet = React.useCallback(() => {
    console.log('[AppNavigator] Call vet clicked');
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
      companionId={selectedCompanionId}
      onCallVet={handleCallVet}
      onAdverseEvent={handleAdverseEvent}
    />
  );
};

const AppNavigatorCoParentInviteSheet: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const {user} = useAuth();
  const pendingInvites = useSelector(
    (state: RootState) => (state as any)?.coParent?.pendingInvites ?? [],
  );
  const [currentInviteIndex, setCurrentInviteIndex] = React.useState(0);
  const sheetRef = React.useRef<CoParentInviteBottomSheetRef>(null);

  React.useEffect(() => {
    if (!user?.id) {
      sheetRef.current?.close();
      return;
    }
    dispatch(fetchPendingInvites());
  }, [dispatch, user?.id]);

  React.useEffect(() => {
    if (pendingInvites.length === 0) {
      setCurrentInviteIndex(0);
      sheetRef.current?.close();
      return;
    }

    setCurrentInviteIndex(prev => {
      const nextIndex = prev < pendingInvites.length ? prev : 0;
      return nextIndex === prev ? prev : nextIndex;
    });

    requestAnimationFrame(() => sheetRef.current?.open());
  }, [pendingInvites]);

  const currentInvite = pendingInvites[currentInviteIndex] ?? null;

  const handleAccept = React.useCallback(async () => {
    const invite = pendingInvites[currentInviteIndex];
    if (!invite) {
      return;
    }
    try {
      await dispatch(acceptCoParentInvite({token: invite.token})).unwrap();
      dispatch(fetchPendingInvites());
      if (user?.parentId) {
        dispatch(
          fetchParentAccess({
            parentId: user.parentId,
            companionIds: invite.companion?.id ? [invite.companion.id] : undefined,
          }),
        );
        dispatch(fetchCompanions(user.parentId));
      }
    } catch (error) {
      console.error('Failed to accept invite:', error);
      Alert.alert('Error', 'Failed to accept invite');
    }
  }, [currentInviteIndex, dispatch, pendingInvites, user?.parentId]);

  const handleDecline = React.useCallback(async () => {
    const invite = pendingInvites[currentInviteIndex];
    if (!invite) {
      return;
    }
    try {
      await dispatch(declineCoParentInvite({token: invite.token})).unwrap();
      dispatch(fetchPendingInvites());
    } catch (error) {
      console.error('Failed to decline invite:', error);
      Alert.alert('Error', 'Failed to decline invite');
    }
  }, [currentInviteIndex, dispatch, pendingInvites]);

  return (
    <CoParentInviteBottomSheet
      ref={sheetRef}
      coParentName={currentInvite?.inviteeName}
      inviteeName={currentInvite?.inviteeName}
      inviterName={
        currentInvite?.invitedBy?.fullName ??
        ((`${currentInvite?.invitedBy?.firstName ?? ''} ${currentInvite?.invitedBy?.lastName ?? ''}`).trim() ||
          undefined)
      }
      inviterProfileImage={currentInvite?.invitedBy?.profileImageUrl}
      companionName={currentInvite?.companion?.name}
      companionProfileImage={currentInvite?.companion?.photoUrl}
      onAccept={handleAccept}
      onDecline={handleDecline}
    />
  );
};

const AppNavigatorNetworkStatusSheet: React.FC = () => {
  const {setNetworkSheetRef} = useNetworkStatus();
  const sheetRef = React.useRef<NetworkStatusBottomSheetRef | null>(null);

  React.useEffect(() => {
    if (sheetRef.current) {
      setNetworkSheetRef(sheetRef as React.RefObject<{open: () => void; close: () => void}>);
    }
  }, [setNetworkSheetRef]);

  return (
    <NetworkStatusBottomSheet
      ref={sheetRef}
    />
  );
};
