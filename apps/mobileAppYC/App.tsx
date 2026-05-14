/* eslint-disable react-native/no-inline-styles */
/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {StatusBar, LogBox, Linking} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import devOutputs from './devamplify_outputs.json';
import prodOutputs from './prodamplify_outputs.json';
import {StripeProvider} from '@stripe/stripe-react-native';
import {Amplify} from 'aws-amplify';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {AuthProvider, useAuth} from '@/features/auth/context/AuthContext';
import {configureSocialProviders} from '@/features/auth/services/socialAuth';
import {ErrorBoundary} from '@/shared/components/common/ErrorBoundary';
import {PreferencesProvider} from '@/features/preferences/PreferencesContext';
import {GlobalLoaderProvider} from '@/context/GlobalLoaderContext';
import {BottomFadeOverlay} from '@/shared/components/common';
import {
  initializeNotifications,
  type NotificationNavigationIntent,
} from '@/shared/services/firebaseNotifications';
import {
  fetchMobileConfig,
  type MobileConfig,
} from '@/shared/services/mobileConfig';
import {
  registerDeviceToken,
  unregisterDeviceToken,
} from '@/shared/services/deviceTokenRegistry';
import {useAppDispatch} from '@/app/hooks';
import type {RootStackParamList} from '@/navigation/types';
import {
  API_CONFIG,
  AUTH_FEATURE_FLAGS,
  MOBILE_CONFIG_BEHAVIOR,
  POSTHOG_CONFIG,
  STRIPE_CONFIG,
  UI_FEATURE_FLAGS,
} from '@/config/variables';
import {updateApiClientBaseConfig} from '@/shared/services/apiClient';
import {observationToolApi} from '@/features/observationalTools/services/observationToolService';
import AppUpdateBottomSheet, {
  AppUpdateBottomSheetRef,
} from '@/features/appUpdate/components/AppUpdateBottomSheet';
import {
  AppUpdatePrompt,
  evaluateAppUpdatePrompt,
  getCurrentAppIdentity,
  shouldShowOptionalPrompt,
} from '@/features/appUpdate/services/appUpdatePolicy';
import {
  initializePostHog,
  trackPostHogScreen,
} from '@/shared/services/posthogAnalytics';

Amplify.configure(MOBILE_CONFIG_BEHAVIOR.useDevApi ? devOutputs : prodOutputs);

LogBox.ignoreLogs([
  'This method is deprecated (as well as all React Native Firebase namespaced API)',
]);

const coerceBooleanFlag = (
  value: boolean | string | null | undefined,
): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }
  }
  return false;
};

const PRODUCTION_API_BASE_URL = 'https://api.yosemitecrew.com';

const applyMockAppUpdateFlow = (
  config: MobileConfig,
  mode: 'off' | 'optional' | 'required',
): MobileConfig => {
  if (mode === 'off') {
    return config;
  }

  const basePolicy =
    mode === 'required'
      ? {
          force: true,
          minimumSupportedVersion: '99.0.0',
          minimumSupportedBuildNumber: 99999,
          title: 'Update required',
          message: 'Please update the app to continue.',
        }
      : {
          enabled: true,
          latestVersion: '99.0.0',
          latestBuildNumber: 99999,
          remindAfterHours: 1,
          title: 'Update available',
          message: 'A newer version is ready to install.',
        };

  return {
    ...config,
    appUpdate: {
      ...basePolicy,
      ios: {
        ...basePolicy,
        storeUrl: 'https://apps.apple.com/in/app/yosemite-crew/id6756180296',
      },
      android: {
        ...basePolicy,
        storeUrl:
          'https://play.google.com/store/apps/details?id=com.mobileappyc',
      },
    },
  };
};

const OPTIONAL_UPDATE_LAST_PROMPTED_AT_KEY =
  '@app_update_optional_last_prompted_at';

// const noop = () => {};
// console.log = noop;
// console.info = noop;
// console.debug = noop;
// console.trace = noop;

function App(): React.JSX.Element {
  const [isSplashVisible, setIsSplashVisible] = useState(true);
  const [mobileConfig, setMobileConfig] = useState<MobileConfig | null>(null);
  const [appUpdatePrompt, setAppUpdatePrompt] =
    useState<AppUpdatePrompt | null>(null);
  const [isConfigLoading, setIsConfigLoading] = useState(true);
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const pendingIntentRef = useRef<NotificationNavigationIntent | null>(null);
  const currentRouteNameRef = useRef<string | null>(null);

  useEffect(() => {
    configureSocialProviders();
  }, []);

  useEffect(() => {
    if (!POSTHOG_CONFIG.enabled) {
      return;
    }

    initializePostHog();
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadMobileConfig = async () => {
      try {
        let config: MobileConfig = {
          env: 'production',
          enablePayments: false,
        };

        if (!MOBILE_CONFIG_BEHAVIOR.skipRemoteFetch) {
          config = await fetchMobileConfig();
        }

        // Apply local overrides on top of remote config (field is `overrides`, not `override`)
        if (
          MOBILE_CONFIG_BEHAVIOR.overrides &&
          Object.keys(MOBILE_CONFIG_BEHAVIOR.overrides).length > 0
        ) {
          const {
            enableReviewLogin: overrideReviewLogin,
            apiBaseUrl: overrideApiBaseUrl,
            pmsBaseUrl: overridePmsBaseUrl,
            mobileConfig: overrideMobileConfig,
            stripePublishableKey: overrideStripeKey,
            forceLiquidGlassBorder: overrideGlassBorder,
          } = MOBILE_CONFIG_BEHAVIOR.overrides;

          if (overrideMobileConfig) {
            config = {...config, ...overrideMobileConfig};
          }
          if (overrideStripeKey !== undefined) {
            config = {...config, stripePublishableKey: overrideStripeKey};
          }
          if (overrideGlassBorder !== undefined) {
            config = {...config, forceLiquidGlassBorder: overrideGlassBorder};
          }
          if (overrideReviewLogin !== undefined) {
            config = {...config, enableReviewLogin: overrideReviewLogin};
          }
          if (
            overrideApiBaseUrl !== undefined ||
            overridePmsBaseUrl !== undefined
          ) {
            // These are applied below when resolving the base URL
          }
        }

        config = applyMockAppUpdateFlow(
          config,
          MOBILE_CONFIG_BEHAVIOR.mockAppUpdateFlow,
        );

        console.log('[MobileConfig] Effective runtime config', {
          skipRemoteFetch: MOBILE_CONFIG_BEHAVIOR.skipRemoteFetch,
          useDevApi: MOBILE_CONFIG_BEHAVIOR.useDevApi,
          mockAppUpdateFlow: MOBILE_CONFIG_BEHAVIOR.mockAppUpdateFlow,
          env: config.env,
          enableReviewLogin: config.enableReviewLogin,
          hasAppUpdate: Boolean(config.appUpdate),
          appUpdate: config.appUpdate,
        });

        if (mounted) {
          // Priority: local override apiBaseUrl > useDevApi flag > env from remote config
          let resolvedBaseUrl: string;
          if (MOBILE_CONFIG_BEHAVIOR.overrides?.apiBaseUrl) {
            resolvedBaseUrl = MOBILE_CONFIG_BEHAVIOR.overrides.apiBaseUrl;
          } else if (MOBILE_CONFIG_BEHAVIOR.useDevApi) {
            resolvedBaseUrl = 'https://devapi.yosemitecrew.com';
          } else {
            resolvedBaseUrl = PRODUCTION_API_BASE_URL;
          }

          const resolvedPmsUrl =
            MOBILE_CONFIG_BEHAVIOR.overrides?.pmsBaseUrl ?? resolvedBaseUrl;

          API_CONFIG.baseUrl = resolvedBaseUrl;
          API_CONFIG.pmsBaseUrl = resolvedPmsUrl;
          updateApiClientBaseConfig({
            baseUrl: resolvedBaseUrl,
            timeoutMs: API_CONFIG.timeoutMs,
          });
          console.log('[API] Runtime base URL applied', {
            baseUrl: resolvedBaseUrl,
            useDevApi: MOBILE_CONFIG_BEHAVIOR.useDevApi,
          });

          // enableReviewLogin: remote config wins; local variables.local.ts override applies via
          // MOBILE_CONFIG_BEHAVIOR.overrides.enableReviewLogin (set above). Never silently kill it.
          if (config.enableReviewLogin !== undefined) {
            AUTH_FEATURE_FLAGS.enableReviewLogin = coerceBooleanFlag(
              config.enableReviewLogin,
            );
          }
          // If remote didn't send enableReviewLogin at all, keep whatever variables.ts default was.

          UI_FEATURE_FLAGS.forceLiquidGlassBorder = coerceBooleanFlag(
            config.forceLiquidGlassBorder ??
              UI_FEATURE_FLAGS.forceLiquidGlassBorder,
          );

          // console.log('[MobileConfig] Applied config', {
          //   env: config.env,
          //   baseUrl: API_CONFIG.baseUrl,
          //   enableReviewLogin: AUTH_FEATURE_FLAGS.enableReviewLogin,
          //   forceLiquidGlassBorder: UI_FEATURE_FLAGS.forceLiquidGlassBorder,
          //   stripeKeyPresent: Boolean(config.stripePublishableKey),
          // });

          setMobileConfig(config);

          const {currentVersion, currentBuildNumber, bundleId} =
            getCurrentAppIdentity();
          const evaluatedPrompt = evaluateAppUpdatePrompt(
            config,
            currentVersion,
            currentBuildNumber,
            bundleId,
          );

          console.log('[AppUpdate] Prompt evaluation', {
            currentVersion,
            currentBuildNumber,
            bundleId,
            evaluatedPrompt,
          });

          if (evaluatedPrompt?.kind === 'optional') {
            const lastPromptedAt = await AsyncStorage.getItem(
              OPTIONAL_UPDATE_LAST_PROMPTED_AT_KEY,
            );
            const shouldBypassDeferral =
              MOBILE_CONFIG_BEHAVIOR.mockAppUpdateFlow === 'optional';
            const shouldShow =
              shouldBypassDeferral ||
              shouldShowOptionalPrompt(
                lastPromptedAt,
                evaluatedPrompt.remindAfterHours,
              );
            console.log('[AppUpdate] Optional prompt visibility', {
              lastPromptedAt,
              remindAfterHours: evaluatedPrompt.remindAfterHours,
              shouldBypassDeferral,
              shouldShow,
            });
            setAppUpdatePrompt(shouldShow ? evaluatedPrompt : null);
          } else {
            setAppUpdatePrompt(evaluatedPrompt);
          }
        }
      } catch (error) {
        if (mounted) {
          console.warn('[MobileConfig] Failed to fetch config', error);
        }
      } finally {
        if (mounted) {
          setIsConfigLoading(false);
        }
      }
    };

    loadMobileConfig();

    return () => {
      mounted = false;
    };
  }, []);

  const resolvedPublishableKey =
    mobileConfig?.stripePublishableKey ?? STRIPE_CONFIG.publishableKey;

  useEffect(() => {
    if (!resolvedPublishableKey && !isConfigLoading) {
      console.warn(
        '[Stripe] Missing publishableKey from mobile config API and local config.',
      );
    }
  }, [isConfigLoading, resolvedPublishableKey]);

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
    const routeName = navigationRef.getCurrentRoute()?.name;
    if (!routeName || currentRouteNameRef.current === routeName) {
      return;
    }
    currentRouteNameRef.current = routeName;
    trackPostHogScreen(routeName).catch(error =>
      console.warn('[PostHog] Failed to track screen on ready', error),
    );
  }, [navigationRef]);

  const handleNavigationStateChange = useCallback(() => {
    const routeName = navigationRef.getCurrentRoute()?.name;
    if (!routeName || currentRouteNameRef.current === routeName) {
      return;
    }
    currentRouteNameRef.current = routeName;
    trackPostHogScreen(routeName).catch(error =>
      console.warn('[PostHog] Failed to track screen change', error),
    );
  }, [navigationRef]);

  const handleOptionalUpdateDeferred = useCallback(async () => {
    try {
      await AsyncStorage.setItem(
        OPTIONAL_UPDATE_LAST_PROMPTED_AT_KEY,
        new Date().toISOString(),
      );
    } catch (error) {
      console.warn(
        '[AppUpdate] Failed to persist optional update deferral',
        error,
      );
    } finally {
      setAppUpdatePrompt(currentPrompt =>
        currentPrompt?.kind === 'optional' ? null : currentPrompt,
      );
    }
  }, []);

  if (isSplashVisible) {
    return <CustomSplashScreen onAnimationEnd={handleSplashAnimationEnd} />;
  }

  if (isConfigLoading) {
    return <CustomSplashScreen onAnimationEnd={handleSplashAnimationEnd} />;
  }

  return (
    <Provider store={store}>
      <PersistGate
        loading={<CustomSplashScreen onAnimationEnd={() => {}} />}
        persistor={persistor}>
        <GestureHandlerRootView style={{flex: 1}}>
          <SafeAreaProvider>
            <AuthProvider>
              <PreferencesProvider>
                <GlobalLoaderProvider>
                  <AppUpdateGate
                    prompt={appUpdatePrompt}
                    onDeferred={handleOptionalUpdateDeferred}>
                    <NotificationBootstrap
                      onNavigate={handleNotificationNavigation}>
                      <StripeProvider
                        publishableKey={resolvedPublishableKey ?? ''}
                        urlScheme={STRIPE_CONFIG.urlScheme}>
                        <NavigationContainer
                          ref={navigationRef}
                          onReady={handleNavigationReady}
                          onStateChange={handleNavigationStateChange}>
                          <AppContent />
                        </NavigationContainer>
                      </StripeProvider>
                    </NotificationBootstrap>
                  </AppUpdateGate>
                </GlobalLoaderProvider>
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
      <BottomFadeOverlay height={30} intensity="medium" bottomOffset={0} />
    </>
  );
}

export default App;

type AppUpdateGateProps = {
  prompt: AppUpdatePrompt | null;
  onDeferred: () => void;
  children: React.ReactNode;
};

const AppUpdateGate: React.FC<AppUpdateGateProps> = ({
  prompt,
  onDeferred,
  children,
}) => {
  const updateSheetRef = useRef<AppUpdateBottomSheetRef>(null);

  useEffect(() => {
    console.log('[AppUpdate] Gate state', {
      kind: prompt?.kind ?? null,
      hasStoreUrl: Boolean(prompt?.storeUrl),
    });
    if (!prompt) return;
    if (prompt.kind === 'required') {
      return;
    }
    if (
      prompt.kind === 'optional' &&
      MOBILE_CONFIG_BEHAVIOR.mockAppUpdateFlow === 'optional'
    ) {
      return;
    }

    let cancelled = false;
    let retries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const maxRetries = 8;
    const retryIntervalMs = 80;

    const tryOpenSheet = () => {
      if (cancelled) return;

      const ref = updateSheetRef.current;
      if (ref) {
        console.log('[AppUpdate] Opening update sheet', {
          kind: prompt.kind,
          retry: retries,
        });
        ref.open();
        return;
      }

      retries += 1;
      if (retries >= maxRetries) {
        console.warn(
          '[AppUpdate] Failed to open update sheet: ref unavailable',
        );
        return;
      }

      timer = setTimeout(tryOpenSheet, retryIntervalMs);
    };

    timer = setTimeout(tryOpenSheet, 0);

    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [prompt]);

  return (
    <>
      {children}
      {prompt ? (
        <AppUpdateBottomSheet
          ref={updateSheetRef}
          prompt={prompt}
          initialOpen={
            prompt.kind === 'optional' &&
            MOBILE_CONFIG_BEHAVIOR.mockAppUpdateFlow === 'optional'
          }
          onDeferred={onDeferred}
        />
      ) : null}
    </>
  );
};

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
  const lastRegisteredRef = useRef<{userId: string; token: string} | null>(
    null,
  );
  const authStatusRef = useRef<{isLoggedIn: boolean; userId: string | null}>({
    isLoggedIn,
    userId: user?.parentId ?? user?.id ?? null,
  });

  const currentUserId = user?.parentId ?? user?.id ?? null;

  const syncRegisterToken = useCallback(async (token: string) => {
    const userId = authStatusRef.current.userId;
    if (!userId) {
      return;
    }
    await registerDeviceToken({userId, token});
    lastRegisteredRef.current = {userId, token};
  }, []);

  const syncUnregisterToken = useCallback(async () => {
    const last = lastRegisteredRef.current;
    if (!last) {
      return;
    }
    await unregisterDeviceToken(last);
    lastRegisteredRef.current = null;
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    const preloadTools = async () => {
      try {
        await observationToolApi.list({onlyActive: true});
      } catch (error) {
        console.warn('[ObservationTools] Failed to preload tools', error);
      }
    };
    preloadTools();
  }, [isLoggedIn]);

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
            // console.log('[Notifications] FCM token updated', token);
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
    navigationRef.navigate('Main', {
      screen: 'HomeStack',
      params: {
        screen: intent.stackScreen,
        params: intent.params,
      },
    } as never);
  }
}
