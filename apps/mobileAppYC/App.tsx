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
import {Amplify} from 'aws-amplify';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '@/features/auth/context/AuthContext';
import {configureSocialProviders} from '@/features/auth/services/socialAuth';
import { ErrorBoundary } from '@/shared/components/common/ErrorBoundary';
import {
  initializeNotifications,
  type NotificationNavigationIntent,
} from '@/shared/services/firebaseNotifications';
import {useAppDispatch} from '@/app/hooks';
import type {RootStackParamList} from '@/navigation/types';

Amplify.configure(outputs);

LogBox.ignoreLogs([
  'This method is deprecated (as well as all React Native Firebase namespaced API)',
]);

function App(): React.JSX.Element {
  const [isSplashVisible, setIsSplashVisible] = useState(true);
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const pendingIntentRef = useRef<NotificationNavigationIntent | null>(null);

  useEffect(() => {
    configureSocialProviders();
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
              <NotificationBootstrap onNavigate={handleNotificationNavigation}>
                <NavigationContainer ref={navigationRef} onReady={handleNavigationReady}>
                  <AppContent />
                </NavigationContainer>
              </NotificationBootstrap>
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
          onTokenUpdate: token => {
            console.log('[Notifications] FCM token updated', token);
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
  }, [dispatch, onNavigate]);

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
    navigationRef.navigate(intent.root as keyof RootStackParamList);
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
