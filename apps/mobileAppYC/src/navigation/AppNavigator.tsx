import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  createNativeStackNavigator,
  NativeStackNavigationProp,
} from '@react-navigation/native-stack';
import {useNavigation} from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {DeviceEventEmitter, Alert, Linking} from 'react-native';
import {useDispatch, useSelector} from 'react-redux';
import {RootStackParamList} from './types';
import {AuthNavigator} from './AuthNavigator';
import type {AuthStackParamList} from './AuthNavigator';
import {TabNavigator} from './TabNavigator';
import {OnboardingScreen} from '@/features/onboarding/screens/OnboardingScreen';
import {useAuth, type AuthTokens} from '@/features/auth/context/AuthContext';
import {useGlobalLoader} from '@/context/GlobalLoaderContext';
import {
  EmergencyProvider,
  useEmergency,
} from '@/features/home/context/EmergencyContext';
import {EmergencyBottomSheet} from '@/features/home/components/EmergencyBottomSheet';
import CoParentInviteBottomSheet, {
  type CoParentInviteBottomSheetRef,
} from '@/features/coParent/components/CoParentInviteBottomSheet/CoParentInviteBottomSheet';
import NetworkStatusBottomSheet, {
  type NetworkStatusBottomSheetRef,
} from '@/features/network/components/NetworkStatusBottomSheet';
import {
  useNetworkStatus,
  NetworkProvider,
} from '@/features/network/context/NetworkContext';
import type {AppDispatch, RootState} from '@/app/store';
import {
  acceptCoParentInvite,
  declineCoParentInvite,
  fetchParentAccess,
  fetchPendingInvites,
} from '@/features/coParent';
import {fetchCompanions, selectSelectedCompanionId} from '@/features/companion';
import {
  PENDING_PROFILE_STORAGE_KEY,
  PENDING_PROFILE_UPDATED_EVENT,
} from '@/config/variables';
import {
  getFreshStoredTokens,
  isTokenExpired,
} from '@/features/auth/sessionManager';
import {
  fetchBusinessDetails,
  selectLinkedHospitalsForCompanion,
} from '@/features/linkedBusinesses';

const Stack = createNativeStackNavigator<RootStackParamList>();
const ONBOARDING_COMPLETED_KEY = '@onboarding_completed';

let _onboardingLoaded = false;
let _showOnboarding = false;
let _onboardingFetching = false;
const _onboardingListeners = new Set<() => void>();

function _notifyOnboarding() {
  _onboardingListeners.forEach(l => l());
}

function _startOnboardingFetch() {
  if (_onboardingFetching) return;
  _onboardingFetching = true;
  AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY)
    .then(value => {
      _showOnboarding = value === null;
    })
    .catch(() => {
      _showOnboarding = true;
    })
    .finally(() => {
      _onboardingLoaded = true;
      _notifyOnboarding();
    });
}

function _subscribeOnboarding(l: () => void) {
  _onboardingListeners.add(l);
  _startOnboardingFetch();
  return () => {
    _onboardingListeners.delete(l);
  };
}

function _getShowOnboarding() {
  return _showOnboarding;
}
function _getOnboardingLoading() {
  return !_onboardingLoaded;
}

export function _resetOnboardingStoreForTesting() {
  _onboardingLoaded = false;
  _showOnboarding = false;
  _onboardingFetching = false;
  _onboardingListeners.clear();
}

export const AppNavigator: React.FC = () => {
  const {isLoggedIn, isLoading: authLoading, user} = useAuth();
  const isLoading = useSyncExternalStore(
    _subscribeOnboarding,
    _getOnboardingLoading,
    _getOnboardingLoading,
  );
  const showOnboarding = useSyncExternalStore(
    _subscribeOnboarding,
    _getShowOnboarding,
    _getShowOnboarding,
  );
  const {showLoader, hideLoader} = useGlobalLoader();
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

  const loadPendingProfile = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(PENDING_PROFILE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AuthStackParamList['CreateAccount'];
        setPendingProfile({
          ...parsed,
          // OTP success sheet should be shown only in immediate post-OTP navigation,
          // not when resuming an unfinished profile from persisted storage.
          showOtpSuccess: false,
        });
      } else {
        setPendingProfile(null);
      }
    } catch (error) {
      console.warn('Failed to load pending profile payload', error);
      setPendingProfile(null);
    }
  }, []);

  const loadPendingProfileRef = useRef(loadPendingProfile);
  loadPendingProfileRef.current = loadPendingProfile;

  useEffect(() => {
    loadPendingProfileRef.current();
    const subscription = DeviceEventEmitter.addListener(
      PENDING_PROFILE_UPDATED_EVENT,
      () => loadPendingProfileRef.current(),
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (pendingProfile || !isLoggedIn || isProfileComplete || !user) {
      return;
    }

    let cancelled = false;

    const seedPendingProfile = async () => {
      try {
        const storedTokens = await getFreshStoredTokens();
        if (!storedTokens) {
          console.warn(
            '[AppNavigator] No stored tokens available to resume pending profile.',
          );
          return;
        }

        if (isTokenExpired(storedTokens.expiresAt ?? undefined)) {
          console.warn(
            '[AppNavigator] Stored tokens are expired; skipping pending profile seeding.',
          );
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
        console.warn(
          '[AppNavigator] Failed to seed pending profile for incomplete account',
          error,
        );
      }
    };

    seedPendingProfile();

    return () => {
      cancelled = true;
    };
  }, [pendingProfile, isLoggedIn, isProfileComplete, user]);

  const handleOnboardingComplete = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
    } catch (error) {
      console.error('Error saving onboarding status:', error);
    } finally {
      _showOnboarding = false;
      _notifyOnboarding();
    }
  };

  const isNavigatorLoading = isLoading || authLoading;
  useEffect(() => {
    if (isNavigatorLoading) {
      showLoader();
    } else {
      hideLoader();
    }
  }, [hideLoader, isNavigatorLoading, showLoader]);

  if (isNavigatorLoading) {
    return null;
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
};

const AppNavigatorEmergencySheet: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const dispatch = useDispatch<AppDispatch>();
  const emergencySheetRef = React.useRef<any>(null);
  const {setEmergencySheetRef} = useEmergency();

  // Get selected companion ID from Redux
  const selectedCompanionId = useSelector(selectSelectedCompanionId);
  const linkedHospitals = useSelector((state: RootState) =>
    selectLinkedHospitalsForCompanion(state, selectedCompanionId ?? null),
  );

  const [hospitalPhone, setHospitalPhone] = React.useState<string | null>(null);
  const primaryHospital = React.useMemo(() => {
    if (!linkedHospitals?.length) {
      return null;
    }
    return linkedHospitals.reduce((latest, hospital) => {
      const latestTime = new Date(
        latest.updatedAt ?? latest.createdAt ?? 0,
      ).getTime();
      const hospitalTime = new Date(
        hospital.updatedAt ?? hospital.createdAt ?? 0,
      ).getTime();
      return hospitalTime > latestTime ? hospital : latest;
    }, linkedHospitals[0]);
  }, [linkedHospitals]);

  React.useEffect(() => {
    if (emergencySheetRef.current) {
      setEmergencySheetRef(emergencySheetRef);
    }
  }, [setEmergencySheetRef]);

  const fetchHospitalPhone = React.useCallback(async () => {
    if (!primaryHospital) {
      setHospitalPhone(null);
      return null;
    }
    if (primaryHospital.phone?.trim()) {
      const trimmed = primaryHospital.phone.trim();
      setHospitalPhone(trimmed);
      return trimmed;
    }
    const placeId =
      primaryHospital.placeId ??
      (primaryHospital as any)?.googlePlacesId ??
      (primaryHospital as any)?.organisation?.googlePlacesId;
    if (!placeId) {
      setHospitalPhone(null);
      return null;
    }
    try {
      const details = await dispatch(fetchBusinessDetails(placeId)).unwrap();
      const phoneNumber = details?.phoneNumber?.trim() ?? null;
      setHospitalPhone(phoneNumber);
      return phoneNumber;
    } catch (error) {
      console.warn('[AppNavigator] Failed to fetch hospital phone', error);
      setHospitalPhone(null);
      return null;
    }
  }, [dispatch, primaryHospital]);

  React.useEffect(() => {
    fetchHospitalPhone();
  }, [fetchHospitalPhone]);

  const tryOpenDialer = React.useCallback(async (url: string) => {
    try {
      await Linking.openURL(url);
      return true;
    } catch (error) {
      console.warn('[AppNavigator] Dialer open failed', {url, error});
      return false;
    }
  }, []);

  const handleCallVet = React.useCallback(async () => {
    if (!primaryHospital) {
      Alert.alert(
        'Hospital not linked',
        'Link a hospital to quickly call your vet.',
      );
      return;
    }
    const phone = hospitalPhone ?? (await fetchHospitalPhone());
    if (!phone) {
      Alert.alert(
        'Contact unavailable',
        'We could not find a phone number for your linked hospital.',
      );
      return;
    }
    const normalizedPhone = phone.replaceAll(/[^\d+]/g, '');
    if (!normalizedPhone) {
      Alert.alert(
        'Contact unavailable',
        'The hospital phone number seems invalid. Please update it and try again.',
      );
      return;
    }
    const telUrl = `tel:${normalizedPhone}`;
    const telPromptUrl = `telprompt:${normalizedPhone}`;
    const opened =
      (await tryOpenDialer(telUrl)) || (await tryOpenDialer(telPromptUrl));
    if (!opened) {
      Alert.alert(
        'Dialer unavailable',
        `Please call this number manually: ${normalizedPhone}`,
      );
    }
  }, [fetchHospitalPhone, hospitalPhone, primaryHospital, tryOpenDialer]);

  const handleAdverseEvent = React.useCallback(() => {
    console.log(
      '[AppNavigator] Adverse event clicked - navigating to AdverseEvent',
    );
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
  const {user, isLoggedIn, isLoading} = useAuth();
  const allPendingInvites = useSelector(
    (state: RootState) => (state as any)?.coParent?.pendingInvites ?? [],
  );
  // Only show invites where the current user is the recipient, not the sender.
  // The API may return invites from both perspectives; filter out any where
  // invitedBy.id matches the current user's parentId (they sent it, not received it).
  const pendingInvites = React.useMemo(
    () =>
      allPendingInvites.filter(
        (invite: any) =>
          !invite.invitedBy?.id ||
          (invite.invitedBy.id !== user?.parentId &&
            invite.invitedBy.id !== user?.id),
      ),
    [allPendingInvites, user?.id, user?.parentId],
  );
  const [currentInviteIndex, setCurrentInviteIndex] = React.useState(0);
  const sheetRef = React.useRef<CoParentInviteBottomSheetRef>(null);
  const isProfileComplete = React.useMemo(
    () => Boolean(user?.parentId || user?.profileCompleted),
    [user],
  );

  React.useEffect(() => {
    if (!isLoggedIn || isLoading || !user?.id || !isProfileComplete) {
      sheetRef.current?.close();
      return;
    }
    dispatch(fetchPendingInvites());
  }, [dispatch, isLoggedIn, isLoading, isProfileComplete, user?.id]);

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
            companionIds: invite.companion?.id
              ? [invite.companion.id]
              : undefined,
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
        (`${currentInvite?.invitedBy?.firstName ?? ''} ${currentInvite?.invitedBy?.lastName ?? ''}`.trim() ||
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
      setNetworkSheetRef(
        sheetRef as React.RefObject<{open: () => void; close: () => void}>,
      );
    }
  }, [setNetworkSheetRef]);

  return <NetworkStatusBottomSheet ref={sheetRef} />;
};
