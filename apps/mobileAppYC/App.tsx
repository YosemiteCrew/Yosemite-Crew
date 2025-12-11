/* eslint-disable react-native/no-inline-styles */
/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {StatusBar, LogBox, Linking} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {Provider} from 'react-redux';
import {PersistGate} from 'redux-persist/integration/react';
import {
  NavigationContainer,
  useNavigationContainerRef,
  type NavigationContainerRef,
} from '@react-navigation/native';
import {store, persistor} from '@/app/store';
import {AppNavigator} from './src/navigation';
import {useTheme} from './src/hooks';
import CustomSplashScreen from './src/shared/components/common/customSplashScreen/customSplash';
import './src/localization';
import outputs from './amplify_outputs.json';
import {StripeProvider} from '@stripe/stripe-react-native';
import {Amplify} from 'aws-amplify';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '@/features/auth/context/AuthContext';
import {configureSocialProviders} from '@/features/auth/services/socialAuth';
import { ErrorBoundary } from '@/shared/components/common/ErrorBoundary';
import { PreferencesProvider } from '@/features/preferences/PreferencesContext';
import {
  initializeNotifications,
  type NotificationNavigationIntent,
} from '@/shared/services/firebaseNotifications';
import {
  registerDeviceToken,
  unregisterDeviceToken,
} from '@/shared/services/deviceTokenRegistry';
import {useAppDispatch} from '@/app/hooks';
import type {RootStackParamList} from '@/navigation/types';
import {STRIPE_CONFIG} from '@/config/variables';

Amplify.configure(outputs);

LogBox.ignoreLogs([
  'This method is deprecated (as well as all React Native Firebase namespaced API)',
]);


  const noop = () => {};
  console.log = noop;
  console.info = noop;
  console.debug = noop;
  console.trace = noop;


function App(): React.JSX.Element {
  const [isSplashVisible, setIsSplashVisible] = useState(true);
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const pendingIntentRef = useRef<NotificationNavigationIntent | null>(null);

  useEffect(() => {
    configureSocialProviders();
  }, []);

  useEffect(() => {
    if (!STRIPE_CONFIG.publishableKey) {
      console.warn(
        '[Stripe] Missing publishableKey. Add STRIPE_CONFIG in variables.local.ts to enable payments.',
      );
    }
  }, []);

  const handleSplashAnimationEnd = () => {
    setIsSplashVisible(false);
  };

  const handleNotificationNavigation = useCallback(
    (intent: NotificationNavigationIntent) => {
      if (navigationRef.isReady()) {
        navigateFromNotificationIntent(navigationRef, intent);
      } else {
        pendingIntentRef.current = intent;
      }
    },
    [navigationRef],
  );

  const handleNavigationReady = useCallback(() => {
    if (pendingIntentRef.current && navigationRef.isReady()) {
      navigateFromNotificationIntent(navigationRef, pendingIntentRef.current);
      pendingIntentRef.current = null;
    }
  }, [navigationRef]);

  if (isSplashVisible) {
    return <CustomSplashScreen onAnimationEnd={handleSplashAnimationEnd} />;
  }

  return (
    <Provider store={store}>
      <PersistGate loading={<CustomSplashScreen onAnimationEnd={() => {}} />} persistor={persistor}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <AuthProvider>
              <PreferencesProvider>
                <NotificationBootstrap onNavigate={handleNotificationNavigation}>
                  <StripeProvider
                    publishableKey={STRIPE_CONFIG.publishableKey}
                    urlScheme={STRIPE_CONFIG.urlScheme}
                  >
                    <NavigationContainer ref={navigationRef} onReady={handleNavigationReady}>
                      <AppContent />
                    </NavigationContainer>
                  </StripeProvider>
                </NotificationBootstrap>
              </PreferencesProvider>
            </AuthProvider>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </PersistGate>
    </Provider>
  );
}

function AppContent(): React.JSX.Element {
  const {theme, isDark} = useTheme();

  return (
    <>
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor={theme.colors.background}
        />
        <ErrorBoundary>
          <AppNavigator />
        </ErrorBoundary>
    </>
  );
}

export default App;

type NotificationBootstrapProps = {
  children: React.ReactNode;
  onNavigate: (intent: NotificationNavigationIntent) => void;
};

const NotificationBootstrap: React.FC<NotificationBootstrapProps> = ({
  children,
  onNavigate,
}) => {
  const dispatch = useAppDispatch();
  const {isLoggedIn, user} = useAuth();
  const latestTokenRef = useRef<string | null>(null);
  const lastRegisteredRef = useRef<{userId: string; token: string} | null>(null);
  const authStatusRef = useRef<{isLoggedIn: boolean; userId: string | null}>({
    isLoggedIn,
    userId: user?.parentId ?? user?.id ?? null,
  });

  const currentUserId = user?.parentId ?? user?.id ?? null;

  const syncRegisterToken = useCallback(
    async (token: string) => {
      const userId = authStatusRef.current.userId;
      if (!userId) {
        return;
      }
      await registerDeviceToken({userId, token});
      lastRegisteredRef.current = {userId, token};
    },
    [],
  );

  const syncUnregisterToken = useCallback(async () => {
    const last = lastRegisteredRef.current;
    if (!last) {
      return;
    }
    await unregisterDeviceToken(last);
    lastRegisteredRef.current = null;
  }, []);

  useEffect(() => {
    let mounted = true;

    const setup = async () => {
      try {
        await initializeNotifications({
          dispatch,
          onNavigate: intent => {
            if (mounted) {
              onNavigate(intent);
            }
          },
          onTokenUpdate: async token => {
            console.log('[Notifications] FCM token updated', token);
            latestTokenRef.current = token;
            if (authStatusRef.current.isLoggedIn) {
              await syncRegisterToken(token);
            }
          },
        });
      } catch (error) {
        console.error('[Notifications] Initialization failed', error);
      }
    };

    setup();

    return () => {
      mounted = false;
    };
  }, [dispatch, onNavigate, syncRegisterToken]);

  useEffect(() => {
    authStatusRef.current = {isLoggedIn, userId: currentUserId};
    if (isLoggedIn && latestTokenRef.current) {
      syncRegisterToken(latestTokenRef.current);
    }

    if (!isLoggedIn) {
      syncUnregisterToken();
    }
  }, [currentUserId, isLoggedIn, syncRegisterToken, syncUnregisterToken]);

  return <>{children}</>;
};

function navigateFromNotificationIntent(
  navigationRef: NavigationContainerRef<RootStackParamList>,
  intent: NotificationNavigationIntent,
): void {
  if (!navigationRef.isReady()) {
    return;
  }

  if (intent.deepLink) {
    Linking.openURL(intent.deepLink).catch(error =>
      console.warn('[Notifications] Failed to open deep link', error),
    );
    return;
  }

  if (intent.root && intent.root !== 'Main') {
    navigationRef.navigate({
      name: intent.root as keyof RootStackParamList,
    } as never);
    return;
  }

  if (intent.tab) {
    const tabParams =
      intent.stackScreen != null
        ? {screen: intent.stackScreen, params: intent.params}
        : intent.params;

    navigationRef.navigate('Main', {
      screen: intent.tab,
      params: tabParams as never,
    } as never);
    return;
  }

  if (intent.stackScreen) {
    navigationRef.navigate(
      'Main',
      {
        screen: 'HomeStack',
        params: {
          screen: intent.stackScreen,
          params: intent.params,
        },
      } as never,
    );
  }
}
