// Central place to hold URLs and other auth-related configuration for the
// React Native CLI app. Replace the empty strings with real endpoints or wire
// them up to your native config solution (e.g., react-native-config).
export const PASSWORDLESS_AUTH_CONFIG = {
  profileServiceUrl: '',
  createAccountUrl: '',
  profileBootstrapUrl: '',
  googleWebClientId: '',
  facebookAppId: '',
  appleServiceId: 'com.yourAppName.mobile.auth',  
  appleRedirectUri: 'https://yourDomain.firebaseapp.com/__/auth/handler', 
};
export const PENDING_PROFILE_STORAGE_KEY = '@pending_profile_payload';
export const PENDING_PROFILE_UPDATED_EVENT = 'pendingProfileUpdated';
