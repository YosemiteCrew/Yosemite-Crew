// Note: The module is mocked in jest.setup.js. For these tests we unmock and require actual implementation.

// Mocks
const mockGoogle = {
  hasPlayServices: jest.fn().mockResolvedValue(true),
  signIn: jest.fn().mockResolvedValue({}),
  getTokens: jest.fn().mockResolvedValue({idToken: 'google-id-token'}),
  configure: jest.fn(),
};

const mockAuthUser = () => ({
  uid: 'uid-123',
  email: 'test@example.com',
  displayName: 'Ada Lovelace',
  photoURL: 'https://example.com/avatar.png',
  getIdToken: jest.fn().mockResolvedValue('id-jwt'),
  getIdTokenResult: jest.fn().mockResolvedValue({
    expirationTime: '2099-01-01T00:00:00.000Z',
  }),
});

// Mock uuid ESM to avoid transform issues
jest.mock('uuid', () => ({ v4: jest.fn(() => 'nonce-123') }));

const mockFirebaseAuth = {
  getIdToken: jest.fn(async user => user.getIdToken()),
  getIdTokenResult: jest.fn(async user => user.getIdTokenResult()),
  getAuth: jest.fn(() => ({ /* auth instance */ })),
  signInWithCredential: jest.fn(async (_auth, _cred) => ({
    user: mockAuthUser(),
  })),
  GoogleAuthProvider: { credential: jest.fn(token => ({ provider: 'google', token })) },
  FacebookAuthProvider: { credential: jest.fn((token, nonce) => ({ provider: 'facebook', token, nonce })) },
  AppleAuthProvider: { credential: jest.fn((token, nonce) => ({ provider: 'apple', token, nonce })) },
};
jest.mock('@react-native-firebase/auth', () => mockFirebaseAuth);

const mockSyncAuthUser = jest.fn();
jest.mock('@/features/auth/services/authUserService', () => ({
  syncAuthUser: (...args: any[]) => mockSyncAuthUser(...args),
}));

jest.mock('react-native-fbsdk-next', () => ({
  Settings: {
    setAppID: jest.fn(),
    initializeSDK: jest.fn(),
  },
  LoginManager: {
    logInWithPermissions: jest.fn(),
    logOut: jest.fn(),
  },
  AccessToken: {
    getCurrentAccessToken: jest.fn(),
  },
  AuthenticationToken: {
    getAuthenticationTokenIOS: jest.fn(),
  },
}));

// Mock Apple auth modules to avoid ESM issues
jest.mock('@invertase/react-native-apple-authentication', () => ({
  appleAuth: {
    performRequest: jest.fn(),
    Operation: { LOGIN: 'LOGIN' },
    Scope: { EMAIL: 'EMAIL', FULL_NAME: 'FULL_NAME' },
    Error: { CANCELED: 'CANCELED', FAILED: 'FAILED', INVALID_RESPONSE: 'INVALID_RESPONSE', NOT_HANDLED: 'NOT_HANDLED' },
  },
  appleAuthAndroid: {
    isSupported: true,
    configure: jest.fn(),
    signIn: jest.fn().mockResolvedValue({ id_token: 'id-token' }),
    ResponseType: { ALL: 'ALL' },
    Scope: { ALL: 'ALL' },
  },
}));

const defaultPasswordlessConfig = {
  profileServiceUrl: 'https://example.com/profile',
  createAccountUrl: 'https://example.com/create',
  profileBootstrapUrl: 'https://example.com/bootstrap',
  googleWebClientId: 'test-google-client-id',
  facebookAppId: 'test-facebook-app-id',
  appleServiceId: 'com.test.app',
  appleRedirectUri: 'https://test.firebaseapp.com/__/auth/handler',
};
const mockPasswordlessConfig = {...defaultPasswordlessConfig};
const mockApiConfig = {baseUrl: 'http://localhost:4000', timeoutMs: 15000};

jest.mock('@/config/variables', () => ({
  PASSWORDLESS_AUTH_CONFIG: mockPasswordlessConfig,
  API_CONFIG: mockApiConfig,
  PENDING_PROFILE_STORAGE_KEY: '@pending_profile_payload',
  PENDING_PROFILE_UPDATED_EVENT: 'pendingProfileUpdated',
}));

const mockConfigModule = (overrides?: Partial<typeof defaultPasswordlessConfig>) => {
  Object.assign(mockPasswordlessConfig, defaultPasswordlessConfig, overrides);
};

const baseAuthSyncResponse = {
  success: true,
  authUser: {
    _id: 'auth-user-id',
    authProvider: 'firebase',
    providerUserId: 'uid-123',
    email: 'test@example.com',
  },
  parentLinked: false,
  parentSummary: undefined,
};

describe('socialAuth', () => {
  const RN = require('react-native');
  const originalPlatform = RN.Platform.OS;

  beforeEach(() => {
    mockConfigModule();
    jest.clearAllMocks();
    mockSyncAuthUser.mockResolvedValue(baseAuthSyncResponse);
    RN.Platform.OS = originalPlatform;
  });

  it('configures social providers with configured IDs', () => {
    jest.isolateModules(() => {
      // Mock config with actual values
      mockConfigModule({
        googleWebClientId: 'test-google-client-id',
        facebookAppId: 'test-facebook-app-id',
        appleServiceId: 'com.test.app',
        appleRedirectUri: 'https://test.firebaseapp.com/__/auth/handler',
      });
      jest.doMock('@react-native-google-signin/google-signin', () => ({
        GoogleSignin: mockGoogle,
        statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED' },
      }), {virtual: true});
      jest.unmock('@/features/auth/services/socialAuth');
      const {configureSocialProviders} = require('@/features/auth/services/socialAuth');
      configureSocialProviders();

      // Assert inside isolateModules to access the mocked state
      expect(mockGoogle.configure).toHaveBeenCalledWith(
        expect.objectContaining({ webClientId: expect.any(String) })
      );
    });
  });

  it('signs in with Google and bootstraps profile when missing', async () => {
    let signInWithSocialProvider: any;
    jest.isolateModules(() => {
      mockConfigModule();
      jest.doMock('@react-native-google-signin/google-signin', () => ({
        GoogleSignin: mockGoogle,
        statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED' },
      }), {virtual: true});
      jest.unmock('@/features/auth/services/socialAuth');
      ({signInWithSocialProvider} = require('@/features/auth/services/socialAuth'));
    });
    const result = await signInWithSocialProvider('google');

    // Google path went through
    expect(mockGoogle.hasPlayServices).toHaveBeenCalled();
    expect(mockGoogle.signIn).toHaveBeenCalled();
    expect(mockGoogle.getTokens).toHaveBeenCalled();
    expect(mockFirebaseAuth.GoogleAuthProvider.credential).toHaveBeenCalledWith('google-id-token');
    expect(mockFirebaseAuth.signInWithCredential).toHaveBeenCalled();

    // Tokens built from user
    expect(result.tokens.idToken).toBe('id-jwt');
    expect(result.tokens.provider).toBe('firebase');

    // Name parsed from displayName
    expect(result.user.firstName).toBe('Ada');
    expect(result.user.lastName).toBe('Lovelace');
    expect(result.user.email).toBe('test@example.com');

    // Auth sync path
    expect(mockSyncAuthUser).toHaveBeenCalledWith({
      authToken: 'id-jwt',
      idToken: 'id-jwt',
    });
    expect(result.profile.exists).toBe(false);
    expect(result.profile.profileToken).toBeUndefined();
  });

  it('signs in with Google and returns existing profile if present', async () => {
    let signInWithSocialProvider: any;
    jest.isolateModules(() => {
      mockConfigModule();
      jest.doMock('@react-native-google-signin/google-signin', () => ({
        GoogleSignin: mockGoogle,
        statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED' },
      }), {virtual: true});
      jest.unmock('@/features/auth/services/socialAuth');
      ({signInWithSocialProvider} = require('@/features/auth/services/socialAuth'));
    });
    mockSyncAuthUser.mockResolvedValueOnce({
      ...baseAuthSyncResponse,
      parentLinked: true,
      parentSummary: {
        id: 'parent-123',
        firstName: 'Ada',
        lastName: 'Lovelace',
        isComplete: true,
        profileImageUrl: 'existing-token',
      },
    });

    const result = await signInWithSocialProvider('google');

    // Profile already exists
    expect(result.profile.profileToken).toBe('existing-token');
    expect(result.profile.exists).toBe(true);
    expect(result.user.parentId).toBe('parent-123');
    expect(result.parentLinked).toBe(true);
  });

  it('signs in with Facebook and bootstraps profile', async () => {
    const {LoginManager, AuthenticationToken} = require('react-native-fbsdk-next');
    RN.Platform.OS = 'ios';
    (LoginManager.logInWithPermissions as jest.Mock).mockResolvedValueOnce({ isCancelled: false });
    (AuthenticationToken.getAuthenticationTokenIOS as jest.Mock).mockResolvedValueOnce({
      authenticationToken: 'fb-auth-token',
    });

    let signInWithSocialProvider: any;
    jest.isolateModules(() => {
      mockConfigModule();
      jest.doMock('@react-native-google-signin/google-signin', () => ({
        GoogleSignin: mockGoogle,
        statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED' },
      }), {virtual: true});
      jest.unmock('@/features/auth/services/socialAuth');
      ({signInWithSocialProvider} = require('@/features/auth/services/socialAuth'));
    });

    mockSyncAuthUser.mockResolvedValueOnce({
      ...baseAuthSyncResponse,
      parentSummary: {
        id: 'parent-fb',
        firstName: 'John',
        lastName: 'Doe',
        profileImageUrl: 'fb-profile-token',
        isComplete: false,
      },
      parentLinked: false,
    });

    const result = await signInWithSocialProvider('facebook');
    expect(result.tokens.idToken).toBe('id-jwt');
    expect(result.profile.profileToken).toBe('fb-profile-token');
    expect(result.profile.exists).toBe(true);
    expect(LoginManager.logInWithPermissions).toHaveBeenCalledWith(
      ['public_profile', 'email'],
      'limited',
      '1d9664478addbe4ee7186c19b2a2c98e461a77dc1e183654f36916bf9fb51cba',
    );
    expect(mockFirebaseAuth.FacebookAuthProvider.credential).toHaveBeenCalledWith(
      'fb-auth-token',
      'nonce-123',
    );
  });

  it('signs in with Apple on iOS and resolves profile', async () => {
    const {appleAuth} = require('@invertase/react-native-apple-authentication');
    appleAuth.performRequest.mockResolvedValueOnce({
      identityToken: 'apple-token',
      nonce: 'nonce-123',
      fullName: { givenName: 'Ada', familyName: 'Lovelace' },
      email: 'ada@apple.example',
    });

    // Ensure iOS platform
    RN.Platform.OS = 'ios';

    let signInWithSocialProvider: any;
    jest.isolateModules(() => {
      mockConfigModule();
      jest.doMock('@react-native-google-signin/google-signin', () => ({
        GoogleSignin: mockGoogle,
        statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED' },
      }), {virtual: true});
      jest.unmock('@/features/auth/services/socialAuth');
      ({signInWithSocialProvider} = require('@/features/auth/services/socialAuth'));
    });

    const result = await signInWithSocialProvider('apple');
    expect(result.user.firstName).toBe('Ada');
    expect(result.user.lastName).toBe('Lovelace');
    expect(result.tokens.idToken).toBe('id-jwt');
  });

  it('maps Google cancel error to auth/cancelled', async () => {
    const cancelError = { code: 'SIGN_IN_CANCELLED' };
    let signInWithSocialProvider: any;
    jest.isolateModules(() => {
      jest.doMock('@react-native-google-signin/google-signin', () => ({
        GoogleSignin: {
          ...mockGoogle,
          signIn: jest.fn().mockRejectedValue(cancelError),
        },
        statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED' },
      }), {virtual: true});
      jest.unmock('@/features/auth/services/socialAuth');
      ({signInWithSocialProvider} = require('@/features/auth/services/socialAuth'));
    });

    await expect(signInWithSocialProvider('google')).rejects.toEqual(
      expect.objectContaining({ code: 'auth/cancelled' })
    );
  });

  it('facebook sign-in throws when authentication token missing on iOS', async () => {
    const {LoginManager, AuthenticationToken} = require('react-native-fbsdk-next');
    RN.Platform.OS = 'ios';
    (LoginManager.logInWithPermissions as jest.Mock).mockResolvedValueOnce({ isCancelled: false });
    (AuthenticationToken.getAuthenticationTokenIOS as jest.Mock).mockResolvedValueOnce(null);

    let signInWithSocialProvider: any;
    jest.isolateModules(() => {
      jest.doMock('@react-native-google-signin/google-signin', () => ({
        GoogleSignin: mockGoogle,
        statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED' },
      }), {virtual: true});
      jest.unmock('@/features/auth/services/socialAuth');
      ({signInWithSocialProvider} = require('@/features/auth/services/socialAuth'));
    });
    await expect(signInWithSocialProvider('facebook')).rejects.toThrow(/Missing authentication token/);
  });

  it('facebook sign-in throws when access token missing on Android', async () => {
    const {LoginManager, AccessToken} = require('react-native-fbsdk-next');
    RN.Platform.OS = 'android';
    (LoginManager.logInWithPermissions as jest.Mock).mockResolvedValueOnce({ isCancelled: false });
    (AccessToken.getCurrentAccessToken as jest.Mock).mockResolvedValueOnce({ accessToken: null });

    let signInWithSocialProvider: any;
    jest.isolateModules(() => {
      jest.doMock('@react-native-google-signin/google-signin', () => ({
        GoogleSignin: mockGoogle,
        statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED' },
      }), {virtual: true});
      jest.unmock('@/features/auth/services/socialAuth');
      ({signInWithSocialProvider} = require('@/features/auth/services/socialAuth'));
    });
    await expect(signInWithSocialProvider('facebook')).rejects.toThrow(/Missing access token/);
  });

  it('iOS Apple sign-in throws when identityToken missing', async () => {
    const {appleAuth} = require('@invertase/react-native-apple-authentication');
    RN.Platform.OS = 'ios';
    appleAuth.performRequest.mockResolvedValueOnce({ identityToken: null });

    let signInWithSocialProvider: any;
    jest.isolateModules(() => {
      jest.doMock('@react-native-google-signin/google-signin', () => ({
        GoogleSignin: mockGoogle,
        statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED' },
      }), {virtual: true});
      jest.unmock('@/features/auth/services/socialAuth');
      ({signInWithSocialProvider} = require('@/features/auth/services/socialAuth'));
    });
    await expect(signInWithSocialProvider('apple')).rejects.toThrow(/no identity token/);
  });

  it('handles Google missing idToken error', async () => {
    let signInWithSocialProvider: any;
    jest.isolateModules(() => {
      jest.doMock('@react-native-google-signin/google-signin', () => ({
        GoogleSignin: {
          ...mockGoogle,
          getTokens: jest.fn().mockResolvedValue({ idToken: null }),
        },
        statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED' },
      }), {virtual: true});
      jest.unmock('@/features/auth/services/socialAuth');
      ({signInWithSocialProvider} = require('@/features/auth/services/socialAuth'));
    });

    await expect(signInWithSocialProvider('google')).rejects.toThrow(
      /Missing ID token/
    );
  });

  it('maps Facebook cancel to auth/cancelled', async () => {
    const {LoginManager} = require('react-native-fbsdk-next');
    (LoginManager.logInWithPermissions as jest.Mock).mockResolvedValueOnce({ isCancelled: true });

    let signInWithSocialProvider: any;
    jest.isolateModules(() => {
      jest.doMock('@react-native-google-signin/google-signin', () => ({
        GoogleSignin: mockGoogle,
        statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED' },
      }), {virtual: true});
      jest.unmock('@/features/auth/services/socialAuth');
      ({signInWithSocialProvider} = require('@/features/auth/services/socialAuth'));
    });

    await expect(signInWithSocialProvider('facebook')).rejects.toThrow(/cancelled/i);
  });

  it('maps Apple specific auth errors to friendly messages', async () => {
    const {appleAuth} = require('@invertase/react-native-apple-authentication');
    RN.Platform.OS = 'ios';

    const cases = [
      { code: 'auth/invalid-credential', message: /Invalid Apple credentials/ },
      { code: 'auth/account-exists-with-different-credential', message: /An account already exists/ },
      { code: 'auth/missing-or-invalid-nonce', message: /invalid nonce/ },
      { code: 'auth/credential-already-in-use', message: /already linked/ },
      { code: undefined, message: /Invalid response/ , appleCode: 'INVALID_RESPONSE' },
      { code: undefined, message: /Please try again/ , appleCode: 'FAILED' },
      { code: undefined, message: /not supported/ , appleCode: 'NOT_HANDLED' },
      { code: undefined, message: /cancelled/ , appleCode: 'CANCELED' },
      { code: undefined, message: /Apple configuration error/ , extraMessage: 'invalid_client' },
    ];

    for (const c of cases) {
      appleAuth.performRequest.mockRejectedValueOnce({ code: c.appleCode ?? c.code, message: c.extraMessage });
      let signInWithSocialProvider: any;
      jest.isolateModules(() => {
        jest.doMock('@react-native-google-signin/google-signin', () => ({
          GoogleSignin: mockGoogle,
          statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED' },
        }), {virtual: true});
        jest.unmock('@/features/auth/services/socialAuth');
        ({signInWithSocialProvider} = require('@/features/auth/services/socialAuth'));
      });
      await expect(signInWithSocialProvider('apple')).rejects.toThrow(c.message);
    }
  });


  it('throws for unsupported provider', async () => {
    let signInWithSocialProvider: any;
    jest.isolateModules(() => {
      jest.doMock('@react-native-google-signin/google-signin', () => ({
        GoogleSignin: mockGoogle,
        statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED' },
      }), {virtual: true});
      jest.unmock('@/features/auth/services/socialAuth');
      ({signInWithSocialProvider} = require('@/features/auth/services/socialAuth'));
    });
    await expect(signInWithSocialProvider('unknown')).rejects.toThrow(/Unsupported social provider/);
  });

  // keep simple unsupported provider case to exercise switch default


  it('signs in with Apple on Android via web flow', async () => {
    const {appleAuthAndroid} = require('@invertase/react-native-apple-authentication');
    (appleAuthAndroid.signIn as jest.Mock).mockResolvedValueOnce({
      id_token: 'android-apple-token',
      user: { name: { firstName: 'Ada', lastName: 'Lovelace' }, email: 'ada@apple.example' },
    });
    RN.Platform.OS = 'android';

    let signInWithSocialProvider: any;
    jest.isolateModules(() => {
      jest.doMock('@react-native-google-signin/google-signin', () => ({
        GoogleSignin: mockGoogle,
        statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED' },
      }), {virtual: true});
      jest.unmock('@/features/auth/services/socialAuth');
      ({signInWithSocialProvider} = require('@/features/auth/services/socialAuth'));
    });

    mockSyncAuthUser.mockResolvedValueOnce({
      ...baseAuthSyncResponse,
      parentSummary: {
        id: 'parent-android',
        firstName: 'Ada',
        lastName: 'Lovelace',
        profileImageUrl: 'androidP',
        isComplete: true,
      },
      parentLinked: true,
    });
    const result = await signInWithSocialProvider('apple');
    expect(result.tokens.idToken).toBe('id-jwt');
    expect(result.user.firstName).toBe('Ada');
  });

  it('throws on Android Apple sign-in when id_token missing', async () => {
    const {appleAuthAndroid} = require('@invertase/react-native-apple-authentication');
    (appleAuthAndroid.signIn as jest.Mock).mockResolvedValueOnce({ id_token: undefined });
    RN.Platform.OS = 'android';

    let signInWithSocialProvider: any;
    jest.isolateModules(() => {
      jest.doMock('@react-native-google-signin/google-signin', () => ({
        GoogleSignin: mockGoogle,
        statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED' },
      }), {virtual: true});
      jest.unmock('@/features/auth/services/socialAuth');
      ({signInWithSocialProvider} = require('@/features/auth/services/socialAuth'));
    });

    await expect(signInWithSocialProvider('apple')).rejects.toThrow(/no id_token/);
  });
});
