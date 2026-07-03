// Note: The module is mocked in jest.setup.js. For these tests we unmock and require actual implementation.

// Mock uuid ESM to avoid transform issues
jest.mock('uuid', () => ({v4: jest.fn(() => 'nonce-123')}));

// Shared closure object so the same mock instance is used across
// jest.isolateModules registries.
const mockSuperTokens = {
  init: jest.fn(),
  signOut: jest.fn(),
  doesSessionExist: jest.fn(),
  getAccessToken: jest.fn(),
  getUserId: jest.fn(),
  attemptRefreshingSession: jest.fn(),
  addAxiosInterceptors: jest.fn(),
};
jest.mock('supertokens-react-native', () => ({
  __esModule: true,
  default: mockSuperTokens,
}));

const mockGoogle = {
  hasPlayServices: jest.fn().mockResolvedValue(true),
  signIn: jest.fn().mockResolvedValue({
    type: 'success',
    data: {
      user: {
        email: 'test@example.com',
        givenName: 'Ada',
        familyName: 'Lovelace',
        photo: 'https://example.com/avatar.png',
      },
    },
  }),
  getTokens: jest.fn().mockResolvedValue({
    idToken: 'google-id-token',
    accessToken: 'google-access-token',
  }),
  signOut: jest.fn().mockResolvedValue(undefined),
  configure: jest.fn(),
};

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
    Operation: {LOGIN: 'LOGIN'},
    Scope: {EMAIL: 'EMAIL', FULL_NAME: 'FULL_NAME'},
    Error: {
      CANCELED: 'CANCELED',
      FAILED: 'FAILED',
      INVALID_RESPONSE: 'INVALID_RESPONSE',
      NOT_HANDLED: 'NOT_HANDLED',
    },
  },
  appleAuthAndroid: {
    isSupported: true,
    configure: jest.fn(),
    signIn: jest.fn().mockResolvedValue({id_token: 'id-token'}),
    ResponseType: {ALL: 'ALL'},
    Scope: {ALL: 'ALL'},
  },
}));

const defaultPasswordlessConfig = {
  profileServiceUrl: 'https://example.com/profile',
  createAccountUrl: 'https://example.com/create',
  profileBootstrapUrl: 'https://example.com/bootstrap',
  googleWebClientId: 'test-google-client-id',
  facebookAppId: 'test-facebook-app-id',
  appleServiceId: 'com.test.app',
  appleRedirectUri: 'https://test.example.com/auth/handler',
};
const mockPasswordlessConfig = {...defaultPasswordlessConfig};
const mockApiConfig = {baseUrl: 'http://localhost:4000', timeoutMs: 15000};

jest.mock('@/config/variables', () => ({
  PASSWORDLESS_AUTH_CONFIG: mockPasswordlessConfig,
  API_CONFIG: mockApiConfig,
  PENDING_PROFILE_STORAGE_KEY: '@pending_profile_payload',
  PENDING_PROFILE_UPDATED_EVENT: 'pendingProfileUpdated',
}));

const mockConfigModule = (
  overrides?: Partial<typeof defaultPasswordlessConfig>,
) => {
  Object.assign(mockPasswordlessConfig, defaultPasswordlessConfig, overrides);
};

const baseAuthSyncResponse = {
  success: true,
  authUser: {
    _id: 'auth-user-id',
    authProvider: 'supertokens',
    providerUserId: 'st-user-1',
    email: 'test@example.com',
  },
  parentLinked: false,
  parentSummary: undefined,
};

const makeResponse = (body: unknown, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => body,
});

const okSignInUpBody = {
  status: 'OK',
  createdNewRecipeUser: true,
  user: {id: 'st-user-1', emails: ['test@example.com']},
};

const mockFetch = jest.fn();

const loadSocialAuth = (googleOverrides: Record<string, any> = {}) => {
  let mod: any;
  jest.isolateModules(() => {
    jest.doMock(
      '@react-native-google-signin/google-signin',
      () => ({
        GoogleSignin: {...mockGoogle, ...googleOverrides},
        statusCodes: {SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED'},
      }),
      {virtual: true},
    );
    jest.unmock('@/features/auth/services/socialAuth');
    mod = require('@/features/auth/services/socialAuth');
  });
  return mod;
};

describe('socialAuth', () => {
  const RN = require('react-native');
  const originalPlatform = RN.Platform.OS;

  beforeEach(() => {
    mockConfigModule();
    jest.clearAllMocks();
    (global as any).fetch = mockFetch;
    mockFetch.mockResolvedValue(makeResponse(okSignInUpBody));
    mockSuperTokens.getAccessToken.mockResolvedValue('st-access-token');
    mockSyncAuthUser.mockResolvedValue(baseAuthSyncResponse);
    RN.Platform.OS = originalPlatform;
  });

  afterAll(() => {
    RN.Platform.OS = originalPlatform;
  });

  it('configures social providers with configured IDs', () => {
    const {configureSocialProviders} = loadSocialAuth();
    configureSocialProviders();

    expect(mockGoogle.configure).toHaveBeenCalledWith(
      expect.objectContaining({webClientId: expect.any(String)}),
    );
  });

  it('configureSocialProviders handles missing googleWebClientId gracefully', () => {
    mockConfigModule({googleWebClientId: ''});
    const {configureSocialProviders} = loadSocialAuth();
    expect(() => configureSocialProviders()).not.toThrow();
  });

  it('configureSocialProviders handles missing facebookAppId gracefully', () => {
    mockConfigModule({
      googleWebClientId: 'test-client-id',
      facebookAppId: '',
    });
    const {configureSocialProviders} = loadSocialAuth();
    expect(() => configureSocialProviders()).not.toThrow();
  });

  it('configureSocialProviders skips reconfiguring when already configured', () => {
    const {configureSocialProviders} = loadSocialAuth();
    configureSocialProviders(); // first call
    jest.clearAllMocks();
    configureSocialProviders(); // second call — providersConfigured = true → early return
    expect(mockGoogle.configure).not.toHaveBeenCalled();
  });

  describe('google', () => {
    it('signs in with Google and exchanges the tokens with SuperTokens', async () => {
      const {signInWithSocialProvider} = loadSocialAuth();

      const result = await signInWithSocialProvider('google');

      // Native Google path went through untouched
      expect(mockGoogle.hasPlayServices).toHaveBeenCalled();
      expect(mockGoogle.signIn).toHaveBeenCalled();
      expect(mockGoogle.getTokens).toHaveBeenCalled();

      // Exchange step hits the SuperTokens FDI endpoint
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4000/auth/signinup',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            rid: 'thirdparty',
          }),
        }),
      );
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body).toEqual({
        thirdPartyId: 'google',
        oAuthTokens: {
          access_token: 'google-access-token',
          id_token: 'google-id-token',
        },
      });

      // SDK is initialized against the runtime API domain
      expect(mockSuperTokens.init).toHaveBeenCalledWith(
        expect.objectContaining({
          apiDomain: 'http://localhost:4000',
          apiBasePath: '/auth',
          tokenTransferMethod: 'header',
        }),
      );

      // Tokens come from the SuperTokens SDK
      expect(result.tokens.accessToken).toBe('st-access-token');
      expect(result.tokens.provider).toBe('supertokens');
      expect(result.tokens.userId).toBe('st-user-1');

      // Profile info from the native Google payload
      expect(result.user.firstName).toBe('Ada');
      expect(result.user.lastName).toBe('Lovelace');
      expect(result.user.email).toBe('test@example.com');
      expect(result.user.profilePicture).toBe('https://example.com/avatar.png');

      // Auth sync uses the SuperTokens access token
      expect(mockSyncAuthUser).toHaveBeenCalledWith({
        authToken: 'st-access-token',
      });
      expect(result.profile.exists).toBe(false);
      expect(result.profile.profileToken).toBeUndefined();
    });

    it('returns existing profile if the parent is already linked', async () => {
      const {signInWithSocialProvider} = loadSocialAuth();
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

      expect(result.profile.profileToken).toBe('existing-token');
      expect(result.profile.exists).toBe(true);
      expect(result.user.parentId).toBe('parent-123');
      expect(result.parentLinked).toBe(true);
    });

    it('maps Google cancel error to auth/cancelled', async () => {
      const {signInWithSocialProvider} = loadSocialAuth({
        signIn: jest.fn().mockRejectedValue({code: 'SIGN_IN_CANCELLED'}),
      });

      await expect(signInWithSocialProvider('google')).rejects.toEqual(
        expect.objectContaining({code: 'auth/cancelled'}),
      );
    });

    it('handles Google missing idToken error', async () => {
      const {signInWithSocialProvider} = loadSocialAuth({
        getTokens: jest.fn().mockResolvedValue({idToken: null}),
      });

      await expect(signInWithSocialProvider('google')).rejects.toThrow(
        /Missing ID token/,
      );
    });

    it('handles Google getTokens cancellation error (SIGN_IN_CANCELLED)', async () => {
      const {signInWithSocialProvider} = loadSocialAuth({
        getTokens: jest.fn().mockRejectedValue({
          code: 'SIGN_IN_CANCELLED',
          message: 'cancelled',
        }),
      });

      await expect(signInWithSocialProvider('google')).rejects.toThrow(
        /cancelled/i,
      );
    });

    it('handles Google getTokens generic error (no code → auth/cancelled fallback)', async () => {
      const {signInWithSocialProvider} = loadSocialAuth({
        getTokens: jest.fn().mockRejectedValue(new Error('Network error')),
      });

      await expect(signInWithSocialProvider('google')).rejects.toMatchObject({
        code: 'auth/cancelled',
      });
    });

    it('handles legacy google signIn result shape', async () => {
      const {signInWithSocialProvider} = loadSocialAuth({
        signIn: jest.fn().mockResolvedValue({
          user: {
            email: 'legacy@example.com',
            name: 'Grace Hopper',
            photo: null,
          },
        }),
      });

      const result = await signInWithSocialProvider('google');

      expect(result.user.firstName).toBe('Grace');
      expect(result.user.lastName).toBe('Hopper');
    });

    it('tolerates a signIn result without any profile payload', async () => {
      const {signInWithSocialProvider} = loadSocialAuth({
        signIn: jest.fn().mockResolvedValue(null),
      });

      const result = await signInWithSocialProvider('google');

      // Email falls back to the SuperTokens exchange response
      expect(result.user.email).toBe('test@example.com');
      expect(result.user.firstName).toBeUndefined();
    });
  });

  describe('facebook', () => {
    it('signs in with Facebook on iOS using the limited-login OIDC token', async () => {
      const {
        LoginManager,
        AuthenticationToken,
      } = require('react-native-fbsdk-next');
      RN.Platform.OS = 'ios';
      (LoginManager.logInWithPermissions as jest.Mock).mockResolvedValueOnce({
        isCancelled: false,
      });
      (
        AuthenticationToken.getAuthenticationTokenIOS as jest.Mock
      ).mockResolvedValueOnce({
        authenticationToken: 'fb-auth-token',
      });

      const {signInWithSocialProvider} = loadSocialAuth();
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

      expect(LoginManager.logInWithPermissions).toHaveBeenCalledWith(
        ['public_profile', 'email'],
        'limited',
        expect.any(String),
      );
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body).toEqual({
        thirdPartyId: 'facebook',
        oAuthTokens: {id_token: 'fb-auth-token'},
      });
      expect(result.tokens.accessToken).toBe('st-access-token');
      expect(result.profile.profileToken).toBe('fb-profile-token');
      expect(result.profile.exists).toBe(true);
    });

    it('signs in with Facebook on Android using the access token', async () => {
      const {LoginManager, AccessToken} = require('react-native-fbsdk-next');
      RN.Platform.OS = 'android';
      (LoginManager.logInWithPermissions as jest.Mock).mockResolvedValueOnce({
        isCancelled: false,
      });
      (AccessToken.getCurrentAccessToken as jest.Mock).mockResolvedValueOnce({
        accessToken: 'fb-access-token',
      });

      const {signInWithSocialProvider} = loadSocialAuth();
      const result = await signInWithSocialProvider('facebook');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body).toEqual({
        thirdPartyId: 'facebook',
        oAuthTokens: {access_token: 'fb-access-token'},
      });
      expect(result.user.email).toBe('test@example.com');
    });

    it('facebook sign-in throws when authentication token missing on iOS', async () => {
      const {
        LoginManager,
        AuthenticationToken,
      } = require('react-native-fbsdk-next');
      RN.Platform.OS = 'ios';
      (LoginManager.logInWithPermissions as jest.Mock).mockResolvedValueOnce({
        isCancelled: false,
      });
      (
        AuthenticationToken.getAuthenticationTokenIOS as jest.Mock
      ).mockResolvedValueOnce(null);

      const {signInWithSocialProvider} = loadSocialAuth();
      await expect(signInWithSocialProvider('facebook')).rejects.toThrow(
        /Missing authentication token/,
      );
    });

    it('facebook sign-in throws when access token missing on Android', async () => {
      const {LoginManager, AccessToken} = require('react-native-fbsdk-next');
      RN.Platform.OS = 'android';
      (LoginManager.logInWithPermissions as jest.Mock).mockResolvedValueOnce({
        isCancelled: false,
      });
      (AccessToken.getCurrentAccessToken as jest.Mock).mockResolvedValueOnce({
        accessToken: null,
      });

      const {signInWithSocialProvider} = loadSocialAuth();
      await expect(signInWithSocialProvider('facebook')).rejects.toThrow(
        /Missing access token/,
      );
    });

    it('maps Facebook cancel to auth/cancelled', async () => {
      const {LoginManager} = require('react-native-fbsdk-next');
      (LoginManager.logInWithPermissions as jest.Mock).mockResolvedValueOnce({
        isCancelled: true,
      });

      const {signInWithSocialProvider} = loadSocialAuth();
      await expect(signInWithSocialProvider('facebook')).rejects.toThrow(
        /cancelled/i,
      );
    });

    it('Facebook Android login cancellation throws auth/cancelled', async () => {
      const {LoginManager} = require('react-native-fbsdk-next');
      RN.Platform.OS = 'android';
      (LoginManager.logInWithPermissions as jest.Mock).mockResolvedValueOnce({
        isCancelled: true,
      });

      const {signInWithSocialProvider} = loadSocialAuth();
      await expect(signInWithSocialProvider('facebook')).rejects.toMatchObject({
        code: 'auth/cancelled',
      });
    });
  });

  describe('apple', () => {
    it('signs in with Apple on iOS via the authorization-code flow', async () => {
      const {
        appleAuth,
      } = require('@invertase/react-native-apple-authentication');
      RN.Platform.OS = 'ios';
      appleAuth.performRequest.mockResolvedValueOnce({
        identityToken: 'apple-id-token',
        authorizationCode: 'apple-auth-code',
        nonce: 'nonce-123',
        fullName: {givenName: 'Ada', familyName: 'Lovelace'},
        email: 'ada@apple.example',
      });

      const {signInWithSocialProvider} = loadSocialAuth();
      const result = await signInWithSocialProvider('apple');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body).toEqual({
        thirdPartyId: 'apple',
        redirectURIInfo: {
          redirectURIOnProviderDashboard: '',
          redirectURIQueryParams: {
            code: 'apple-auth-code',
            id_token: 'apple-id-token',
          },
        },
      });
      expect(result.user.firstName).toBe('Ada');
      expect(result.user.lastName).toBe('Lovelace');
      expect(result.tokens.accessToken).toBe('st-access-token');
    });

    it('falls back to oAuthTokens when no authorization code is returned on iOS', async () => {
      const {
        appleAuth,
      } = require('@invertase/react-native-apple-authentication');
      RN.Platform.OS = 'ios';
      appleAuth.performRequest.mockResolvedValueOnce({
        identityToken: 'apple-id-token',
        authorizationCode: null,
        nonce: 'nonce-123',
        fullName: {givenName: 'Ada', familyName: 'Lovelace'},
        email: 'ada@apple.example',
      });

      const {signInWithSocialProvider} = loadSocialAuth();
      await signInWithSocialProvider('apple');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body).toEqual({
        thirdPartyId: 'apple',
        oAuthTokens: {id_token: 'apple-id-token'},
      });
    });

    it('iOS Apple sign-in throws when identityToken missing', async () => {
      const {
        appleAuth,
      } = require('@invertase/react-native-apple-authentication');
      RN.Platform.OS = 'ios';
      appleAuth.performRequest.mockResolvedValueOnce({identityToken: null});

      const {signInWithSocialProvider} = loadSocialAuth();
      await expect(signInWithSocialProvider('apple')).rejects.toThrow(
        /no identity token/,
      );
    });

    it('signs in with Apple on Android via web flow', async () => {
      const {
        appleAuthAndroid,
      } = require('@invertase/react-native-apple-authentication');
      (appleAuthAndroid.signIn as jest.Mock).mockResolvedValueOnce({
        id_token: 'android-apple-token',
        user: {
          name: {firstName: 'Ada', lastName: 'Lovelace'},
          email: 'ada@apple.example',
        },
      });
      RN.Platform.OS = 'android';

      const {signInWithSocialProvider} = loadSocialAuth();
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

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body).toEqual({
        thirdPartyId: 'apple',
        oAuthTokens: {id_token: 'android-apple-token'},
      });
      expect(result.tokens.accessToken).toBe('st-access-token');
      expect(result.user.firstName).toBe('Ada');
    });

    it('throws on Android Apple sign-in when id_token missing', async () => {
      const {
        appleAuthAndroid,
      } = require('@invertase/react-native-apple-authentication');
      (appleAuthAndroid.signIn as jest.Mock).mockResolvedValueOnce({
        id_token: undefined,
      });
      RN.Platform.OS = 'android';

      const {signInWithSocialProvider} = loadSocialAuth();
      await expect(signInWithSocialProvider('apple')).rejects.toThrow(
        /no id_token/,
      );
    });

    it('Android Apple sign-in throws when not supported', async () => {
      const {
        appleAuthAndroid,
      } = require('@invertase/react-native-apple-authentication');
      RN.Platform.OS = 'android';
      (appleAuthAndroid as any).isSupported = false;

      const {signInWithSocialProvider} = loadSocialAuth();
      await expect(signInWithSocialProvider('apple')).rejects.toThrow(
        /Android API 19\+/,
      );

      // restore
      (appleAuthAndroid as any).isSupported = true;
    });

    it('Android Apple sign-in throws when appleServiceId or redirectUri missing', async () => {
      RN.Platform.OS = 'android';
      mockConfigModule({appleServiceId: '', appleRedirectUri: ''});

      const {signInWithSocialProvider} = loadSocialAuth();
      await expect(signInWithSocialProvider('apple')).rejects.toThrow(
        /appleServiceId or appleRedirectUri/,
      );
    });

    it('Apple sign-in on unsupported platform throws mapped error', async () => {
      RN.Platform.OS = 'web';

      const {signInWithSocialProvider} = loadSocialAuth();
      await expect(signInWithSocialProvider('apple')).rejects.toThrow(
        /not supported on this platform/,
      );
    });

    it('maps Apple specific auth errors to friendly messages', async () => {
      const {
        appleAuth,
      } = require('@invertase/react-native-apple-authentication');
      RN.Platform.OS = 'ios';

      const cases = [
        {
          code: 'auth/account-exists-with-different-credential',
          message: /An account already exists/,
        },
        {
          code: undefined,
          message: /Invalid response/,
          appleCode: 'INVALID_RESPONSE',
        },
        {code: undefined, message: /Please try again/, appleCode: 'FAILED'},
        {code: undefined, message: /not supported/, appleCode: 'NOT_HANDLED'},
        {code: undefined, message: /cancelled/, appleCode: 'CANCELED'},
        {
          code: undefined,
          message: /Apple configuration error/,
          extraMessage: 'invalid_client',
        },
      ];

      for (const c of cases) {
        appleAuth.performRequest.mockRejectedValueOnce({
          code: c.appleCode ?? c.code,
          message: c.extraMessage,
        });
        const {signInWithSocialProvider} = loadSocialAuth();
        await expect(signInWithSocialProvider('apple')).rejects.toThrow(
          c.message,
        );
      }
    });

    it('uses the cached Apple profile when Apple omits the name', async () => {
      const Keychain = require('react-native-keychain');
      (Keychain.getGenericPassword as jest.Mock).mockResolvedValueOnce({
        username: 'apple-profile',
        password: JSON.stringify({
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'jane@apple.com',
        }),
      });

      const {
        appleAuth,
      } = require('@invertase/react-native-apple-authentication');
      RN.Platform.OS = 'ios';
      appleAuth.performRequest.mockResolvedValueOnce({
        identityToken: 'apple-token',
        authorizationCode: 'apple-code',
        nonce: 'nonce-123',
        email: null,
        fullName: {givenName: null, familyName: null},
      });
      // Exchange returns no email either — cache supplies it
      mockFetch.mockResolvedValueOnce(
        makeResponse({
          status: 'OK',
          createdNewRecipeUser: false,
          user: {id: 'st-apple-1', emails: []},
        }),
      );

      const {signInWithSocialProvider} = loadSocialAuth();
      const result = await signInWithSocialProvider('apple');

      expect(result.user.firstName).toBe('Jane');
      expect(result.user.email).toBe('jane@apple.com');
    });

    it('caches the Apple profile keyed by the SuperTokens user id', async () => {
      const Keychain = require('react-native-keychain');
      (Keychain.getGenericPassword as jest.Mock).mockResolvedValueOnce(null);

      const {
        appleAuth,
      } = require('@invertase/react-native-apple-authentication');
      RN.Platform.OS = 'ios';
      appleAuth.performRequest.mockResolvedValueOnce({
        identityToken: 'apple-token',
        authorizationCode: 'apple-code',
        nonce: 'nonce-123',
        email: 'user@apple.com',
        fullName: {givenName: 'Apple', familyName: 'Tester'},
      });
      mockFetch.mockResolvedValueOnce(
        makeResponse({
          status: 'OK',
          createdNewRecipeUser: true,
          user: {id: 'st-apple-2', emails: ['user@apple.com']},
        }),
      );

      const {signInWithSocialProvider} = loadSocialAuth();
      const result = await signInWithSocialProvider('apple');

      expect(Keychain.setGenericPassword).toHaveBeenCalledWith(
        'apple-profile',
        JSON.stringify({
          firstName: 'Apple',
          lastName: 'Tester',
          email: 'user@apple.com',
        }),
        expect.objectContaining({
          service: 'yosemite-apple-profile-st-apple-2',
        }),
      );
      expect(result.user.firstName).toBe('Apple');
    });

    it('continues when the Apple profile cache is unreadable', async () => {
      const Keychain = require('react-native-keychain');
      const AsyncStorage = jest.requireMock(
        '@react-native-async-storage/async-storage',
      );
      (Keychain.getGenericPassword as jest.Mock).mockRejectedValueOnce(
        new Error('Keychain locked'),
      );
      (AsyncStorage.removeItem as jest.Mock).mockRejectedValueOnce(
        new Error('storage error'),
      );

      const {
        appleAuth,
      } = require('@invertase/react-native-apple-authentication');
      RN.Platform.OS = 'ios';
      appleAuth.performRequest.mockResolvedValueOnce({
        identityToken: 'apple-token',
        authorizationCode: 'apple-code',
        nonce: 'nonce-123',
        email: 'direct@apple.com',
        fullName: {givenName: 'Direct', familyName: 'User'},
      });

      const {signInWithSocialProvider} = loadSocialAuth();
      const result = await signInWithSocialProvider('apple');

      expect(result.user.email).toBe('test@example.com');
      expect(result.user.firstName).toBe('Direct');
    });

    it('continues when caching the Apple profile fails', async () => {
      const Keychain = require('react-native-keychain');
      (Keychain.setGenericPassword as jest.Mock).mockRejectedValueOnce(
        new Error('Keychain write failed'),
      );

      const {
        appleAuth,
      } = require('@invertase/react-native-apple-authentication');
      RN.Platform.OS = 'ios';
      appleAuth.performRequest.mockResolvedValueOnce({
        identityToken: 'apple-token',
        authorizationCode: 'apple-code',
        nonce: 'nonce-123',
        email: 'user@apple.com',
        fullName: {givenName: 'KeyFail', familyName: 'User'},
      });

      const {signInWithSocialProvider} = loadSocialAuth();
      const result = await signInWithSocialProvider('apple');
      expect(result.user.email).toBe('test@example.com');
    });
  });

  describe('SuperTokens exchange errors', () => {
    it('maps SIGN_IN_UP_NOT_ALLOWED to an account-exists error', async () => {
      mockFetch.mockResolvedValueOnce(
        makeResponse({
          status: 'SIGN_IN_UP_NOT_ALLOWED',
          reason: 'Cannot sign in / up due to security reasons.',
        }),
      );

      const {signInWithSocialProvider} = loadSocialAuth();
      await expect(signInWithSocialProvider('google')).rejects.toMatchObject({
        code: 'auth/account-exists-with-different-credential',
        message: 'Cannot sign in / up due to security reasons.',
      });
    });

    it('maps SIGN_IN_UP_NOT_ALLOWED without a reason to the default message', async () => {
      mockFetch.mockResolvedValueOnce(
        makeResponse({status: 'SIGN_IN_UP_NOT_ALLOWED'}),
      );

      const {signInWithSocialProvider} = loadSocialAuth();
      await expect(signInWithSocialProvider('google')).rejects.toThrow(
        /existing login method/i,
      );
    });

    it('surfaces GENERAL_ERROR messages from the backend', async () => {
      mockFetch.mockResolvedValueOnce(
        makeResponse({status: 'GENERAL_ERROR', message: 'Provider is down.'}),
      );

      const {signInWithSocialProvider} = loadSocialAuth();
      await expect(signInWithSocialProvider('google')).rejects.toThrow(
        'Provider is down.',
      );
    });

    it('falls back to a generic message when the response is unparseable', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error('bad json');
        },
      });

      const {signInWithSocialProvider} = loadSocialAuth();
      await expect(signInWithSocialProvider('google')).rejects.toThrow(
        /Social sign-in failed/,
      );
    });

    it('throws when the response is OK but has no user id', async () => {
      mockFetch.mockResolvedValueOnce(makeResponse({status: 'OK', user: {}}));

      const {signInWithSocialProvider} = loadSocialAuth();
      await expect(signInWithSocialProvider('google')).rejects.toThrow(
        /Missing user in response/,
      );
    });

    it('throws when the SDK has no access token after the exchange', async () => {
      mockSuperTokens.getAccessToken.mockResolvedValueOnce(undefined);

      const {signInWithSocialProvider} = loadSocialAuth();
      await expect(signInWithSocialProvider('google')).rejects.toThrow(
        /tokens are missing/i,
      );
    });

    it('throws when no email is available from the provider or exchange', async () => {
      mockFetch.mockResolvedValueOnce(
        makeResponse({
          status: 'OK',
          createdNewRecipeUser: true,
          user: {id: 'st-user-2', emails: []},
        }),
      );

      const {signInWithSocialProvider} = loadSocialAuth({
        signIn: jest.fn().mockResolvedValue({data: {user: {}}}),
      });
      await expect(signInWithSocialProvider('google')).rejects.toThrow(
        /email address/i,
      );
    });
  });

  it('handles syncAuthUser failure gracefully', async () => {
    mockSyncAuthUser.mockRejectedValueOnce(new Error('sync failed'));

    const {signInWithSocialProvider} = loadSocialAuth();
    const result = await signInWithSocialProvider('google');

    // Should still succeed with default empty profile
    expect(result.profile.exists).toBe(false);
  });

  it('throws for unsupported provider', async () => {
    const {signInWithSocialProvider} = loadSocialAuth();
    await expect(signInWithSocialProvider('unknown')).rejects.toThrow(
      /Unsupported social provider/,
    );
  });
});
