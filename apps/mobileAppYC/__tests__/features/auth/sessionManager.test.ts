// Mock dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('@/services/auth/tokenStorage');
jest.mock('@/services/profile/profileService');
jest.mock('@react-native-firebase/auth', () => ({
  getAuth: jest.fn(() => ({
    currentUser: null,
  })),
}));
jest.mock('aws-amplify/auth', () => ({
  fetchAuthSession: jest.fn(),
  fetchUserAttributes: jest.fn(),
  getCurrentUser: jest.fn(),
}));
jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(() => ({remove: jest.fn()})),
  },
}));

describe('sessionManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    const sessionManager = require('@/features/auth/sessionManager');
    expect(sessionManager).toBeDefined();
  });

  it('should export persistUserData function', () => {
    const {persistUserData} = require('@/features/auth/sessionManager');
    expect(typeof persistUserData).toBe('function');
  });

  it('should export clearSessionData function', () => {
    const {clearSessionData} = require('@/features/auth/sessionManager');
    expect(typeof clearSessionData).toBe('function');
  });

  it('should export markAuthRefreshed function', () => {
    const {markAuthRefreshed} = require('@/features/auth/sessionManager');
    expect(typeof markAuthRefreshed).toBe('function');
  });

  it('should export resetAuthLifecycle function', () => {
    const {resetAuthLifecycle} = require('@/features/auth/sessionManager');
    expect(typeof resetAuthLifecycle).toBe('function');
  });

  it('should export persistSessionData function', () => {
    const {persistSessionData} = require('@/features/auth/sessionManager');
    expect(typeof persistSessionData).toBe('function');
  });

  it('should export registerAppStateListener function', () => {
    const {registerAppStateListener} = require('@/features/auth/sessionManager');
    expect(typeof registerAppStateListener).toBe('function');
  });

  it('should export scheduleSessionRefresh function', () => {
    const {scheduleSessionRefresh} = require('@/features/auth/sessionManager');
    expect(typeof scheduleSessionRefresh).toBe('function');
  });

  it('should export recoverAuthSession function', () => {
    const {recoverAuthSession} = require('@/features/auth/sessionManager');
    expect(typeof recoverAuthSession).toBe('function');
  });
});
