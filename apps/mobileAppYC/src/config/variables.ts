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
let PASSWORDLESS_AUTH_CONFIG: PasswordlessAuthConfig = {
  profileServiceUrl: '',
  createAccountUrl: '',
  profileBootstrapUrl: '',
  googleWebClientId: '',
  facebookAppId: '',
  appleServiceId: 'com.yourAppName.mobile.auth',
  appleRedirectUri: 'https://yourDomain.firebaseapp.com/__/auth/handler',
};

let GOOGLE_PLACES_CONFIG: GooglePlacesConfig = {
  apiKey: '',
};

// Try to load local configuration if it exists (for development)
try {
  // @ts-ignore - dynamic require for optional local config
  const localConfig = require('./variables.local');
  if (localConfig.PASSWORDLESS_AUTH_CONFIG) {
    PASSWORDLESS_AUTH_CONFIG = localConfig.PASSWORDLESS_AUTH_CONFIG;
  }
  if (localConfig.GOOGLE_PLACES_CONFIG) {
    GOOGLE_PLACES_CONFIG = localConfig.GOOGLE_PLACES_CONFIG;
  }
} catch (error) {
  // No local config file found, using defaults (this is expected in CI/CD)
  if (process.env.NODE_ENV !== 'test' && process.env.CI !== 'true') {
    console.warn(
      'No variables.local.ts found. Using default configuration. ' +
      'For local development, copy variables.ts to variables.local.ts and add your credentials.'
    );
  }
}

export {PASSWORDLESS_AUTH_CONFIG, GOOGLE_PLACES_CONFIG};
export const PENDING_PROFILE_STORAGE_KEY = '@pending_profile_payload';
export const PENDING_PROFILE_UPDATED_EVENT = 'pendingProfileUpdated';
