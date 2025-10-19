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

let passwordlessOverrides: Partial<PasswordlessAuthConfig> | undefined;
let googlePlacesOverrides: Partial<GooglePlacesConfig> | undefined;

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

export const PENDING_PROFILE_STORAGE_KEY = '@pending_profile_payload';
export const PENDING_PROFILE_UPDATED_EVENT = 'pendingProfileUpdated';
