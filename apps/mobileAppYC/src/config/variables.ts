// Central place to hold URLs and other auth-related configuration for the
// React Native CLI app.
//
// IMPORTANT FOR DEVELOPERS:
// ------------------------
// For local development with real credentials:
// 1. Copy this file to variables.local.ts
// 2. Add your real API keys and credentials to variables.local.ts
// 3. The variables.local.ts file is gitignored and will be used automatically
//
// This file contains safe default/test values and is committed to git so that
// CI/CD pipelines and other developers can run tests without real credentials.

export interface PasswordlessAuthConfig {
  profileServiceUrl: string;
  createAccountUrl: string;
  profileBootstrapUrl: string;
  googleWebClientId: string;
  facebookAppId: string;
  appleServiceId: string;
  appleRedirectUri: string;
}

export interface GooglePlacesConfig {
  apiKey: string;
}

export interface ApiConfig {
  baseUrl: string;
  timeoutMs: number;
  /**
   * Optional secondary base for PMS endpoints if they live on a different host (e.g. devapi).
   * Falls back to baseUrl when not provided.
   */
  pmsBaseUrl?: string;
}

export interface StreamChatConfig {
  apiKey: string;
}

export interface StripeConfig {
  publishableKey: string;
  merchantIdentifier?: string;
  merchantDisplayName?: string;
  urlScheme?: string;
}

export interface AuthFeatureFlags {
  enableReviewLogin: boolean;
}

export interface DemoLoginConfig {
  email?: string;
  password?: string;
}

export interface UiFeatureFlags {
  /**
   * Forces a 1px black outline on all liquid glass surfaces (cards/buttons) to aid visibility.
   */
  forceLiquidGlassBorder: boolean;
}

// Default/test configuration (safe for CI/CD)
const DEFAULT_PASSWORDLESS_AUTH_CONFIG: PasswordlessAuthConfig = {
  profileServiceUrl: '',
  createAccountUrl: '',
  profileBootstrapUrl: '',
  googleWebClientId: '',
  facebookAppId: '',
  appleServiceId: 'com.yourAppName.mobile.auth',
  appleRedirectUri: 'https://yourDomain.firebaseapp.com/__/auth/handler',
};

const DEFAULT_GOOGLE_PLACES_CONFIG: GooglePlacesConfig = {
  apiKey: '',
};

const DEFAULT_API_CONFIG: ApiConfig = {
  // Default to cloud dev API; override in variables.local.ts for other envs
  baseUrl: 'https://devapi.yosemitecrew.com',
  timeoutMs: 15000,
  pmsBaseUrl: 'https://devapi.yosemitecrew.com',
};

const DEFAULT_STREAM_CHAT_CONFIG: StreamChatConfig = {
  apiKey: '', // Add your Stream API key in variables.local.ts
};

const DEFAULT_STRIPE_CONFIG: StripeConfig = {
  publishableKey: '',
  merchantIdentifier: undefined,
  merchantDisplayName: undefined,
  urlScheme: 'yosemitecrew',
};

const DEFAULT_AUTH_FEATURE_FLAGS: AuthFeatureFlags = {
  enableReviewLogin: true,
};

const DEFAULT_DEMO_LOGIN_CONFIG: DemoLoginConfig = {
  email: '',
  password: '',
};

const DEFAULT_UI_FEATURE_FLAGS: UiFeatureFlags = {
  forceLiquidGlassBorder: false,
};

let passwordlessOverrides: Partial<PasswordlessAuthConfig> | undefined;
let googlePlacesOverrides: Partial<GooglePlacesConfig> | undefined;
let apiOverrides: Partial<ApiConfig> | undefined;
let streamChatOverrides: Partial<StreamChatConfig> | undefined;
let stripeOverrides: Partial<StripeConfig> | undefined;
let authFlagsOverrides: Partial<AuthFeatureFlags> | undefined;
let demoLoginOverrides: Partial<DemoLoginConfig> | undefined;
let uiFlagsOverrides: Partial<UiFeatureFlags> | undefined;

const isMissingLocalVariablesModule = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as Partial<NodeJS.ErrnoException> & {message?: string};
  if (candidate.code !== 'MODULE_NOT_FOUND') {
    return false;
  }

  return typeof candidate.message === 'string' && candidate.message.includes('variables.local');
};

// Try to load local configuration if it exists (for development)
try {
  // @ts-ignore - dynamic require for optional local config
  const localConfig = require('./variables.local');
  if (localConfig.PASSWORDLESS_AUTH_CONFIG) {
    passwordlessOverrides = localConfig.PASSWORDLESS_AUTH_CONFIG;
  }
  if (localConfig.GOOGLE_PLACES_CONFIG) {
    googlePlacesOverrides = localConfig.GOOGLE_PLACES_CONFIG;
  }
  if (localConfig.API_CONFIG) {
    apiOverrides = localConfig.API_CONFIG;
  }
  if (localConfig.STREAM_CHAT_CONFIG) {
    streamChatOverrides = localConfig.STREAM_CHAT_CONFIG;
  }
  if (localConfig.STRIPE_CONFIG) {
    stripeOverrides = localConfig.STRIPE_CONFIG;
  }
  if (localConfig.AUTH_FEATURE_FLAGS) {
    authFlagsOverrides = localConfig.AUTH_FEATURE_FLAGS;
  }
  if (localConfig.DEMO_LOGIN_CONFIG) {
    demoLoginOverrides = localConfig.DEMO_LOGIN_CONFIG;
  }
  if (localConfig.UI_FEATURE_FLAGS) {
    uiFlagsOverrides = localConfig.UI_FEATURE_FLAGS;
  }
} catch (error) {
  if (isMissingLocalVariablesModule(error)) {
    // No local config file found, using defaults (this is expected in CI/CD)
    if (process.env.NODE_ENV !== 'test' && process.env.CI !== 'true') {
      console.warn(
        'No variables.local.ts found. Using default configuration. ' +
        'For local development, copy variables.ts to variables.local.ts and add your credentials.',
      );
    }
  } else {
    throw error;
  }
}

export const PASSWORDLESS_AUTH_CONFIG: PasswordlessAuthConfig = {
  ...DEFAULT_PASSWORDLESS_AUTH_CONFIG,
  ...passwordlessOverrides,
};

export const GOOGLE_PLACES_CONFIG: GooglePlacesConfig = {
  ...DEFAULT_GOOGLE_PLACES_CONFIG,
  ...googlePlacesOverrides,
};

export const API_CONFIG: ApiConfig = {
  ...DEFAULT_API_CONFIG,
  ...apiOverrides,
};

export const STREAM_CHAT_CONFIG: StreamChatConfig = {
  ...DEFAULT_STREAM_CHAT_CONFIG,
  ...streamChatOverrides,
};

export const STRIPE_CONFIG: StripeConfig = {
  ...DEFAULT_STRIPE_CONFIG,
  ...stripeOverrides,
};

export const AUTH_FEATURE_FLAGS: AuthFeatureFlags = {
  ...DEFAULT_AUTH_FEATURE_FLAGS,
  ...authFlagsOverrides,
};

export const DEMO_LOGIN_CONFIG: DemoLoginConfig = {
  ...DEFAULT_DEMO_LOGIN_CONFIG,
  ...demoLoginOverrides,
};

export const UI_FEATURE_FLAGS: UiFeatureFlags = {
  ...DEFAULT_UI_FEATURE_FLAGS,
  ...uiFlagsOverrides,
};

export const PENDING_PROFILE_STORAGE_KEY = '@pending_profile_payload';
export const PENDING_PROFILE_UPDATED_EVENT = 'pendingProfileUpdated';
