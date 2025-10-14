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
  getAuth: jest.fn(() => ({ /* auth instance */ })),
  signInWithCredential: jest.fn(async (_auth, _cred) => ({
    user: mockAuthUser(),
  })),
  GoogleAuthProvider: { credential: jest.fn(token => ({ provider: 'google', token })) },
  FacebookAuthProvider: { credential: jest.fn(token => ({ provider: 'facebook', token })) },
  AppleAuthProvider: { credential: jest.fn((token, nonce) => ({ provider: 'apple', token, nonce })) },
};
jest.mock('@react-native-firebase/auth', () => mockFirebaseAuth);

// Mock profile service with safe hoisted names
const mockFetchProfileStatus = jest.fn();
const mockBootstrapProfile = jest.fn();
jest.mock('@/services/profile/profileService', () => ({
  fetchProfileStatus: mockFetchProfileStatus,
  bootstrapProfile: mockBootstrapProfile,
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

describe('socialAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('configures social providers with configured IDs', () => {
    jest.isolateModules(() => {
      // Mock config with actual values
      jest.doMock('@/config/variables', () => ({
        PASSWORDLESS_AUTH_CONFIG: {
          profileServiceUrl: 'https://example.com/profile',
          createAccountUrl: 'https://example.com/create',
          profileBootstrapUrl: 'https://example.com/bootstrap',
          googleWebClientId: 'test-google-client-id',
          facebookAppId: 'test-facebook-app-id',
          appleServiceId: 'com.test.app',
          appleRedirectUri: 'https://test.firebaseapp.com/__/auth/handler',
        },
      }));
      jest.doMock('@react-native-google-signin/google-signin', () => ({
        GoogleSignin: mockGoogle,
        statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED' },
      }), {virtual: true});
      jest.unmock('@/services/auth/socialAuth');
      const {configureSocialProviders} = require('@/services/auth/socialAuth');
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
      jest.doMock('@react-native-google-signin/google-signin', () => ({
        GoogleSignin: mockGoogle,
        statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED' },
      }), {virtual: true});
      jest.unmock('@/services/auth/socialAuth');
      ({signInWithSocialProvider} = require('@/services/auth/socialAuth'));
    });
    // Profile does not exist; bootstrap creates it and returns token
    mockFetchProfileStatus.mockResolvedValueOnce({ exists: false });
    mockBootstrapProfile.mockResolvedValueOnce({ profileToken: 'profile-token' });

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
    
    // Profile bootstrap path
    expect(mockFetchProfileStatus).toHaveBeenCalled();
    expect(mockBootstrapProfile).toHaveBeenCalled();
    expect(result.profile.profileToken).toBe('profile-token');
  });

  it('signs in with Google and returns existing profile if present', async () => {
    let signInWithSocialProvider: any;
    jest.isolateModules(() => {
      jest.doMock('@react-native-google-signin/google-signin', () => ({
        GoogleSignin: mockGoogle,
        statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED' },
      }), {virtual: true});
      jest.unmock('@/services/auth/socialAuth');
      ({signInWithSocialProvider} = require('@/services/auth/socialAuth'));
    });
    mockFetchProfileStatus.mockResolvedValueOnce({
      exists: true,
      profileToken: 'existing-token',
      source: 'remote',
    });

    const result = await signInWithSocialProvider('google');

    // Should not bootstrap when profile already exists
    expect(mockBootstrapProfile).not.toHaveBeenCalled();
    expect(result.profile.profileToken).toBe('existing-token');
  });

  it('signs in with Facebook and bootstraps profile', async () => {
    const {LoginManager, AccessToken} = require('react-native-fbsdk-next');
    (LoginManager.logInWithPermissions as jest.Mock).mockResolvedValueOnce({ isCancelled: false });
    (AccessToken.getCurrentAccessToken as jest.Mock).mockResolvedValueOnce({ accessToken: 'fb-access' });

    let signInWithSocialProvider: any;
    jest.isolateModules(() => {
      jest.doMock('@react-native-google-signin/google-signin', () => ({
        GoogleSignin: mockGoogle,
        statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED' },
      }), {virtual: true});
      jest.unmock('@/services/auth/socialAuth');
      ({signInWithSocialProvider} = require('@/services/auth/socialAuth'));
    });

    mockFetchProfileStatus.mockResolvedValueOnce({ exists: false });
    mockBootstrapProfile.mockResolvedValueOnce({ profileToken: 'fb-profile-token' });

    const result = await signInWithSocialProvider('facebook');
    expect(result.tokens.idToken).toBe('id-jwt');
    expect(result.profile.profileToken).toBe('fb-profile-token');
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
    const RN = require('react-native');
    RN.Platform.OS = 'ios';

    let signInWithSocialProvider: any;
    jest.isolateModules(() => {
      jest.doMock('@react-native-google-signin/google-signin', () => ({
        GoogleSignin: mockGoogle,
        statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED' },
      }), {virtual: true});
      jest.unmock('@/services/auth/socialAuth');
      ({signInWithSocialProvider} = require('@/services/auth/socialAuth'));
    });

    mockFetchProfileStatus.mockResolvedValueOnce({ exists: true, profileToken: 'p' });
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
      jest.unmock('@/services/auth/socialAuth');
      ({signInWithSocialProvider} = require('@/services/auth/socialAuth'));
    });

    await expect(signInWithSocialProvider('google')).rejects.toEqual(
      expect.objectContaining({ code: 'auth/cancelled' })
    );
  });

  it('facebook sign-in throws when access token missing', async () => {
    const {LoginManager, AccessToken} = require('react-native-fbsdk-next');
    (LoginManager.logInWithPermissions as jest.Mock).mockResolvedValueOnce({ isCancelled: false });
    (AccessToken.getCurrentAccessToken as jest.Mock).mockResolvedValueOnce({ accessToken: null });

    let signInWithSocialProvider: any;
    jest.isolateModules(() => {
      jest.doMock('@react-native-google-signin/google-signin', () => ({
        GoogleSignin: mockGoogle,
        statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED' },
      }), {virtual: true});
      jest.unmock('@/services/auth/socialAuth');
      ({signInWithSocialProvider} = require('@/services/auth/socialAuth'));
    });
    await expect(signInWithSocialProvider('facebook')).rejects.toThrow(/Missing access token/);
  });

  it('iOS Apple sign-in throws when identityToken missing', async () => {
    const {appleAuth} = require('@invertase/react-native-apple-authentication');
    const RN = require('react-native');
    RN.Platform.OS = 'ios';
    appleAuth.performRequest.mockResolvedValueOnce({ identityToken: null });

    let signInWithSocialProvider: any;
    jest.isolateModules(() => {
      jest.doMock('@react-native-google-signin/google-signin', () => ({
        GoogleSignin: mockGoogle,
        statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED' },
      }), {virtual: true});
      jest.unmock('@/services/auth/socialAuth');
      ({signInWithSocialProvider} = require('@/services/auth/socialAuth'));
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
      jest.unmock('@/services/auth/socialAuth');
      ({signInWithSocialProvider} = require('@/services/auth/socialAuth'));
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
      jest.unmock('@/services/auth/socialAuth');
      ({signInWithSocialProvider} = require('@/services/auth/socialAuth'));
    });

    await expect(signInWithSocialProvider('facebook')).rejects.toThrow(/cancelled/i);
  });

  it('maps Apple specific auth errors to friendly messages', async () => {
    const {appleAuth} = require('@invertase/react-native-apple-authentication');
    const RN = require('react-native');
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
        jest.unmock('@/services/auth/socialAuth');
        ({signInWithSocialProvider} = require('@/services/auth/socialAuth'));
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
      jest.unmock('@/services/auth/socialAuth');
      ({signInWithSocialProvider} = require('@/services/auth/socialAuth'));
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
    const RN = require('react-native');
    RN.Platform.OS = 'android';

    let signInWithSocialProvider: any;
    jest.isolateModules(() => {
      jest.doMock('@react-native-google-signin/google-signin', () => ({
        GoogleSignin: mockGoogle,
        statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED' },
      }), {virtual: true});
      jest.unmock('@/services/auth/socialAuth');
      ({signInWithSocialProvider} = require('@/services/auth/socialAuth'));
    });

    mockFetchProfileStatus.mockResolvedValueOnce({ exists: true, profileToken: 'androidP' });
    const result = await signInWithSocialProvider('apple');
    expect(result.tokens.idToken).toBe('id-jwt');
    expect(result.user.firstName).toBe('Ada');
  });

  it('throws on Android Apple sign-in when id_token missing', async () => {
    const {appleAuthAndroid} = require('@invertase/react-native-apple-authentication');
    (appleAuthAndroid.signIn as jest.Mock).mockResolvedValueOnce({ id_token: undefined });
    const RN = require('react-native');
    RN.Platform.OS = 'android';

    let signInWithSocialProvider: any;
    jest.isolateModules(() => {
      jest.doMock('@react-native-google-signin/google-signin', () => ({
        GoogleSignin: mockGoogle,
        statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED' },
      }), {virtual: true});
      jest.unmock('@/services/auth/socialAuth');
      ({signInWithSocialProvider} = require('@/services/auth/socialAuth'));
    });

    await expect(signInWithSocialProvider('apple')).rejects.toThrow(/no id_token/);
  });
});
