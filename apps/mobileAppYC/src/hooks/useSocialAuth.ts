import {useCallback, useRef, useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {DeviceEventEmitter} from 'react-native';
import {
  PENDING_PROFILE_STORAGE_KEY,
  PENDING_PROFILE_UPDATED_EVENT,
} from '@/config/variables';
import {signInWithSocialProvider, type SocialProvider} from '@/services/auth/socialAuth';
import type {AuthStackParamList} from '@/navigation/AuthNavigator';

type SocialAuthResult = Awaited<ReturnType<typeof signInWithSocialProvider>>;

interface UseSocialAuthOptions {
  onExistingProfile: (result: SocialAuthResult) => Promise<void> | void;
  onNewProfile: (
    payload: AuthStackParamList['CreateAccount'],
  ) => Promise<void> | void;
  onStart?: () => void;
  cancelledMessage?: string;
  genericErrorMessage: string;
}

interface UseSocialAuthReturn {
  activeProvider: SocialProvider | null;
  isSocialLoading: boolean;
  handleSocialAuth: (provider: SocialProvider) => Promise<void>;
}

const DEFAULT_CANCELLED_MESSAGE = 'Kindly retry.';

export const useSocialAuth = ({
  onExistingProfile,
  onNewProfile,
  onStart,
  cancelledMessage = DEFAULT_CANCELLED_MESSAGE,
  genericErrorMessage,
}: UseSocialAuthOptions): UseSocialAuthReturn => {
  const [activeProvider, setActiveProvider] = useState<SocialProvider | null>(null);
  const activeProviderRef = useRef<SocialProvider | null>(null);

  const updateActiveProvider = useCallback((provider: SocialProvider | null) => {
    activeProviderRef.current = provider;
    setActiveProvider(provider);
  }, []);

  const handleSocialAuth = useCallback(
    async (provider: SocialProvider) => {
      if (activeProviderRef.current) {
        return;
      }

      onStart?.();
      updateActiveProvider(provider);

      try {
        const result = await signInWithSocialProvider(provider);

        if (result.profile.exists) {
          await AsyncStorage.removeItem(PENDING_PROFILE_STORAGE_KEY);
          DeviceEventEmitter.emit(PENDING_PROFILE_UPDATED_EVENT);
          await onExistingProfile(result);
          return;
        }

        const createAccountPayload: AuthStackParamList['CreateAccount'] = {
          email: result.user.email,
          userId: result.user.id,
          profileToken: result.profile.profileToken,
          tokens: result.tokens,
          initialAttributes: {
            firstName: result.initialAttributes.firstName,
            lastName: result.initialAttributes.lastName,
            profilePicture: result.initialAttributes.profilePicture,
          },
        };

        await AsyncStorage.setItem(
          PENDING_PROFILE_STORAGE_KEY,
          JSON.stringify(createAccountPayload),
        );
        DeviceEventEmitter.emit(PENDING_PROFILE_UPDATED_EVENT);
        await onNewProfile(createAccountPayload);
      } catch (rawError) {
        const error = rawError as {code?: string; message?: string} | undefined;
        const message = String(error?.message ?? '');
        const isCancelled =
          error?.code === 'auth/cancelled' || /cancel/i.test(message);
        throw new Error(isCancelled ? cancelledMessage : genericErrorMessage);
      } finally {
        updateActiveProvider(null);
      }
    },
    [
      cancelledMessage,
      genericErrorMessage,
      onExistingProfile,
      onNewProfile,
      onStart,
      updateActiveProvider,
    ],
  );

  return {
    activeProvider,
    isSocialLoading: activeProvider !== null,
    handleSocialAuth,
  };
};

export type {SocialProvider} from '@/services/auth/socialAuth';
