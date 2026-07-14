// Copy this file to apps/mobileAppYC/src/config/variables.local.ts.
// variables.local.ts is gitignored; never commit real service keys.

const USE_DEV_API = true;

export const ENVIRONMENT_CONFIG = {
  appEnv: USE_DEV_API ? ('development' as const) : ('production' as const),
};

export const MOBILE_CONFIG_BEHAVIOR = {
  skipRemoteFetch: false,
  useDevApi: USE_DEV_API,
  mockAppUpdateFlow: 'off' as const,
  overrides: {
    apiBaseUrl: undefined,
    pmsBaseUrl: undefined,
    mobileConfigUrl: undefined,
    stripePublishableKey: undefined,
    forceLiquidGlassBorder: undefined,
    enableReviewLogin: undefined,
  },
};

export const PASSWORDLESS_AUTH_CONFIG = {
  profileServiceUrl: '',
  createAccountUrl: '',
  profileBootstrapUrl: '',
  googleWebClientId: '',
  facebookAppId: '',
  appleServiceId: 'com.yourAppName.mobile.auth',
  appleRedirectUri: 'https://yourDomain.firebaseapp.com/__/auth/handler',
};

export const GOOGLE_PLACES_CONFIG = {
  apiKey: '',
};

export const STREAM_CHAT_CONFIG = {
  apiKey: '',
};

export const STRIPE_CONFIG = {
  publishableKey: '',
  merchantIdentifier: undefined,
  merchantDisplayName: 'Yosemite Crew',
  urlScheme: 'yosemitecrew',
};

export const AUTH_FEATURE_FLAGS = {
  enableReviewLogin: false,
};

export const DEMO_LOGIN_CONFIG = {
  email: '',
  password: '',
};

export const UI_FEATURE_FLAGS = {
  forceLiquidGlassBorder: false,
};

export const POSTHOG_CONFIG = {
  apiKey: '',
  captureScreens: true,
  defaultOptIn: false,
  enableSessionReplay: false,
  enabled: false,
  host: 'https://eu.i.posthog.com',
};
